const model = require('../models/model');
const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

async function create_categories(req, res) {
    const Create = new model.Categories({ type: 'Investment', color: '#FCBE44' });
    await Create.save(function (err) {
        if (!err) return res.json(Create);
        return res.status(400).json({ message: 'Error creating categories: ' + err });
    });
}
async function get_categories(req, res) {
    let data = await model.Categories.find({});
    return res.json(data.map(v => ({ type: v.type, color: v.color })));
}
async function create_transaction(req, res) {
    if (!req.body) return res.status(400).json('Post HTTP Data not Provided');
    let { name, type, amount } = req.body;
    const create = new model.Transaction({ name, type, amount, date: new Date() });
    create.save(function (err) {
        if (!err) return res.json(create);
        return res.status(400).json({ message: 'Error creating transaction: ' + err });
    });
}
async function get_transaction(req, res) {
    return res.json(await model.Transaction.find({}));
}
async function delete_transaction(req, res) {
    if (!req.body) return res.status(400).json({ message: 'Request body not found' });
    await model.Transaction.deleteOne(req.body, function (err) {
        if (!err) return res.json('Record Deleted...!');
    }).clone().catch(function (err) { if (err) res.json('Error deleting Transaction'); });
}
async function get_labels(req, res) {
    model.Transaction.aggregate([
        { $lookup: { from: 'categories', localField: 'type', foreignField: 'type', as: 'categories_info' } },
        { $unwind: '$categories_info' }
    ]).then(result => {
        res.json(result.map(v => ({ _id: v._id, name: v.name, type: v.type, amount: v.amount, color: v.categories_info['color'] })));
    }).catch(() => res.status(400).json('Lookup Collection Error'));
}
// -- Budget Management (ER-01) --
const MONTH_RE = /^[0-9]{4}-[0-9]{2}$/;
function validateBudgetBody(month, overall, categoryBudgets) {
    if (!month || !MONTH_RE.test(month)) return 'Valid month in YYYY-MM format is required';
    if (overall === undefined || overall === null || isNaN(Number(overall)) || Number(overall) < 0)
        return 'Overall budget must be a non-negative number';
    if (categoryBudgets !== undefined) {
        if (!Array.isArray(categoryBudgets)) return 'categoryBudgets must be an array';
        for (const cb of categoryBudgets) {
            if (!cb.type) return 'Each category budget must have a type';
            if (cb.amount === undefined || isNaN(Number(cb.amount)) || Number(cb.amount) < 0)
                return 'Each category budget amount must be non-negative';
        }
    }
    return null;
}
function calcPace(spent, budgetAmt, daysElapsed, daysInMonth) {
    if (budgetAmt <= 0 || daysInMonth <= 0) return { status: 'N/A', expectedSpend: 0 };
    const expectedSpend = (budgetAmt / daysInMonth) * daysElapsed;
    if (daysElapsed === 0) return { status: 'On track', expectedSpend: 0 };
    const ratio = spent / expectedSpend;
    const status = ratio <= 1.0 ? 'On track' : ratio <= 1.2 ? 'At risk' : 'Off track';
    return { status, expectedSpend: Math.round(expectedSpend * 100) / 100 };
}
async function create_budget(req, res) {
    if (!req.body) return res.status(400).json({ message: 'Request body not provided' });
    const { month, overall, categoryBudgets } = req.body;
    const valErr = validateBudgetBody(month, overall, categoryBudgets);
    if (valErr) return res.status(400).json({ message: valErr });
    try {
        const existing = await model.Budget.findOne({ month });
        if (existing) return res.status(409).json({ message: 'Budget for ' + month + ' already exists. Use PUT to update.' });
        const budget = new model.Budget({ month, overall: Number(overall),
            categoryBudgets: (categoryBudgets || []).map(cb => ({ type: cb.type, amount: Number(cb.amount) })) });
        await budget.save();
        return res.status(201).json(budget);
    } catch (e) { return res.status(400).json({ message: 'Error creating budget: ' + e.message }); }
}
async function get_budgets(req, res) {
    try {
        return res.json(await model.Budget.find({}).sort({ month: -1 }));
    } catch (e) { return res.status(400).json({ message: 'Error fetching budgets: ' + e.message }); }
}
async function get_budget(req, res) {
    const { month } = req.params;
    try {
        const budget = await model.Budget.findOne({ month });
        if (!budget) return res.status(404).json({ message: 'Budget for ' + month + ' not found' });
        return res.json(budget);
    } catch (e) { return res.status(400).json({ message: 'Error fetching budget: ' + e.message }); }
}
async function update_budget(req, res) {
    const { month } = req.params;
    if (!req.body) return res.status(400).json({ message: 'Request body not provided' });
    const { overall, categoryBudgets } = req.body;
    const valErr = validateBudgetBody(month, overall, categoryBudgets);
    if (valErr) return res.status(400).json({ message: valErr });
    try {
        const budget = await model.Budget.findOneAndUpdate({ month },
            { $set: { overall: Number(overall), categoryBudgets: (categoryBudgets || []).map(cb => ({ type: cb.type, amount: Number(cb.amount) })) } },
            { new: true, runValidators: true });
        if (!budget) return res.status(404).json({ message: 'Budget for ' + month + ' not found' });
        return res.json(budget);
    } catch (e) { return res.status(400).json({ message: 'Error updating budget: ' + e.message }); }
}
async function delete_budget(req, res) {
    const { month } = req.params;
    try {
        const result = await model.Budget.deleteOne({ month });
        if (result.deletedCount === 0) return res.status(404).json({ message: 'Budget for ' + month + ' not found' });
        return res.json({ message: 'Budget for ' + month + ' deleted' });
    } catch (e) { return res.status(400).json({ message: 'Error deleting budget: ' + e.message }); }
}
async function get_utilization(req, res) {
    const { month } = req.params;
    try {
        const budget = await model.Budget.findOne({ month });
        if (!budget) return res.status(404).json({ message: 'Budget for ' + month + ' not found' });
        const [year, monthNum] = month.split('-').map(Number);
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
        const txns = await model.Transaction.find({ date: { $gte: startDate, $lte: endDate } });
        const totalSpent = txns.reduce((s, t) => s + (t.amount || 0), 0);
        const spentByCat = {};
        txns.forEach(t => { spentByCat[t.type] = (spentByCat[t.type] || 0) + (t.amount || 0); });
        const today = new Date();
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        const cy = today.getFullYear(), cm = today.getMonth() + 1;
        let daysElapsed = (year < cy || (year === cy && monthNum < cm)) ? daysInMonth
            : (year === cy && monthNum === cm) ? today.getDate() : 0;
        const op = calcPace(totalSpent, budget.overall, daysElapsed, daysInMonth);
        const overall = { budget: budget.overall, spent: totalSpent,
            remaining: Math.max(0, budget.overall - totalSpent),
            percentUsed: budget.overall > 0 ? Math.round((totalSpent / budget.overall) * 100) : 0,
            pace: { daysElapsed, daysInMonth, expectedSpend: op.expectedSpend, status: op.status } };
        const byCategory = budget.categoryBudgets.map(cb => {
            const spent = spentByCat[cb.type] || 0;
            const p = calcPace(spent, cb.amount, daysElapsed, daysInMonth);
            return { type: cb.type, budget: cb.amount, spent,
                remaining: Math.max(0, cb.amount - spent),
                percentUsed: cb.amount > 0 ? Math.round((spent / cb.amount) * 100) : 0,
                pace: { daysElapsed, daysInMonth, expectedSpend: p.expectedSpend, status: p.status } };
        });
        return res.json({ month, utilization: { overall, byCategory } });
    } catch (e) { return res.status(400).json({ message: 'Error computing utilization: ' + e.message }); }
}
module.exports = {
    create_categories, get_categories,
    create_transaction, get_transaction, delete_transaction,
    get_labels,
    create_budget, get_budgets, get_budget, update_budget, delete_budget,
    get_utilization
};

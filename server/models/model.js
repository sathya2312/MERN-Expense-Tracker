const mongoose = require('mongoose');

const Schema = mongoose.Schema;

// categories => field => ['type', 'color']
const categories_model = new Schema({
    type: { type: String, default: 'Investment'},
    color: { type: String, default: '#FCBE44' }
})

// transactions => field => ['name', 'type', 'amount', 'date']
const transaction_model = new Schema({
    name: { type: String, default: 'Anonymous'},
    type: { type: String, default: 'Investment'},
    amount: { type: Number },
    date: { type: Date, default: Date.now}
})

// budget category sub-schema
const category_budget_schema = new Schema({
    type: { type: String, required: true },
    amount: { type: Number, required: true, min: [0, 'Category budget amount must be non-negative'] }
}, { _id: false });

// budget => field => ['month', 'overall', 'categoryBudgets']
// month uniqueness enforces one budget per month (no user auth in this app)
const budget_model = new Schema({
    month: {
        type: String,
        required: [true, 'Month is required'],
        unique: true,
        match: [/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format']
    },
    overall: {
        type: Number,
        required: [true, 'Overall budget amount is required'],
        min: [0, 'Overall budget amount must be non-negative']
    },
    categoryBudgets: { type: [category_budget_schema], default: [] }
}, { timestamps: true });

const Categories = mongoose.model('categories', categories_model);
const Transaction = mongoose.model('transaction', transaction_model);
const Budget = mongoose.model('budget', budget_model);

exports.default = Transaction;
module.exports = {
    Categories,
    Transaction,
    Budget
}

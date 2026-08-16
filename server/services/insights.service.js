const model = require('../models/model');
const { getMonthRange } = require('./period');

async function getBudgetVsActual(period) {
  const budget = await model.Budget.findOne({ month: period });
  if (!budget) {
    const err = new Error('Budget for ' + period + ' not found');
    err.statusCode = 404;
    throw err;
  }
  const { startDate, endDate } = getMonthRange(period);

  const spendAgg = await model.Transaction.aggregate([
    { $match: { date: { $gte: startDate, $lt: endDate } } },
    { $group: { _id: '$type', actualSpend: { $sum: '$amount' } } }
  ]);

  const spendByType = {};
  spendAgg.forEach(r => { spendByType[r._id] = r.actualSpend; });

  const categories = budget.categoryBudgets.map(cb => {
    const actualSpend = spendByType[cb.type] || 0;
    const budgetLimit = cb.amount;
    const utilizationPct = budgetLimit > 0 ? (actualSpend / budgetLimit) * 100 : 0;
    return {
      categoryNormalized: cb.type,
      actualSpend: Math.round(actualSpend * 100) / 100,
      budgetLimit,
      utilizationPct: Math.round(utilizationPct * 100) / 100,
      variance: Math.round((budgetLimit - actualSpend) * 100) / 100
    };
  });

  const overallActualSpend = spendAgg.reduce((s, r) => s + (r.actualSpend || 0), 0);
  const overall = {
    actualSpend: Math.round(overallActualSpend * 100) / 100,
    budgetLimit: budget.overall,
    utilizationPct: budget.overall > 0 ? Math.round(((overallActualSpend / budget.overall) * 100) * 100) / 100 : 0,
    variance: Math.round((budget.overall - overallActualSpend) * 100) / 100
  };

  return { period, currency: 'USD', overall, categories };
}

function gradeFromScore(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

async function getHealth(period) {
  const bva = await getBudgetVsActual(period);

  const categoriesWithBudget = bva.categories.filter(c => c.budgetLimit > 0);
  const within = categoriesWithBudget.filter(c => c.actualSpend <= c.budgetLimit).length;
  const budgetAdherencePct = categoriesWithBudget.length > 0 ? (within / categoriesWithBudget.length) * 100 : 100;

  // Discretionary ratio MVP: treat everything except "Investment" as discretionary unknown.
  // If categories are enriched later, this can be updated.
  const discretionaryRatioPct = 50;

  // Forecast variance MVP: placeholder until forecasting endpoint is integrated.
  const forecastVariancePct = 0;

  // Savings rate requires income tracking; current app does not. Return null.
  const savingsRatePct = null;

  const healthScore = Math.round(
    (Math.min(100, budgetAdherencePct) * 0.6) +
    (Math.max(0, 100 - discretionaryRatioPct) * 0.2) +
    (Math.max(0, 100 - forecastVariancePct) * 0.2)
  );

  const drivers = [];
  const nearLimit = bva.categories
    .filter(c => c.budgetLimit > 0)
    .sort((a, b) => b.utilizationPct - a.utilizationPct)
    .slice(0, 3);
  nearLimit.forEach(c => {
    if (c.utilizationPct >= 80) {
      drivers.push({
        type: 'overspend-category',
        title: `${c.categoryNormalized} is near budget limit`,
        detail: `${c.categoryNormalized} is at ${Math.round(c.utilizationPct)}% of budget`,
        categoryNormalized: c.categoryNormalized,
        impact: c.utilizationPct >= 100 ? 'negative' : 'neutral'
      });
    }
  });

  return {
    period,
    healthScore,
    grade: gradeFromScore(healthScore),
    kpis: {
      budgetAdherencePct: Math.round(budgetAdherencePct * 100) / 100,
      discretionaryRatioPct,
      forecastVariancePct,
      savingsRatePct
    },
    drivers
  };
}

module.exports = {
  getBudgetVsActual,
  getHealth
};

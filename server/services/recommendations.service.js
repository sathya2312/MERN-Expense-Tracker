const model = require('../models/model');
const { getBudgetVsActual } = require('./insights.service');
const { computeForecast } = require('./forecast.service');

async function getRecommendations(period) {
  const bva = await getBudgetVsActual(period);
  const forecast = await computeForecast(period);

  const items = [];

  // Rule 1: Reduce-category (top projected overspend)
  const projectedOver = (forecast.categories || []).filter(c => c.projectedOverBudget);
  projectedOver.sort((a, b) => (b.projectedMonthEndSpend - (b.budgetLimit || 0)) - (a.projectedMonthEndSpend - (a.budgetLimit || 0)));
  const top = projectedOver[0];
  if (top) {
    const overAmt = Math.max(0, top.projectedMonthEndSpend - (top.budgetLimit || 0));
    const weekly = Math.ceil(overAmt / 4);
    items.push({
      id: 'rec-reduce-' + top.categoryNormalized,
      type: 'reduce-category',
      title: `Reduce ${top.categoryNormalized} by $${weekly}/week`,
      rationale: `${top.categoryNormalized} is projected to exceed budget by $${Math.round(overAmt)} this month.`,
      evidence: {
        projectedMonthly: top.projectedMonthEndSpend,
        budgetLimit: top.budgetLimit,
        overBy: overAmt
      },
      estimatedMonthlySavings: Math.round(overAmt * 100) / 100,
      priority: 1
    });
  }

  // Rule 2: Subscription cleanup (detect small recurring-like transactions)
  // Use name+type with frequency >= 3 in month and avg amount between 5..30
  const txns = await model.Transaction.find({}).lean();
  const map = {};
  txns.forEach(t => {
    const key = `${(t.name || '').toLowerCase()}|${t.type}`;
    if (!map[key]) map[key] = [];
    map[key].push(t);
  });
  const subs = Object.entries(map)
    .map(([k, list]) => {
      const avg = list.reduce((s, t) => s + (t.amount || 0), 0) / list.length;
      return { key: k, list, avg };
    })
    .filter(x => x.list.length >= 3 && x.avg >= 5 && x.avg <= 30)
    .sort((a, b) => b.avg - a.avg);
  if (subs[0]) {
    const [name] = subs[0].key.split('|');
    items.push({
      id: 'rec-sub-' + name,
      type: 'subscription-cleanup',
      title: `Review subscription-like spend: ${name}`,
      rationale: `You have ${subs[0].list.length} charges averaging $${Math.round(subs[0].avg * 100) / 100}. Consider cancelling if unused.`,
      evidence: { occurrences: subs[0].list.length, avgAmount: subs[0].avg },
      estimatedMonthlySavings: Math.round(subs[0].avg * 100) / 100,
      priority: 2
    });
  }

  // Rule 3: Weekly cap based on remaining overall budget
  if (bva.overall && bva.overall.budgetLimit > 0) {
    const remaining = Math.max(0, bva.overall.budgetLimit - bva.overall.actualSpend);
    const weeklyCap = Math.floor(remaining / 4);
    items.push({
      id: 'rec-weekly-cap',
      type: 'weekly-cap',
      title: `Set a weekly spending cap of ~$${weeklyCap}`,
      rationale: `To stay within your overall budget, aim to spend about $${weeklyCap} per week for the rest of the month.`,
      evidence: { remainingBudget: remaining, overallBudget: bva.overall.budgetLimit, spentToDate: bva.overall.actualSpend },
      estimatedMonthlySavings: 0,
      priority: 3
    });
  }

  return { period, items };
}

module.exports = { getRecommendations };

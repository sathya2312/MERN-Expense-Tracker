const model = require('../models/model');
const { getMonthRange, getDaysInMonth, assertPeriod } = require('./period');

function _daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

async function computeForecast(period, options = {}) {
  assertPeriod(period);
  const historyWindowMonths = options.historyWindowMonths || 3;
  const { startDate, endDate, year, month } = getMonthRange(period);

  const budget = await model.Budget.findOne({ month: period }).lean();

  const txns = await model.Transaction.find({ date: { $gte: startDate, $lt: endDate } }).lean();
  const spendToDate = txns.reduce((s, t) => s + (t.amount || 0), 0);

  const now = new Date();
  const daysInMonth = getDaysInMonth(year, month);
  let daysElapsed = 0;
  if (now >= startDate && now < endDate) daysElapsed = now.getDate();
  else if (now >= endDate) daysElapsed = daysInMonth;

  // Trend daily rate from spend-to-date
  const dailyRate = daysElapsed > 0 ? (spendToDate / daysElapsed) : 0;
  const remainingDays = Math.max(0, daysInMonth - daysElapsed);

  // MVP recurring detection: detect same type+name+amount repeating across last N months (not persisted)
  // Since schema uses {name,type,amount,date}, we'll approximate merchant as name.
  const amountTolerancePct = 5;
  const intervalToleranceDays = 3;

  const histStart = new Date(year, month - 1 - historyWindowMonths, 1);
  const histTxns = await model.Transaction.find({ date: { $gte: histStart, $lt: endDate } }).lean();

  const byKey = {};
  for (const t of histTxns) {
    const key = `${(t.name || '').toLowerCase()}|${t.type}`;
    if (!byKey[key]) byKey[key] = [];
    byKey[key].push(t);
  }

  let recurringProjected = 0;
  for (const key of Object.keys(byKey)) {
    const list = byKey[key].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (list.length < 3) continue;

    // check if amounts are within tolerance
    const avg = list.reduce((s, t) => s + (t.amount || 0), 0) / list.length;
    const within = list.every(t => {
      const diffPct = avg > 0 ? Math.abs((t.amount - avg) / avg) * 100 : 0;
      return diffPct <= amountTolerancePct;
    });
    if (!within) continue;

    // check approximate interval ~30 days between last 3 occurrences
    const last3 = list.slice(-3);
    const d1 = _daysBetween(new Date(last3[0].date), new Date(last3[1].date));
    const d2 = _daysBetween(new Date(last3[1].date), new Date(last3[2].date));
    const isMonthly = Math.abs(d1 - 30) <= intervalToleranceDays && Math.abs(d2 - 30) <= intervalToleranceDays;
    if (!isMonthly) continue;

    // if last occurrence already happened in this period, skip projecting again
    const lastOcc = new Date(last3[2].date);
    if (lastOcc >= startDate && lastOcc < endDate) continue;

    // project one occurrence if expected date falls within remaining window
    const next = new Date(lastOcc);
    next.setDate(next.getDate() + 30);
    if (next >= now && next < endDate) recurringProjected += avg;
  }

  const projectedRemainingSpend = (dailyRate * remainingDays) + recurringProjected;
  const projectedMonthEndSpend = spendToDate + projectedRemainingSpend;

  const categories = [];
  const spendByType = {};
  txns.forEach(t => { spendByType[t.type] = (spendByType[t.type] || 0) + (t.amount || 0); });
  if (budget && budget.categoryBudgets) {
    for (const cb of budget.categoryBudgets) {
      const spend = spendByType[cb.type] || 0;
      const rate = daysElapsed > 0 ? (spend / daysElapsed) : 0;
      const proj = spend + (rate * remainingDays);
      categories.push({
        categoryNormalized: cb.type,
        spendToDate: Math.round(spend * 100) / 100,
        projectedMonthEndSpend: Math.round(proj * 100) / 100,
        budgetLimit: cb.amount,
        projectedOverBudget: cb.amount > 0 ? proj > cb.amount : false
      });
    }
  }

  const overallBudgetLimit = budget ? budget.overall : undefined;

  return {
    period,
    currency: 'USD',
    overall: {
      spendToDate: Math.round(spendToDate * 100) / 100,
      projectedMonthEndSpend: Math.round(projectedMonthEndSpend * 100) / 100,
      projectedRemainingSpend: Math.round(projectedRemainingSpend * 100) / 100,
      projectedOverBudget: overallBudgetLimit ? projectedMonthEndSpend > overallBudgetLimit : undefined
    },
    categories,
    assumptions: {
      method: 'trend+recurring',
      historyWindowMonths,
      amountTolerancePct,
      intervalToleranceDays
    },
    confidence: (histTxns.length >= 30) ? 'medium' : 'low'
  };
}

module.exports = { computeForecast };

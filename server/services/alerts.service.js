const model = require('../models/model');
const AlertEvent = require('../models/alertEvent.model');
const { getMonthRange, assertPeriod } = require('./period');

async function _dedupeExists({ type, scope, period, categoryNormalized, severity, thresholdPct }) {
  const query = {
    type,
    scope,
    period,
    severity,
    ...(categoryNormalized ? { categoryNormalized } : {}),
    ...(thresholdPct ? { 'explanation.thresholdPct': thresholdPct } : {})
  };
  const existing = await AlertEvent.findOne(query).select('_id').lean();
  return !!existing;
}

async function evaluateThresholdsForPeriod(period, transactionId) {
  assertPeriod(period);
  const budget = await model.Budget.findOne({ month: period });
  if (!budget) return; // no budget set, nothing to alert

  const { startDate, endDate } = getMonthRange(period);
  const spendAgg = await model.Transaction.aggregate([
    { $match: { date: { $gte: startDate, $lt: endDate } } },
    { $group: { _id: '$type', spent: { $sum: '$amount' } } }
  ]);
  const spentByType = {};
  spendAgg.forEach(r => { spentByType[r._id] = r.spent; });
  const totalSpent = spendAgg.reduce((s, r) => s + (r.spent || 0), 0);

  const warningPct = 80;
  const criticalPct = 100;

  // overall
  if (budget.overall > 0) {
    const util = (totalSpent / budget.overall) * 100;
    if (util >= warningPct && !(await _dedupeExists({ type: 'threshold', scope: 'overall', period, severity: 'warning', thresholdPct: warningPct }))) {
      await AlertEvent.create({
        type: 'threshold',
        scope: 'overall',
        period,
        severity: 'warning',
        message: `Overall spending reached ${warningPct}% of budget`,
        explanation: { observed: totalSpent, thresholdPct: warningPct, utilizationPct: util },
        refs: { budgetId: budget._id, transactionId }
      });
    }
    if (util >= criticalPct && !(await _dedupeExists({ type: 'threshold', scope: 'overall', period, severity: 'critical', thresholdPct: criticalPct }))) {
      await AlertEvent.create({
        type: 'threshold',
        scope: 'overall',
        period,
        severity: 'critical',
        message: `Overall spending reached ${criticalPct}% of budget`,
        explanation: { observed: totalSpent, thresholdPct: criticalPct, utilizationPct: util },
        refs: { budgetId: budget._id, transactionId }
      });
    }
  }

  // per category
  for (const cb of budget.categoryBudgets) {
    const limit = cb.amount;
    if (limit <= 0) continue;
    const spent = spentByType[cb.type] || 0;
    const util = (spent / limit) * 100;

    if (util >= warningPct && !(await _dedupeExists({ type: 'threshold', scope: 'category', period, categoryNormalized: cb.type, severity: 'warning', thresholdPct: warningPct }))) {
      await AlertEvent.create({
        type: 'threshold',
        scope: 'category',
        period,
        categoryNormalized: cb.type,
        severity: 'warning',
        message: `${cb.type} reached ${warningPct}% of budget`,
        explanation: { observed: spent, thresholdPct: warningPct, utilizationPct: util },
        refs: { budgetId: budget._id, transactionId }
      });
    }

    if (util >= criticalPct && !(await _dedupeExists({ type: 'threshold', scope: 'category', period, categoryNormalized: cb.type, severity: 'critical', thresholdPct: criticalPct }))) {
      await AlertEvent.create({
        type: 'threshold',
        scope: 'category',
        period,
        categoryNormalized: cb.type,
        severity: 'critical',
        message: `${cb.type} reached ${criticalPct}% of budget`,
        explanation: { observed: spent, thresholdPct: criticalPct, utilizationPct: util },
        refs: { budgetId: budget._id, transactionId }
      });
    }
  }
}

function _median(nums) {
  const arr = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

async function evaluateAnomalies(period) {
  assertPeriod(period);
  const budget = await model.Budget.findOne({ month: period });
  if (!budget) return;

  // baseline from previous 3 months
  const [year, month] = period.split('-').map(Number);
  const previousPeriods = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(year, month - 1 - i, 1);
    const p = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    previousPeriods.push(p);
  }

  const current = await model.Transaction.aggregate([
    { $match: { date: { $gte: getMonthRange(period).startDate, $lt: getMonthRange(period).endDate } } },
    { $group: { _id: '$type', spent: { $sum: '$amount' } } }
  ]);
  const currentByType = {};
  current.forEach(r => { currentByType[r._id] = r.spent; });

  for (const cb of budget.categoryBudgets) {
    const baselineValues = [];
    for (const pp of previousPeriods) {
      const { startDate, endDate } = getMonthRange(pp);
      const agg = await model.Transaction.aggregate([
        { $match: { date: { $gte: startDate, $lt: endDate }, type: cb.type } },
        { $group: { _id: '$type', spent: { $sum: '$amount' } } }
      ]);
      baselineValues.push((agg[0] && agg[0].spent) ? agg[0].spent : 0);
    }
    const baseline = _median(baselineValues);
    const observed = currentByType[cb.type] || 0;
    const spikeFactor = 1.5;
    const minDelta = 50;

    if (baseline > 0 && observed > baseline * spikeFactor && (observed - baseline) >= minDelta) {
      if (await _dedupeExists({ type: 'anomaly', scope: 'category', period, categoryNormalized: cb.type, severity: 'warning' })) continue;
      await AlertEvent.create({
        type: 'anomaly',
        scope: 'category',
        period,
        categoryNormalized: cb.type,
        severity: 'warning',
        message: `${cb.type} spike detected`,
        explanation: { baseline, observed, delta: observed - baseline },
        refs: { budgetId: budget._id }
      });
    }
  }
}

async function listAlerts({ status, type, period, limit = 50 }) {
  const query = {};
  if (status) query.status = status;
  if (type) query.type = type;
  if (period) query.period = period;

  const items = await AlertEvent.find(query)
    .sort({ triggeredAt: -1 })
    .limit(Math.min(Number(limit) || 50, 200))
    .lean();

  return { items: items.map(a => ({
    id: a._id,
    type: a.type,
    scope: a.scope,
    categoryNormalized: a.categoryNormalized,
    period: a.period,
    severity: a.severity,
    message: a.message,
    explanation: a.explanation,
    status: a.status,
    triggeredAt: a.triggeredAt
  })) };
}

async function updateAlertStatus(id, status) {
  if (!['read', 'dismissed', 'unread'].includes(status)) {
    const err = new Error('Invalid status');
    err.statusCode = 400;
    throw err;
  }
  const updated = await AlertEvent.findByIdAndUpdate(id, { $set: { status } }, { new: true });
  if (!updated) {
    const err = new Error('Alert not found');
    err.statusCode = 404;
    throw err;
  }
  return { message: 'Updated', id: updated._id, status: updated.status };
}

module.exports = {
  evaluateThresholdsForPeriod,
  evaluateAnomalies,
  listAlerts,
  updateAlertStatus
};

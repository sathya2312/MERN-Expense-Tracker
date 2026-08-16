const MONTH_RE = /^\d{4}-\d{2}$/;

function assertPeriod(period) {
  if (!period || !MONTH_RE.test(period)) {
    const err = new Error('Valid period in YYYY-MM format is required');
    err.statusCode = 400;
    throw err;
  }
}

function getMonthRange(period) {
  assertPeriod(period);
  const [year, month] = period.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  return { startDate, endDate, year, month };
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

module.exports = {
  assertPeriod,
  getMonthRange,
  getDaysInMonth
};

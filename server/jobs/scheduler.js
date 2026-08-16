const cron = require('node-cron');
const { evaluateThresholdsForPeriod, evaluateAnomalies } = require('../services/alerts.service');

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function startScheduler() {
  // Every day at 02:00
  cron.schedule('0 2 * * *', async () => {
    const period = currentPeriod();
    try {
      await evaluateThresholdsForPeriod(period);
      await evaluateAnomalies(period);
      // eslint-disable-next-line no-console
      console.log(`[scheduler] Alerts evaluated for ${period}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[scheduler] Failed to evaluate alerts', e);
    }
  });
}

module.exports = { startScheduler };

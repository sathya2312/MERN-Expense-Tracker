const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const alert_event_model = new Schema({
  type: { type: String, enum: ['threshold', 'anomaly'], required: true },
  scope: { type: String, enum: ['overall', 'category'], required: true },
  period: { type: String, required: true, match: [/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'] },
  categoryNormalized: { type: String },
  severity: { type: String, enum: ['warning', 'critical'], required: true },
  triggeredAt: { type: Date, default: Date.now },
  message: { type: String, required: true },
  explanation: {
    baseline: { type: Number },
    observed: { type: Number, required: true },
    delta: { type: Number },
    thresholdPct: { type: Number },
    utilizationPct: { type: Number }
  },
  refs: {
    budgetId: { type: Schema.Types.ObjectId, ref: 'budget' },
    transactionId: { type: Schema.Types.ObjectId, ref: 'transaction' }
  },
  status: { type: String, enum: ['unread', 'read', 'dismissed'], default: 'unread' }
}, { timestamps: true });

alert_event_model.index({ status: 1, triggeredAt: -1 });
alert_event_model.index({ period: 1, triggeredAt: -1 });

module.exports = mongoose.model('alertEvent', alert_event_model);

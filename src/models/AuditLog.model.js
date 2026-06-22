const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId },
  method: { type: String },
  path: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  statusCode: { type: Number },
  details: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

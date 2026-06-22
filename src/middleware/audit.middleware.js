const AuditLog = require('../models/AuditLog.model');

const auditLogger = async (req, res, next) => {
  const start = Date.now();
  res.on('finish', async () => {
    try {
      if (req.path === '/health') return;
      await AuditLog.create({
        userId: req.user?._id,
        action: `${req.method} ${req.path}`,
        resource: req.path.split('/')[2] || 'unknown',
        method: req.method,
        path: req.path,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        statusCode: res.statusCode,
        details: { duration: Date.now() - start },
      });
    } catch (_) { /* non-blocking */ }
  });
  next();
};

module.exports = { auditLogger };

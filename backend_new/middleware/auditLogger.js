import db from '../models/index.js';
const AuditLog = db.AuditLog;


// Helper to generate a human-friendly message for audit logs
const getAuditMessage = (req, user) => {
  if (req.originalUrl.includes('/auth/login') && req.method === 'POST') {
    return `User ${user.username || req.body.username || 'unknown'} logged in`;
  }
  if (req.originalUrl.includes('/auth/logout')) {
    return `User ${user.username || 'unknown'} logged out`;
  }
  if (req.originalUrl.includes('/auth/profile')) {
    return `User ${user.username || 'unknown'} viewed profile`;
  }
  // Add more cases as needed
  return `${user.username || req.body.username || 'Unknown user'} performed ${req.method} on ${req.originalUrl}`;
};

const auditLogger = async (req, res, next) => {
  res.on('finish', async () => {
    try {
      const user = req.user || {};
      await AuditLog.create({
        user_id: user.id || null,
        username: user.username || req.body.username || null,
        action: `${req.method} ${req.originalUrl}`,
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip,
        status: res.statusCode,
        message: getAuditMessage(req, user),
        details: {
          params: req.params,
          query: req.query,
          body: req.body
        }
      });
    } catch (err) {
      console.error('Failed to log audit:', err);
    }
  });
  next();
};

export default auditLogger;
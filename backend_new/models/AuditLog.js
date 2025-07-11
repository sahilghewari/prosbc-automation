import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const AuditLog = database.sequelize.define('AuditLog', {
  message: { type: DataTypes.STRING, allowNull: true },

  user_id: { type: DataTypes.INTEGER, allowNull: true },
  username: { type: DataTypes.STRING, allowNull: true },
  action: { type: DataTypes.STRING, allowNull: false },
  endpoint: { type: DataTypes.STRING, allowNull: false },
  method: { type: DataTypes.STRING, allowNull: false },
  ip: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.INTEGER, allowNull: true },
  details: { type: DataTypes.JSON, allowNull: true }
}, {
  tableName: 'audit_logs',
  timestamps: true
});

export default AuditLog;
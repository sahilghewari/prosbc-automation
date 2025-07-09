/**
 * Audit Logs Schema
 * Comprehensive system event tracking
 */

import { DataTypes } from 'sequelize';
import database from '../config/database.js';


const AuditLog = database.sequelize.define('AuditLog', {
  event: { type: DataTypes.STRING, allowNull: false },
  event_category: { type: DataTypes.ENUM('nap', 'file', 'mapping', 'config', 'auth', 'system', 'security'), allowNull: false },
  severity: { type: DataTypes.ENUM('info', 'warning', 'error', 'critical'), defaultValue: 'info' },
  status: { type: DataTypes.BOOLEAN, allowNull: false },
  related_entity: { type: DataTypes.JSON, allowNull: true },
  user_info: { type: DataTypes.JSON, allowNull: true },
  action_details: { type: DataTypes.JSON, allowNull: true },
  changes: { type: DataTypes.JSON, allowNull: true },
  error_details: { type: DataTypes.JSON, allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true },
  correlation_id: { type: DataTypes.STRING, allowNull: true },
  tags: { type: DataTypes.JSON, allowNull: true },
  message: { type: DataTypes.TEXT, allowNull: true },
  timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'audit_logs',
  createdAt: 'timestamp',
  updatedAt: false,
});

export default AuditLog;



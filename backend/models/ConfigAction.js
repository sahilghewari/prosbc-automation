/**
 * Configuration Actions Schema
 * Tracks generate and activate operations
 */

import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const ConfigAction = database.sequelize.define('ConfigAction', {
  nap_id: { type: DataTypes.INTEGER, allowNull: false },
  action_type: { type: DataTypes.ENUM('generate', 'activate', 'validate', 'backup', 'restore', 'sync'), allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'running', 'success', 'failed', 'cancelled'), defaultValue: 'pending' },
  command: { type: DataTypes.STRING, allowNull: true },
  parameters: { type: DataTypes.JSON, allowNull: true },
  output_log: { type: DataTypes.TEXT, allowNull: true },
  error_log: { type: DataTypes.TEXT, allowNull: true },
  execution_time: { type: DataTypes.JSON, allowNull: true },
  executed_by: { type: DataTypes.STRING, allowNull: false },
  execution_method: { type: DataTypes.ENUM('ssh', 'api', 'gui', 'scheduler'), defaultValue: 'gui' },
  related_mappings: { type: DataTypes.JSON, allowNull: true },
  prosbc_response: { type: DataTypes.JSON, allowNull: true },
  retry_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  max_retries: { type: DataTypes.INTEGER, defaultValue: 3 },
  priority: { type: DataTypes.INTEGER, defaultValue: 0 },
  metadata: { type: DataTypes.JSON, allowNull: true },
}, {
  tableName: 'config_actions',
  createdAt: 'executed_at',
  updatedAt: 'updated_at',
});

export default ConfigAction;



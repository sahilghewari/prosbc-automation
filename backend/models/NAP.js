/**
 * NAP (Network Access Points) Schema
 * Enhanced schema for managing ProSBC NAPs
 */

import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const NAP = database.sequelize.define('NAP', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  config_data: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('created', 'mapped', 'activated', 'inactive', 'error'),
    defaultValue: 'created',
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tags: {
    type: DataTypes.JSON, // Array of strings
    allowNull: true,
  },
  prosbc_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  validation_results: {
    type: DataTypes.JSON, // { is_valid: boolean, errors: [string] }
    allowNull: true,
  },
}, {
  tableName: 'naps',
  timestamps: true,
});

export default NAP;



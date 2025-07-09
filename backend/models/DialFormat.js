/**
 * Dial Formats Schema
 * Manages DF files and their metadata - similar structure to DigitMap
 */

import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const DialFormat = database.sequelize.define('DialFormat', {
  filename: { type: DataTypes.STRING, allowNull: false },
  original_filename: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT('long'), allowNull: false },
  content_type: { type: DataTypes.ENUM('csv', 'json', 'text'), defaultValue: 'csv' },
  file_size: { type: DataTypes.INTEGER, allowNull: false },
  checksum: { type: DataTypes.STRING, allowNull: true },
  nap_id: { type: DataTypes.INTEGER, allowNull: true },
  prosbc_id: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.ENUM('uploaded', 'validated', 'mapped', 'active', 'error'), defaultValue: 'uploaded' },
  validation_results: { type: DataTypes.JSON, allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true },
  uploaded_by: { type: DataTypes.STRING, allowNull: false },
  tags: { type: DataTypes.JSON, allowNull: true },
}, {
  tableName: 'dial_formats',
  createdAt: 'uploaded_at',
  updatedAt: 'updated_at',
});

export default DialFormat;



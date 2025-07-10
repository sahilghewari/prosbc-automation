/**
 * Digit Maps Schema
 * Manages DM files and their metadata
 */

import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const DigitMap = database.sequelize.define('DigitMap', {
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
  tableName: 'digitmaps',
  createdAt: 'uploaded_at',
  updatedAt: 'updated_at',
});

export default DigitMap;



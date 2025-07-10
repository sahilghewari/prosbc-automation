/**
 * Dial Formats Schema
 * Manages DF files and their metadata - similar structure to DigitMap
 */

import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const DialFormat = database.sequelize.define('DialFormat', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  filename: { type: DataTypes.STRING, allowNull: false },
  originalname: { type: DataTypes.STRING, allowNull: false },
  nap_id: { type: DataTypes.INTEGER, allowNull: true },
  tags: { type: DataTypes.JSON, allowNull: true },
  uploaded_by: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: true },
  createdAt: { type: DataTypes.DATE },
  updatedAt: { type: DataTypes.DATE }
}, {
  tableName: 'dialformats',
  timestamps: false
}, {
  tableName: 'dialformats',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

export default DialFormat;



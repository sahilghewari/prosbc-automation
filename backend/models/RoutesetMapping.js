/**
 * Routeset Mappings Schema
 * Links NAPs with DM/DF files
 */

import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const RoutesetMapping = database.sequelize.define('RoutesetMapping', {
  nap_id: { type: DataTypes.INTEGER, allowNull: false },
  digit_map_id: { type: DataTypes.INTEGER, allowNull: false },
  dial_format_id: { type: DataTypes.INTEGER, allowNull: false },
  mapping_name: { type: DataTypes.STRING, allowNull: false },
  configuration: { type: DataTypes.JSON, allowNull: true },
  mapped_by: { type: DataTypes.STRING, allowNull: false },
  mapped_via: { type: DataTypes.ENUM('gui', 'api', 'ssh', 'import'), defaultValue: 'gui' },
  status: { type: DataTypes.ENUM('active', 'inactive', 'pending', 'error'), defaultValue: 'pending' },
  priority: { type: DataTypes.INTEGER, defaultValue: 0 },
  validation_results: { type: DataTypes.JSON, allowNull: true },
  prosbc_sync: { type: DataTypes.JSON, allowNull: true },
  notes: { type: DataTypes.STRING, allowNull: true },
}, {
  tableName: 'routeset_mappings',
  createdAt: 'mapped_at',
  updatedAt: 'updated_at',
});

export default RoutesetMapping;

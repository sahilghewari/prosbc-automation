import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const ProSBCDMFile = database.sequelize.define('ProSBCDMFile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  file_content: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
  },
  numbers: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
  },
  prosbc_instance_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  prosbc_instance_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  total_numbers: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  last_synced: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'syncing'),
    allowNull: true,
    defaultValue: 'active',
  },
}, {
  tableName: 'prosbc_dm_files',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

export default ProSBCDMFile;
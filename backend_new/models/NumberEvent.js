import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const NumberEvent = database.sequelize.define('NumberEvent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  number: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  action: {
    type: DataTypes.ENUM('add', 'remove', 'update'),
    allowNull: false,
  },
  customerName: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  prosbcInstanceId: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  userName: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  fileName: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'number_events',
  timestamps: true,
  indexes: [
    { fields: ['number'] },
    { fields: ['prosbcInstanceId', 'timestamp'] },
    { fields: ['action'] },
    { fields: ['prosbcInstanceId', 'action', 'timestamp'] }, // For analytics queries
    { fields: ['customerName', 'prosbcInstanceId', 'timestamp'] }, // For monthly reports
  ],
});

export default NumberEvent;

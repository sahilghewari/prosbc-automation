import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const CustomerNumberChange = database.sequelize.define('CustomerNumberChange', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  customerName: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  changeType: {
    type: DataTypes.ENUM('add', 'remove'),
    allowNull: false,
  },
  count: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
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
  details: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'customer_number_changes',
  timestamps: true,
  indexes: [
    {
      fields: ['customerName', 'prosbcInstanceId', 'timestamp'],
    },
    {
      fields: ['changeType', 'timestamp'],
    },
  ],
});

export default CustomerNumberChange;
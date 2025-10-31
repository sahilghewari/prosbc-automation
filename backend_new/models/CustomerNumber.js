import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const CustomerNumber = database.sequelize.define('CustomerNumber', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  number: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  customerName: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  addedDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  removedDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  prosbcInstanceId: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  addedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  removedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
}, {
  tableName: 'customer_numbers',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['number', 'customerName', 'prosbcInstanceId'],
    },
    {
      fields: ['customerName', 'prosbcInstanceId', 'addedDate'],
    },
    {
      fields: ['removedDate'],
    },
    {
      fields: ['prosbcInstanceId', 'removedDate'], // For live count queries
    },
    {
      fields: ['prosbcInstanceId', 'addedDate', 'removedDate'], // For usedThisMonth queries
    },
  ],
});

export default CustomerNumber;
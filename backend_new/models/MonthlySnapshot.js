import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const MonthlySnapshot = database.sequelize.define('MonthlySnapshot', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  month: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  customerName: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  prosbcInstanceId: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  count: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
  }
}, {
  tableName: 'monthly_snapshots',
  timestamps: true,
  indexes: [
    { fields: ['year', 'month', 'prosbcInstanceId'] },
  ],
});

export default MonthlySnapshot;

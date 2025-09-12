import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const CustomerCount = database.sequelize.define('CustomerCount', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  count: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATEONLY, // Store date only, for monthly records
    allowNull: false,
  },
  prosbcInstanceId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    references: {
      model: 'ProSBCInstances',
      key: 'id',
    },
  },
}, {
  tableName: 'customer_counts',
  timestamps: true,
});

export default CustomerCount;
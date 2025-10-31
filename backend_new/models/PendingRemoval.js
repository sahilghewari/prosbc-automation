import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const PendingRemoval = database.sequelize.define('PendingRemoval', {
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
  removalDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  prosbcInstanceId: {
    type: DataTypes.STRING(50),
    allowNull: false,
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
  tableName: 'pending_removals',
  timestamps: true,
  indexes: [
    {
      fields: ['customerName', 'prosbcInstanceId'],
    },
    {
      fields: ['removalDate'],
    },
  ],
});

export default PendingRemoval;
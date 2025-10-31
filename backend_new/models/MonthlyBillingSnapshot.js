import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const MonthlyBillingSnapshot = database.sequelize.define('MonthlyBillingSnapshot', {
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
  // Billing metrics
  billedCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Total unique numbers billed for the month'
  },
  liveCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Numbers still active at end of month'
  },
  addedCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Numbers added during the month'
  },
  removedCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Numbers removed during the month'
  },
  // Additional metadata
  snapshotDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'When this snapshot was created'
  },
  billingPeriodStart: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'Start of billing period'
  },
  billingPeriodEnd: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'End of billing period'
  },
  // Detailed data for auditing
  billedNumbers: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'List of all numbers that were billed'
  },
  monthlyEvents: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Summary of add/remove events during the month'
  }
}, {
  tableName: 'monthly_billing_snapshots',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['year', 'month', 'customerName', 'prosbcInstanceId'],
      name: 'unique_monthly_billing_snapshot'
    },
    { fields: ['prosbcInstanceId', 'year', 'month'] },
    { fields: ['customerName', 'prosbcInstanceId'] },
    { fields: ['snapshotDate'] },
  ],
});

export default MonthlyBillingSnapshot;
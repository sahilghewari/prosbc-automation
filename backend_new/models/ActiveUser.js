import { DataTypes } from 'sequelize';
import database from '../config/database.js';

const ActiveUser = database.sequelize.define('ActiveUser', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'User',
      key: 'id',
    },
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  loginTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

export default ActiveUser;

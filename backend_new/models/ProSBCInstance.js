import { DataTypes } from 'sequelize';
import database from '../config/database.js';
import bcrypt from 'bcryptjs';

const ProSBCInstance = database.sequelize.define('ProSBCInstance', {
  id: {
    type: DataTypes.STRING(50),
    primaryKey: true,
  },
  baseUrl: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'baseUrl' // Match the actual field in database - should be lowercase 'url'
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  // These fields don't exist in the database but are added for API compatibility
  name: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.id; // Use id as name
    }
  },
  isActive: {
    type: DataTypes.VIRTUAL,
    get() {
      return true; // Always active
    }
  },
  description: {
    type: DataTypes.VIRTUAL,
    get() {
      return ''; // Empty description
    }
  },
  // Explicitly provide the baseUrl as a virtual getter to ensure compatibility
  baseURL: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue('baseUrl'); // Use the lowercase baseUrl from DB
    }
  },
  location: {
    type: DataTypes.VIRTUAL,
    get() {
      return ''; // Empty location
    }
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  },
}, {
  tableName: 'prosbc_instances',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Instance method to get decrypted password
ProSBCInstance.prototype.getDecryptedPassword = function() {
  // Decode base64 encoded password
  return Buffer.from(this.password, 'base64').toString('utf-8');
};

// Instance method to verify password (for display purposes)
ProSBCInstance.prototype.verifyPassword = function(plainPassword) {
  const decoded = this.getDecryptedPassword();
  return decoded === plainPassword;
};

// Class method to find active instances
ProSBCInstance.findActiveInstances = function() {
  // Return all instances since isActive field doesn't exist in the database
  return this.findAll({
    order: [['id', 'ASC']]
  });
};

export default ProSBCInstance;

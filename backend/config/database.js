/**
 * Database Configuration and Connection
 */


import { Sequelize } from 'sequelize';

// MariaDB connection details (update as needed or use environment variables)
const DB_NAME = process.env.DB_NAME || 'yourdatabase';
const DB_USER = process.env.DB_USER || 'prosbc';
const DB_PASSWORD = process.env.DB_PASSWORD || 'sahil';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 3306;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mariadb',
  logging: false,
});


// Sequelize connection utility
const database = {
  sequelize,
  Sequelize,
  async connect() {
    try {
      await sequelize.authenticate();
      console.log('✅ MariaDB connection established.');
    } catch (error) {
      console.error('❌ Unable to connect to MariaDB:', error);
      throw error;
    }
  },
  async disconnect() {
    try {
      await sequelize.close();
      console.log('� MariaDB connection closed.');
    } catch (error) {
      console.error('❌ Error disconnecting from MariaDB:', error);
      throw error;
    }
  },
  async healthCheck() {
    try {
      await sequelize.authenticate();
      return { status: 'healthy', message: 'Database connection is healthy' };
    } catch (error) {
      return { status: 'error', message: error.message, error };
    }
  }
  ,
  // Dummy initializeIndexes function for compatibility
  async initializeIndexes() {
    // In Sequelize with MariaDB, indexes are usually defined in model definitions.
    // If you need to ensure indexes, sync models here or leave as a no-op.
    // Example: await sequelize.sync();
    // For now, this is a no-op for compatibility.
    return;
  }
  ,
  // Returns connection status for compatibility with server.js
  getConnectionStatus() {
    // Sequelize does not expose a direct isConnected property, so we check connection manager state
    // This is a best-effort check
    const isConnectedd = !!(sequelize && sequelize.connectionManager && sequelize.connectionManager.pool && !sequelize.connectionManager.pool._closed);
    return { isConnectedd };
  }
};

export default database;

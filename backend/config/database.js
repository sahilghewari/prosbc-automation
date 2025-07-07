/**
 * Database Configuration and Connection
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/prosbc-automation';

class Database {
  constructor() {
    this.connection = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      if (this.isConnected) {
        console.log('Database already connected');
        return this.connection;
      }

      console.log('Connecting to MongoDB...');
      
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4
      };

      this.connection = await mongoose.connect(MONGODB_URI, options);
      this.isConnected = true;

      console.log(`✅ MongoDB connected: ${this.connection.connection.host}:${this.connection.connection.port}`);
      console.log(`📊 Database: ${this.connection.connection.name}`);

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('📡 MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
        this.isConnected = true;
      });

      return this.connection;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        this.isConnected = false;
        console.log('📡 MongoDB disconnected');
      }
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }

  async getStats() {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const admin = mongoose.connection.db.admin();
      const stats = await admin.serverStatus();
      
      return {
        version: stats.version,
        uptime: stats.uptime,
        connections: stats.connections,
        memory: stats.mem,
        network: stats.network,
        opcounters: stats.opcounters
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      throw error;
    }
  }

  async initializeIndexes() {
    try {
      console.log('🔍 Initializing database indexes...');
      
      // Import models to ensure indexes are created
      const { NAP, DigitMap, DialFormat, RoutesetMapping, ConfigAction, AuditLog } = await import('./models/index.js');
      
      // Create indexes for each model
      await NAP.createIndexes();
      await DigitMap.createIndexes();
      await DialFormat.createIndexes();
      await RoutesetMapping.createIndexes();
      await ConfigAction.createIndexes();
      await AuditLog.createIndexes();
      
      console.log('✅ Database indexes initialized');
    } catch (error) {
      console.error('❌ Error initializing indexes:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected', message: 'Database not connected' };
      }

      // Simple ping to check connection
      await mongoose.connection.db.admin().ping();
      
      const stats = this.getConnectionStatus();
      
      return {
        status: 'healthy',
        message: 'Database connection is healthy',
        details: stats
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        error: error
      };
    }
  }
}

// Create singleton instance
const database = new Database();

export default database;

/**
 * Database Connection and Configuration
 * MongoDB connection with Mongoose
 */

import mongoose from 'mongoose';

// Database configuration
const DB_CONFIG = {
  development: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/prosbc_nap_testing_dev',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      bufferCommands: false,
      bufferMaxEntries: 0
    }
  },
  production: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/prosbc_nap_testing_prod',
    options: {
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 60000,
      family: 4,
      bufferCommands: false,
      bufferMaxEntries: 0,
      retryWrites: true,
      w: 'majority'
    }
  },
  test: {
    uri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/prosbc_nap_testing_test',
    options: {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000
    }
  }
};

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.environment = process.env.NODE_ENV || 'development';
    this.config = DB_CONFIG[this.environment];
    
    // Set mongoose options
    mongoose.set('strictQuery', false);
    
    // Connection event handlers
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    mongoose.connection.on('connected', () => {
      console.log(`✅ MongoDB connected to ${this.config.uri}`);
      this.isConnected = true;
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
      this.isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
      this.isConnected = true;
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  async connect() {
    try {
      if (this.isConnected) {
        console.log('📦 MongoDB already connected');
        return;
      }

      console.log(`🔄 Connecting to MongoDB (${this.environment})...`);
      
      await mongoose.connect(this.config.uri, this.config.options);
      
      console.log(`✅ Database connection established successfully`);
      
      // Create indexes if needed
      await this.createIndexes();
      
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (!this.isConnected) {
        console.log('📦 MongoDB already disconnected');
        return;
      }

      console.log('🔄 Disconnecting from MongoDB...');
      await mongoose.disconnect();
      console.log('✅ MongoDB disconnected successfully');
      
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  async createIndexes() {
    try {
      console.log('🔄 Creating database indexes...');
      
      // Create text indexes for search functionality
      const collections = await mongoose.connection.db.listCollections().toArray();
      
      for (const collection of collections) {
        const collectionName = collection.name;
        
        // Create text indexes for searchable fields
        switch (collectionName) {
          case 'nap_records':
            await mongoose.connection.db.collection(collectionName).createIndex({
              name: 'text',
              'config_json': 'text',
              created_by: 'text'
            }, { background: true });
            break;
            
          case 'uploaded_files':
            await mongoose.connection.db.collection(collectionName).createIndex({
              original_filename: 'text',
              uploaded_by: 'text'
            }, { background: true });
            break;
            
          case 'file_edit_history':
            await mongoose.connection.db.collection(collectionName).createIndex({
              changes_summary: 'text',
              editor: 'text'
            }, { background: true });
            break;
        }
      }
      
      console.log('✅ Database indexes created successfully');
      
    } catch (error) {
      console.error('❌ Error creating indexes:', error);
      // Don't throw here as indexes are not critical for basic functionality
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected', message: 'Not connected to database' };
      }

      // Ping the database
      await mongoose.connection.db.admin().ping();
      
      // Get database stats
      const stats = await mongoose.connection.db.stats();
      
      return {
        status: 'healthy',
        environment: this.environment,
        database: mongoose.connection.name,
        collections: stats.collections,
        dataSize: this.formatBytes(stats.dataSize),
        indexSize: this.formatBytes(stats.indexSize),
        uptime: process.uptime()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        error: error.name
      };
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async clearDatabase() {
    if (this.environment === 'production') {
      throw new Error('Cannot clear production database');
    }

    try {
      console.log('🔄 Clearing database...');
      await mongoose.connection.db.dropDatabase();
      console.log('✅ Database cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing database:', error);
      throw error;
    }
  }

  getConnectionString() {
    // Return connection string without credentials for logging
    return this.config.uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

export default dbConnection;

// Helper function for quick connection
export const connectDB = async () => {
  await dbConnection.connect();
};

// Helper function for quick disconnection
export const disconnectDB = async () => {
  await dbConnection.disconnect();
};

// Helper function for health check
export const getDBHealth = async () => {
  return await dbConnection.healthCheck();
};

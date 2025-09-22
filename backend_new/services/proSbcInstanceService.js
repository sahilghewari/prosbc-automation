import ProSBCInstance from '../models/ProSBCInstance.js';
import bcrypt from 'bcryptjs';

class ProSBCInstanceService {
  
  // Get all active ProSBC instances
  async getAllInstances() {
    try {
      console.log('[ProSBC Service] Calling ProSBCInstance.findActiveInstances()...');
      const instances = await ProSBCInstance.findActiveInstances();
      console.log(`[ProSBC Service] Successfully retrieved ${instances.length} instances`);
      return instances;
    } catch (error) {
      console.error('[ProSBC Service] Error in getAllInstances:', error);
      console.error('[ProSBC Service] Error details:', error.message);
      console.error('[ProSBC Service] Error stack:', error.stack);
      throw new Error(`Failed to fetch ProSBC instances: ${error.message}`);
    }
  }

  // Get specific ProSBC instance by ID
  async getInstanceById(id) {
    try {
      const instance = await ProSBCInstance.findByPk(id);
      if (!instance) {
        throw new Error(`ProSBC instance with ID ${id} not found`);
      }
      return instance;
    } catch (error) {
      throw new Error(`Failed to fetch ProSBC instance: ${error.message}`);
    }
  }

  // Get instance with decrypted credentials for API calls
  async getInstanceCredentials(id) {
    try {
      const instance = await this.getInstanceById(id);
      
      // Get the raw instance data to see exactly what's in the database
      const rawInstance = instance.get({ plain: true });
      
      // Get baseUrl directly from the instance data
      return {
        id: instance.id,
        name: instance.id, 
        baseUrl: rawInstance.baseUrl,
        username: instance.username,
        password: instance.password,
        location: ''
      };
    } catch (error) {
      console.error('Error getting credentials:', error);
      throw new Error(`Failed to get instance credentials: ${error.message}`);
    }
  }

  // Create new ProSBC instance
  async createInstance(instanceData) {
    try {
      const instance = await ProSBCInstance.create(instanceData);
      return instance;
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error('ProSBC instance with this name already exists');
      }
      throw new Error(`Failed to create ProSBC instance: ${error.message}`);
    }
  }

  // Update ProSBC instance
  async updateInstance(id, updateData) {
    try {
      const instance = await this.getInstanceById(id);
      await instance.update(updateData);
      return instance;
    } catch (error) {
      throw new Error(`Failed to update ProSBC instance: ${error.message}`);
    }
  }

  // Delete ProSBC instance
  async deleteInstance(id) {
    try {
      const instance = await this.getInstanceById(id);
      await instance.destroy();
      return { message: 'ProSBC instance deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete ProSBC instance: ${error.message}`);
    }
  }

  // Toggle active status
  async toggleActiveStatus(id) {
    try {
      const instance = await this.getInstanceById(id);
      instance.isActive = !instance.isActive;
      await instance.save();
      return instance;
    } catch (error) {
      throw new Error(`Failed to toggle instance status: ${error.message}`);
    }
  }

  // Test connection to ProSBC instance
  async testConnection(id) {
    try {
      console.log(`Starting connection test for instance ${id}`);
      
      const credentials = await this.getInstanceCredentials(id);
      console.log(`Credentials fetched: ${JSON.stringify({
        id: credentials.id,
        username: credentials.username,
        hasPassword: !!credentials.password,
        hasBaseUrl: !!credentials.baseUrl
      })}`);
      
      const { prosbcLogin } = await import('../utils/prosbc/login.js');
      
      // Use baseUrl directly from credentials
      const baseUrl = credentials.baseUrl;
      
      if (!baseUrl) {
        console.error(`No baseUrl found for instance ${id}`);
        return {
          success: false,
          message: 'Connection failed: No URL found for this instance',
          details: { testResult: 'Missing URL in database for this instance' }
        };
      }
      
      // Additional verification log
      console.log(`Using baseUrl: ${baseUrl} for connection test`);
      
      
      console.log(`Testing connection to ${baseUrl} with user ${credentials.username}`);
      
      try {
        // Test login
        const sessionCookie = await prosbcLogin(baseUrl, credentials.username, credentials.password);
        
        return {
          success: true,
          message: 'Connection successful',
          details: { 
            testResult: `Successfully connected to ${baseUrl}`,
            sessionCookie: !!sessionCookie
          }
        };
      } catch (error) {
        console.error(`Login error for ${baseUrl}:`, error);
        return {
          success: false,
          message: `Connection failed: ${error.message}`,
          details: { testResult: `Error connecting to ${baseUrl}: ${error.message}` }
        };
      }
    } catch (error) {
      console.error(`Test connection error:`, error);
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
        details: { testResult: error.message }
      };
    }
  }

  // For now, we'll use a simple decryption (in production, use proper encryption)
  decryptPassword(encryptedPassword) {
    // Since we're using bcrypt, we need to store plain passwords for API calls
    // For production, consider using reversible encryption like AES
    // For now, we'll modify the model to handle this differently
    return encryptedPassword;
  }

  // Initialize default instances from environment
  async initializeDefaultInstances() {
    try {
      const count = await ProSBCInstance.count();
      if (count === 0) {
        console.log('Initializing default ProSBC instances...');
        
        const defaultInstances = [
          {
            name: 'ProSBC NYC1',
            baseUrl: 'https://prosbc1nyc1.dipvtel.com:12358',
            username: 'Monitor',
            password: 'Temp@o25!!',
            location: 'New York',
            description: 'Primary ProSBC instance in New York',
            isActive: true
          },
          {
            name: 'ProSBC NYC2',
            baseUrl: 'https://prosbc1nyc2.dipvtel.com:12358',
            username: 'Monitor',
            password: 'Temp@o25!!',
            location: 'New York',
            description: 'Secondary ProSBC instance in New York',
            isActive: true
          },
          {
            name: 'ProSBC TPA2',
            baseUrl: 'http://prosbc5tpa2.dipvtel.com:12358',
            username: 'Monitor',
            password: 'Temp@o25!!',
            location: 'Tampa',
            description: 'ProSBC instance in Tampa',
            isActive: true
          }
        ];

        for (const instanceData of defaultInstances) {
          await this.createInstance(instanceData);
        }
        
        console.log('✅ Default ProSBC instances initialized successfully');
      }
    } catch (error) {
      console.error('❌ Failed to initialize default instances:', error.message);
    }
  }
}

export default new ProSBCInstanceService();
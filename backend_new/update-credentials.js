// Script to update ProSBC instance credentials
import ProSBCInstance from './models/ProSBCInstance.js';

const updateCredentials = async () => {
  try {
    console.log('Updating ProSBC instance credentials...');
    
    // Update prosbc3 credentials to match the ones you use
    const updateData = {
      username: 'tpa2admin',  // Your working username
      password: 'MAkula123!'  // Your working password
    };
    
    const [updatedCount] = await ProSBCInstance.update(updateData, {
      where: { id: 'prosbc3' }
    });
    
    if (updatedCount > 0) {
      console.log('✓ Updated prosbc3 credentials successfully');
    } else {
      console.log('✗ No instance found with ID prosbc3');
    }
    
    // Verify the update
    const instance = await ProSBCInstance.findByPk('prosbc3');
    if (instance) {
      console.log('Current prosbc3 credentials:');
      console.log(`  Username: ${instance.username}`);
      console.log(`  Password: ${instance.password ? '***' : 'NOT SET'}`);
      console.log(`  Base URL: ${instance.baseUrl}`);
    }
    
  } catch (error) {
    console.error('Error updating credentials:', error);
  }
  
  process.exit(0);
};

updateCredentials();
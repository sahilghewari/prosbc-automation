import database from './config/database.js';
import './models/ProSBCInstance.js';

const checkInstances = async () => {
  try {
    const ProSBCInstance = database.sequelize.models.ProSBCInstance;
    const instances = await ProSBCInstance.findAll();
    console.log('Current ProSBC instances in database:');
    instances.forEach(instance => {
      console.log(`  ID: ${instance.id}, Name: ${instance.name}, URL: ${instance.baseUrl}, Active: ${instance.isActive}`);
    });
    
    if (instances.length === 0) {
      console.log('No instances found in database. You need to create some first.');
    }
  } catch (error) {
    console.error('Error checking instances:', error);
  }
  process.exit(0);
};

checkInstances();

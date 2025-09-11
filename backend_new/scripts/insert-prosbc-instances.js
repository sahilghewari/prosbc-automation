import ProSBCInstance from '../models/ProSBCInstance.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prosbcInstances = JSON.parse(
  readFileSync(join(__dirname, '../config/prosbc-instances.json'), 'utf8')
);

async function insertProSBCInstances() {
  try {
    console.log('Inserting ProSBC instances...');
    
    for (const instance of prosbcInstances) {
      const [prosbcInstance, created] = await ProSBCInstance.findOrCreate({
        where: { id: instance.id },
        defaults: {
          id: instance.id,
          baseUrl: instance.baseURL, // Note: using baseUrl (database field name)
          username: instance.username,
          password: instance.password
        }
      });
      
      if (created) {
        console.log(`✓ Created ProSBC instance: ${instance.name} (ID: ${instance.id})`);
      } else {
        console.log(`- ProSBC instance already exists: ${instance.name} (ID: ${instance.id})`);
      }
    }
    
    console.log('ProSBC instances setup completed.');
  } catch (error) {
    console.error('Error inserting ProSBC instances:', error);
  }
}

// Run the function
insertProSBCInstances().then(() => process.exit(0));
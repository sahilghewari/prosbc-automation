import { ProSBCFileAPI } from './backend_new/utils/prosbc/prosbcFileManager.js';
import prosbcInstances from './backend_new/config/prosbc-instances.json' assert { type: 'json' };

async function testDbIdFix() {
  try {
    console.log('Testing DB ID extraction fix...\n');
    
    // Test with ProSBC1 which has the mismatch issue
    const instance = prosbcInstances.find(inst => inst.name === "ProSBC NYC1");
    if (!instance) {
      throw new Error('ProSBC1 instance not found');
    }
    
    const fileManager = new ProSBCFileAPI(instance.baseURL, instance.username, instance.password, 'ProSBC1');
    
    console.log('1. Testing configuration selection and DB ID extraction...');
    await fileManager.ensureConfigSelected(4); // Use config 4 which maps to DB ID 2
    console.log(`Selected config ID: ${fileManager.selectedConfigId}`);
    
    console.log('\n2. Testing DF file listing with correct DB ID...');
    const dfFiles = await fileManager.listDfFiles(4);
    console.log(`Found ${dfFiles.files?.length || 0} DF files`);
    if (dfFiles.files?.length > 0) {
      console.log('Sample files:', dfFiles.files.slice(0, 3).map(f => ({
        name: f.name,
        id: f.id
      })));
    }
    
    console.log('\n3. Testing DM file listing with correct DB ID...');
    const dmFiles = await fileManager.listDmFiles(4);
    console.log(`Found ${dmFiles.files?.length || 0} DM files`);
    if (dmFiles.files?.length > 0) {
      console.log('Sample files:', dmFiles.files.slice(0, 3).map(f => ({
        name: f.name,
        id: f.id
      })));
    }
    
    console.log('\n✅ DB ID fix test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testDbIdFix();

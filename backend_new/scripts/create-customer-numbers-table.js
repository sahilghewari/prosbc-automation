import database from '../config/database.js';
import CustomerNumber from '../models/CustomerNumber.js';

(async () => {
  try {
    console.log('🔧 Creating CustomerNumber table...');
    await database.connect();
    await CustomerNumber.sync({ force: false }); // Don't drop existing data
    console.log('✅ CustomerNumber table created successfully!');
    await database.disconnect();
  } catch (error) {
    console.error('❌ Failed to create table:', error.message);
    console.log('Note: The table may need to be created manually if database connection issues persist.');
  }
})();
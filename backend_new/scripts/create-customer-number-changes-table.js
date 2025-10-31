import database from '../config/database.js';
import CustomerNumberChange from '../models/CustomerNumberChange.js';

(async () => {
  try {
    console.log('🔧 Creating CustomerNumberChange table...');
    await database.connect();
    await CustomerNumberChange.sync({ force: false }); // Don't drop existing data
    console.log('✅ CustomerNumberChange table created successfully!');
    await database.disconnect();
  } catch (error) {
    console.error('❌ Failed to create table:', error.message);
    console.log('Note: The table may need to be created manually if database connection issues persist.');
  }
})();
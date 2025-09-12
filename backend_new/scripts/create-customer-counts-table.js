import database from './config/database.js';
import CustomerCount from './models/CustomerCount.js';

(async () => {
  try {
    console.log('🔧 Creating CustomerCount table...');
    await database.connect();
    await CustomerCount.sync({ force: false }); // Don't drop existing data
    console.log('✅ CustomerCount table created successfully!');
    await database.disconnect();
  } catch (error) {
    console.error('❌ Failed to create table:', error.message);
    console.log('Note: The table may need to be created manually if database connection issues persist.');
  }
})();
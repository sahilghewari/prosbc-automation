import database from '../config/database.js';
import PendingRemoval from '../models/PendingRemoval.js';

(async () => {
  try {
    console.log('🔧 Creating PendingRemoval table...');
    await database.connect();
    await PendingRemoval.sync({ force: false }); // Don't drop existing data
    console.log('✅ PendingRemoval table created successfully!');
    await database.disconnect();
  } catch (error) {
    console.error('❌ Failed to create table:', error.message);
    console.log('Note: The table may need to be created manually if database connection issues persist.');
  }
})();
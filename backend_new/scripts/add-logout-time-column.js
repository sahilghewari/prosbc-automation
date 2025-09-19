import 'dotenv/config';
import database from '../config/database.js';

(async () => {
  try {
    console.log('🚀 Adding logoutTime column to ActiveUsers table...');
    await database.connect();

    // Add logoutTime column to ActiveUsers table
    await database.sequelize.query(`
      ALTER TABLE ActiveUsers
      ADD COLUMN logoutTime DATETIME NULL;
    `);

    console.log('✅ logoutTime column added successfully.');
    await database.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to add column:', error);
    process.exit(1);
  }
})();
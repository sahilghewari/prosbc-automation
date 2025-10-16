import database from '../config/database.js';

(async () => {
  try {
    console.log('🔧 Adding createdAt column to logs table...');
    await database.connect();

    // Add createdAt column to logs table
    await database.sequelize.query(`
      ALTER TABLE logs
      ADD COLUMN createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    `);

    console.log('✅ createdAt column added successfully!');
    await database.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to add column:', error);
    process.exit(1);
  }
})();
import database from '../config/database.js';

(async () => {
  try {
    console.log('🔧 Adding indexes to prosbc_dm_files table...');
    await database.connect();

    // Add indexes for better query performance
    await database.sequelize.query(`
      ALTER TABLE prosbc_dm_files
      ADD INDEX idx_prosbc_instance_id (prosbc_instance_id),
      ADD INDEX idx_status (status)
    `);

    console.log('✅ Indexes added successfully!');
    await database.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to add indexes:', error);
    process.exit(1);
  }
})();
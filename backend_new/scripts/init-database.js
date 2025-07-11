import database from '../config/database.js';
import '../models/User.js';
import '../models/NAP.js';
import '../models/DigitMap.js';
import '../models/DialFormat.js';
import '../models/AuditLog.js';

// Helper to add column if not exists
async function addColumnIfNotExists(table, column, definition, sequelize) {
  const results = await sequelize.query(
    `SHOW COLUMNS FROM \`${table}\` LIKE :column`,
    { replacements: { column }, type: sequelize.QueryTypes.SELECT }
  );
  if (!results || results.length === 0) {
    await sequelize.query(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`
    );
    console.log(`Added column '${column}' to table '${table}'.`);
  }
}

(async () => {
  try {
    console.log('🚀 Initializing MariaDB (Sequelize) Database...');
    await database.connect();
    await database.sequelize.sync();
    // Ensure 'message' column exists in audit_logs
    await addColumnIfNotExists(
      'audit_logs',
      'message',
      'VARCHAR(255) NULL',
      database.sequelize
    );
    console.log('✅ All tables have been created/updated.');
    await database.disconnect();
    console.log('✨ Database initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
})();

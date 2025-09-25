import database from '../config/database.js';
import fs from 'fs';
import path from 'path';

(async () => {
  try {
    console.log('🔧 Recreating CustomerCount table...');
    await database.connect();

    // Read the recreate SQL file
    const sqlPath = path.join(process.cwd(), 'recreate_customer_counts_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    await database.sequelize.query(sql);

    console.log('✅ CustomerCount table recreated successfully!');
    await database.disconnect();
  } catch (error) {
    console.error('❌ Failed to recreate table:', error.message);
    console.log('Note: Check database connection and SQL syntax.');
  }
})();
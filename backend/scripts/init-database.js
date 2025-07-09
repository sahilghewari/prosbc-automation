
/**
 * Database Initialization Script for ProSBC NAP Testing Application (MariaDB/Sequelize)
 *
 * This script syncs all Sequelize models and creates tables in MariaDB if they do not exist.
 * Usage: node backend/scripts/init-database.js
 */

import database from '../config/database.js';
import '../models/index.js'; // Ensure all models are imported and registered

(async () => {
  try {
    console.log('🚀 Starting MariaDB (Sequelize) Database Initialization...\n');
    await database.connect();
    // Sync all models (alter: true = auto-migrate tables, do not drop data)
    await database.sequelize.sync({ alter: true });
    console.log('✅ All tables have been created/updated.');
    await database.disconnect();
    console.log('\n✨ Database initialization completed successfully!');
    console.log('\n🚀 You can now start the application with: npm run dev');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
})();

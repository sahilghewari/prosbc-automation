import database from '../config/database.js';
import '../models/index.js';

(async () => {
  try {
    console.log('🚀 Initializing MariaDB (Sequelize) Database...');
    await database.connect();
    await database.sequelize.sync({ force: true });
    console.log('✅ All tables have been created/updated.');
    await database.disconnect();
    console.log('✨ Database initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
})();

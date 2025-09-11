import database from './config/database.js';
import User from './models/User.js';

(async () => {
  try {
    console.log('🚀 Connecting to database...');
    await database.connect();
    
    // Create a test user
    const [user, created] = await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        username: 'admin',
        password: 'admin123',
        email: 'admin@example.com'
      }
    });
    
    if (created) {
      console.log('✅ Created new user:', user.username);
    } else {
      console.log('📝 User already exists:', user.username);
    }
    
    await database.disconnect();
    console.log('✨ User creation completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create user:', error);
    process.exit(1);
  }
})();

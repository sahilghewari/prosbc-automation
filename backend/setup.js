/**
 * Ubuntu Setup Script
 * Sets up the directory structure and initializes the backend
 */

import fs from 'fs-extra';
import path from 'path';

const STORAGE_BASE = process.env.STORAGE_PATH || '/root/prosbc-dashboard/files';

const DIRS = {
  df: path.join(STORAGE_BASE, 'df'),
  dm: path.join(STORAGE_BASE, 'dm'),
  routesets: path.join(STORAGE_BASE, 'routesets'),
  backups: path.join(STORAGE_BASE, 'backups'),
  naps: path.join(STORAGE_BASE, 'naps'),
  logs: path.join(STORAGE_BASE, 'logs'),
  metadata: path.join(STORAGE_BASE, 'metadata')
};

const setup = async () => {
  console.log('🔧 Setting up ProSBC NAP Testing Ubuntu deployment...');
  console.log(`📂 Base storage path: ${STORAGE_BASE}`);

  try {
    // Ensure all directories exist
    console.log('📁 Creating directory structure...');
    for (const [name, dir] of Object.entries(DIRS)) {
      await fs.ensureDir(dir);
      console.log(`   ✅ ${name}: ${dir}`);
    }

    // Create initial index files
    console.log('📋 Creating index files...');
    
    const fileIndex = path.join(DIRS.metadata, 'file_index.json');
    if (!await fs.pathExists(fileIndex)) {
      await fs.writeJson(fileIndex, [], { spaces: 2 });
      console.log('   ✅ file_index.json created');
    }

    const napIndex = path.join(DIRS.metadata, 'nap_index.json');
    if (!await fs.pathExists(napIndex)) {
      await fs.writeJson(napIndex, [], { spaces: 2 });
      console.log('   ✅ nap_index.json created');
    }

    // Create a sample configuration file
    const configFile = path.join(STORAGE_BASE, 'config.json');
    const config = {
      version: '1.0.0',
      setupDate: new Date().toISOString(),
      environment: 'ubuntu',
      storageType: 'filesystem',
      directories: DIRS,
      settings: {
        maxFileSize: '50MB',
        allowedFileTypes: ['csv', 'json', 'txt'],
        backupRetentionDays: 30,
        logRetentionDays: 90
      }
    };

    await fs.writeJson(configFile, config, { spaces: 2 });
    console.log(`   ✅ config.json created at ${configFile}`);

    // Set proper permissions (if running as root)
    try {
      await fs.chmod(STORAGE_BASE, 0o755);
      console.log(`   ✅ Permissions set for ${STORAGE_BASE}`);
    } catch (error) {
      console.log(`   ⚠️  Could not set permissions: ${error.message}`);
    }

    console.log('\n✅ Ubuntu setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Install dependencies: npm install');
    console.log('2. Start the backend: npm start');
    console.log('3. Build the frontend: npm run build');
    console.log('4. Serve the frontend with nginx or similar');
    console.log('\n🔗 Backend will be available at: http://localhost:3001/api/health');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
};

setup();

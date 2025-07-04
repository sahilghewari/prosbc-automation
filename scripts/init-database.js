#!/usr/bin/env node

/**
 * Database Initialization Script for ProSBC NAP Testing Application
 * 
 * This script initializes the MongoDB database with the required collections,
 * indexes, and sample data for development.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Import database schemas
import '../src/database/schemas/napRecords.js';
import '../src/database/schemas/uploadedFiles.js';
import '../src/database/schemas/fileEditHistory.js';
import '../src/database/schemas/routesetMapping.js';
import '../src/database/schemas/activationLogs.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/prosbc_nap';

async function initializeDatabase() {
  try {
    console.log('🚀 Starting ProSBC Database Initialization...\n');

    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully\n');

    // Get database instance
    const db = mongoose.connection.db;

    // Check existing collections
    console.log('🔍 Checking existing collections...');
    const collections = await db.listCollections().toArray();
    const existingCollections = collections.map(c => c.name);
    console.log(`Found ${existingCollections.length} existing collections:`, existingCollections, '\n');

    // Define required collections with indexes
    const requiredCollections = [
      {
        name: 'naprecords',
        indexes: [
          { fields: { napName: 1 }, options: { unique: true } },
          { fields: { status: 1 } },
          { fields: { createdAt: -1 } },
          { fields: { tags: 1 } },
          { fields: { 'metadata.lastModified': -1 } }
        ]
      },
      {
        name: 'uploadedfiles',
        indexes: [
          { fields: { fileName: 1, fileType: 1 }, options: { unique: true } },
          { fields: { fileType: 1 } },
          { fields: { uploadDate: -1 } },
          { fields: { tags: 1 } },
          { fields: { 'validation.isValid': 1 } }
        ]
      },
      {
        name: 'fileedithistories',
        indexes: [
          { fields: { fileId: 1 } },
          { fields: { timestamp: -1 } },
          { fields: { userId: 1 } },
          { fields: { fileId: 1, version: -1 } }
        ]
      },
      {
        name: 'routesetmappings',
        indexes: [
          { fields: { routesetId: 1 }, options: { unique: true } },
          { fields: { napId: 1 } },
          { fields: { isActive: 1 } },
          { fields: { createdAt: -1 } }
        ]
      },
      {
        name: 'activationlogs',
        indexes: [
          { fields: { napId: 1 } },
          { fields: { activationType: 1 } },
          { fields: { status: 1 } },
          { fields: { timestamp: -1 } },
          { fields: { napId: 1, timestamp: -1 } }
        ]
      }
    ];

    // Create collections and indexes
    console.log('🏗️  Creating collections and indexes...');
    for (const collection of requiredCollections) {
      try {
        // Create collection if it doesn't exist
        if (!existingCollections.includes(collection.name)) {
          await db.createCollection(collection.name);
          console.log(`✅ Created collection: ${collection.name}`);
        } else {
          console.log(`📁 Collection already exists: ${collection.name}`);
        }

        // Create indexes
        for (const index of collection.indexes) {
          try {
            await db.collection(collection.name).createIndex(index.fields, index.options || {});
            console.log(`📇 Created index on ${collection.name}:`, Object.keys(index.fields));
          } catch (error) {
            if (error.code === 85) {
              console.log(`📇 Index already exists on ${collection.name}:`, Object.keys(index.fields));
            } else {
              console.log(`⚠️  Warning: Could not create index on ${collection.name}:`, error.message);
            }
          }
        }
      } catch (error) {
        console.log(`⚠️  Warning: Issue with collection ${collection.name}:`, error.message);
      }
    }

    console.log('\n🎯 Adding sample data...');

    // Add sample NAP record
    const NapRecord = mongoose.model('NapRecord');
    const sampleNap = await NapRecord.findOne({ napName: 'sample-nap-001' });
    if (!sampleNap) {
      await NapRecord.create({
        napName: 'sample-nap-001',
        enabled: true,
        defaultProfile: '1',
        proxyAddress: '192.168.1.100',
        proxyPort: 5060,
        status: 'active',
        tags: ['sample', 'development'],
        metadata: {
          description: 'Sample NAP for development testing',
          environment: 'development',
          lastModified: new Date(),
          version: '1.0.0'
        }
      });
      console.log('✅ Created sample NAP record');
    } else {
      console.log('📁 Sample NAP record already exists');
    }

    // Add sample file record
    const UploadedFile = mongoose.model('UploadedFile');
    const sampleFile = await UploadedFile.findOne({ fileName: 'sample-df-001.csv' });
    if (!sampleFile) {
      await UploadedFile.create({
        fileName: 'sample-df-001.csv',
        fileType: 'df',
        filePath: '/prosbc-files/df/sample-df-001.csv',
        fileSize: 1024,
        uploadDate: new Date(),
        tags: ['sample', 'development'],
        validation: {
          isValid: true,
          validatedAt: new Date(),
          issues: []
        },
        integration: {
          isIntegrated: false,
          flags: ['sample']
        }
      });
      console.log('✅ Created sample file record');
    } else {
      console.log('📁 Sample file record already exists');
    }

    console.log('\n📊 Database Statistics:');
    const stats = await db.stats();
    console.log(`- Database: ${stats.db}`);
    console.log(`- Collections: ${stats.collections}`);
    console.log(`- Data Size: ${(stats.dataSize / 1024).toFixed(2)} KB`);
    console.log(`- Storage Size: ${(stats.storageSize / 1024).toFixed(2)} KB`);
    console.log(`- Indexes: ${stats.indexes}`);

    console.log('\n✨ Database initialization completed successfully!');
    console.log('\n🚀 You can now start the application with: npm run dev');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
  }
}

// Run initialization
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}

export default initializeDatabase;

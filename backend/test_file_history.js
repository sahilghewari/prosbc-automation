import { DigitMap, AuditLog } from './models/index.js';
import database from './config/database.js';

async function testFileHistory() {
  try {
    // Connect to database
    await database.connect();
    console.log('✅ Connected to database');

    // Create a test digit map
    const testDigitMap = new DigitMap({
      filename: 'test_dm_001.csv',
      original_filename: 'test_digitmap.csv',
      content: 'Pattern,Translation,Description\n^([2-9]\\d{2})([2-9]\\d{2})(\\d{4})$,+1\\1\\2\\3,North American numbering plan\n^0([1-9]\\d+)$,+44\\1,UK national dialing',
      file_size: 150,
      checksum: 'abc123def456',
      uploaded_by: 'test_user',
      version: 1,
      metadata: {
        encoding: 'utf-8',
        upload_source: 'web'
      }
    });

    await testDigitMap.save();
    console.log('✅ Test digit map created:', testDigitMap._id);

    // Create audit log entry with content backup
    const auditLog = await AuditLog.logEvent({
      event: 'Test Digit Map Created',
      category: 'file',
      severity: 'info',
      status: true,
      entity: {
        type: 'DigitMap',
        id: testDigitMap._id.toString(),
        name: testDigitMap.filename
      },
      user: {
        username: 'test_user'
      },
      action: {
        action: 'create',
        method: 'POST',
        endpoint: '/test'
      },
      changes: { created: true },
      metadata: {
        content_backup: {
          content: testDigitMap.content,
          headers: ['Pattern', 'Translation', 'Description'],
          checksum: testDigitMap.checksum,
          size: testDigitMap.file_size
        }
      }
    });
    console.log('✅ Audit log created:', auditLog._id);

    // Test the history endpoint
    console.log('🧪 Testing file history endpoint...');
    const response = await fetch(`http://localhost:3001/api/files/digit-maps/${testDigitMap._id}/history`);
    const result = await response.json();
    
    console.log('📋 History response:', JSON.stringify(result, null, 2));

    // Test the rollback endpoint
    console.log('🧪 Testing rollback endpoint...');
    
    // First, let's check what audit logs exist for our file
    const auditLogs = await AuditLog.find({ 'related_entity.id': testDigitMap._id.toString() });
    console.log('📋 Found audit logs:', auditLogs.length);
    
    if (auditLogs.length > 0) {
      const rollbackResponse = await fetch(`http://localhost:3001/api/files/digit-maps/${testDigitMap._id}/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          history_id: auditLogs[0]._id.toString(),
          reason: 'Testing rollback functionality'
        })
      });

      const rollbackResult = await rollbackResponse.json();
      console.log('🔄 Rollback response:', JSON.stringify(rollbackResult, null, 2));
    } else {
      console.log('⚠️ No audit logs found, skipping rollback test');
    }

    console.log('✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await database.disconnect();
    console.log('📦 Database disconnected');
  }
}

testFileHistory();

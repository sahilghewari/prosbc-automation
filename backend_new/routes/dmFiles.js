import express from 'express';
import csv from 'csv-parser';
import { Op } from 'sequelize';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import ProSBCDMFile from '../models/ProSBCDMFile.js';
import ProSBCInstance from '../models/ProSBCInstance.js';
import CustomerNumber from '../models/CustomerNumber.js';
import PendingRemoval from '../models/PendingRemoval.js';
import CustomerNumberChange from '../models/CustomerNumberChange.js';
import NumberEvent from '../models/NumberEvent.js';
import MonthlySnapshot from '../models/MonthlySnapshot.js';
import { getProSBCCredentials } from '../utils/prosbc/multiInstanceManager.js';
import { ProSBCFileAPI } from '../utils/prosbc/prosbcFileManager.js';

const router = express.Router();

// Helper to get instance config
async function getInstanceConfig(instanceId) {
  if (instanceId) {
    const instance = await getProSBCCredentials(instanceId);
    if (instance) {
      return {
        baseURL: instance.baseUrl,
        username: instance.username,
        password: instance.password,
        instanceId: instanceId
      };
    } else {
      throw new Error(`Instance ${instanceId} not found`);
    }
  } else {
    return {
      baseURL: process.env.PROSBC_BASE_URL,
      username: process.env.PROSBC_USERNAME,
      password: process.env.PROSBC_PASSWORD,
      instanceId: 'default'
    };
  }
}

// Function to extract numbers from CSV content
function extractNumbersFromCSV(csvContent) {
  return new Promise((resolve, reject) => {
    const numbers = [];
    const stream = Readable.from(csvContent);

    stream
      .pipe(csv())
      .on('data', (row) => {
        // Only extract numbers from the 'called' column (first column)
        const calledValue = Object.values(row)[0] || '';

        if (calledValue && calledValue.trim() !== '' && calledValue.trim() !== 'called') {
          numbers.push(calledValue.trim());
        }
      })
      .on('end', () => resolve(numbers))
      .on('error', reject);
  });
}

// POST /dm-files/sync
router.post('/sync', async (req, res) => {
  try {
    const instanceId = req.headers['x-prosbc-instance-id'];
    const { configId, userId } = req.body;

    if (!configId) {
      return res.status(400).json({ success: false, error: 'configId is required' });
    }

    const instanceConfig = await getInstanceConfig(instanceId);
    const fileManager = new ProSBCFileAPI(instanceId);

    // Get DM files
    const dmResult = await fileManager.listDmFiles(configId);
    if (!dmResult.success) {
      throw new Error('Failed to list DM files');
    }
    const dmFiles = dmResult.files.filter(file =>
      file.id &&
      !isNaN(file.id) &&
      file.name &&
      file.name.endsWith('.csv') &&
      !file.name.includes('called_calling') // Filter out header-like entries
    );

    // Get ProSBC instance details
    let prosbcInstance;
    if (instanceId) {
      prosbcInstance = await ProSBCInstance.findOne({ where: { id: instanceId } });
      if (!prosbcInstance) {
        return res.status(400).json({ success: false, error: 'Invalid instance ID' });
      }
    } else {
      // Default instance
      prosbcInstance = await ProSBCInstance.findOne({ where: { name: 'default' } });
      if (!prosbcInstance) {
        prosbcInstance = { id: 1, name: 'default' }; // Assume 1 if not found
      }
    }

    const syncedFiles = [];
    const errors = [];

    for (const file of dmFiles) {
      try {
        // Update status to syncing
        await ProSBCDMFile.upsert({
          file_name: file.name,
          prosbc_file_id: file.id.toString(),
          prosbc_instance_id: prosbcInstance.id,
          prosbc_instance_name: prosbcInstance.name,
          status: 'syncing',
          last_synced: new Date()
        });

        // Fetch the file content
        const exportUrl = `${fileManager.baseURL}${file.exportUrl}`;
        const response = await fetch(exportUrl, {
          headers: await fileManager.getCommonHeaders()
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch file ${file.name}: ${response.status}`);
        }

        const csvContent = await response.text();
        const numbers = await extractNumbersFromCSV(csvContent);

        // Store full CSV content and numbers array
        await ProSBCDMFile.upsert({
          file_name: file.name,
          file_content: csvContent,
          numbers: JSON.stringify(numbers),
          prosbc_file_id: file.id.toString(),
          prosbc_instance_id: prosbcInstance.id,
          prosbc_instance_name: prosbcInstance.name,
          total_numbers: numbers.length,
          last_synced: new Date(),
          status: 'active'
        });

        syncedFiles.push({
          file_name: file.name,
          total_numbers: numbers.length
        });

      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err);
        errors.push({
          file_name: file.name,
          error: err.message
        });

        // Update status to inactive on error
        try {
          await ProSBCDMFile.upsert({
            file_name: file.name,
            prosbc_file_id: file.id.toString(),
            prosbc_instance_id: prosbcInstance.id,
            prosbc_instance_name: prosbcInstance.name,
            status: 'inactive',
            last_synced: new Date()
          });
        } catch (dbError) {
          console.error('Error updating file status:', dbError);
        }
      }
    }

    res.json({
      success: true,
      message: `Synced ${syncedFiles.length} files, ${errors.length} errors`,
      syncedFiles,
      errors
    });

  } catch (err) {
    console.error('Error syncing DM files:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /dm-files/replace-all
router.post('/replace-all', async (req, res) => {
  console.time('replace-all-total');
  try {
    const { configId } = req.body;

    if (!configId) {
      return res.status(400).json({ success: false, error: 'configId is required' });
    }

    // Get all ProSBC instances
    const proSbcInstanceService = (await import('../services/proSbcInstanceService.js')).default;
    const instances = await proSbcInstanceService.getAllInstances();

    const results = { successes: [], failures: [] };

    // Helper to compute end of current month
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    for (const instance of instances) {
      console.time(`process-instance-${instance.id}`);
      try {
        const instanceId = instance.id;
        const instanceConfig = await getInstanceConfig(instanceId);
        const fileManager = new ProSBCFileAPI(instanceId);

        // Get DM files
        const dmResult = await fileManager.listDmFiles(configId);
        if (!dmResult.success) {
          throw new Error('Failed to list DM files');
        }
        const dmFiles = dmResult.files.filter(file =>
          file.id &&
          !isNaN(file.id) &&
          file.name &&
          file.name.endsWith('.csv') &&
          !file.name.includes('called_calling')
        );

        // Get ProSBC instance details
        let prosbcInstance;
        if (instanceId) {
          prosbcInstance = await ProSBCInstance.findOne({ where: { id: instanceId } });
          if (!prosbcInstance) {
            return res.status(400).json({ success: false, error: 'Invalid instance ID' });
          }
        } else {
          prosbcInstance = await ProSBCInstance.findOne({ where: { name: 'default' } });
          if (!prosbcInstance) {
            prosbcInstance = { id: 1, name: 'default' };
          }
        }

        // Aggregate new numbers across all files for this instance
        const newNumbersMap = new Map(); // number -> { customerName, fileName }
        const syncedFiles = [];

        // Fetch and process files sequentially to avoid overwhelming remote host; still parallel within DB ops
        for (const file of dmFiles) {
          try {
            const exportUrl = `${fileManager.baseURL}${file.exportUrl}`;
            const response = await fetch(exportUrl, {
              headers: await fileManager.getCommonHeaders()
            });

            if (!response.ok) {
              throw new Error(`Failed to fetch file ${file.name}: ${response.status}`);
            }

            const csvContent = await response.text();
            let numbers = await extractNumbersFromCSV(csvContent);
            numbers = numbers.map(n => (n || '').toString().trim()).filter(n => n);
            numbers = Array.from(new Set(numbers));

            // Upsert DM file record
            await ProSBCDMFile.upsert({
              file_name: file.name,
              file_content: csvContent,
              numbers: JSON.stringify(numbers),
              prosbc_file_id: file.id.toString(),
              prosbc_instance_id: prosbcInstance.id,
              prosbc_instance_name: prosbcInstance.name,
              total_numbers: numbers.length,
              last_synced: new Date(),
              status: 'active'
            });

            // Populate newNumbersMap
            numbers.forEach(num => {
              if (!newNumbersMap.has(num)) {
                newNumbersMap.set(num, { customerName: file.name, fileName: file.name });
              }
            });

            syncedFiles.push({ file_name: file.name, total_numbers: numbers.length });
          } catch (err) {
            console.error(`Error processing file ${file.name}:`, err);
            results.failures.push({ instanceId: instance.id, file_name: file.name, error: err.message });
          }
        }

        // Load existing active numbers for this instance
        const existingRows = await CustomerNumber.findAll({ where: { prosbcInstanceId: prosbcInstance.id.toString(), removedDate: null } });
        const existingMap = new Map(); // number -> row
        existingRows.forEach(r => existingMap.set(r.number, r));

        // Compute additions and removals
        const additions = [];
        const removalCandidates = [];

        // Additions: newNumbersMap keys not in existingMap
        for (const [num, meta] of newNumbersMap.entries()) {
          if (!existingMap.has(num)) {
            additions.push({ number: num, customerName: meta.customerName });
          } else {
            // If customerName changed, log an update event
            const existing = existingMap.get(num);
            if (existing.customerName !== meta.customerName) {
              await NumberEvent.create({
                number: num,
                action: 'update',
                customerName: meta.customerName,
                prosbcInstanceId: prosbcInstance.id,
                userId: req.user?.id || null,
                userName: req.user?.username || null,
                fileName: meta.fileName,
                details: `Customer changed from ${existing.customerName} to ${meta.customerName}`,
                timestamp: new Date()
              });
            }
          }
        }

        // Removals: existing numbers not in newNumbersMap -> pending removal
        for (const [num, row] of existingMap.entries()) {
          if (!newNumbersMap.has(num)) {
            removalCandidates.push({ number: num, customerName: row.customerName });
          }
        }

        // Persist additions in batches
        if (additions.length > 0) {
          const batchSize = 1000;
          for (let i = 0; i < additions.length; i += batchSize) {
            const batch = additions.slice(i, i + batchSize).map(a => ({
              number: a.number,
              customerName: a.customerName,
              addedDate: new Date(),
              prosbcInstanceId: prosbcInstance.id,
              addedBy: req.user?.id || null
            }));
            await CustomerNumber.bulkCreate(batch, { ignoreDuplicates: true });
          }

          // Create per-number events for additions (batch create)
          const eventBatches = [];
          const evBatchSize = 1000;
          for (let i = 0; i < additions.length; i += evBatchSize) {
            const eb = additions.slice(i, i + evBatchSize).map(a => ({
              number: a.number,
              action: 'add',
              customerName: a.customerName,
              prosbcInstanceId: prosbcInstance.id,
              userId: req.user?.id || null,
              userName: req.user?.username || null,
              fileName: a.customerName,
              details: 'Added during replace-all',
              timestamp: new Date()
            }));
            eventBatches.push(eb);
          }
          for (const eb of eventBatches) {
            await NumberEvent.bulkCreate(eb);
          }

          // Summary change record
          await CustomerNumberChange.create({
            customerName: 'multiple',
            changeType: 'add',
            count: additions.length,
            timestamp: new Date(),
            prosbcInstanceId: prosbcInstance.id,
            userId: req.user?.id || null,
            userName: req.user?.username || null,
            details: `Replace-all: Added ${additions.length} numbers`
          });
        }

        // Persist pending removals
        if (removalCandidates.length > 0) {
          const prBatchSize = 1000;
          for (let i = 0; i < removalCandidates.length; i += prBatchSize) {
            const batch = removalCandidates.slice(i, i + prBatchSize).map(r => ({
              number: r.number,
              customerName: r.customerName,
              removalDate: endOfMonth,
              prosbcInstanceId: prosbcInstance.id,
              removedBy: req.user?.id || null
            }));
            await PendingRemoval.bulkCreate(batch, { ignoreDuplicates: true });
          }

          // Create per-number events for removals
          const remEvBatches = [];
          const evBatchSize2 = 1000;
          for (let i = 0; i < removalCandidates.length; i += evBatchSize2) {
            const eb = removalCandidates.slice(i, i + evBatchSize2).map(r => ({
              number: r.number,
              action: 'remove',
              customerName: r.customerName,
              prosbcInstanceId: prosbcInstance.id,
              userId: req.user?.id || null,
              userName: req.user?.username || null,
              fileName: r.customerName,
              details: `Scheduled removal on ${endOfMonth.toISOString()}`,
              timestamp: new Date()
            }));
            remEvBatches.push(eb);
          }
          for (const eb of remEvBatches) {
            await NumberEvent.bulkCreate(eb);
          }

          // Summary change record (pending removals logged as remove)
          await CustomerNumberChange.create({
            customerName: 'multiple',
            changeType: 'remove',
            count: removalCandidates.length,
            timestamp: new Date(),
            prosbcInstanceId: prosbcInstance.id,
            userId: req.user?.id || null,
            userName: req.user?.username || null,
            details: `Replace-all: ${removalCandidates.length} numbers scheduled for removal on ${endOfMonth.toISOString()}`
          });
        }

        // Push result for this instance
        results.successes.push({
          instanceId: instance.id,
          syncedFiles
        });

        console.timeEnd(`process-instance-${instance.id}`);

      } catch (error) {
        console.timeEnd(`process-instance-${instance.id}`);
        console.error(`Error replacing data for ${instance.id}:`, error);
        results.failures.push({ instanceId: instance.id, error: error.message });
      }
    }

    console.timeEnd('replace-all-total');
    const hasSuccesses = results.successes.length > 0;
    const hasFailures = results.failures.length > 0;

    res.json({ success: hasSuccesses && !hasFailures, message: hasSuccesses ? `Data replace queued/completed for ${results.successes.length} instance(s).` : 'All replacements failed.', successes: results.successes, failures: results.failures });

  } catch (err) {
    console.timeEnd('replace-all-total');
    console.error('Error replacing all data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /dm-files - Create a new DM file entry
router.post('/', async (req, res) => {
  try {
    const instanceId = req.headers['x-prosbc-instance-id'];
    const { file_name, prosbc_file_id, file_content, configId } = req.body;

    if (!file_name) {
      return res.status(400).json({ success: false, error: 'file_name is required' });
    }

    // Get instance details
    let prosbcInstance;
    if (instanceId) {
      prosbcInstance = await ProSBCInstance.findOne({ where: { id: instanceId } });
      if (!prosbcInstance) {
        return res.status(400).json({ success: false, error: 'Invalid instance ID' });
      }
    } else {
      // Default instance
      prosbcInstance = await ProSBCInstance.findOne({ where: { name: 'default' } });
      if (!prosbcInstance) {
        prosbcInstance = { id: 1, name: 'default' }; // Assume 1 if not found
      }
    }

    // Extract numbers from CSV content if provided
    let numbers = [];
    let totalNumbers = 0;
    if (file_content) {
      numbers = await extractNumbersFromCSV(file_content);
      totalNumbers = numbers.length;
    }

    // Create the file entry
    const newFile = await ProSBCDMFile.create({
      file_name: file_name,
      file_content: file_content || null,
      numbers: file_content ? JSON.stringify(numbers) : null,
      prosbc_file_id: prosbc_file_id || null,
      prosbc_instance_id: prosbcInstance.id,
      prosbc_instance_name: prosbcInstance.name,
      total_numbers: totalNumbers,
      last_synced: new Date(),
      status: 'active'
    });

    res.json({
      success: true,
      message: 'DM file created successfully',
      file: {
        id: newFile.id,
        file_name: newFile.file_name,
        prosbc_file_id: newFile.prosbc_file_id,
        prosbc_instance_id: newFile.prosbc_instance_id,
        prosbc_instance_name: newFile.prosbc_instance_name,
        total_numbers: newFile.total_numbers,
        last_synced: newFile.last_synced,
        status: newFile.status,
        createdAt: newFile.createdAt,
        updatedAt: newFile.updatedAt
      }
    });

  } catch (err) {
    console.error('Error creating DM file:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /dm-files
router.get('/', async (req, res) => {
  try {
    const instanceId = req.query.instanceId;

    const whereClause = {};
    if (instanceId) {
      whereClause.prosbc_instance_id = instanceId;
    }

    const dmFiles = await ProSBCDMFile.findAll({
      where: whereClause,
      order: [['last_synced', 'DESC'], ['file_name', 'ASC']]
    });

    res.json({
      success: true,
      files: dmFiles.map(file => {
        // Safely parse numbers field
        let numbers = [];
        if (file.numbers) {
          try {
            // Check if it's already an object/array
            numbers = typeof file.numbers === 'string' ? JSON.parse(file.numbers) : file.numbers;
          } catch (parseError) {
            console.error(`[DM Files] Error parsing numbers for file ${file.file_name}:`, parseError.message);
            numbers = [];
          }
        }
        
        return {
          id: file.id,
          file_name: file.file_name,
          prosbc_file_id: file.prosbc_file_id,
          prosbc_instance_id: file.prosbc_instance_id,
          prosbc_instance_name: file.prosbc_instance_name,
          total_numbers: file.total_numbers,
          numbers: numbers,
          last_synced: file.last_synced,
          status: file.status,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt
        };
      })
    });

  } catch (err) {
    console.error('Error fetching DM files:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /dm-files/:id/content - Get file content for editing
router.get('/:id/content', async (req, res) => {
  try {
    const fileId = req.params.id;
    const instanceId = req.query.instanceId;

    const whereClause = { id: fileId };
    if (instanceId) {
      whereClause.prosbc_instance_id = instanceId;
    }

    const dmFile = await ProSBCDMFile.findOne({
      where: whereClause
    });

    if (!dmFile) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Return file content from database
    res.json({
      success: true,
      file: {
        id: dmFile.id,
        file_name: dmFile.file_name,
        file_content: dmFile.file_content,
        prosbc_file_id: dmFile.prosbc_file_id,
        prosbc_instance_id: dmFile.prosbc_instance_id,
        prosbc_instance_name: dmFile.prosbc_instance_name,
        last_synced: dmFile.last_synced,
        status: dmFile.status
      }
    });

  } catch (err) {
    console.error('Error fetching DM file content:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /dm-files/:id/content - Update file content in database and ProSBC
router.put('/:id/content', async (req, res) => {
  try {
    const fileId = req.params.id;
    const { file_content, configId } = req.body;
    const instanceId = req.headers['x-prosbc-instance-id'];

    if (!file_content) {
      return res.status(400).json({ success: false, error: 'file_content is required' });
    }

    // Find the file in database
    const dmFile = await ProSBCDMFile.findOne({
      where: { id: fileId }
    });

    if (!dmFile) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Extract numbers from the updated CSV content
    const numbers = await extractNumbersFromCSV(file_content);

    // Update database first
    await dmFile.update({
      file_content: file_content,
      numbers: JSON.stringify(numbers),
      total_numbers: numbers.length,
      last_synced: new Date(),
      status: 'active'
    });

    // Update ProSBC if instanceId and configId are provided
    let prosbcUpdateResult = null;
    if (instanceId && configId) {
      try {
        const instanceConfig = await getInstanceConfig(instanceId);
        const fileManager = new ProSBCFileAPI(instanceId);

        // Clean the filename: remove any timestamp suffix that may have been added
        // Pattern: filename.csv_1234567890123.csv -> filename.csv
        let cleanFileName = dmFile.file_name;
        const timestampPattern = /\.csv_\d{13}\.csv$/i;
        if (timestampPattern.test(cleanFileName)) {
          cleanFileName = cleanFileName.replace(timestampPattern, '.csv');
          console.log(`[DM Update] Cleaned filename: '${dmFile.file_name}' -> '${cleanFileName}'`);
        }

        // Use REST API method which doesn't require CSRF token
        // and works better with Basic Auth
        prosbcUpdateResult = await fileManager.updateFileRestAPI(
          'routesets_digitmaps',
          cleanFileName,
          file_content,
          configId
        );

        // Update sync status
        await dmFile.update({
          last_synced: new Date(),
          status: 'active'
        });

      } catch (prosbcError) {
        console.error('Error updating ProSBC:', prosbcError);
        // Don't fail the whole operation if ProSBC update fails
        prosbcUpdateResult = {
          success: false,
          error: prosbcError.message
        };
      }
    }

    res.json({
      success: true,
      message: 'File updated successfully',
      file: {
        id: dmFile.id,
        file_name: dmFile.file_name,
        total_numbers: numbers.length,
        last_synced: dmFile.last_synced,
        status: dmFile.status
      },
      prosbc_update: prosbcUpdateResult
    });

  } catch (err) {
    console.error('Error updating DM file content:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /dm-files/clear
router.delete('/clear', async (req, res) => {
  try {
    const instanceId = req.headers['x-prosbc-instance-id'];

    if (!instanceId) {
      return res.status(400).json({ success: false, error: 'instanceId is required in headers' });
    }

    // Delete all records for this instance
    const deletedCount = await ProSBCDMFile.destroy({
      where: {
        prosbc_instance_id: instanceId
      }
    });

    res.json({
      success: true,
      message: `Deleted ${deletedCount} DM file records for instance ${instanceId}`
    });

  } catch (err) {
    console.error('Error clearing DM files:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /dm-files/process-pending-removals
// Processes pending removals whose removalDate is <= now: marks CustomerNumber.removedDate
router.post('/process-pending-removals', async (req, res) => {
  try {
    const now = new Date();
  const due = await PendingRemoval.findAll({ where: { removalDate: { [Op.lte]: now } } });

    if (!due || due.length === 0) {
      return res.json({ success: true, message: 'No pending removals due' });
    }

    const processed = [];
    for (const rem of due) {
      try {
        // Mark CustomerNumber removedDate
        await CustomerNumber.update({ removedDate: rem.removalDate, removedBy: rem.removedBy }, {
          where: { number: rem.number, prosbcInstanceId: rem.prosbcInstanceId, removedDate: null }
        });

        // Log summary change
        let removedByName = null;
        if (rem.removedBy) {
          try {
            const User = (await import('../models/User.js')).default;
            const u = await User.findOne({ where: { id: rem.removedBy } });
            if (u) removedByName = u.username;
          } catch (err) {
            console.error('Error resolving removedBy user name:', err);
          }
        }

        await CustomerNumberChange.create({
          customerName: rem.customerName,
          changeType: 'remove',
          count: 1,
          timestamp: new Date(),
          prosbcInstanceId: rem.prosbcInstanceId,
          userId: rem.removedBy || null,
          userName: removedByName,
          details: `Processed pending removal for ${rem.number}`
        });

        // Remove pending removal
        await rem.destroy();
        processed.push(rem.number);
      } catch (err) {
        console.error('Error processing pending removal for', rem.number, err);
      }
    }

    res.json({ success: true, processedCount: processed.length, processed });
  } catch (err) {
    console.error('Error processing pending removals:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /dm-files/monthly-usage
// Returns billed unique numbers per customer for a given month (year, month)
router.get('/monthly-usage', async (req, res) => {
  try {
    const instanceId = req.query.instanceId;
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10); // 1..12

    if (!year || !month) {
      return res.status(400).json({ success: false, error: 'year and month query parameters are required' });
    }

    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const whereClause = {
      addedDate: { [Op.lte]: monthEnd },
      [Op.or]: [
        { removedDate: null },
        { removedDate: { [Op.gte]: monthStart } }
      ]
    };

    if (instanceId) whereClause.prosbcInstanceId = instanceId.toString();

    // Find unique numbers matching the condition
    const rows = await CustomerNumber.findAll({ where: whereClause });

    // Aggregate by customerName
    const usageMap = new Map();
    rows.forEach(r => {
      const key = `${r.customerName}::${r.prosbcInstanceId}`;
      if (!usageMap.has(key)) usageMap.set(key, { customerName: r.customerName, prosbcInstanceId: r.prosbcInstanceId, numbers: new Set() });
      usageMap.get(key).numbers.add(r.number);
    });

    const result = Array.from(usageMap.values()).map(v => ({ customerName: v.customerName, prosbcInstanceId: v.prosbcInstanceId, count: v.numbers.size }));

    res.json({ success: true, year, month, usage: result });
  } catch (err) {
    console.error('Error computing monthly usage:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /dm-files/cleanup - Fix malformed JSON data
router.post('/cleanup', async (req, res) => {
  try {
    const instanceId = req.headers['x-prosbc-instance-id'];

    if (!instanceId) {
      return res.status(400).json({ success: false, error: 'instanceId is required in headers' });
    }

    // Get all files for this instance
    const dmFiles = await ProSBCDMFile.findAll({
      where: {
        prosbc_instance_id: instanceId
      }
    });

    let fixedCount = 0;
    let errorCount = 0;

    for (const file of dmFiles) {
      try {
        let parsedNumbers = [];
        let needsUpdate = false;

        if (file.numbers) {
          if (Array.isArray(file.numbers)) {
            // If it's already an array, use it
            parsedNumbers = file.numbers;
            needsUpdate = true; // Convert to string
          } else if (typeof file.numbers === 'string') {
            // Try to parse and re-stringify to fix any issues
            try {
              parsedNumbers = JSON.parse(file.numbers);
              needsUpdate = true; // Re-stringify to ensure proper format
            } catch (parseError) {
              console.log(`Attempting to fix malformed JSON for ${file.file_name}`);
              // Try to clean up the string
              let cleaned = file.numbers.trim();
              cleaned = cleaned.replace(/,(\s*\])/g, '$1'); // Remove trailing commas
              cleaned = cleaned.replace(/,(\s*\})/g, '$1'); // Remove trailing commas in objects
              parsedNumbers = JSON.parse(cleaned);
              needsUpdate = true;
            }
          } else {
            console.error(`Unexpected type for numbers in ${file.file_name}:`, typeof file.numbers);
            continue;
          }
        }

        if (needsUpdate) {
          // Re-stringify to ensure proper JSON format
          const fixedJson = JSON.stringify(parsedNumbers);
          // Update the record
          await file.update({ numbers: fixedJson });
          fixedCount++;
        }
      } catch (err) {
        console.error(`Failed to fix ${file.file_name}:`, err.message);
        errorCount++;
      }
    }

    res.json({
      success: true,
      message: `Cleanup completed. Fixed ${fixedCount} records, ${errorCount} errors.`
    });

  } catch (err) {
    console.error('Error in cleanup:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /dm-files/search - Search for numbers in DM files
router.post('/search', async (req, res) => {
  try {
    const { numbers, instanceId } = req.body;

    if (!numbers || !Array.isArray(numbers)) {
      return res.status(400).json({ success: false, error: 'numbers array is required in request body' });
    }

    if (numbers.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one number is required' });
    }

    // Build where clause
    const whereClause = {};
    if (instanceId) {
      whereClause.prosbc_instance_id = instanceId;
    }

    // Get all DM files with their numbers
    const dmFiles = await ProSBCDMFile.findAll({
      where: whereClause,
      attributes: ['id', 'file_name', 'prosbc_instance_id', 'prosbc_instance_name', 'numbers']
    });

    console.log(`Found ${dmFiles.length} DM files to search`);

    // Pre-parse numbers for all files to avoid repeated JSON parsing
    const parsedFiles = [];
    for (const file of dmFiles) {
      try {
        let fileNumbers = [];
        if (file.numbers) {
          if (Array.isArray(file.numbers)) {
            fileNumbers = file.numbers;
          } else if (typeof file.numbers === 'string') {
            fileNumbers = JSON.parse(file.numbers);
          }
        }
        parsedFiles.push({
          ...file.toJSON(),
          parsedNumbers: fileNumbers
        });
      } catch (err) {
        console.error(`Error parsing numbers for file ${file.file_name}:`, err);
        // Skip this file
      }
    }

    const results = [];

    for (const searchNumber of numbers) {
      const foundLocations = [];

      for (const file of parsedFiles) {
        if (file.parsedNumbers.includes(searchNumber)) {
          foundLocations.push({
            file_name: file.file_name,
            prosbc_instance_id: file.prosbc_instance_id,
            prosbc_instance_name: file.prosbc_instance_name
          });
        }
      }

      results.push({
        number: searchNumber,
        found: foundLocations.length > 0,
        locations: foundLocations
      });
    }

    res.json({
      success: true,
      results: results
    });

  } catch (err) {
    console.error('Error in DM files search:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /dm-files/debug - Debug endpoint to check data format
router.get('/debug', async (req, res) => {
  try {
    const instanceId = req.query.instanceId;
    const limit = parseInt(req.query.limit) || 5;

    const whereClause = {};
    if (instanceId) {
      whereClause.prosbc_instance_id = instanceId;
    }

    const dmFiles = await ProSBCDMFile.findAll({
      where: whereClause,
      attributes: ['id', 'file_name', 'numbers', 'prosbc_instance_id'],
      limit: limit
    });

    const debugInfo = dmFiles.map(file => ({
      id: file.id,
      file_name: file.file_name,
      numbers_type: typeof file.numbers,
      numbers_preview: typeof file.numbers === 'string' ? file.numbers.substring(0, 50) + '...' : file.numbers,
      prosbc_instance_id: file.prosbc_instance_id
    }));

    res.json({
      success: true,
      debug: debugInfo,
      total_found: dmFiles.length
    });

  } catch (err) {
    console.error('Error in debug:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
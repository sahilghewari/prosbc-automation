import express from 'express';
import csv from 'csv-parser';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import ProSBCDMFile from '../models/ProSBCDMFile.js';
import ProSBCInstance from '../models/ProSBCInstance.js';
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
    const { configId } = req.body;

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
      files: dmFiles.map(file => ({
        id: file.id,
        file_name: file.file_name,
        prosbc_file_id: file.prosbc_file_id,
        prosbc_instance_id: file.prosbc_instance_id,
        prosbc_instance_name: file.prosbc_instance_name,
        total_numbers: file.total_numbers,
        numbers: file.numbers ? JSON.parse(file.numbers) : [],
        last_synced: file.last_synced,
        status: file.status,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt
      }))
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

        // Create a temporary file with the content
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFilePath = path.join(tempDir, `${dmFile.file_name}_${Date.now()}.csv`);
        fs.writeFileSync(tempFilePath, file_content);

        // Update the file on ProSBC
        prosbcUpdateResult = await fileManager.updateFile(
          'routesets_digitmaps',
          dmFile.prosbc_file_id, // Use the actual ProSBC file ID
          tempFilePath,
          null,
          configId
        );

        // Clean up temp file
        fs.unlinkSync(tempFilePath);

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

// GET /dm-files/search?numbers=num1,num2,num3&instanceId=optional
router.get('/search', async (req, res) => {
  try {
    const numbersParam = req.query.numbers || req.query.number;
    const instanceId = req.query.instanceId;

    if (!numbersParam) {
      return res.status(400).json({ success: false, error: 'numbers parameter is required' });
    }

    const numbers = numbersParam.split(/[, \r\n]+/).map(num => num.trim()).filter(num => num);
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

    const results = [];

    for (const searchNumber of numbers) {
      const foundLocations = [];

      for (const file of dmFiles) {
        try {
          let fileNumbers = [];
          if (file.numbers) {
            if (Array.isArray(file.numbers)) {
              // If it's already an array
              fileNumbers = file.numbers;
            } else if (typeof file.numbers === 'string') {
              // Handle potential malformed JSON from old data
              try {
                fileNumbers = JSON.parse(file.numbers);
              } catch (parseError) {
                console.error(`Error parsing numbers for file ${file.file_name}:`, parseError.message);
                console.error(`Raw numbers data:`, file.numbers.substring(0, 100));

                // Try to fix common JSON issues
                try {
                  // Remove any trailing commas before closing bracket
                  let cleanedData = file.numbers.trim().replace(/,(\s*\])/g, '$1');
                  fileNumbers = JSON.parse(cleanedData);
                } catch (secondError) {
                  console.error(`Failed to fix JSON for ${file.file_name}:`, secondError.message);
                  continue;
                }
              }
            } else {
              console.error(`Numbers field is not a string or array for ${file.file_name}, type:`, typeof file.numbers);
              continue;
            }
          }

          if (Array.isArray(fileNumbers) && fileNumbers.includes(searchNumber)) {
            foundLocations.push({
              file_name: file.file_name,
              prosbc_instance_id: file.prosbc_instance_id,
              prosbc_instance_name: file.prosbc_instance_name
            });
          }
        } catch (err) {
          console.error(`Error processing file ${file.file_name}:`, err);
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
import express from 'express';
import csv from 'csv-parser';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import CustomerCount from '../models/CustomerCount.js';
import ProSBCInstance from '../models/ProSBCInstance.js';
import { getProSBCCredentials } from '../utils/prosbc/multiInstanceManager.js';
import { prosbcLogin } from '../utils/prosbc/login.js';
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

// Function to fetch DM file content
async function fetchDMFile(baseURL, sessionCookie, dbId, fileId) {
  const exportUrl = `${baseURL}/file_dbs/${dbId}/dm/${fileId}/export`;
  const response = await fetch(exportUrl, {
    headers: {
      'Cookie': `_WebOAMP_session=${sessionCookie}`,
      'User-Agent': 'Mozilla/5.0 (compatible; ProSBC-Automation)'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch DM file ${fileId}: ${response.status}`);
  }
  return response.text();
}

// Function to count numbers in 'called' or 'calling' column
function countCalledNumbers(csvContent, fileName) {
  return new Promise((resolve, reject) => {
    let count = 0;
    const stream = Readable.from(csvContent);

    stream
      .pipe(csv())
      .on('data', (row) => {
        // Check 'called' first, then 'calling' if 'called' is empty
        const calledValue = Object.values(row)[0] || '';
        const callingValue = Object.values(row)[1] || '';
        if ((calledValue && calledValue.trim() !== '') || (callingValue && callingValue.trim() !== '')) {
          count++;
        }
      })
      .on('end', () => resolve(count))
      .on('error', reject);
  });
}

// Function to create monthly historical counts for all DM files
async function createMonthlyHistoricalCounts(instanceId, configId, fileManager) {
  try {
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

    // Use the correct prosbcInstanceId format (prosbc1, prosbc2, etc.)
    const prosbcInstanceId = `prosbc${instanceId}`;

    const currentDate = new Date();
    const currentMonth = currentDate.toISOString().slice(0, 10); // YYYY-MM-DD

    for (const file of dmFiles) {
      try {
        // Fetch the file content directly
        const exportUrl = `${fileManager.baseURL}${file.exportUrl}`;
        const response = await fetch(exportUrl, {
          headers: await fileManager.getCommonHeaders()
        });
        if (!response.ok) {
          console.error(`Failed to fetch file ${file.name}: ${response.status}`);
          continue;
        }
        const csvContent = await response.text();
        const count = await countCalledNumbers(csvContent, file.name);

        // Check if we need to store monthly data
        const existingRecord = await CustomerCount.findOne({
          where: {
            customerName: file.name,
            date: currentMonth,
            prosbcInstanceId: prosbcInstanceId
          }
        });

        if (!existingRecord) {
          await CustomerCount.create({
            customerName: file.name,
            count: count,
            date: currentMonth,
            prosbcInstanceId: prosbcInstanceId
          });
          console.log(`Created historical count for ${file.name} on ${currentMonth}`);
        } else {
          console.log(`Historical count already exists for ${file.name} on ${currentMonth}`);
        }
      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err);
        // Continue with other files
      }
    }
  } catch (error) {
    console.error('Error creating monthly historical counts:', error);
    throw error;
  }
}

// GET /customer-counts
router.get('/', async (req, res) => {
  try {
    const instanceId = req.headers['x-prosbc-instance-id'];
    const configId = req.query.configId;

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

    const liveCounts = [];

    for (const file of dmFiles) {
      try {
        // Fetch the file content directly
        const exportUrl = `${fileManager.baseURL}${file.exportUrl}`;
        const response = await fetch(exportUrl, {
          headers: await fileManager.getCommonHeaders()
        });
        if (!response.ok) {
          console.error(`Failed to fetch file ${file.name}: ${response.status}`);
          continue;
        }
        const csvContent = await response.text();
        const count = await countCalledNumbers(csvContent, file.name);
        liveCounts.push({
          customerName: file.name,
          count: count
        });
      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err);
        // Continue with other files
      }
    }

    // Get historical data
    let historicalCounts = [];
    try {
      // Map instanceId to prosbcInstanceId format (prosbc1, prosbc2, etc.)
      const prosbcInstanceId = `prosbc${instanceId}`;

      historicalCounts = await CustomerCount.findAll({
        where: { prosbcInstanceId: prosbcInstanceId },
        order: [['date', 'DESC'], ['customerName', 'ASC']]
      });
    } catch (dbError) {
      // Silently skip if table doesn't exist
    }

    res.json({
      success: true,
      liveCounts: liveCounts,
      historicalCounts: historicalCounts.map(record => ({
        customerName: record.customerName,
        count: record.count,
        date: record.date
      }))
    });
  } catch (err) {
    console.error('Error in customer counts:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /customer-counts/create-monthly
router.post('/create-monthly', async (req, res) => {
  try {
    const instanceId = req.headers['x-prosbc-instance-id'];
    const configId = req.body.configId;

    if (!configId) {
      return res.status(400).json({ success: false, error: 'configId is required' });
    }

    const instanceConfig = await getInstanceConfig(instanceId);
    const fileManager = new ProSBCFileAPI(instanceId);

    await createMonthlyHistoricalCounts(instanceId, configId, fileManager);

    res.json({
      success: true,
      message: 'Monthly historical counts created successfully'
    });
  } catch (err) {
    console.error('Error creating monthly historical counts:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /customer-counts/historical?instanceId=xxx
router.get('/historical', async (req, res) => {
  try {
    const instanceId = req.query.instanceId;

    if (!instanceId) {
      return res.status(400).json({ success: false, error: 'instanceId is required' });
    }

    // Map instanceId to prosbcInstanceId format (prosbc1, prosbc2, etc.)
    const prosbcInstanceId = `prosbc${instanceId}`;

    const historicalCounts = await CustomerCount.findAll({
      where: { prosbcInstanceId: prosbcInstanceId },
      order: [['date', 'DESC'], ['customerName', 'ASC']]
    });

    res.json({
      success: true,
      historicalCounts: historicalCounts.map(record => ({
        customerName: record.customerName,
        count: record.count,
        date: record.date
      }))
    });
  } catch (err) {
    console.error('Error fetching historical data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
router.get('/search', async (req, res) => {
  try {
    const instanceId = req.headers['x-prosbc-instance-id'];
    const configId = req.query.configId;
    const numbersParam = req.query.numbers || req.query.number; // Support both 'numbers' and 'number' for backward compatibility

    if (!configId || !numbersParam) {
      return res.status(400).json({ success: false, error: 'configId and numbers are required' });
    }

    const numbers = numbersParam.split(/[, \r\n]+/).map(num => num.trim()).filter(num => num);
    if (numbers.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one number is required' });
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

    const results = [];

    for (const searchNumber of numbers) {
      let found = false;
      let customerName = null;

      for (const file of dmFiles) {
        if (found) break; // Skip remaining files if already found
        try {
          // Fetch the file content directly
          const exportUrl = `${fileManager.baseURL}${file.exportUrl}`;
          const response = await fetch(exportUrl, {
            headers: await fileManager.getCommonHeaders()
          });
          if (!response.ok) {
            console.error(`Failed to fetch file ${file.name}: ${response.status}`);
            continue;
          }
          const csvContent = await response.text();
          const numberFound = await searchNumberInCSV(csvContent, searchNumber);
          if (numberFound) {
            found = true;
            customerName = file.name;
            break;
          }
        } catch (err) {
          console.error(`Error processing file ${file.name}:`, err);
        }
      }

      results.push({
        number: searchNumber,
        found: found,
        customerName: customerName
      });
    }

    res.json({
      success: true,
      results: results
    });
  } catch (err) {
    console.error('Error in bulk search:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

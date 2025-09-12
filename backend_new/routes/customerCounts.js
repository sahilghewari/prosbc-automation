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
    let headersLogged = false;
    const stream = Readable.from(csvContent);

    stream
      .pipe(csv())
      .on('data', (row) => {
        if (!headersLogged && fileName === 'DIP_800_TFN_DM.csv') {
          console.log('Headers for DIP_800_TFN_DM.csv:', Object.keys(row));
          headersLogged = true;
        }
        if (fileName === 'DIP_800_TFN_DM.csv') {
          console.log('Row for DIP_800_TFN_DM.csv:', row);
        }
        if (fileName === 'DIP_800_TFN_DM.csv') {
          console.log('Row keys:', Object.keys(row));
          console.log('Row values:', Object.values(row));
          console.log('row["Called"]:', row['Called']);
          console.log('row["called"]:', row['called']);
          console.log('row["CALLED"]:', row['CALLED']);
        }
        // Check 'called' first, then 'calling' if 'called' is empty
        const calledValue = Object.values(row)[0] || '';
        const callingValue = Object.values(row)[1] || '';
        if (fileName === 'DIP_800_TFN_DM.csv') {
          console.log('calledValue:', calledValue, 'callingValue:', callingValue);
        }
        if ((calledValue && calledValue.trim() !== '') || (callingValue && callingValue.trim() !== '')) {
          if (fileName === 'DIP_800_TFN_DM.csv') {
            console.log('Incrementing count for DIP_800_TFN_DM.csv');
          }
          count++;
        }
      })
      .on('end', () => resolve(count))
      .on('error', reject);
  });
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

    // Get ProSBC instance ID from DB
    let prosbcInstanceId;
    if (instanceId) {
      const instance = await ProSBCInstance.findOne({ where: { id: instanceId } });
      if (!instance) {
        return res.status(400).json({ success: false, error: 'Invalid instance ID' });
      }
      prosbcInstanceId = instance.id;
    } else {
      // Default instance
      const instance = await ProSBCInstance.findOne({ where: { name: 'default' } });
      prosbcInstanceId = instance ? instance.id : 1; // Assume 1 if not found
    }

    const liveCounts = [];
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
        if (file.name === 'DIP_800_TFN_DM.csv') {
          console.log('CSV Content for DIP_800_TFN_DM.csv:', csvContent);
        }
        const count = await countCalledNumbers(csvContent, file.name);
        if (file.name === 'DIP_800_TFN_DM.csv') {
          console.log('Count for DIP_800_TFN_DM.csv:', count);
        }
        liveCounts.push({
          customerName: file.name,
          count: count
        });

        // Check if we need to store monthly data
        try {
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
          }
        } catch (dbError) {
          // Silently skip database operations if table doesn't exist
        }
      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err);
        // Continue with other files
      }
    }

    // Get historical data
    let historicalCounts = [];
    try {
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

// GET /customer-counts/historical?instanceId=xxx
router.get('/historical', async (req, res) => {
  try {
    const instanceId = req.query.instanceId;

    if (!instanceId) {
      return res.status(400).json({ success: false, error: 'instanceId is required' });
    }

    // Get historical data for the specified instance
    const historicalCounts = await CustomerCount.findAll({
      where: { prosbcInstanceId: instanceId },
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

export default router;

import express from 'express';
import csv from 'csv-parser';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import { Op } from 'sequelize';
import CustomerCount from '../models/CustomerCount.js';
import CustomerNumber from '../models/CustomerNumber.js';
import PendingRemoval from '../models/PendingRemoval.js';
import ProSBCInstance from '../models/ProSBCInstance.js';
import User from '../models/User.js';
import CustomerNumberChange from '../models/CustomerNumberChange.js';
import NumberEvent from '../models/NumberEvent.js';
import MonthlyBillingSnapshot from '../models/MonthlyBillingSnapshot.js';
import { fn, col } from 'sequelize';
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

// Function to search for a number in CSV
function searchNumberInCSV(csvContent, searchNumber) {
  return new Promise((resolve, reject) => {
    const stream = Readable.from(csvContent);

    stream
      .pipe(csv())
      .on('data', (row) => {
        // Check 'called' and 'calling' columns
        const calledValue = Object.values(row)[0] || '';
        const callingValue = Object.values(row)[1] || '';
        if (calledValue.trim() === searchNumber.trim() || callingValue.trim() === searchNumber.trim()) {
          resolve(true);
        }
      })
      .on('end', () => resolve(false))
      .on('error', reject);
  });
}

// Function to create monthly billing snapshots for historical data
async function createMonthlyBillingSnapshots(instanceId, year, month) {
  try {
    const prosbcInstanceId = instanceId.startsWith('prosbc') ? instanceId : `prosbc${instanceId}`;

    // Month window for billing period
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    console.log(`Creating billing snapshots for ${prosbcInstanceId} - ${year}-${month} (SIMPLE LOGIC)`);

    // Get all customers that have current live numbers OR had activity during this month
    const customers = await CustomerNumber.findAll({
      where: {
        prosbcInstanceId,
        [Op.or]: [
          { removedDate: null }, // Currently live
          {
            addedDate: { [Op.between]: [monthStart, monthEnd] } // Added during month
          }
        ]
      },
      attributes: ['customerName'],
      group: ['customerName']
    });

    const snapshots = [];

    for (const customer of customers) {
      const customerName = customer.customerName;

      // SIMPLE LOGIC: Get current live count
      const [liveData] = await CustomerNumber.findAll({
        where: { customerName, prosbcInstanceId, removedDate: null },
        attributes: [[fn('COUNT', fn('DISTINCT', col('number'))), 'liveCount']],
        raw: true
      });

      // Get added count for the month
      const [addedData] = await NumberEvent.findAll({
        where: {
          customerName,
          prosbcInstanceId,
          action: 'add',
          timestamp: { [Op.between]: [monthStart, monthEnd] }
        },
        attributes: [[fn('COUNT', fn('DISTINCT', col('number'))), 'addedCount']],
        raw: true
      });

      // Get removed count for the month
      const [removedData] = await NumberEvent.findAll({
        where: {
          customerName,
          prosbcInstanceId,
          action: 'remove',
          timestamp: { [Op.between]: [monthStart, monthEnd] }
        },
        attributes: [[fn('COUNT', fn('DISTINCT', col('number'))), 'removedCount']],
        raw: true
      });

      const liveCount = parseInt(liveData?.liveCount || 0);
      const addedCount = parseInt(addedData?.addedCount || 0);
      const removedCount = parseInt(removedData?.removedCount || 0);

      // SIMPLE BILLING: billedCount = liveCount + addedCount
      const billedCount = liveCount + addedCount;

      // Get list of current live numbers for audit
      const liveNumbers = await CustomerNumber.findAll({
        where: { customerName, prosbcInstanceId, removedDate: null },
        attributes: ['number', 'addedDate'],
        raw: true
      });

      // Get monthly events summary
      const monthlyEvents = await NumberEvent.findAll({
        where: {
          customerName,
          prosbcInstanceId,
          timestamp: { [Op.between]: [monthStart, monthEnd] }
        },
        attributes: [
          'action',
          [fn('COUNT', 'id'), 'count']
        ],
        group: ['action'],
        raw: true
      });

      // Create or update snapshot with SIMPLE LOGIC
      await MonthlyBillingSnapshot.upsert({
        year,
        month,
        customerName,
        prosbcInstanceId,
        billedCount: billedCount, // liveCount + addedCount
        liveCount: liveCount,
        addedCount: addedCount,
        removedCount: removedCount,
        snapshotDate: new Date(),
        billingPeriodStart: monthStart,
        billingPeriodEnd: monthEnd,
        billedNumbers: liveNumbers, // Current live numbers
        monthlyEvents: monthlyEvents.reduce((acc, event) => {
          acc[event.action] = parseInt(event.count);
          return acc;
        }, {})
      });

      snapshots.push({
        customerName,
        billedCount: billedCount,
        liveCount: liveCount,
        addedCount: addedCount,
        removedCount: removedCount
      });
    }

    console.log(`Created ${snapshots.length} billing snapshots for ${prosbcInstanceId} - ${year}-${month} (SIMPLE LOGIC)`);
    return snapshots;
  } catch (error) {
    console.error('Error creating monthly billing snapshots:', error);
    throw error;
  }
}
async function createMonthlyHistoricalCounts(instanceId, configId, fileManager) {
  try {
    // Use the correct prosbcInstanceId format (prosbc1, prosbc2, etc.)
    const prosbcInstanceId = instanceId.startsWith('prosbc') ? instanceId : `prosbc${instanceId}`;

    const currentDate = new Date();
    const currentMonth = currentDate.toISOString().slice(0, 7) + '-01'; // YYYY-MM-01

    // Get all customers for this instance
    const customers = await CustomerNumber.findAll({
      where: {
        prosbcInstanceId: prosbcInstanceId,
        addedDate: {
          [Op.gte]: new Date(currentMonth),
          [Op.lt]: new Date(new Date(currentMonth).getTime() + 31 * 24 * 60 * 60 * 1000) // approx next month
        }
      },
      attributes: ['customerName'],
      group: ['customerName']
    });

    for (const customer of customers) {
      const count = await CustomerNumber.count({
        where: {
          customerName: customer.customerName,
          prosbcInstanceId: prosbcInstanceId,
          addedDate: {
            [Op.gte]: new Date(currentMonth),
            [Op.lt]: new Date(new Date(currentMonth).getTime() + 31 * 24 * 60 * 60 * 1000)
          }
        },
        distinct: true,
        col: 'number'
      });

      // Check if we need to store monthly data
      const existingRecord = await CustomerCount.findOne({
        where: {
          customerName: customer.customerName,
          date: currentMonth,
          prosbcInstanceId: prosbcInstanceId
        }
      });

      if (!existingRecord) {
        await CustomerCount.create({
          customerName: customer.customerName,
          count: count,
          date: currentMonth,
          prosbcInstanceId: prosbcInstanceId
        });
        console.log(`Created historical count for ${customer.customerName} on ${currentMonth}`);
      } else {
        console.log(`Historical count already exists for ${customer.customerName} on ${currentMonth}`);
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

    res.json({
      success: true,
      liveCounts: liveCounts
      // Historical data is now fetched separately via /customer-counts/historical endpoint
    });
  } catch (err) {
    console.error('Error in customer counts:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /customer-counts/create-monthly
router.post('/create-monthly', async (req, res) => {
  try {
    const configId = req.body.configId;

    if (!configId) {
      return res.status(400).json({ success: false, error: 'configId is required' });
    }

    // Get all ProSBC instances
    const proSbcInstanceService = (await import('../services/proSbcInstanceService.js')).default;
    const instances = await proSbcInstanceService.getAllInstances();

    const results = [];

    for (const instance of instances) {
      try {
        const instanceId = instance.id; // e.g., 'prosbc1'
        const fileManager = new ProSBCFileAPI(instanceId);
        await createMonthlyHistoricalCounts(instanceId, configId, fileManager);
        results.push({ instanceId, status: 'success' });
      } catch (error) {
        console.error(`Error creating historical counts for ${instance.id}:`, error);
        results.push({ instanceId: instance.id, status: 'error', error: error.message });
      }
    }

    res.json({
      success: true,
      message: 'Monthly historical counts creation completed for all instances',
      results: results
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
    const prosbcInstanceId = instanceId.startsWith('prosbc') ? instanceId : `prosbc${instanceId}`;
    console.log('Fetching historical data for prosbcInstanceId:', prosbcInstanceId);

    const historicalCounts = await CustomerCount.findAll({
      where: { prosbcInstanceId: prosbcInstanceId },
      order: [['date', 'DESC'], ['customerName', 'ASC']]
    });

    console.log('Found historical records:', historicalCounts.length);
    if (historicalCounts.length > 0) {
      console.log('Sample record:', historicalCounts[0].dataValues);
    }

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

// POST /customer-counts/process-pending-removals
router.post('/process-pending-removals', async (req, res) => {
  try {
    const { instanceId } = req.body;

    if (!instanceId) {
      return res.status(400).json({ success: false, error: 'instanceId is required' });
    }

    const prosbcInstanceId = instanceId.startsWith('prosbc') ? instanceId : `prosbc${instanceId}`;

    // Get all pending removals for this instance
    const pendingRemovals = await PendingRemoval.findAll({
      where: { prosbcInstanceId: prosbcInstanceId }
    });

    const processed = [];

    for (const removal of pendingRemovals) {
      // Update the CustomerNumber with removedDate
      await CustomerNumber.update(
        { removedDate: removal.removalDate, removedBy: removal.removedBy },
        {
          where: {
            number: removal.number,
            customerName: removal.customerName,
            prosbcInstanceId: prosbcInstanceId,
            removedDate: null
          }
        }
      );

      processed.push({
        number: removal.number,
        customerName: removal.customerName
      });

      // Delete the pending removal
      await removal.destroy();
    }

    res.json({
      success: true,
      message: `Processed ${processed.length} pending removals`,
      processed: processed
    });
  } catch (err) {
    console.error('Error processing pending removals:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /customer-counts/change-logs?instanceId=xxx
router.get('/change-logs', async (req, res) => {
  try {
    const instanceId = req.query.instanceId;

    if (!instanceId) {
      return res.status(400).json({ success: false, error: 'instanceId is required' });
    }

    const prosbcInstanceId = instanceId.startsWith('prosbc') ? instanceId : `prosbc${instanceId}`;

    const changeLogs = await CustomerNumberChange.findAll({
      where: { prosbcInstanceId: prosbcInstanceId },
      order: [['timestamp', 'DESC']],
      limit: 100
    });

    // Resolve userIds to usernames to make frontend display easier
    const userIds = Array.from(new Set(changeLogs.map(l => l.userId).filter(Boolean)));
    let usersMap = {};
    if (userIds.length > 0) {
      const users = await User.findAll({ where: { id: userIds } });
      usersMap = users.reduce((acc, u) => { acc[u.id] = u.username; return acc; }, {});
    }

    res.json({
      success: true,
      changeLogs: changeLogs.map(log => ({
        id: log.id,
        customerName: log.customerName,
        changeType: log.changeType,
        count: log.count,
        timestamp: log.timestamp,
        userId: log.userId,
        userName: log.userId ? (usersMap[log.userId] || null) : null,
        details: log.details
      }))
    });
  } catch (err) {
    console.error('Error fetching change logs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /customer-counts/pending-removals?instanceId=xxx
router.get('/pending-removals', async (req, res) => {
  try {
    const instanceId = req.query.instanceId;

    if (!instanceId) {
      return res.status(400).json({ success: false, error: 'instanceId is required' });
    }

    const prosbcInstanceId = instanceId.startsWith('prosbc') ? instanceId : `prosbc${instanceId}`;

    const pendingRemovals = await PendingRemoval.findAll({
      where: { prosbcInstanceId: prosbcInstanceId },
      order: [['removalDate', 'DESC']]
    });

    // Resolve removedBy user ids to usernames
    const removedByIds = Array.from(new Set(pendingRemovals.map(r => r.removedBy).filter(Boolean)));
    let removedByMap = {};
    if (removedByIds.length > 0) {
      const users = await User.findAll({ where: { id: removedByIds } });
      removedByMap = users.reduce((acc, u) => { acc[u.id] = u.username; return acc; }, {});
    }

    res.json({
      success: true,
      pendingRemovals: pendingRemovals.map(removal => ({
        id: removal.id,
        number: removal.number,
        customerName: removal.customerName,
        removalDate: removal.removalDate,
        removedBy: removal.removedBy,
        removedByName: removal.removedBy ? (removedByMap[removal.removedBy] || null) : null
      }))
    });
  } catch (err) {
    console.error('Error fetching pending removals:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /customer-counts/number-events?instanceId=...&customerName=...&userName=...&number=...&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&pageSize=50
router.get('/number-events', async (req, res) => {
  try {
    const instanceId = req.query.instanceId;
    const customerName = req.query.customerName;
    const userName = req.query.userName;
    const number = req.query.number;
    const from = req.query.from;
    const to = req.query.to;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 50, 1000);

    const where = {};
    if (instanceId) where.prosbcInstanceId = instanceId.startsWith('prosbc') ? instanceId : `prosbc${instanceId}`;
    if (customerName) where.customerName = { [Op.like]: `%${customerName}%` };
    if (userName) where.userName = { [Op.like]: `%${userName}%` };
    if (number) where.number = number;
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp[Op.gte] = new Date(from);
      if (to) where.timestamp[Op.lte] = new Date(to);
    }

    const offset = (page - 1) * pageSize;
    const { rows, count } = await NumberEvent.findAndCountAll({
      where,
      order: [['timestamp', 'DESC']],
      offset,
      limit: pageSize
    });

    res.json({ success: true, total: count, page, pageSize, events: rows });
  } catch (err) {
    console.error('Error fetching number events:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /customer-counts/change/:id/numbers
router.get('/change/:id/numbers', async (req, res) => {
  try {
    const id = req.params.id;
    const record = await CustomerNumberChange.findByPk(id);
    if (!record) return res.status(404).json({ success: false, error: 'Change record not found' });

    const prosbcInstanceId = record.prosbcInstanceId;
    const ts = new Date(record.timestamp || new Date());
    const windowStart = new Date(ts.getTime() - 24 * 60 * 60 * 1000); // 24h before
    const windowEnd = new Date(ts.getTime() + 24 * 60 * 60 * 1000); // 24h after

    // Build where clause for CustomerNumber search
    const where = { prosbcInstanceId };
    if (record.changeType === 'add') {
      // addedDate within window
      where.addedDate = { [Op.between]: [windowStart, windowEnd] };
    } else if (record.changeType === 'remove') {
      // removedDate within window
      where.removedDate = { [Op.between]: [windowStart, windowEnd] };
    }

    // If change record has a specific customerName (not 'multiple'), filter by it
    if (record.customerName && record.customerName !== 'multiple') {
      where.customerName = record.customerName;
    }

    const numbers = await CustomerNumber.findAll({ where, attributes: ['number', 'customerName', 'addedDate', 'removedDate', 'addedBy', 'removedBy'] });

    res.json({ success: true, changeId: id, found: numbers.length, numbers });
  } catch (err) {
    console.error('Error fetching change numbers:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /customer-counts/backfill-number-events
// Body: { instanceId, from, to, dryRun }
router.post('/backfill-number-events', async (req, res) => {
  try {
    const { instanceId, from, to, dryRun } = req.body || {};
    if (!instanceId) return res.status(400).json({ success: false, error: 'instanceId is required' });

    const prosbcInstanceId = instanceId.startsWith('prosbc') ? instanceId : `prosbc${instanceId}`;
    const fromDate = from ? new Date(from) : new Date('1970-01-01');
    const toDate = to ? new Date(to) : new Date();

    const changes = await CustomerNumberChange.findAll({
      where: {
        prosbcInstanceId,
        timestamp: { [Op.between]: [fromDate, toDate] }
      },
      order: [['timestamp', 'ASC']]
    });

    const summary = { totalChanges: changes.length, processedChanges: 0, eventsCreated: 0, details: [] };

    for (const change of changes) {
      // Reuse logic from /change/:id/numbers to find likely numbers
      const ts = new Date(change.timestamp || new Date());
      const windowStart = new Date(ts.getTime() - 24 * 60 * 60 * 1000);
      const windowEnd = new Date(ts.getTime() + 24 * 60 * 60 * 1000);

      const where = { prosbcInstanceId };
      if (change.changeType === 'add') where.addedDate = { [Op.between]: [windowStart, windowEnd] };
      else if (change.changeType === 'remove') where.removedDate = { [Op.between]: [windowStart, windowEnd] };
      if (change.customerName && change.customerName !== 'multiple') where.customerName = change.customerName;

      const nums = await CustomerNumber.findAll({ where, attributes: ['number', 'customerName', 'addedDate', 'removedDate'] });

      let createdForChange = 0;
      for (const n of nums) {
        const evPayload = {
          number: n.number,
          action: change.changeType === 'add' ? 'add' : (change.changeType === 'remove' ? 'remove' : 'update'),
          customerName: n.customerName,
          prosbcInstanceId: prosbcInstanceId,
          userId: change.userId || null,
          userName: change.userName || null,
          fileName: null,
          details: `Backfilled from CustomerNumberChange id=${change.id}`,
          timestamp: change.timestamp || new Date()
        };

        if (!dryRun) {
          try {
            await NumberEvent.create(evPayload);
            createdForChange++;
          } catch (err) {
            // If duplicate or error, log and continue
            console.error('Failed to create NumberEvent during backfill for', n.number, err.message);
          }
        } else {
          createdForChange++;
        }
      }

      summary.processedChanges++;
      summary.eventsCreated += createdForChange;
      summary.details.push({ changeId: change.id, found: nums.length, wouldCreate: createdForChange });
    }

    res.json({ success: true, summary, dryRun: !!dryRun });
  } catch (err) {
    console.error('Error backfilling number events:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /customer-counts/analytics?instanceId=xxx&year=YYYY&month=MM&limit=50
// Returns per-customer billing metrics: liveCount, usedThisMonth (billed amount), addedCount, removedCount
// usedThisMonth = COUNT of distinct numbers that existed at ANY point during the month
// This represents the total numbers billed for the month
router.get('/analytics', async (req, res) => {
  try {
    const instanceId = req.query.instanceId;
    const year = parseInt(req.query.year, 10) || (new Date()).getFullYear();
    const month = parseInt(req.query.month, 10) || ((new Date()).getMonth() + 1);
    const limit = parseInt(req.query.limit, 10) || 50;

    if (!instanceId) return res.status(400).json({ success: false, error: 'instanceId is required' });

    const prosbcInstanceId = instanceId.startsWith('prosbc') ? instanceId : `prosbc${instanceId}`;

    // Month window for billing period
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // 1) liveCount: Currently active numbers (removedDate IS NULL)
    // These are numbers still active after the billing month
    const liveRows = await CustomerNumber.findAll({
      where: { prosbcInstanceId, removedDate: null },
      attributes: ['customerName', [fn('COUNT', fn('DISTINCT', col('number'))), 'liveCount']],
      group: ['customerName'],
      order: [[fn('COUNT', fn('DISTINCT', col('number'))), 'DESC']],
      raw: true,
      limit
    });

    // 2) usedThisMonth (BILLED AMOUNT): All distinct numbers that existed during the billing month
    // Billing Logic: COUNT(numbers WHERE addedDate <= monthEnd AND (removedDate IS NULL OR removedDate >= monthStart))
    // This captures all numbers that were active at any point during the month, regardless of when they were removed
    // Numbers scheduled for removal (in pending_removals) still have removedDate = NULL during the month
    const usedRows = await CustomerNumber.findAll({
      where: {
        prosbcInstanceId,
        addedDate: { [Op.lte]: monthEnd }, // Added before or during the month
        [Op.or]: [
          { removedDate: null }, // Still active (including pending removals)
          { removedDate: { [Op.gte]: monthStart } } // Removed during or after month start
        ]
      },
      attributes: ['customerName', [fn('COUNT', fn('DISTINCT', col('number'))), 'usedThisMonth']],
      group: ['customerName'],
      order: [[fn('COUNT', fn('DISTINCT', col('number'))), 'DESC']],
      raw: true,
      limit
    });

    // 3) addedCount: Numbers added during the month (from NumberEvent)
    const addedRows = await NumberEvent.findAll({
      where: {
        prosbcInstanceId,
        action: 'add',
        timestamp: { [Op.between]: [monthStart, monthEnd] }
      },
      attributes: ['customerName', [fn('COUNT', fn('DISTINCT', col('number'))), 'addedCount']],
      group: ['customerName'],
      order: [[fn('COUNT', fn('DISTINCT', col('number'))), 'DESC']],
      raw: true,
      limit
    });

    // 4) removedCount: Numbers removed during the month (from NumberEvent)
    // Note: Actual removal happens at month end via pending_removals processing
    const removedRows = await NumberEvent.findAll({
      where: {
        prosbcInstanceId,
        action: 'remove',
        timestamp: { [Op.between]: [monthStart, monthEnd] }
      },
      attributes: ['customerName', [fn('COUNT', fn('DISTINCT', col('number'))), 'removedCount']],
      group: ['customerName'],
      order: [[fn('COUNT', fn('DISTINCT', col('number'))), 'DESC']],
      raw: true,
      limit
    });

    // Merge results by customerName
    const map = new Map();
    function ensure(name) {
      if (!map.has(name)) map.set(name, {
        customerName: name,
        prosbcInstanceId,
        liveCount: 0,
        usedThisMonth: 0, // This is the BILLED amount for the month
        addedCount: 0,
        removedCount: 0
      });
      return map.get(name);
    }

    liveRows.forEach(r => ensure(r.customerName).liveCount = parseInt(r.liveCount, 10) || 0);
    usedRows.forEach(r => ensure(r.customerName).usedThisMonth = parseInt(r.usedThisMonth, 10) || 0);
    addedRows.forEach(r => ensure(r.customerName).addedCount = parseInt(r.addedCount, 10) || 0);
    removedRows.forEach(r => ensure(r.customerName).removedCount = parseInt(r.removedCount, 10) || 0);

    const result = Array.from(map.values()).sort((a, b) => (b.usedThisMonth || b.liveCount) - (a.usedThisMonth || a.liveCount)).slice(0, limit);

    res.json({
      success: true,
      year,
      month,
      instanceId: prosbcInstanceId,
      billingPeriod: {
        start: monthStart.toISOString().split('T')[0],
        end: monthEnd.toISOString().split('T')[0]
      },
      analytics: result,
      _notes: {
        usedThisMonth: 'Total unique numbers billed for this month (numbers active at any point during the month)',
        liveCount: 'Numbers still active after this billing month',
        billingLogic: 'Each number is counted once per month regardless of add/remove timing within the month'
      }
    });
  } catch (err) {
    console.error('Error computing analytics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /customer-counts/monthly-report?instanceId=xxx&year=YYYY&month=MM&customerName=xxx
// Returns detailed monthly usage report with daily changes, running totals, and billing summary
router.get('/monthly-report', async (req, res) => {
  try {
    const instanceId = req.query.instanceId;
    const year = parseInt(req.query.year, 10) || (new Date()).getFullYear();
    const month = parseInt(req.query.month, 10) || ((new Date()).getMonth() + 1);
    const customerName = req.query.customerName; // Optional: filter by specific customer

    if (!instanceId) return res.status(400).json({ success: false, error: 'instanceId is required' });

    const prosbcInstanceId = instanceId.startsWith('prosbc') ? instanceId : `prosbc${instanceId}`;

    // Month window
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // Get all number events for the month
    const eventWhere = {
      prosbcInstanceId,
      timestamp: { [Op.between]: [monthStart, monthEnd] }
    };
    if (customerName) eventWhere.customerName = customerName;

    const events = await NumberEvent.findAll({
      where: eventWhere,
      order: [['timestamp', 'ASC']],
      include: [{
        model: User,
        as: 'user',
        attributes: ['username'],
        required: false
      }]
    });

    // Get numbers that were active during the month
    const numberWhere = {
      prosbcInstanceId,
      addedDate: { [Op.lte]: monthEnd },
      [Op.or]: [
        { removedDate: null },
        { removedDate: { [Op.gte]: monthStart } }
      ]
    };
    if (customerName) numberWhere.customerName = customerName;

    const activeNumbers = await CustomerNumber.findAll({
      where: numberWhere,
      attributes: ['number', 'customerName', 'addedDate', 'removedDate', 'addedBy', 'removedBy'],
      include: [
        { model: User, as: 'adder', attributes: ['username'], required: false },
        { model: User, as: 'remover', attributes: ['username'], required: false }
      ]
    });

    // Group events by date
    const dailyEvents = {};
    events.forEach(event => {
      const dateKey = event.timestamp.toISOString().split('T')[0];
      if (!dailyEvents[dateKey]) {
        dailyEvents[dateKey] = { adds: [], removes: [], updates: [] };
      }
      dailyEvents[dateKey][event.action === 'add' ? 'adds' : event.action === 'remove' ? 'removes' : 'updates'].push({
        number: event.number,
        customerName: event.customerName,
        timestamp: event.timestamp,
        userName: event.userName || event.user?.username,
        details: event.details
      });
    });

    // Calculate daily running totals
    const report = {
      instanceId: prosbcInstanceId,
      customerName: customerName || 'all',
      billingPeriod: {
        year,
        month,
        startDate: monthStart.toISOString().split('T')[0],
        endDate: monthEnd.toISOString().split('T')[0]
      },
      summary: {
        totalNumbersBilled: activeNumbers.length,
        totalAdds: events.filter(e => e.action === 'add').length,
        totalRemoves: events.filter(e => e.action === 'remove').length,
        totalUpdates: events.filter(e => e.action === 'update').length,
        customersAffected: [...new Set(activeNumbers.map(n => n.customerName))].length
      },
      dailyBreakdown: [],
      billedNumbers: activeNumbers.map(n => ({
        number: n.number,
        customerName: n.customerName,
        addedDate: n.addedDate,
        removedDate: n.removedDate,
        addedBy: n.addedBy || n.adder?.username,
        removedBy: n.removedBy || n.remover?.username
      }))
    };

    // Build daily breakdown with running totals
    let runningTotal = 0;
    const dates = Object.keys(dailyEvents).sort();

    // Add starting balance (numbers active at month start)
    const startBalance = activeNumbers.filter(n =>
      n.addedDate < monthStart &&
      (!n.removedDate || n.removedDate >= monthStart)
    ).length;

    report.dailyBreakdown.push({
      date: monthStart.toISOString().split('T')[0],
      startingBalance: startBalance,
      adds: 0,
      removes: 0,
      updates: 0,
      endingBalance: startBalance,
      netChange: 0
    });
    runningTotal = startBalance;

    // Process each day
    for (const date of dates) {
      const dayEvents = dailyEvents[date];
      const adds = dayEvents.adds.length;
      const removes = dayEvents.removes.length;
      const updates = dayEvents.updates.length;
      const netChange = adds - removes;

      runningTotal += netChange;

      report.dailyBreakdown.push({
        date,
        startingBalance: runningTotal - netChange,
        adds,
        removes,
        updates,
        endingBalance: runningTotal,
        netChange,
        details: {
          addedNumbers: dayEvents.adds.map(a => ({ number: a.number, user: a.userName })),
          removedNumbers: dayEvents.removes.map(r => ({ number: r.number, user: r.userName })),
          updatedNumbers: dayEvents.updates.map(u => ({ number: u.number, details: u.details, user: u.userName }))
        }
      });
    }

    res.json({ success: true, report });
  } catch (err) {
    console.error('Error generating monthly report:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /customer-counts/analytics?instanceId=xxx&year=YYYY&month=MM&limit=50
// Returns per-customer billing metrics: liveCount, usedThisMonth (billed amount), addedCount, removedCount
// SIMPLE LOGIC:
// - liveCount: Current active numbers from ProSBC (removedDate IS NULL)
// - usedThisMonth: liveCount + addedCount (total numbers used this month)
// - addedCount: Numbers added during the month
// - removedCount: Numbers removed during the month
router.get('/analytics', async (req, res) => {
  try {
    const instanceId = req.query.instanceId;
    const year = parseInt(req.query.year, 10) || (new Date()).getFullYear();
    const month = parseInt(req.query.month, 10) || ((new Date()).getMonth() + 1);
    const limit = parseInt(req.query.limit, 10) || 50;

    if (!instanceId) return res.status(400).json({ success: false, error: 'instanceId is required' });

    const prosbcInstanceId = instanceId.startsWith('prosbc') ? instanceId : `prosbc${instanceId}`;

    // Check if this is historical data (past months) - use stored snapshots
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const isHistorical = (year < currentYear) || (year === currentYear && month < currentMonth);

    let analytics;

    if (isHistorical) {
      // Use stored snapshots for historical data
      const snapshots = await MonthlyBillingSnapshot.findAll({
        where: { prosbcInstanceId, year, month },
        order: [['billedCount', 'DESC']],
        limit
      });

      analytics = snapshots.map(snapshot => ({
        customerName: snapshot.customerName,
        prosbcInstanceId: snapshot.prosbcInstanceId,
        liveCount: snapshot.liveCount,
        usedThisMonth: snapshot.billedCount, // billed amount
        addedCount: snapshot.addedCount,
        removedCount: snapshot.removedCount,
        _fromSnapshot: true,
        _snapshotDate: snapshot.snapshotDate
      }));
    } else {
      // Calculate on-demand for current month - SIMPLE LOGIC
      // Month window for billing period
      const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

      // 1) liveCount: Currently active numbers from ProSBC (removedDate IS NULL)
      const liveRows = await CustomerNumber.findAll({
        where: { prosbcInstanceId, removedDate: null },
        attributes: ['customerName', [fn('COUNT', fn('DISTINCT', col('number'))), 'liveCount']],
        group: ['customerName'],
        order: [[fn('COUNT', fn('DISTINCT', col('number'))), 'DESC']],
        raw: true,
        limit
      });

      // 2) addedCount: Numbers added during the month (from NumberEvent)
      const addedRows = await NumberEvent.findAll({
        where: {
          prosbcInstanceId,
          action: 'add',
          timestamp: { [Op.between]: [monthStart, monthEnd] }
        },
        attributes: ['customerName', [fn('COUNT', fn('DISTINCT', col('number'))), 'addedCount']],
        group: ['customerName'],
        order: [[fn('COUNT', fn('DISTINCT', col('number'))), 'DESC']],
        raw: true,
        limit
      });

      // 3) removedCount: Numbers removed during the month (from NumberEvent)
      const removedRows = await NumberEvent.findAll({
        where: {
          prosbcInstanceId,
          action: 'remove',
          timestamp: { [Op.between]: [monthStart, monthEnd] }
        },
        attributes: ['customerName', [fn('COUNT', fn('DISTINCT', col('number'))), 'removedCount']],
        group: ['customerName'],
        order: [[fn('COUNT', fn('DISTINCT', col('number'))), 'DESC']],
        raw: true,
        limit
      });

      // Merge results by customerName - SIMPLE BILLING LOGIC
      const map = new Map();
      function ensure(name) {
        if (!map.has(name)) map.set(name, {
          customerName: name,
          prosbcInstanceId,
          liveCount: 0,
          usedThisMonth: 0, // liveCount + addedCount = total used this month
          addedCount: 0,
          removedCount: 0
        });
        return map.get(name);
      }

      liveRows.forEach(r => {
        const liveCount = parseInt(r.liveCount, 10) || 0;
        ensure(r.customerName).liveCount = liveCount;
        // usedThisMonth will be calculated after we have addedCount
      });

      addedRows.forEach(r => ensure(r.customerName).addedCount = parseInt(r.addedCount, 10) || 0);
      removedRows.forEach(r => ensure(r.customerName).removedCount = parseInt(r.removedCount, 10) || 0);

      // Calculate usedThisMonth = liveCount + addedCount (simple logic)
      map.forEach(customer => {
        customer.usedThisMonth = customer.liveCount + customer.addedCount;
      });

      analytics = Array.from(map.values());
    }

    const result = analytics.sort((a, b) => (b.usedThisMonth || b.liveCount) - (a.usedThisMonth || a.liveCount)).slice(0, limit);

    res.json({
      success: true,
      year,
      month,
      instanceId: prosbcInstanceId,
      billingPeriod: {
        start: new Date(year, month - 1, 1).toISOString().split('T')[0],
        end: new Date(year, month, 0).toISOString().split('T')[0]
      },
      analytics: result,
      dataSource: isHistorical ? 'historical_snapshot' : 'live_calculation',
      _notes: {
        usedThisMonth: 'Total numbers used this month (live count + numbers added during month)',
        liveCount: 'Current active numbers from ProSBC',
        billingLogic: 'Simple: live numbers + added numbers = total billed'
      }
    });
  } catch (err) {
    console.error('Error computing analytics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /customer-counts/create-snapshots?instanceId=xxx&year=YYYY&month=MM
// Creates monthly billing snapshots for historical data storage
router.post('/create-snapshots', async (req, res) => {
  try {
    const instanceId = req.query.instanceId;
    const year = parseInt(req.query.year, 10) || (new Date()).getFullYear();
    const month = parseInt(req.query.month, 10) || ((new Date()).getMonth()); // Previous month by default

    if (!instanceId) return res.status(400).json({ success: false, error: 'instanceId is required' });

    const snapshots = await createMonthlyBillingSnapshots(instanceId, year, month);

    res.json({
      success: true,
      message: `Created ${snapshots.length} billing snapshots for ${year}-${month}`,
      snapshots
    });
  } catch (err) {
    console.error('Error creating snapshots:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /customer-counts/historical?instanceId=xxx&limit=12
// Returns list of available historical billing months
router.get('/historical', async (req, res) => {
  try {
    const instanceId = req.query.instanceId;
    const limit = parseInt(req.query.limit, 10) || 12;

    if (!instanceId) return res.status(400).json({ success: false, error: 'instanceId is required' });

    const prosbcInstanceId = instanceId.startsWith('prosbc') ? instanceId : `prosbc${instanceId}`;

    const availableMonths = await MonthlyBillingSnapshot.findAll({
      where: { prosbcInstanceId },
      attributes: [
        'year',
        'month',
        [fn('COUNT', 'id'), 'customersCount'],
        [fn('SUM', col('billedCount')), 'totalBilled'],
        [fn('MAX', col('snapshotDate')), 'lastSnapshot']
      ],
      group: ['year', 'month'],
      order: [['year', 'DESC'], ['month', 'DESC']],
      limit,
      raw: true
    });

    res.json({
      success: true,
      instanceId: prosbcInstanceId,
      availableMonths: availableMonths.map(month => ({
        year: month.year,
        month: month.month,
        period: `${month.year}-${String(month.month).padStart(2, '0')}`,
        customersCount: parseInt(month.customersCount),
        totalBilled: parseInt(month.totalBilled || 0),
        lastSnapshot: month.lastSnapshot
      }))
    });
  } catch (err) {
    console.error('Error fetching historical data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

import express from 'express';
import cors from 'cors';

// Simplified test server for multi-ProSBC functionality
const app = express();
app.use(cors());
app.use(express.json());

// Mock ProSBC instances data for testing
const mockProSBCInstances = [
  {
    id: 1,
    name: 'ProSBC NYC1',
    baseUrl: 'https://prosbc1nyc1.dipvtel.com:12358',
    username: 'Monitor',
    location: 'New York',
    description: 'Primary ProSBC instance in New York',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 2,
    name: 'ProSBC NYC2',
    baseUrl: 'https://prosbc1nyc2.dipvtel.com:12358',
    username: 'Monitor',
    location: 'New York',
    description: 'Secondary ProSBC instance in New York',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 3,
    name: 'ProSBC TPA2',
    baseUrl: 'http://prosbc5tpa2.dipvtel.com:12358',
    username: 'Monitor',
    location: 'Tampa',
    description: 'ProSBC instance in Tampa',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Test endpoint to get all ProSBC instances
app.get('/backend/api/prosbc-instances', (req, res) => {
  console.log('📋 GET /backend/api/prosbc-instances - Fetching all ProSBC instances');
  res.json({ 
    success: true, 
    instances: mockProSBCInstances,
    count: mockProSBCInstances.length 
  });
});

// Test endpoint to get specific ProSBC instance
app.get('/backend/api/prosbc-instances/:id', (req, res) => {
  const id = parseInt(req.params.id);
  console.log(`🔍 GET /backend/api/prosbc-instances/${id} - Fetching specific instance`);
  
  const instance = mockProSBCInstances.find(inst => inst.id === id);
  if (!instance) {
    return res.status(404).json({ 
      success: false, 
      error: `ProSBC instance with ID ${id} not found` 
    });
  }
  
  res.json({ success: true, instance });
});

// Test endpoint for instance-specific NAP operations
app.get('/backend/api/prosbc-instances/:instanceId/naps', (req, res) => {
  const instanceId = parseInt(req.params.instanceId);
  console.log(`📡 GET /backend/api/prosbc-instances/${instanceId}/naps - Fetching NAPs for instance`);
  
  const instance = mockProSBCInstances.find(inst => inst.id === instanceId);
  if (!instance) {
    return res.status(404).json({ 
      success: false, 
      error: `ProSBC instance with ID ${instanceId} not found` 
    });
  }
  
  // Mock NAP data for the specific instance
  const mockNaps = [
    {
      id: `${instanceId}_1`,
      name: `NAP_${instance.name.replace(/\s+/g, '_')}_001`,
      description: `Test NAP for ${instance.name}`,
      instanceId: instanceId,
      instanceName: instance.name,
      enabled: true
    },
    {
      id: `${instanceId}_2`,
      name: `NAP_${instance.name.replace(/\s+/g, '_')}_002`,
      description: `Secondary NAP for ${instance.name}`,
      instanceId: instanceId,
      instanceName: instance.name,
      enabled: true
    }
  ];
  
  res.json({ 
    success: true, 
    naps: mockNaps,
    instance: {
      id: instance.id,
      name: instance.name,
      baseUrl: instance.baseUrl
    }
  });
});

// Test endpoint to test connection to specific ProSBC instance
app.post('/backend/api/prosbc-instances/:id/test', (req, res) => {
  const id = parseInt(req.params.id);
  console.log(`🧪 POST /backend/api/prosbc-instances/${id}/test - Testing connection`);
  
  const instance = mockProSBCInstances.find(inst => inst.id === id);
  if (!instance) {
    return res.status(404).json({ 
      success: false, 
      error: `ProSBC instance with ID ${id} not found` 
    });
  }
  
  // Simulate connection test
  const isNYC = instance.baseUrl.includes('nyc');
  const isTPA = instance.baseUrl.includes('tpa');
  
  res.json({
    success: true,
    message: `Connection test successful for ${instance.name}`,
    details: {
      instance: instance.name,
      baseUrl: instance.baseUrl,
      location: instance.location,
      protocol: instance.baseUrl.startsWith('https') ? 'HTTPS' : 'HTTP',
      testResult: 'Connection established successfully'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'Multi-ProSBC Test Server is running',
    timestamp: new Date(),
    instances: mockProSBCInstances.length
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Multi-ProSBC Backend Test Server',
    version: '1.0.0',
    endpoints: [
      'GET /backend/api/prosbc-instances',
      'GET /backend/api/prosbc-instances/:id',
      'GET /backend/api/prosbc-instances/:instanceId/naps',
      'POST /backend/api/prosbc-instances/:id/test',
      'GET /health'
    ],
    availableInstances: mockProSBCInstances.map(inst => ({
      id: inst.id,
      name: inst.name,
      location: inst.location
    }))
  });
});

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  console.log('🚀 Multi-ProSBC Test Server started successfully!');
  console.log(`📍 Server running on http://localhost:${PORT}`);
  console.log(`📋 Available ProSBC instances: ${mockProSBCInstances.length}`);
  console.log('');
  console.log('🔧 Test endpoints:');
  console.log(`   GET  http://localhost:${PORT}/backend/api/prosbc-instances`);
  console.log(`   GET  http://localhost:${PORT}/backend/api/prosbc-instances/1`);
  console.log(`   GET  http://localhost:${PORT}/backend/api/prosbc-instances/1/naps`);
  console.log(`   POST http://localhost:${PORT}/backend/api/prosbc-instances/1/test`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log('');
  mockProSBCInstances.forEach(instance => {
    console.log(`📡 ${instance.name}: ${instance.baseUrl} (${instance.location})`);
  });
});

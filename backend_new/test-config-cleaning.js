import fetch from 'node-fetch';

async function testConfigCleaning() {
  console.log('\n=== Testing Config Name Cleaning ===');
  
  try {
    // Test the frontend endpoint that gets configs
    const response = await fetch('http://localhost:3001/backend/api/prosbc-files/test-configs', {
      headers: {
        'X-ProSBC-Instance-ID': '1'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n📥 Raw configs from backend:');
      data.configs.forEach((cfg, index) => {
        console.log(`${index + 1}. ID: ${cfg.id}, Name: "${cfg.name}", Active: ${cfg.active}`);
        
        // Test HTML entity detection
        if (cfg.name.includes('&')) {
          console.log(`   ⚠️  Contains HTML entities: ${cfg.name}`);
          
          // Test cleaning
          const cleaned = cfg.name
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim();
          
          console.log(`   ✅ After cleaning: "${cleaned}"`);
        }
      });
      
      console.log(`\n✅ Total configs retrieved: ${data.configs.length}`);
    } else {
      console.error('❌ Failed to fetch configs:', response.status, response.statusText);
    }
    
  } catch (error) {
    console.error('❌ Error testing config cleaning:', error.message);
  }
}

testConfigCleaning();

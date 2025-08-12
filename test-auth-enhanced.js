// Test the enhanced authentication system
// Run this file to test both signup and login functionality

const testAuth = async () => {
  const baseUrl = 'http://localhost:3001/backend/api/auth';
  
  console.log('🧪 Testing Enhanced Authentication System...\n');

  // Test 1: Signup with valid credentials
  console.log('1️⃣ Testing Signup...');
  try {
    const signupResponse = await fetch(`${baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser_' + Date.now(),
        password: 'testpass123'
      })
    });

    const signupData = await signupResponse.json();
    console.log('✅ Signup Response:', signupData);
    
    if (signupData.success && signupData.token) {
      console.log('✅ Signup successful! Token received.');
    } else {
      console.log('❌ Signup failed:', signupData.message);
    }
  } catch (error) {
    console.log('❌ Signup error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Signup with duplicate username
  console.log('2️⃣ Testing Duplicate Username...');
  try {
    const duplicateResponse = await fetch(`${baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin', // Assuming this exists
        password: 'testpass123'
      })
    });

    const duplicateData = await duplicateResponse.json();
    console.log('✅ Duplicate Username Response:', duplicateData);
  } catch (error) {
    console.log('❌ Duplicate test error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Login with valid credentials
  console.log('3️⃣ Testing Login...');
  try {
    const loginResponse = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin'
      })
    });

    const loginData = await loginResponse.json();
    console.log('✅ Login Response:', loginData);
    
    if (loginData.success && loginData.token) {
      console.log('✅ Login successful! Token received.');
    } else {
      console.log('❌ Login failed:', loginData.message);
    }
  } catch (error) {
    console.log('❌ Login error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 4: Login with invalid credentials
  console.log('4️⃣ Testing Invalid Login...');
  try {
    const invalidResponse = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'nonexistent',
        password: 'wrongpass'
      })
    });

    const invalidData = await invalidResponse.json();
    console.log('✅ Invalid Login Response:', invalidData);
  } catch (error) {
    console.log('❌ Invalid login test error:', error.message);
  }

  console.log('\n🎉 Authentication tests completed!');
};

// Run the tests
testAuth().catch(console.error);

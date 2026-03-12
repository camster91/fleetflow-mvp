const fetch = require('node-fetch');
const { Headers } = require('node-fetch');

async function testLogin() {
  try {
    console.log('🔍 Testing login...');
    
    // Step 1: Get CSRF token
    const csrfRes = await fetch('https://fleet.ashbi.ca/api/auth/csrf');
    const { csrfToken } = await csrfRes.json();
    console.log('✅ CSRF token obtained');
    
    // Step 2: Login
    const params = new URLSearchParams();
    params.append('csrfToken', csrfToken);
    params.append('email', 'test@example.com');
    params.append('password', 'Test123!');
    params.append('redirect', 'true');
    
    const loginRes = await fetch('https://fleet.ashbi.ca/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
      redirect: 'manual' // Don't follow redirects
    });
    
    console.log('Login response status:', loginRes.status);
    console.log('Login response headers:', Object.fromEntries(loginRes.headers.entries()));
    
    // Check for location header
    const location = loginRes.headers.get('location');
    console.log('Location header:', location);
    
    if (loginRes.status === 302 && location) {
      console.log('Redirecting to:', location);
      // Follow redirect
      const redirectRes = await fetch('https://fleet.ashbi.ca' + location, {
        redirect: 'manual'
      });
      console.log('Redirect status:', redirectRes.status);
      console.log('Redirect location:', redirectRes.headers.get('location'));
    }
    
    // Try to get session
    const sessionRes = await fetch('https://fleet.ashbi.ca/api/auth/session');
    const session = await sessionRes.json();
    console.log('Session:', session);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testLogin();
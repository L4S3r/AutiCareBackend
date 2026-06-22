// Health & AI verification script
const http = require('http');

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', (err) => resolve({ status: 0, data: { error: err.message } }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function verify() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║        AutiCare Health & AI Verification        ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // 1. Backend health check
  console.log('① BACKEND SERVER CHECK');
  console.log('   Endpoint: GET http://localhost:5000/health');
  const health = await makeRequest({
    hostname: 'localhost', port: 5000, path: '/health', method: 'GET'
  });
  if (health.status === 200) {
    console.log('   ✅ Backend is RUNNING');
    console.log('   Service:', health.data.service, '| Version:', health.data.version);
  } else {
    console.log('   ❌ Backend is DOWN');
    console.log('   Error:', health.data.error || health.data);
    console.log('\n   To start the backend, run:');
    console.log('   cd backend && npm run dev');
    return;
  }

  // 2. Database check (try to login — requires DB)
  console.log('\n② DATABASE CONNECTION CHECK');
  console.log('   Testing: POST /api/auth/login');
  const loginRes = await makeRequest({
    hostname: 'localhost', port: 5000, path: '/api/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, { email: 'youssef@auticare.org', password: 'auticare123' });
  
  if (loginRes.status === 200 && loginRes.data.success) {
    console.log('   ✅ Database is CONNECTED (login succeeded)');
    console.log('   User:', loginRes.data.user.name);
  } else {
    console.log('   ❌ Database issue:', loginRes.data.error || 'Unknown');
    return;
  }

  const token = loginRes.data.token;

  // 3. Get child for AI prediction
  const patientsRes = await makeRequest({
    hostname: 'localhost', port: 5000, path: '/api/patients',
    method: 'GET', headers: { 'Authorization': `Bearer ${token}` }
  });
  const childId = patientsRes.data?.data?.[0]?._id;
  if (!childId) {
    console.log('   ⚠️  No child profiles found. AI prediction test skipped.');
    return;
  }

  // 4. AI Model check — the key test
  console.log('\n③ AI MODEL (GEMINI) CHECK');
  console.log('   Testing: POST /api/ai/predict/' + childId + '?lang=en');
  console.log('   This calls Google Gemini 1.5 Flash API...');
  
  const startTime = Date.now();
  const aiRes = await makeRequest({
    hostname: 'localhost', port: 5000, path: `/api/ai/predict/${childId}?lang=en`,
    method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
  });
  const elapsed = Date.now() - startTime;
  
  if (aiRes.status === 200 && aiRes.data.success) {
    const pred = aiRes.data.data;
    console.log('   ✅ AI Prediction RECEIVED (took ' + elapsed + 'ms)');
    console.log('');
    console.log('   ┌─────────────────────────────────────────────┐');
    console.log('   │ Risk Score:    ' + String(pred.riskScore).padEnd(30) + '│');
    console.log('   │ Risk Level:    ' + String(pred.riskLevel).padEnd(30) + '│');
    console.log('   │ Based on:      ' + String(pred.basedOnDays + ' days of data').padEnd(30) + '│');
    console.log('   │ Generated at:  ' + String(pred.generatedAt || 'now').padEnd(30) + '│');
    console.log('   └─────────────────────────────────────────────┘');
    console.log('   Message: ' + pred.message);
    if (pred.alerts && pred.alerts.length) {
      console.log('   Alerts: ' + pred.alerts.join('; '));
    }
    if (pred.interventions && pred.interventions.length) {
      console.log('   Interventions: ' + pred.interventions.join('; '));
    }

    // Determine if Gemini or fallback was used
    // Gemini responses tend to be > 1 second, and contain richer/varied content
    // Fallback responses are instant and follow the fixed rule-based patterns
    if (elapsed > 800) {
      console.log('\n   🔮 Likely source: GEMINI API (response took ' + elapsed + 'ms)');
    } else {
      console.log('\n   ⚡ Likely source: Rule-based FALLBACK (response was instant)');
    }
    console.log('   Disclaimer:', pred.disclaimer);
  } else {
    console.log('   ❌ AI Prediction FAILED');
    console.log('   Error:', JSON.stringify(aiRes.data));
  }

  // 5. Verify GEMINI_API_KEY is present in .env
  console.log('\n④ GEMINI API KEY STATUS');
  const fs = require('fs');
  try {
    const env = fs.readFileSync('.env', 'utf-8');
    const keyLine = env.split('\n').find(l => l.startsWith('GEMINI_API_KEY='));
    if (keyLine) {
      const key = keyLine.split('=')[1].trim();
      if (key && key !== 'your_gemini_api_key' && key.length > 10) {
        console.log('   ✅ GEMINI_API_KEY is SET in .env');
        console.log('   Key prefix: ' + key.substring(0, 10) + '...');
      } else {
        console.log('   ⚠️  GEMINI_API_KEY is EMPTY or placeholder');
        console.log('   The AI falls back to rule-based scoring.');
      }
    } else {
      console.log('   ⚠️  GEMINI_API_KEY line NOT FOUND in .env');
      console.log('   The AI will use rule-based fallback only.');
    }
  } catch {
    console.log('   Could not read .env file');
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log('   All checks complete.');
  console.log('══════════════════════════════════════════════════');
}

verify();

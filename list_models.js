const https = require('https');
const env = require('fs').readFileSync('.env', 'utf-8');
const key = env.split('\n').find(l => l.startsWith('GEMINI_API_KEY=')).split('=')[1].trim();

https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, function(r) {
  let d = '';
  r.on('data', function(c) { d += c; });
  r.on('end', function() {
    try {
      const models = JSON.parse(d).models || [];
      const flashModels = models.filter(function(m) {
        return m.name.includes('flash') && m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent');
      });
      console.log('Available Flash models with generateContent support:');
      flashModels.forEach(function(m) {
        console.log('  -', m.name, '(' + m.displayName + ')');
      });
      if (flashModels.length === 0) {
        console.log('\nAll models with generateContent:');
        models.filter(function(m) { return m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'); })
          .forEach(function(m) {
            console.log('  -', m.name, '(' + m.displayName + ')');
          });
      }
    } catch(e) {
      console.log('Error parsing:', d.substring(0, 500));
    }
  });
}).on('error', function(e) { console.log('Error:', e.message); });

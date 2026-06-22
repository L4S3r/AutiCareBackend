const http = require('http');
http.get('http://localhost:5000/api/ai/health', function(r) {
  let d = '';
  r.on('data', function(c) { d += c; });
  r.on('end', function() {
    try {
      const result = JSON.parse(d);
      console.log(JSON.stringify(result, null, 2));
    } catch(e) {
      console.log('Raw response:', d);
    }
  });
}).on('error', function(e) {
  console.log('Backend not reachable:', e.message);
});

const fs = require('fs');

const logFilePath = 'C:\\Users\\Lenovo\\Downloads\\auti-care-backend-log-export-2026-06-23T18-12-08.json';

try {
  const content = fs.readFileSync(logFilePath, 'utf8');
  const logs = JSON.parse(content);
  console.log(`Loaded ${logs.length} log entries.`);
  
  const targetLogs = logs.filter(log => {
    const path = log.requestPath || '';
    const msg = log.message || '';
    return path.includes('firebase-login') || path.includes('patients') || msg.includes('firebase-login') || msg.includes('patients');
  });

  console.log(`Found ${targetLogs.length} entries. Printing all:`);
  targetLogs.forEach((log, index) => {
    console.log(`\n--- Log #${index + 1} ---`);
    console.log(`Time: ${log.TimeUTC} (${log.requestMethod} ${log.requestPath})`);
    console.log(`Status: ${log.responseStatusCode}`);
    console.log(`Message: ${log.message}`);
  });
} catch (err) {
  console.error('Error reading log file:', err);
}

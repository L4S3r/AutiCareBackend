const fs = require('fs');

const logFilePath = 'C:\\Users\\Lenovo\\Downloads\\auti-care-backend-log-export-2026-06-23T18-12-08.json';

try {
  const content = fs.readFileSync(logFilePath, 'utf8');
  const logs = JSON.parse(content);
  console.log(`Loaded ${logs.length} log entries.`);
  
  const relevantLogs = logs.filter(log => {
    const path = log.requestPath || '';
    const msg = log.message || '';
    return path.includes('auth') || path.includes('patients') || msg.includes('firebase') || msg.includes('patients') || msg.includes('ahmedyaso55') || msg.includes('L4S3r');
  });

  console.log(`Found ${relevantLogs.length} relevant logs. Printing them:`);
  relevantLogs.forEach((log, index) => {
    console.log(`\n--- Log #${index + 1} ---`);
    console.log(`Time: ${log.TimeUTC} (${log.requestMethod} ${log.requestPath})`);
    console.log(`Status: ${log.responseStatusCode}`);
    console.log(`Level: ${log.level}`);
    console.log(`Message: ${log.message}`);
  });
} catch (err) {
  console.error('Error:', err);
}

const fs = require('fs');
const logFilePath = 'C:\\Users\\Lenovo\\Downloads\\auti-care-backend-log-export-2026-06-23T13-30-03.json';

try {
  const content = fs.readFileSync(logFilePath, 'utf8');
  const logs = JSON.parse(content);
  
  const loginLogs = logs.filter(log => log.requestPath && log.requestPath.includes('firebase-login'));
  console.log(`Found ${loginLogs.length} logs for firebase-login:`);
  loginLogs.forEach((log, index) => {
    console.log(`\n--- Log #${index + 1} ---`);
    console.log(`Time: ${log.TimeUTC}`);
    console.log(`Method: ${log.requestMethod}`);
    console.log(`Path: ${log.requestPath}`);
    console.log(`Status: ${log.responseStatusCode}`);
    console.log(`Message: ${log.message}`);
  });
} catch (err) {
  console.error(err);
}

const fs = require('fs');

const logFilePath = 'C:\\Users\\Lenovo\\Downloads\\auti-care-backend-log-export-2026-06-23T13-44-57.json';

try {
  const content = fs.readFileSync(logFilePath, 'utf8');
  const logs = JSON.parse(content);
  console.log(`Loaded ${logs.length} log entries.`);
  
  const issues = logs.filter(log => {
    const msg = log.message || '';
    const isError = log.level === 'error' || log.responseStatusCode >= 400 || msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('error') || msg.toLowerCase().includes('missing');
    return isError;
  });

  console.log(`Found ${issues.length} interesting issues. Printing first 22:`);
  issues.slice(0, 22).forEach((log, index) => {
    console.log(`\n--- Issue #${index + 1} ---`);
    console.log(`Time: ${log.TimeUTC} (${log.requestMethod} ${log.requestPath})`);
    console.log(`Status: ${log.responseStatusCode}`);
    console.log(`Level: ${log.level}`);
    console.log(`Message: ${log.message}`);
  });
} catch (err) {
  console.error('Error reading log file:', err);
}

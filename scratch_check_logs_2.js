const fs = require('fs');

const logFilePath = 'C:\\Users\\Lenovo\\Downloads\\auti-care-backend-log-export-2026-06-23T18-12-08.json';

try {
  const content = fs.readFileSync(logFilePath, 'utf8');
  const logs = JSON.parse(content);
  console.log(`Loaded ${logs.length} log entries.`);
  
  const issues = logs.filter(log => {
    const msg = log.message || '';
    if (msg.includes('DeprecationWarning') || msg.includes('favicon.ico') || msg.includes('favicon.png')) {
      return false;
    }
    const isError = log.level === 'error' || log.responseStatusCode >= 500 || (log.responseStatusCode >= 400 && !log.requestPath.includes('favicon') && log.requestPath !== 'auti-care-backend-2e3843e9u-i-don-t-know1.vercel.app/');
    return isError || msg.toLowerCase().includes('error') || msg.toLowerCase().includes('exception') || msg.toLowerCase().includes('failed');
  });

  console.log(`Found ${issues.length} interesting issues. Printing all:`);
  issues.forEach((log, index) => {
    console.log(`\n--- Issue #${index + 1} ---`);
    console.log(`Time: ${log.TimeUTC} (${log.requestMethod} ${log.requestPath})`);
    console.log(`Status: ${log.responseStatusCode}`);
    console.log(`Level: ${log.level}`);
    console.log(`Message: ${log.message}`);
  });
} catch (err) {
  console.error('Error reading log file:', err);
}


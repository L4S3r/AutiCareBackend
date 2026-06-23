const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function run() {
  const logFile = 'C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\3c22bcea-02f2-41d4-95bf-2849667e4267\\.system_generated\\logs\\transcript.jsonl';
  if (!fs.existsSync(logFile)) {
    console.error('Log file does not exist');
    return;
  }

  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (line.includes('ahmedyaso55') || line.includes('predetermined')) {
      console.log(`Line ${lineCount}: ${line.slice(0, 300)}...`);
    }
  }
}

run().catch(console.error);

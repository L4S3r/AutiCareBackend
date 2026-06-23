const fs = require('fs');
const readline = require('readline');

async function run() {
  const logFile = 'C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\3c22bcea-02f2-41d4-95bf-2849667e4267\\.system_generated\\logs\\transcript.jsonl';
  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (lineCount >= 851 && lineCount <= 854) {
      console.log(`--- LINE ${lineCount} ---`);
      console.log(line);
    }
  }
}

run().catch(console.error);

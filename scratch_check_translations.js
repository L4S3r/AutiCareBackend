const fs = require('fs');
const path = require('path');

const dataFilePath = 'C:\\Users\\Lenovo\\Downloads\\antiCare\\frontend\\src\\data.ts';

try {
  const content = fs.readFileSync(dataFilePath, 'utf8');
  
  // Find where TRANSLATIONS starts and parse it or grep lines
  const lines = content.split('\n');
  const translationLines = lines.filter(l => l.includes('footer') || l.includes('Terms') || l.includes('Privacy') || l.includes('Cookie') || l.includes('HIPAA') || l.includes('auth'));
  console.log(`Found ${translationLines.length} translation-related lines:`);
  translationLines.slice(0, 30).forEach(l => console.log(l.trim()));
} catch (err) {
  console.error(err);
}

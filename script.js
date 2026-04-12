const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENKEY;

if (!apiKey) {
  console.error('Error: OPENKEY secret is missing from environment variables.');
  process.exit(1);
}

const appPath = path.join(__dirname, 'app.js');
let app = fs.readFileSync(appPath, 'utf8');

app = app.replace('__OPENKEY__', apiKey);

fs.writeFileSync(appPath, '/* opensky — built */\n' + app);
console.log('API key injected into app.js');

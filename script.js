const fs = require('fs');
const path = require('path');
const apiKey = process.env.OPENKEY;
if (!apiKey) { console.error('Error: OPENKEY secret is missing.'); process.exit(1); }
const p = path.join(__dirname, 'app.js');
let a = fs.readFileSync(p, 'utf8');
a = a.replace('__OS_KEY_PLACEHOLDER__', apiKey);
fs.writeFileSync(p, '/* built */\n' + a);
console.log('Key injected');

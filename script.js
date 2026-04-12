const fs = require('fs');
const path = require('path');
const apiKey = process.env.OPENKEY;
if (!apiKey) { console.error('Error: OPENKEY secret is missing.'); process.exit(1); }
const p = path.join(__dirname, 'app.js');
let a = fs.readFileSync(p, 'utf8');
a = a.replace("var KEY_PH = 'NONE';", "var KEY_PH = '" + apiKey + "';");
fs.writeFileSync(p, a);
console.log('Key injected. Length: ' + apiKey.length);

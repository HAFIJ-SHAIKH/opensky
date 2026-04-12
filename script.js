const fs = require('fs');
const apiKey = process.env.OPENKEY;
if (!apiKey) { console.error('Error: OPENKEY secret is missing.'); process.exit(1); }
const p = path.join(__dirname, 'app.js');
let a = fs.readFileSync(p, 'utf8');
a = a.replace(/\/\/__KEY__[\s\S]*?\/\/__ENDK__\n?/g, '');
a = '//__KEY__\nvar __INJ_KEY__ = "' + apiKey.replace(/"/g, '\\"') + '";\n//__ENDK__\n' + a;
fs.writeFileSync(p, a);
console.log('Key injected. Length: ' + apiKey.length);

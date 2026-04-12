const fs = require('fs');
const path = require('path');
const apiKey = process.env.OPENKEY;
if (!apiKey) { console.error('Error: OPENKEY secret is missing.'); process.exit(1); }
const p = path.join(__dirname, 'app.js');
let a = fs.readFileSync(p, 'utf8');
var lines = a.split('\n');
var found = false;
for (var i = 0; i < lines.length; i++) {
  if (lines[i].indexOf('KEY_PH') !== -1 && lines[i].indexOf('=') !== -1) {
    lines[i] = "var KEY_PH = '" + apiKey.replace(/'/g, "\\'") + "';";
    found = true;
    break;
  }
}
if (!found) { console.error('Error: KEY_PH line not found in app.js'); process.exit(1); }
fs.writeFileSync(p, lines.join('\n'));
console.log('Key injected. Length: ' + apiKey.length);

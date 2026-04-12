var fs = require('fs');
var path = require('path');
var key = process.env.OPENKEY;
if (!key) { console.error('Error: OPENKEY secret is missing.'); process.exit(1); }
var p = path.join(__dirname, 'app.js');
var a = fs.readFileSync(p, 'utf8');
if (a.indexOf('__OPENKEY__') === -1) { console.error('Error: placeholder not found in app.js'); process.exit(1); }
a = a.replace('__OPENKEY__', key);
fs.writeFileSync(p, '/* built */\n' + a);
console.log('Key injected');

const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENKEY;
if (!apiKey) {
  console.error('Error: OPENKEY secret is missing.');
  process.exit(1);
}

/* Read from source app.js (unmodified) */
const srcPath = path.join(__dirname, 'app.js');
/* Write to build/app.js (only this gets deployed) */
const destPath = path.join(__dirname, 'build', 'app.js');

let content = fs.readFileSync(srcPath, 'utf8');

/* Base64 encode the key — prevents plain-text exposure and quote-breaking bugs */
const encoded = Buffer.from(apiKey).toString('base64');

/* Replace the placeholder. app.js must contain: var KEY_PH = 'NONE'; */
const placeholder = "var KEY_PH = 'NONE';";
if (content.indexOf(placeholder) === -1) {
  console.error('Error: Placeholder "var KEY_PH = \'NONE\';" not found in app.js');
  process.exit(1);
}

content = content.replace(placeholder, "var KEY_PH = atob('" + encoded + "');");
fs.writeFileSync(destPath, content);

console.log('Build complete. Key obfuscated (length: ' + apiKey.length + ').');

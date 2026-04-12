const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENKEY;
if (!apiKey) {
  console.error('Error: OPENKEY secret is missing.');
  process.exit(1);
}

/* process.cwd() is always the repo root in GitHub Actions */
const basePath = process.cwd();
const srcPath = path.join(basePath, 'app.js');
const buildDir = path.join(basePath, 'build');
const destPath = path.join(buildDir, 'app.js');

/* Ensure build folder exists */
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

/* Verify source file exists */
if (!fs.existsSync(srcPath)) {
  console.error('Error: app.js not found at ' + srcPath);
  process.exit(1);
}

let content = fs.readFileSync(srcPath, 'utf8');

/* Base64 encode the key */
const encoded = Buffer.from(apiKey).toString('base64');

/* Replace placeholder — app.js must contain: var KEY_PH = 'NONE'; */
const placeholder = "var KEY_PH = 'NONE';";
if (content.indexOf(placeholder) === -1) {
  console.error('Error: Placeholder "var KEY_PH = \'NONE\';" not found in app.js');
  process.exit(1);
}

content = content.replace(placeholder, "var KEY_PH = atob('" + encoded + "');");
fs.writeFileSync(destPath, content);

console.log('Build complete. Key obfuscated (length: ' + apiKey.length + ').');

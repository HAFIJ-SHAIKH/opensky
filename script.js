const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENKEY;

/* Strict validation: stop immediately if the secret is missing, empty, or too short */
if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
  console.error('❌ FAILED: OPENKEY secret is missing, empty, or too short.');
  console.error('   Go to: Repo Settings → Secrets and variables → Actions → OPENKEY');
  process.exit(1);
}

const basePath = process.cwd();
const srcPath = path.join(basePath, 'app.js');
const buildDir = path.join(basePath, 'build');
const destPath = path.join(buildDir, 'app.js');

/* Ensure build folder exists */
if (!fs.existsSync(buildDir)) {
  console.error('❌ FAILED: build/ folder does not exist. deploy.yml must run "mkdir -p build" first.');
  process.exit(1);
}

/* Verify source file exists */
if (!fs.existsSync(srcPath)) {
  console.error('❌ FAILED: app.js not found at ' + srcPath);
  process.exit(1);
}

let content = fs.readFileSync(srcPath, 'utf8');

/* Base64 encode the key */
const encoded = Buffer.from(apiKey.trim()).toString('base64');

/* Replace placeholder */
const placeholder = "var KEY_PH = 'NONE';";
if (content.indexOf(placeholder) === -1) {
  console.error('❌ FAILED: "var KEY_PH = \'NONE\';" not found in app.js');
  console.error('   Make sure your app.js contains exactly: var KEY_PH = \'NONE\';');
  process.exit(1);
}

content = content.replace(placeholder, "var KEY_PH = atob('" + encoded + "');");
fs.writeFileSync(destPath, content);

console.log('✅ SUCCESS: Key injected into build/app.js (length: ' + apiKey.trim().length + ')');

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Step 1: Compiling TypeScript...');
try {
  execSync('tsc -p tsconfig.json', { stdio: 'inherit', cwd: __dirname });
} catch (error) {
  console.error('TypeScript compilation failed');
  process.exit(1);
}

console.log('Step 2: Fixing exports...');
const fixExportsPath = path.join(__dirname, 'fix-exports.js');
if (fs.existsSync(fixExportsPath)) {
  try {
    require(fixExportsPath);
  } catch (error) {
    console.error('Fix exports failed:', error.message);
    process.exit(1);
  }
} else {
  console.error('fix-exports.js not found!');
  process.exit(1);
}
console.log('Build complete!');

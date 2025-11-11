const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building TypeScript...');
try {
  execSync('npx tsc -p tsconfig.json', { stdio: 'inherit', cwd: __dirname });
} catch (error) {
  console.error('TypeScript compilation failed:', error.message);
  process.exit(1);
}

console.log('Fixing exports...');
const fixExportsPath = path.join(__dirname, 'fix-exports.js');
if (fs.existsSync(fixExportsPath)) {
  try {
    execSync(`node ${fixExportsPath}`, { stdio: 'inherit', cwd: __dirname });
  } catch (error) {
    console.error('Fix exports failed:', error.message);
    process.exit(1);
  }
} else {
  console.error('fix-exports.js not found at:', fixExportsPath);
  process.exit(1);
}
console.log('Build complete!');

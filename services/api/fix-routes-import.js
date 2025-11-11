const fs = require('fs');
const path = require('path');

const routesPath = path.join(__dirname, 'dist/routes.js');

if (!fs.existsSync(routesPath)) {
  console.log('Routes file not found, skipping fix');
  process.exit(0);
}

let content = fs.readFileSync(routesPath, 'utf8');

// Check if LLM import is missing
if (!content.includes('require("./llm")')) {
  // Find the line with @aurora/core import
  const coreImportMatch = content.match(/(const \{ [^}]+ \} = require\("@aurora\/core"\);)/);
  if (coreImportMatch) {
    const llmImport = `const {
  generateProtocolSection,
  generatePISICFContent,
  generateIECCoverNote,
  translatePISICF,
  enhanceCRFLayout,
  isAIAvailable,
  validateAIAvailability,
  getAIAvailabilityStatus,
  parseStudyIdea,
  selectStudyDesign,
} = require("./llm");`;
    
    // Insert LLM import after core import
    content = content.replace(
      coreImportMatch[0],
      coreImportMatch[0] + '\n' + llmImport
    );
    
    fs.writeFileSync(routesPath, content);
    console.log('✅ Fixed LLM import in routes.js');
  } else {
    console.log('⚠️ Could not find @aurora/core import to add LLM import after');
  }
} else {
  console.log('✅ LLM import already present in routes.js');
}

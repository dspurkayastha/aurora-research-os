const fs = require('fs');
const path = require('path');

function fixExports(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  let fixed = content;
  
  // Fix orchestrator exports - be very aggressive
  fixed = fixed.replace(/export \* from ['"]\.\/orchestrator['"];?/gm, 'export { parseIdeaToPreSpec, chooseDesign, buildBaselineSpec } from "./orchestrator";');
  
  // Fix baseline exports
  fixed = fixed.replace(/export \* from ['"]\.\/baseline['"];?/gm, 'export { buildBaselinePackageFromIdea, canLockAndLaunch, getResearchSourcesForAssumptions } from "./baseline";');
  
  // Fix pis_icf exports - ensure buildPisIcfDraftForLanguage is explicitly exported
  if (fixed.includes('export * from "./pis_icf"') && !fixed.includes('export { buildPisIcfDraftForLanguage }')) {
    fixed = fixed.replace(/export \* from ['"]\.\/pis_icf['"];?/gm, 'export * from "./pis_icf";\nexport { buildPisIcfDraftForLanguage } from "./pis_icf";');
  }
  
  if (fixed !== content) {
    fs.writeFileSync(filePath, fixed);
    return true;
  }
  return false;
}

const indexPath = path.join(__dirname, 'dist/index.d.ts');
const nodeModulesPath = path.join(__dirname, '../../node_modules/@aurora/core/dist/index.d.ts');

let fixed1 = fixExports(indexPath);
let fixed2 = fixExports(nodeModulesPath);

if (fixed1 || fixed2) {
  console.log('Fixed exports in dist/index.d.ts' + (fixed2 ? ' and node_modules' : ''));
} else {
  console.log('Exports already correct');
}

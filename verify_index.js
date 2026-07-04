const assert = require('assert');

// Simulate the stdoutData that was causing crashes
const stdoutData1 = `[FAILOVER] Key failure for provider groq (index 1): {'error': {'message': 'Invalid API Key'}}
{"files": {"app/page.tsx": {"content": "[SYSTEM ERROR] No configured provider returned a response."}}}`;

// Extractor logic
const lastBrace1 = stdoutData1.lastIndexOf('\n{');
let jsonStr1 = '';
if (lastBrace1 !== -1) {
  jsonStr1 = stdoutData1.substring(lastBrace1).trim();
} else {
  const firstBrace = stdoutData1.indexOf('{');
  jsonStr1 = stdoutData1.substring(firstBrace).trim();
}

console.log("Extracted JSON 1:", jsonStr1);
const parsed1 = JSON.parse(jsonStr1);
assert(parsed1.files, "Should have parsed successfully");

const stdoutData2 = `{"files": {"app/page.tsx": {"content": "[SYSTEM ERROR] No configured provider returned a response."}}}`;
const lastBrace2 = stdoutData2.lastIndexOf('\n{');
let jsonStr2 = '';
if (lastBrace2 !== -1) {
  jsonStr2 = stdoutData2.substring(lastBrace2).trim();
} else {
  const firstBrace = stdoutData2.indexOf('{');
  jsonStr2 = stdoutData2.substring(firstBrace).trim();
}
console.log("Extracted JSON 2:", jsonStr2);
const parsed2 = JSON.parse(jsonStr2);
assert(parsed2.files, "Should have parsed successfully");

console.log("All parsing logic tests passed!");

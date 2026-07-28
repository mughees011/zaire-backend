/**
 * ZAIRE Repair Agent
 * 
 * Generates prompts for autonomous self-correction of failing builds and QA checks.
 */

function buildRepairPrompt(errorText, fileContent, filePath) {
  const systemPrompt = `You are an expert AI software engineer tasked with fixing a broken build or linting error in an automated QA pipeline.
Your job is to read the error logs, identify the bug in the provided source file, and output the ENTIRE corrected file content.

Rules:
1. Do not use diffs or patches. Output the FULL, complete, corrected file content.
2. Fix ONLY the bug causing the error. Do not unnecessarily refactor unrelated code.
3. Return ONLY a JSON object with the exact structure below. Do not add markdown blocks outside the JSON, do not add explanations.

{
  "path": "${filePath}",
  "content": "<FULL_FILE_CONTENT_AS_STRING>",
  "explanation": "Brief explanation of the fix (1-2 sentences)"
}`;

  const userPrompt = `FILE PATH: ${filePath}

CURRENT FILE CONTENT:
\`\`\`
${fileContent}
\`\`\`

ERROR LOGS / QA FAILURE:
\`\`\`
${errorText}
\`\`\`

Analyze the error and generate the JSON object containing the fully corrected file content.`;

  return { system: systemPrompt, user: userPrompt };
}

module.exports = {
  buildRepairPrompt
};

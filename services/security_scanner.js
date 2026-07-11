const fs = require('fs-extra');
const path = require('path');
const { runInSandbox } = require('./engineer_qa_repair');

/**
 * Secret pattern definitions: [source, flags] pairs.
 * Stored as source strings to avoid the `g`-flag lastIndex persistence bug
 * when the same RegExp object is reused across multiple file scans.
 */
const SECRET_PATTERN_DEFS = [
  // OpenAI standard key
  ['sk-[a-zA-Z0-9]{48}', 'g'],
  // OpenAI project key
  ['sk-proj-[a-zA-Z0-9_-]{48,}', 'g'],
  // Anthropic key
  ['sk-ant-api03-[a-zA-Z0-9_-]{90,}', 'g'],
  // GitHub PAT
  ['ghp_[a-zA-Z0-9]{36}', 'g'],
  // Google / GCP API key
  ['AIza[0-9A-Za-z\\-_]{35}', 'g'],
  // Stripe live secret key
  ['sk_live_[0-9a-zA-Z]{24}', 'g'],
  // Stripe test secret key
  ['sk_test_[0-9a-zA-Z]{24}', 'g'],
  // Slack bot token
  ['xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}', 'g'],
  // AWS access key ID
  ['AKIA[0-9A-Z]{16}', 'g'],
  // SendGrid key
  ['SG\\.[a-zA-Z0-9_-]{22}\\.[a-zA-Z0-9_-]{43}', 'g'],
];

const REDACTED_STRING = '***REDACTED_BY_ZAIRE***';

/**
 * Scans a list of files for secrets and redacts them.
 * A fresh RegExp is created per-file per-pattern to prevent the `g`-flag
 * lastIndex carry-over bug that would cause false negatives on subsequent files.
 *
 * @param {Array<{path: string, content: string}>} files - The array of file objects
 * @returns {{ files: Array, foundSecrets: boolean, log: string[] }}
 */
function scanForSecrets(files) {
  let foundSecrets = false;
  const log = [];

  const scannedFiles = files.map(file => {
    if (!file.path || file.content === undefined || file.content === null) {
      return file;
    }

    let contentStr = String(file.content);
    let fileModified = false;

    for (const [source, flags] of SECRET_PATTERN_DEFS) {
      // Always create a fresh RegExp so lastIndex is reset to 0.
      const pattern = new RegExp(source, flags);
      if (pattern.test(contentStr)) {
        contentStr = contentStr.replace(new RegExp(source, flags), REDACTED_STRING);
        fileModified = true;
        foundSecrets = true;
      }
    }

    if (fileModified) {
      log.push(`Redacted sensitive token(s) in: ${file.path}`);
    }

    return {
      ...file,
      content: contentStr
    };
  });

  return {
    files: scannedFiles,
    foundSecrets,
    log
  };
}

/**
 * Audits a package.json content using `npm audit` inside the sandbox.
 * @param {string} packageJsonContent 
 * @param {string} projectId 
 * @returns {Promise<string>} The audit report (or null if no vulnerabilities)
 */
async function auditDependencies(packageJsonContent, projectId) {
  if (!packageJsonContent || !packageJsonContent.trim()) {
    return null;
  }

  const safeProjectId = String(projectId || 'test').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
  const tempWorkspace = path.join(__dirname, '..', 'scratch', `audit_${safeProjectId}_${Date.now()}`);
  
  try {
    await fs.ensureDir(tempWorkspace);
    await fs.writeFile(path.join(tempWorkspace, 'package.json'), packageJsonContent, 'utf8');

    // Generate package-lock.json without installing node_modules
    await runInSandbox(tempWorkspace, 'npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit']);

    // Run audit
    const { stdout, stderr, exitCode } = await runInSandbox(tempWorkspace, 'npm', ['audit', '--json']);

    try {
      const auditResult = JSON.parse(stdout);
      if (auditResult && auditResult.metadata && auditResult.metadata.vulnerabilities) {
        const vulns = auditResult.metadata.vulnerabilities;
        const total = vulns.info + vulns.low + vulns.moderate + vulns.high + vulns.critical;
        if (total > 0) {
          let report = `## ZAIRE Security Audit\n\n`;
          report += `Found ${total} vulnerabilities in the generated dependencies.\n`;
          report += `- Critical: ${vulns.critical}\n`;
          report += `- High: ${vulns.high}\n`;
          report += `- Moderate: ${vulns.moderate}\n`;
          report += `- Low: ${vulns.low}\n\n`;
          report += `*Recommendation: Run \`npm audit fix\` after unzipping the project.*\n`;
          return report;
        }
      }
    } catch (parseErr) {
      console.warn('[SECURITY SCANNER] Failed to parse npm audit output', parseErr.message);
    }

    return null;
  } catch (err) {
    console.error('[SECURITY SCANNER ERR]', err);
    return null;
  } finally {
    // Cleanup
    await fs.remove(tempWorkspace).catch(() => {});
  }
}

module.exports = {
  scanForSecrets,
  auditDependencies
};

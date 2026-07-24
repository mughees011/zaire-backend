/**
 * ZAIRE Engineer Mode — Generation Quality Gate
 *
 * Runs at the end of BUILD, before PACKAGE. Every bug a customer hit in this
 * session's Codex transcript falls into one of these five checks. If this had
 * run before download, none of those five back-and-forths with Codex would
 * have been necessary — the customer would have gotten a clean project.
 *
 * Generator-agnostic: works whether files came from the deterministic
 * scaffold (buildEngineerScaffold) or an LLM-authored generation path, since
 * it validates the actual output files, not the generation method.
 *
 * Usage:
 *   const gate = require('./generation_quality_gate');
 *   const { files, issues, fixedCount } = gate.runQualityGate(generatedFiles, packageJsonContent);
 *   // generatedFiles: { 'app/page.tsx': { content: '...' }, ... }
 *   // issues: anything NOT auto-fixable — route to the FIX phase, don't ship it
 */

const path = require('path');

// ── 1. IMPORT PATH RESOLUTION ───────────────────────────────────────────────
// Catches: "Module not found: Can't resolve '../components/Navbar'"
// This was the FIRST error the customer hit, and structurally identical to
// every backend import bug fixed manually earlier this session.

function normalizeKey(p) {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function resolveImportTarget(fromFile, importPath, allFileKeys) {
  if (!importPath.startsWith('.')) return { external: true };

  const fromDir = path.posix.dirname(normalizeKey(fromFile));
  const resolved = normalizeKey(path.posix.join(fromDir, importPath));
  const candidates = [
    resolved,
    `${resolved}.tsx`, `${resolved}.ts`, `${resolved}.jsx`, `${resolved}.js`,
    `${resolved}/index.tsx`, `${resolved}/index.ts`, `${resolved}/index.jsx`, `${resolved}/index.js`
  ];
  const match = candidates.find((c) => allFileKeys.includes(c));
  return { external: false, resolved, match };
}

function validateAndFixImports(files) {
  const allKeys = Object.keys(files);
  const issues = [];
  let fixedCount = 0;

  const importRegex = /(?:import\s+[^'"]*from\s+|require\()\s*['"](\.[^'"]+)['"]/g;

  for (const [fileKey, fileObj] of Object.entries(files)) {
    let content = fileObj.content;
    let match;
    const seen = new Set();
    importRegex.lastIndex = 0;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (seen.has(importPath)) continue;
      seen.add(importPath);

      const result = resolveImportTarget(fileKey, importPath, allKeys);
      if (result.external || result.match) continue; // fine, or resolves correctly

      // Broken import — try to auto-fix by finding the same basename anywhere in the tree
      const basename = path.posix.basename(importPath);
      const candidateFix = allKeys.find((k) => path.posix.basename(k).replace(/\.(tsx|ts|jsx|js)$/, '') === basename);

      if (candidateFix) {
        const fromDir = path.posix.dirname(normalizeKey(fileKey));
        let newRelative = path.posix.relative(fromDir, candidateFix).replace(/\.(tsx|ts|jsx|js)$/, '');
        if (!newRelative.startsWith('.')) newRelative = './' + newRelative;
        content = content.split(importPath).join(newRelative);
        fixedCount++;
      } else {
        issues.push({
          file: fileKey,
          type: 'UNRESOLVED_IMPORT',
          detail: `Import '${importPath}' does not resolve to any generated file and no matching basename was found. This will break the customer's build exactly like the Navbar/Footer bug did.`
        });
      }
    }
    fileObj.content = content;
  }

  return { issues, fixedCount };
}

// ── 2. "use client" DIRECTIVE ENFORCEMENT ───────────────────────────────────
// Catches: "Could not find the module ...framer-motion... in the React
// Client Manifest" — any file using hooks or interactive/animation libraries
// in the App Router MUST be a Client Component.

const CLIENT_SIGNALS = [
  /\buseState\(/, /\buseEffect\(/, /\buseRef\(/, /\buseContext\(/,
  /\bmotion\.[a-z]+/, /\bonClick=/, /\bonChange=/, /\bonSubmit=/,
  /from ['"]framer-motion['"]/
];

function ensureUseClientDirectives(files) {
  let fixedCount = 0;
  for (const fileObj of Object.values(files)) {
    const content = fileObj.content;
    const alreadyClient = /^\s*['"]use client['"]/.test(content);
    if (alreadyClient) continue;

    const needsClient = CLIENT_SIGNALS.some((re) => re.test(content));
    if (needsClient) {
      fileObj.content = `'use client';\n${content}`;
      fixedCount++;
    }
  }
  return { fixedCount };
}

// ── 3. DEFAULT EXPORT VALIDATION ────────────────────────────────────────────
// Catches: "The default export is not a React Component in page: /"
// Every app/**/page.tsx and layout.tsx MUST have a default export.

function ensureDefaultExports(files) {
  const issues = [];
  let fixedCount = 0;

  for (const [fileKey, fileObj] of Object.entries(files)) {
    const isPageOrLayout = /^app\/.*(page|layout)\.(tsx|jsx)$/.test(normalizeKey(fileKey));
    if (!isPageOrLayout) continue;

    const hasDefaultExport = /export default/.test(fileObj.content);
    if (hasDefaultExport) continue;

    // Try to find a component function to promote to default export
    const fnMatch = fileObj.content.match(/function\s+([A-Z][A-Za-z0-9_]*)\s*\(/);
    if (fnMatch) {
      fileObj.content += `\n\nexport default ${fnMatch[1]};\n`;
      fixedCount++;
    } else {
      issues.push({
        file: fileKey,
        type: 'MISSING_DEFAULT_EXPORT',
        detail: 'No default export and no obvious component function to promote. This page will crash with "default export is not a React Component" for every customer who loads it.'
      });
    }
  }
  return { issues, fixedCount };
}

// ── 4. THIRD-PARTY PACKAGE VALIDATION ───────────────────────────────────────
// Catches: `lucide-react-native` imported when only `lucide-react` is a
// dependency — a classic LLM-hallucinated-import bug (right icon library,
// wrong platform variant).

const KNOWN_PLATFORM_MISTAKES = {
  'lucide-react-native': 'lucide-react',
  'react-native-vector-icons': 'lucide-react',
  '@react-native-async-storage/async-storage': null // no web equivalent — flag, don't auto-fix
};

function validatePackageImports(files, packageJsonContent) {
  const issues = [];
  let fixedCount = 0;
  let deps = {};
  try {
    const pkg = JSON.parse(packageJsonContent);
    deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  } catch (e) {
    issues.push({ file: 'package.json', type: 'INVALID_PACKAGE_JSON', detail: 'package.json is not valid JSON — cannot validate imports against it.' });
    return { issues, fixedCount };
  }

  const importRegex = /from\s+['"]([^'".][^'"]*)['"]/g;

  for (const [fileKey, fileObj] of Object.entries(files)) {
    let content = fileObj.content;
    let match;
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(content)) !== null) {
      const pkgName = match[1].split('/')[0].startsWith('@')
        ? match[1].split('/').slice(0, 2).join('/')
        : match[1].split('/')[0];

      if (KNOWN_PLATFORM_MISTAKES.hasOwnProperty(pkgName)) {
        const replacement = KNOWN_PLATFORM_MISTAKES[pkgName];
        if (replacement && deps[replacement]) {
          content = content.split(pkgName).join(replacement);
          fixedCount++;
        } else {
          issues.push({ file: fileKey, type: 'PLATFORM_MISMATCHED_IMPORT', detail: `Imports '${pkgName}', which has no web equivalent available in package.json.` });
        }
        continue;
      }

      if (!deps[pkgName]) {
        issues.push({
          file: fileKey,
          type: 'UNDECLARED_DEPENDENCY',
          detail: `Imports '${pkgName}' but it isn't in package.json dependencies. Customer's npm install will succeed but this import will fail at build time.`
        });
      }
    }
    fileObj.content = content;
  }
  return { issues, fixedCount };
}

// ── 5. UTF-8 SAFE WRITE (fixes the encoding bug at the SOURCE, not downstream) ──
// Catches: "stream did not contain valid UTF-8" — happened because files were
// written through a Windows-default-encoding path. Fix it where files are
// written, not by asking every customer to re-save files themselves.

function writeFilesUtf8Safe(files, outputDir, fs) {
  for (const [fileKey, fileObj] of Object.entries(files)) {
    const fullPath = path.join(outputDir, fileKey);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    // Explicit utf8 encoding, no BOM — this is the actual fix for the
    // "stream did not contain valid UTF-8" error. Never shell out to
    // PowerShell Set-Content/Out-File for this — those default to UTF-16 or
    // the system codepage on Windows and reintroduce this exact bug.
    fs.writeFileSync(fullPath, fileObj.content, { encoding: 'utf8' });
  }
}

// ── 6. SAFE next.config.mjs DEFAULT ─────────────────────────────────────────
// Prevents the Windows `npm run build` EPERM spawn error at the source,
// instead of customers discovering it themselves and troubleshooting.

const SAFE_NEXT_CONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Single-threaded build avoids a common Windows EPERM error when Next's
    // worker processes try to spawn — safe default for all generated projects,
    // slightly slower builds in exchange for reliability out of the box.
    workerThreads: false,
    cpus: 1
  }
};

export default nextConfig;
`;

// ── ORCHESTRATOR ─────────────────────────────────────────────────────────────

function runQualityGate(files, packageJsonContent) {
  const allIssues = [];
  let totalFixed = 0;

  const r1 = validateAndFixImports(files);
  allIssues.push(...r1.issues); totalFixed += r1.fixedCount;

  const r2 = ensureUseClientDirectives(files);
  totalFixed += r2.fixedCount;

  const r3 = ensureDefaultExports(files);
  allIssues.push(...r3.issues); totalFixed += r3.fixedCount;

  const r4 = validatePackageImports(files, packageJsonContent);
  allIssues.push(...r4.issues); totalFixed += r4.fixedCount;

  if (!files['next.config.mjs']) {
    files['next.config.mjs'] = { content: SAFE_NEXT_CONFIG };
  }

  return { files, issues: allIssues, fixedCount: totalFixed };
}

module.exports = {
  runQualityGate,
  validateAndFixImports,
  ensureUseClientDirectives,
  ensureDefaultExports,
  validatePackageImports,
  writeFilesUtf8Safe,
  SAFE_NEXT_CONFIG
};

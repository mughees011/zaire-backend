const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const { execFile } = require('child_process');
const util = require('util');
const Diff = require('diff');

const execFileAsync = util.promisify(execFile);

/**
 * Returns true if Docker is available on the host.
 */
async function isSandboxAvailable() {
  try {
    await execFileAsync('docker', ['info'], { timeout: 5000 });
    return true;
  } catch (_) {
    return false;
  }
}

async function runInSandbox(workspacePath, command, args) {
  try {
    const dockerArgs = [
      'run', '--rm',
      '-v', `${workspacePath}:/app`,
      '-w', '/app',
      'node:20-alpine',
      command, ...args
    ];
    const { stdout, stderr } = await execFileAsync('docker', dockerArgs, { timeout: 60000 });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    return { 
      exitCode: error.code !== undefined ? error.code : 1, 
      stdout: error.stdout || '', 
      stderr: error.stderr || error.message || ''
    };
  }
}

/**
 * Runs QA checks on a project by saving files to a temporary workspace
 * and executing standard checks (build, lint, etc).
 */
async function qaProject(projectId, files) {
  const tempWorkspace = path.join(__dirname, '..', 'scratch', `qa_${projectId}_${Date.now()}`);
  await fs.ensureDir(tempWorkspace);

  const normalizedFiles = normalizeFileList(files);
  const fileIndex = buildFileIndex(normalizedFiles);
  const packageJson = readPackageJson(fileIndex.get('package.json'));
  const projectSignals = detectProjectSignals(normalizedFiles, packageJson);

  try {
    for (const file of normalizedFiles) {
      if (!file.path || file.content === undefined || file.content === null) continue;
      const safeRelativePath = assertSafeRelativePath(file.path);
      const fullPath = path.resolve(tempWorkspace, safeRelativePath);
      if (!isInsideDirectory(fullPath, path.resolve(tempWorkspace))) {
        throw new Error(`QA file escaped workspace: ${file.path}`);
      }
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, String(file.content), 'utf8');
    }

    const checks = [];
    let passedCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    // ── Docker availability pre-check ─────────────────────────────────────────
    const sandboxAvailable = await isSandboxAvailable();
    const sandboxMode = sandboxAvailable ? 'docker' : 'none';
    if (!sandboxAvailable) {
      checks.push({
        name: 'Sandbox Availability',
        status: 'warning',
        message: 'Docker is not available on this host. Structural checks only — live build execution skipped.'
      });
      warningCount += 1;
    }

    checks.push({
      name: 'Project Inventory',
      status: normalizedFiles.length > 0 ? 'passed' : 'failed',
      message: `${normalizedFiles.length} files prepared for QA`
    });
    if (normalizedFiles.length > 0) passedCount += 1; else errorCount += 1;

    let buildReady = projectSignals.missingCriticalFiles.length === 0;

    if (packageJson) {
      checks.push({
        name: 'Dependency Check',
        status: 'passed',
        message: `package.json found with ${projectSignals.scriptCount} scripts and ${projectSignals.dependencyCount} declared dependencies`
      });
      passedCount += 1;

      if (sandboxAvailable) {
        // ── Real isolated execution via Docker ──────────────────────────────
        const installResult = await runInSandbox(tempWorkspace, 'npm', ['install', '--ignore-scripts']);
        checks.push({
          name: 'Package Install',
          status: installResult.exitCode === 0 ? 'passed' : 'failed',
          message: installResult.exitCode === 0 ? 'Dependencies installed successfully (Docker sandbox)' : 'Failed to install dependencies',
          details: installResult.stderr || installResult.stdout
        });
        if (installResult.exitCode === 0) passedCount += 1; else { errorCount += 1; buildReady = false; }

        if (packageJson.scripts && packageJson.scripts.lint) {
          const lintResult = await runInSandbox(tempWorkspace, 'npm', ['run', 'lint']);
          checks.push({
            name: 'Linting',
            status: lintResult.exitCode === 0 ? 'passed' : 'failed',
            message: lintResult.exitCode === 0 ? 'Linting passed' : 'Linting errors found',
            details: lintResult.stdout || lintResult.stderr
          });
          if (lintResult.exitCode === 0) passedCount += 1; else { errorCount += 1; buildReady = false; }
        }

        if (packageJson.devDependencies && packageJson.devDependencies.typescript) {
          const tscResult = await runInSandbox(tempWorkspace, 'npx', ['tsc', '--noEmit']);
          checks.push({
            name: 'TypeScript Compilation',
            status: tscResult.exitCode === 0 ? 'passed' : 'failed',
            message: tscResult.exitCode === 0 ? 'TypeScript compilation passed' : 'TypeScript errors found',
            details: tscResult.stdout || tscResult.stderr
          });
          if (tscResult.exitCode === 0) passedCount += 1; else { errorCount += 1; buildReady = false; }
        }

        if (packageJson.scripts && packageJson.scripts.build) {
          const buildResult = await runInSandbox(tempWorkspace, 'npm', ['run', 'build']);
          checks.push({
            name: 'Build',
            status: buildResult.exitCode === 0 ? 'passed' : 'failed',
            message: buildResult.exitCode === 0 ? 'Build successful' : 'Build failed',
            details: buildResult.stdout || buildResult.stderr
          });
          if (buildResult.exitCode === 0) passedCount += 1; else { errorCount += 1; buildReady = false; }
        }
      } else {
        // ── Structural checks only (no Docker) ─────────────────────────────
        checks.push({
          name: 'Package Install',
          status: 'warning',
          message: 'Skipped — Docker sandbox unavailable. Run npm install locally to verify dependencies.'
        });
        warningCount += 1;
      }
    } else {
      checks.push({
        name: 'Dependency Check',
        status: 'warning',
        message: 'No package.json found, skipping isolated execution'
      });
      warningCount += 1;
    }

    if (projectSignals.placeholderFiles.length > 0) {
      checks.push({
        name: 'Content Quality Check',
        status: 'warning',
        message: `Placeholder or stub content remains in: ${projectSignals.placeholderFiles.slice(0, 5).join(', ')}`
      });
      warningCount += 1;
    } else if (normalizedFiles.length > 0) {
      checks.push({
        name: 'Content Quality Check',
        status: 'passed',
        message: 'No obvious placeholder files detected'
      });
      passedCount += 1;
    }

    return {
      status: errorCount > 0 ? 'failed' : warningCount > 0 ? 'warning' : 'passed',
      passed_count: passedCount,
      warning_count: warningCount,
      error_count: errorCount,
      checks,
      build_ready: buildReady && errorCount === 0,
      sandbox_mode: sandboxMode,
      project_type: projectSignals.projectType,
      detected_framework: projectSignals.detectedFramework,
      file_count: normalizedFiles.length,
      missing_critical_files: projectSignals.missingCriticalFiles,
      env_references: projectSignals.envReferences,
      placeholder_files: projectSignals.placeholderFiles
    };
  } catch (error) {
    const namedError = normalizeEngineerError(error, 'ENGINEER_QA_RUNTIME_ERROR', 'QA execution failed');
    console.error(`[ENGINEER_QA_REPAIR][${namedError.code}] ${namedError.message}`);
    console.error(namedError.cause);
    return {
      status: 'error',
      passed_count: 0,
      warning_count: 0,
      error_count: 1,
      sandbox_mode: 'error',
      checks: [{
        name: 'System Check',
        status: 'failed',
        code: namedError.code,
        message: namedError.message
      }],
      error: {
        code: namedError.code,
        message: namedError.message
      }
    };
  } finally {
    await fs.remove(tempWorkspace);
  }
}

/**
 * Handles error repair requests.
 */
async function repairError(projectId, errorText, files) {
  const normalizedFiles = normalizeFileList(files);
  const fileMap = buildFileIndex(normalizedFiles);
  const evidence = [];
  const likelyFile = guessLikelyFile(errorText, normalizedFiles, fileMap, evidence);
  const matchedFile = likelyFile ? normalizedFiles.find((file) => normalizeLookupPath(file.path) === normalizeLookupPath(likelyFile)) : null;
  const category = classifyRepairError(errorText, likelyFile, matchedFile);
  const simpleCause = explainRepairCause(category, errorText, likelyFile);
  const confidence = matchedFile ? 0.85 : 0.55;
  const errorCode = mapRepairCategoryToCode(category);

  // Generate a unified diff (original vs. original as a placeholder —
  // the actual content fix is expected to come from the LLM caller,
  // which should then call applyAndVerifyRepair with the real patch text).
  const originalContent = matchedFile?.content ? String(matchedFile.content) : '';
  const actualDiff = matchedFile ? Diff.createTwoFilesPatch(
    matchedFile.path,
    matchedFile.path,
    originalContent,
    originalContent,
    'Original',
    'Repaired'
  ) : '';

  const patch = {
    file: likelyFile,
    description: simpleCause,
    action: matchedFile ? 'review' : 'inspect',
    newContent: originalContent,
    actualDiff,
    evidence,
    confidence,
    code: errorCode
  };

  return {
    category,
    code: errorCode,
    likelyFile,
    simpleCause,
    confidence,
    evidence,
    proposedPatch: patch,
    actualDiff
  };
}

/**
 * Applies a diff to the files, keeps a snapshot, and reruns the QA loop to verify.
 */
async function applyAndVerifyRepair(projectId, files, diffText) {
  const normalizedFiles = normalizeFileList(files);
  const snapshot = JSON.parse(JSON.stringify(normalizedFiles));
  
  // Apply patch if diff is provided and valid
  if (diffText && diffText.trim().length > 0) {
    const patches = Diff.parsePatch(diffText);
    for (const patch of patches) {
      const targetPath = normalizeLookupPath(patch.oldFileName || patch.newFileName);
      const fileToPatch = normalizedFiles.find(f => normalizeLookupPath(f.path) === targetPath);
      
      if (fileToPatch && fileToPatch.content) {
        const patched = Diff.applyPatch(fileToPatch.content, patch);
        if (patched !== false) {
          fileToPatch.content = patched;
        } else {
          console.warn(`[ENGINEER_QA_REPAIR] Failed to apply patch cleanly to ${targetPath}`);
        }
      }
    }
  }

  // Re-run QA with patched files
  const qaResult = await qaProject(projectId, normalizedFiles);
  
  return {
    fixed: qaResult.status === 'passed',
    qaResult,
    snapshot,
    patchedFiles: normalizedFiles
  };
}

function normalizeFileList(files) {
  if (Array.isArray(files)) return files;
  if (files && typeof files === 'object') {
    return Object.entries(files).map(([filePath, record]) => ({
      path: filePath,
      content: typeof record === 'string' ? record : record?.content || ''
    }));
  }
  return [];
}

function normalizeLookupPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\.\/+/, '').toLowerCase();
}

function buildFileIndex(files) {
  const index = new Map();
  for (const file of normalizeFileList(files)) {
    if (!file.path) continue;
    index.set(normalizeLookupPath(file.path), file);
  }
  return index;
}

function readPackageJson(fileRecord) {
  if (!fileRecord?.content) return null;
  try {
    return JSON.parse(String(fileRecord.content));
  } catch (error) {
    console.error('[ENGINEER_QA_REPAIR][ENGINEER_QA_INVALID_PACKAGE_JSON] package.json could not be parsed:', error.message);
    return null;
  }
}

function detectProjectSignals(files, packageJson) {
  const normalizedFiles = normalizeFileList(files);
  const allPaths = normalizedFiles.map((file) => normalizeLookupPath(file.path));
  const allContent = normalizedFiles.map((file) => String(file.content || '')).join('\n');

  const envMatches = Array.from(new Set(
    allContent.match(/(?:process\.env|import\.meta\.env|os\.environ\.get|os\.getenv)(?:\.[A-Z0-9_]+)?/gi) || []
  )).map((match) => {
    const segments = match.split('.');
    return segments[segments.length - 1].replace(/[^A-Z0-9_]/gi, '');
  }).filter(Boolean);

  const dependencyBlock = JSON.stringify({
    dependencies: packageJson?.dependencies || {},
    devDependencies: packageJson?.devDependencies || {}
  }).toLowerCase();
  const scriptCount = Object.keys(packageJson?.scripts || {}).length;
  const dependencyCount = Object.keys({
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {})
  }).length;

  const hasFrontendSurface = allPaths.some((filePath) => [
    'app/page.tsx',
    'app/layout.tsx',
    'app/globals.css',
    'src/app/page.tsx',
    'src/app/layout.tsx',
    'src/app/globals.css',
    'pages/index.tsx',
    'src/pages/index.tsx'
  ].includes(filePath));
  const hasBackendEntry = allPaths.some((filePath) => ['index.js', 'server.js', 'app.js', 'main.py', 'engineer.py'].includes(path.basename(filePath)));

  const detectedFramework = dependencyBlock.includes('next') || hasFrontendSurface
    ? 'nextjs'
    : dependencyBlock.includes('express')
      ? 'express'
      : dependencyBlock.includes('react')
        ? 'react'
        : hasBackendEntry
          ? 'backend'
          : 'unknown';

  const missingCriticalFiles = [];
  if (hasFrontendSurface) {
    for (const required of ['app/page.tsx', 'app/layout.tsx', 'app/globals.css']) {
      if (!allPaths.includes(required) && !allPaths.includes(`src/${required}`) && !allPaths.includes(`pages/${required}`)) {
        missingCriticalFiles.push(required);
      }
    }
    if (!allPaths.includes('tailwind.config.ts')) {
      missingCriticalFiles.push('tailwind.config.ts');
    }
  }
  // Check for backend entry file when backend dependencies are present
  const hasBackendDependencies = dependencyBlock.includes('express') || dependencyBlock.includes('fastify') || dependencyBlock.includes('hono');
  if (hasBackendDependencies && !hasBackendEntry) {
    missingCriticalFiles.push('backend entry file');
  }

  const placeholderFiles = normalizedFiles
    .filter((file) => /placeholder|todo|fixme|repaired content placeholder/i.test(`${file.path || ''} ${String(file.content || '')}`))
    .map((file) => file.path);

  return {
    projectType: hasFrontendSurface && hasBackendEntry
      ? 'full-stack'
      : hasFrontendSurface
        ? 'frontend-app'
        : hasBackendEntry
          ? 'backend-service'
          : 'mixed',
    detectedFramework,
    hasRecognizedAppSurface: hasFrontendSurface,
    hasRecognizedBackendSurface: hasBackendEntry,
    missingCriticalFiles,
    envReferences: envMatches,
    placeholderFiles,
    scriptCount,
    dependencyCount
  };
}

function guessLikelyFile(errorText, files, fileMap, evidence) {
  const normalizedError = String(errorText || '');
  const normalizedErrorLower = normalizedError.toLowerCase();
  const basenameMatches = [];

  for (const file of files) {
    const filePath = normalizeLookupPath(file.path);
    const baseName = path.basename(filePath);
    if (normalizedErrorLower.includes(baseName.toLowerCase())) {
      basenameMatches.push(file.path);
    }
  }

  if (basenameMatches.length > 0) {
    evidence.push(`Matched basename from error text: ${basenameMatches[0]}`);
    return basenameMatches[0];
  }

  const patternMatches = [
    [/encryption_key|crypto/i, 'crypto_utils.js'],
    [/system_config|config/i, 'services/system_config_service.js'],
    [/memory dashboard|memory.*dashboard/i, 'services/memory_dashboard_service.js'],
    [/qa|repair/i, 'services/engineer_qa_repair.js'],
    [/engineer mode|workflow/i, 'services/engineer_workflow.js'],
    [/shadow request/i, 'specialists/engineer.py'],
    [/python|traceback/i, 'engineer.py'],
    [/layout/i, 'app/layout.tsx'],
    [/globals?\.css|tailwind|css/i, 'app/globals.css'],
    [/page\.tsx|page\.ts|react|jsx|tsx/i, 'app/page.tsx'],
    [/index\.js|server|express|route/i, 'index.js']
  ];

  for (const [pattern, target] of patternMatches) {
    if (pattern.test(normalizedErrorLower)) {
      const resolved = resolveFileByHint(target, files, fileMap);
      if (resolved) {
        evidence.push(`Matched error pattern ${pattern} -> ${resolved}`);
        return resolved;
      }
    }
  }

  if (files.length > 0) {
    evidence.push(`Falling back to first file in normalized list: ${files[0].path}`);
    return files[0].path;
  }

  evidence.push('No files were provided; defaulting to App.js');
  return 'App.js';
}

function resolveFileByHint(target, files, fileMap) {
  const normalizedTarget = normalizeLookupPath(target);
  if (fileMap.has(normalizedTarget)) {
    return fileMap.get(normalizedTarget).path;
  }

  const targetBase = path.basename(normalizedTarget);
  const match = files.find((file) => path.basename(normalizeLookupPath(file.path)) === targetBase);
  return match ? match.path : target;
}

function classifyRepairError(errorText, likelyFile, matchedFile) {
  const text = String(errorText || '').toLowerCase();
  const filePath = String(likelyFile || '').toLowerCase();

  if (text.includes('encryption_key') || filePath.includes('crypto_utils')) return 'Environment / Crypto Error';
  if (text.includes('traceback') || filePath.endsWith('.py')) return 'Python Runtime Error';
  if (text.includes('cannot find module') || text.includes('module not found')) return 'Missing Dependency';
  if (text.includes('syntaxerror') || text.includes('unexpected token') || text.includes('invalid syntax')) return 'Syntax Error';
  if (text.includes('referenceerror') || text.includes('is not defined')) return 'Reference Error';
  if (text.includes('typeerror') || text.includes('cannot read properties of undefined')) return 'Type Error';
  if (text.includes('build failed') || text.includes('failed to compile')) return 'Build Error';
  if (matchedFile) return 'Targeted File Repair';
  return 'General Repair';
}

function mapRepairCategoryToCode(category) {
  switch (category) {
    case 'Environment / Crypto Error':
      return 'ENGINEER_REPAIR_ENV_CRYPTO';
    case 'Python Runtime Error':
      return 'ENGINEER_REPAIR_PYTHON_RUNTIME';
    case 'Missing Dependency':
      return 'ENGINEER_REPAIR_MISSING_DEPENDENCY';
    case 'Syntax Error':
      return 'ENGINEER_REPAIR_SYNTAX';
    case 'Reference Error':
      return 'ENGINEER_REPAIR_REFERENCE';
    case 'Type Error':
      return 'ENGINEER_REPAIR_TYPE';
    case 'Build Error':
      return 'ENGINEER_REPAIR_BUILD';
    case 'Targeted File Repair':
      return 'ENGINEER_REPAIR_TARGETED_FILE';
    default:
      return 'ENGINEER_REPAIR_GENERAL';
  }
}

function normalizeEngineerError(error, code, fallbackMessage) {
  if (error && typeof error === 'object') {
    return {
      code: error.code || code,
      message: error.message || fallbackMessage,
      cause: error
    };
  }
  return {
    code,
    message: fallbackMessage,
    cause: error
  };
}

function explainRepairCause(category, errorText, likelyFile) {
  const target = likelyFile ? `in ${likelyFile}` : 'in the project';
  switch (category) {
    case 'Environment / Crypto Error':
      return `The backend is starting ${target} without the required encryption secret or fallback path.`;
    case 'Python Runtime Error':
      return `A Python file ${target} is failing at runtime and needs a traceback review.`;
    case 'Missing Dependency':
      return `The runtime cannot resolve a package or module ${target}.`;
    case 'Syntax Error':
      return `The file ${target} appears to contain invalid syntax or a malformed expression.`;
    case 'Reference Error':
      return `The file ${target} references a variable or symbol that is not defined.`;
    case 'Type Error':
      return `The code ${target} is treating an undefined or unexpected value as a concrete object.`;
    case 'Build Error':
      return `The project failed during the build step and needs the failing file reviewed first.`;
    case 'Targeted File Repair':
      return `The error text points to ${target}, so that file should be reviewed first.`;
    default:
      return `The error could not be mapped cleanly, so the first relevant file should be inspected.`;
  }
}

function isInsideDirectory(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertSafeRelativePath(filePath) {
  const normalized = path.normalize(String(filePath || '')).replace(/^([/\\])+/, '');
  if (!normalized || normalized.startsWith('..') || path.isAbsolute(normalized)) {
    throw new Error(`Unsafe generated file path: ${filePath}`);
  }
  return normalized;
}

async function materializeProject(projectName, files) {
  const safeName = String(projectName || 'zaire-generated-project')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'zaire-generated-project';
  const outputRoot = path.join(__dirname, '..', 'generated_projects');
  const outputDir = path.join(outputRoot, safeName);
  const resolvedOutputRoot = path.resolve(outputRoot);
  const resolvedOutputDir = path.resolve(outputDir);

  if (!isInsideDirectory(resolvedOutputDir, resolvedOutputRoot)) {
    throw new Error('Resolved project output path escaped generated_projects.');
  }

  const normalizedFiles = normalizeFileList(files);
  await fs.ensureDir(outputDir);

  for (const file of normalizedFiles) {
    if (!file.path || file.content === undefined || file.content === null) continue;
    const safeRelativePath = assertSafeRelativePath(file.path);
    const fullPath = path.resolve(outputDir, safeRelativePath);
    if (!isInsideDirectory(fullPath, resolvedOutputDir)) {
      throw new Error(`Generated file escaped project folder: ${file.path}`);
    }
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, String(file.content), 'utf8');
  }

  return {
    outputDir,
    fileCount: normalizedFiles.filter((file) => file.path).length,
    files: normalizedFiles.map((file) => file.path).filter(Boolean)
  };
}

/**
 * Exports a project by zipping the provided files and piping to the response.
 * Returns a Promise that resolves/rejects correctly so errors can be caught by callers.
 */
function exportProjectZip(projectId, files, res) {
  return new Promise((resolve, reject) => {
    try {
      const safeProjectId = String(projectId || 'project').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'project';
      const normalizedFiles = normalizeFileList(files);

      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
          console.warn('[EXPORT WARN]', err);
        } else {
          reject(err);
        }
      });

      archive.on('error', function(err) {
        reject(err);
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="zaire_project_${safeProjectId.substring(0, 8)}.zip"`);

      archive.pipe(res);

      for (const file of normalizedFiles) {
        if (file.path && file.content !== undefined && file.content !== null) {
          const safeRelativePath = assertSafeRelativePath(file.path);
          archive.append(String(file.content), { name: safeRelativePath });
        }
      }

      archive.finalize().then(() => {
        console.log(`[EXPORT] ZIP finalized, total bytes: ${archive.pointer()}`);
        resolve();
      }).catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  qaProject,
  repairError,
  applyAndVerifyRepair,
  exportProjectZip,
  materializeProject,
  normalizeFileList,
  runInSandbox,
  isSandboxAvailable
};




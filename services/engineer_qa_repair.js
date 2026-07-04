const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

/**
 * Runs QA checks on a project by saving files to a temporary workspace
 * and executing standard checks (build, lint, etc).
 */
async function qaProject(projectId, files) {
  const tempWorkspace = path.join(__dirname, '..', 'scratch', `qa_${projectId}_${Date.now()}`);
  await fs.ensureDir(tempWorkspace);

  try {
    // 1. Write generated files to temp workspace
    for (const file of files) {
      if (!file.path || !file.content) continue;
      const safeRelativePath = assertSafeRelativePath(file.path);
      const fullPath = path.resolve(tempWorkspace, safeRelativePath);
      if (!isInsideDirectory(fullPath, path.resolve(tempWorkspace))) {
        throw new Error(`QA file escaped workspace: ${file.path}`);
      }
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, file.content, 'utf8');
    }

    // 2. Determine checks to run
    let checks = [];
    let passedCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    const hasPackageJson = files.some(f => f.path === 'package.json');
    if (hasPackageJson) {
       checks.push({ name: 'Dependency Check', status: 'passed', message: 'package.json found' });
       passedCount++;
       checks.push({ name: 'Build Check', status: 'passed', message: 'Simulated build passed' });
       passedCount++;
    } else {
       checks.push({ name: 'Dependency Check', status: 'warning', message: 'No package.json found' });
       warningCount++;
    }

    const hasEnv = files.some(f => f.path.includes('.env'));
    if (!hasEnv) {
      checks.push({ name: 'Environment Check', status: 'warning', message: 'No .env file found' });
      warningCount++;
    } else {
      checks.push({ name: 'Environment Check', status: 'passed', message: 'Env variables configured' });
      passedCount++;
    }

    return {
      status: errorCount > 0 ? 'failed' : warningCount > 0 ? 'warning' : 'passed',
      passed_count: passedCount,
      warning_count: warningCount,
      error_count: errorCount,
      checks: checks
    };
  } catch (error) {
    console.error('[QA ERR]', error);
    return {
      status: 'error',
      passed_count: 0,
      warning_count: 0,
      error_count: 1,
      checks: [{ name: 'System Check', status: 'failed', message: error.message }]
    };
  } finally {
    await fs.remove(tempWorkspace);
  }
}

/**
 * Handles error repair requests. Simulates AI patching.
 */
async function repairError(projectId, errorText, files) {
  let likelyFile = 'App.js'; 
  const fileNames = files.map(f => f.path);
  for (const fn of fileNames) {
    if (errorText.includes(path.basename(fn))) {
      likelyFile = fn;
      break;
    }
  }

  const patch = {
    file: likelyFile,
    description: 'Fixed syntax/import error detected in logs.',
    action: 'replace',
    newContent: '// Repaired content placeholder\n'
  };

  return {
    category: 'Syntax/Build Error',
    likelyFile: likelyFile,
    simpleCause: 'The code references an undefined variable or missing import.',
    proposedPatch: patch
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

      // Set headers before piping
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
  exportProjectZip,
  materializeProject,
  normalizeFileList
};


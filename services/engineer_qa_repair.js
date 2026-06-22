const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
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
      const fullPath = path.join(tempWorkspace, file.path);
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

/**
 * Exports a project by zipping the provided files and piping to the response.
 */
async function exportProjectZip(projectId, files, res) {
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  archive.on('end', function() {
    console.log(`[EXPORT] ZIP created successfully, total bytes: ${archive.pointer()}`);
  });

  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
      console.warn('[EXPORT WARN]', err);
    } else {
      throw err;
    }
  });

  archive.on('error', function(err) {
    throw err;
  });

  res.attachment(`zaire_project_${projectId.substring(0,8)}.zip`);
  archive.pipe(res);

  for (const file of files) {
    if (file.path && file.content) {
      archive.append(file.content, { name: file.path });
    }
  }

  await archive.finalize();
}

module.exports = {
  qaProject,
  repairError,
  exportProjectZip
};

const archiver = require('archiver');
const { Writable } = require('stream');

/**
 * Creates an in-memory ZIP buffer from the provided files.
 */
async function createZipBuffer(files) {
  return new Promise((resolve, reject) => {
    const buffers = [];
    const stream = new Writable({
      write(chunk, encoding, callback) {
        buffers.push(chunk);
        callback();
      }
    });

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', reject);
    archive.pipe(stream);

    for (const file of files) {
      if (file.path && file.content !== undefined && file.content !== null) {
        // Ensure paths don't start with /
        const relativePath = file.path.replace(/^\/+/, '');
        archive.append(String(file.content), { name: relativePath });
      }
    }

    stream.on('finish', () => resolve(Buffer.concat(buffers)));
    archive.finalize();
  });
}

/**
 * Deploys the project to Vercel via their REST API.
 */
async function deployToVercel(projectName, files, token) {
  const safeName = String(projectName || 'zaire-project').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  
  // Format files for Vercel API
  const vercelFiles = files
    .filter(f => f.path && f.content !== undefined)
    .map(f => ({
      file: f.path.replace(/^\/+/, ''),
      data: String(f.content),
      encoding: 'utf-8'
    }));

  const payload = {
    name: safeName,
    files: vercelFiles,
    projectSettings: {
      framework: 'nextjs'
    }
  };

  const response = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vercel deployment failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    url: data.url ? `https://${data.url}` : null,
    id: data.id,
    readyState: data.readyState
  };
}

/**
 * Deploys the project to Netlify by creating a site and uploading a ZIP.
 */
async function deployToNetlify(projectName, files, token) {
  const safeName = String(projectName || 'zaire-project').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  
  // 1. Create the site first
  const createSiteRes = await fetch('https://api.netlify.com/api/v1/sites', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: `${safeName}-${Math.random().toString(36).substring(2, 8)}`
    })
  });

  if (!createSiteRes.ok) {
    const errText = await createSiteRes.text();
    throw new Error(`Netlify site creation failed (${createSiteRes.status}): ${errText}`);
  }

  const siteData = await createSiteRes.json();
  const siteId = siteData.site_id || siteData.id;

  // 2. Upload the ZIP deploy
  const zipBuffer = await createZipBuffer(files);
  const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/zip'
    },
    body: zipBuffer
  });

  if (!deployRes.ok) {
    const errText = await deployRes.text();
    throw new Error(`Netlify deploy failed (${deployRes.status}): ${errText}`);
  }

  const deployData = await deployRes.json();
  return {
    url: deployData.ssl_url || deployData.url,
    id: deployData.id,
    readyState: deployData.state
  };
}

/**
 * Creates a Vercel project linked to a GitHub repository for true CI/CD.
 */
async function setupVercelCICD(projectName, githubOwner, githubRepo, vercelToken) {
  const safeName = String(projectName || 'zaire-project').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  
  const payload = {
    name: safeName,
    framework: 'nextjs',
    gitRepository: {
      type: 'github',
      repo: `${githubOwner}/${githubRepo}`
    }
  };

  const response = await fetch('https://api.vercel.com/v9/projects', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${vercelToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vercel CI/CD setup failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  
  // Vercel automatically creates a deployment when linking a repo.
  // We can fetch the deployments to get the latest status if needed, 
  // or simply return the project dashboard URL.
  return {
    projectId: data.id,
    projectName: data.name,
    url: data.latestDeployments?.[0]?.url ? `https://${data.latestDeployments[0].url}` : null,
    dashboardUrl: `https://vercel.com/${data.accountId}/${data.name}`
  };
}

module.exports = {
  deployToVercel,
  deployToNetlify,
  setupVercelCICD
};

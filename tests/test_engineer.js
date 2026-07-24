const { spawn } = require('child_process');
const payload = JSON.stringify({ plan: { appName: "Test" }, intake: { projectType: "saas" } });
const child = spawn('python', ['engineer.py', payload], { cwd: __dirname });
let out = '';
child.stdout.on('data', d => out += d);
child.stderr.on('data', d => console.error('ERR:', d.toString()));
child.on('close', () => console.log('OUT:', out));

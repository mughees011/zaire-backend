const { execFile } = require('child_process');

console.log("Opening google via cmd.exe...");
execFile('cmd.exe', ['/c', 'start', '""', 'https://www.google.com'], (err) => {
    if (err) console.error("cmd.exe failed:", err);
    else console.log("cmd.exe success!");
});

console.log("Opening bing via rundll32...");
execFile('rundll32.exe', ['url.dll,FileProtocolHandler', 'https://www.bing.com'], (err) => {
    if (err) console.error("rundll32 failed:", err);
    else console.log("rundll32 success!");
});

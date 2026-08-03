const { openWebsites } = require('../system/system_tools.js');

async function test() {
    console.log("Testing openWebsites function...");
    try {
        await openWebsites("https://www.google.com");
        console.log("Finished openWebsites function execution.");
    } catch (e) {
        console.error("Error calling openWebsites:", e);
    }
}

test();

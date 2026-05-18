const { openWebsites, openApp, countDesktopFolders } = require('./system_tools');

async function testTools() {
    console.log("--- STARTING SYSTEM TOOLS TEST ---");

    // 1. Test Folder Count
    const folders = await countDesktopFolders();
    console.log("Folder Count Test:", folders);

    // 2. Test Website Opening
    console.log("Testing Website: Opening Google...");
    await openWebsites(["https://www.google.com"]);

    // 3. Test App Opening (Calculator is always there)
    console.log("Testing App: Opening Calculator...");
    const appResult = await openApp("Calculator");
    console.log("App Launch Result:", appResult);

    console.log("--- TEST COMPLETE ---");
    console.log("Note: closeChromeTabs test is not automated here to avoid closing your tabs unexpectedly.");
}

testTools().catch(console.error);

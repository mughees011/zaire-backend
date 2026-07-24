
const fs = require('fs');
const content = fs.readFileSync('c:/Users/Mughees Siddiqui/Pictures/Mughees-Tony/frontend-temp/src/App.js', 'utf8');

let divCount = 0;
let fragmentCount = 0;
let lineNum = 0;

const lines = content.split('\n');
for (let line of lines) {
    lineNum++;
    // Simple regex for tags
    const divOpen = (line.match(/<div/g) || []).length;
    const divClose = (line.match(/<\/div>/g) || []).length;
    const fragOpen = (line.match(/<>/g) || []).length;
    const fragClose = (line.match(/<\/>/g) || []).length;

    divCount += divOpen - divClose;
    fragmentCount += fragOpen - fragClose;

    if (lineNum >= 2400) {
        // console.log(`${lineNum}: Divs=${divCount}, Frags=${fragmentCount}`);
    }
}

console.log(`Final Counts: Divs=${divCount}, Frags=${fragmentCount}`);

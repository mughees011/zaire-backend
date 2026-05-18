import record from 'node-record-lpcm16';
import fs from 'fs';

console.log('Recording for 3 seconds...');
const file = fs.createWriteStream('test.wav', { encoding: 'binary' });

const recording = record.record({
  sampleRate: 16000,
  channels: 1,
  threshold: 0
});

recording.stream().pipe(file);

setTimeout(() => {
  recording.stop();
  console.log('Stopped recording');
}, 3000);

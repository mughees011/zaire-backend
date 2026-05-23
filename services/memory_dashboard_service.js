const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, '..', 'memory', 'zaire_memory.json');
const VISUAL_ECHO_FILE = path.join(__dirname, '..', 'memory', 'visual_echo.json');
const STUDY_MEMORY_FILE = path.join(__dirname, '..', 'memory', 'study_progress.json');
const TRADES_MEMORY_FILE = path.join(__dirname, '..', 'memory', 'trades.json');

function readJsonFileSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJsonFileSafe(filePath, value) {
  try {
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[MEMORY SERVICE] Failed to write file:', err.message);
    return false;
  }
}

function getFileSizeSafe(filePath) {
  try {
    return fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  } catch {
    return 0;
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function buildMemoryDashboard() {
  const longTermMemoriesPayload = readJsonFileSafe(MEMORY_FILE, { memories: [] });
  const longTermMemories = Array.isArray(longTermMemoriesPayload.memories) ? longTermMemoriesPayload.memories : [];
  const visualEchoes = readJsonFileSafe(VISUAL_ECHO_FILE, []);
  const studyHistory = readJsonFileSafe(STUDY_MEMORY_FILE, []);
  const tradeHistory = readJsonFileSafe(TRADES_MEMORY_FILE, []);

  const validStudyHistory = Array.isArray(studyHistory) ? studyHistory : [];
  const validVisualEchoes = Array.isArray(visualEchoes) ? visualEchoes : [];
  const validTradeHistory = Array.isArray(tradeHistory) ? tradeHistory : [];
  const oldestMemoryTimestamp = longTermMemories.length > 0
    ? longTermMemories.map((memory) => memory.timestamp).filter(Boolean).sort()[0]
    : null;

  const totalBytes =
    getFileSizeSafe(MEMORY_FILE) +
    getFileSizeSafe(VISUAL_ECHO_FILE) +
    getFileSizeSafe(STUDY_MEMORY_FILE) +
    getFileSizeSafe(TRADES_MEMORY_FILE);

  return {
    stats: {
      factsCount: longTermMemories.length,
      studyCount: validStudyHistory.length,
      tradeCount: validTradeHistory.length,
      visualEchoCount: validVisualEchoes.length,
      oldestMemoryDate: oldestMemoryTimestamp,
      storageUsedBytes: totalBytes,
      storageUsedLabel: formatBytes(totalBytes),
      summary: `${longTermMemories.length} facts · ${validStudyHistory.length} study entries · ${formatBytes(totalBytes)}`
    },
    memories: longTermMemories.map(({ id, timestamp, text, tags }) => ({
      id,
      timestamp,
      text,
      tags: Array.isArray(tags) ? tags : []
    }))
  };
}

function clearMemoryDomain(domain) {
  switch (domain) {
    case 'study':
      return writeJsonFileSafe(STUDY_MEMORY_FILE, []);
    case 'trade':
      return writeJsonFileSafe(TRADES_MEMORY_FILE, []);
    case 'full':
      return (
        writeJsonFileSafe(MEMORY_FILE, { memories: [] }) &&
        writeJsonFileSafe(VISUAL_ECHO_FILE, []) &&
        writeJsonFileSafe(STUDY_MEMORY_FILE, []) &&
        writeJsonFileSafe(TRADES_MEMORY_FILE, [])
      );
    default:
      return false;
  }
}

module.exports = {
  buildMemoryDashboard,
  clearMemoryDomain
};

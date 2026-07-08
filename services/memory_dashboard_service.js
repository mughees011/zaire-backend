const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, '..', 'memory', 'zaire_memory.json');
const VISUAL_ECHO_FILE = path.join(__dirname, '..', 'memory', 'visual_echo.json');
const STUDY_MEMORY_FILE = path.join(__dirname, '..', 'memory', 'study_progress.json');
const TRADES_MEMORY_FILE = path.join(__dirname, '..', 'memory', 'trades.json');

function readJsonFileSafe(filePath, fallback, diagnostics, label) {
  try {
    if (!fs.existsSync(filePath)) {
      if (diagnostics) {
        diagnostics.push({
          code: 'MEMORY_DASHBOARD_FILE_MISSING',
          label,
          filePath,
          message: 'Memory source file does not exist.'
        });
      }
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    const code = 'MEMORY_DASHBOARD_JSON_READ_FAILED';
    const message = `Failed to read ${label || path.basename(filePath)}.`;
    console.error(`[MEMORY DASHBOARD][${code}] ${message}`, error.message);
    if (diagnostics) {
      diagnostics.push({
        code,
        label,
        filePath,
        message,
        cause: error.message
      });
    }
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
  } catch (error) {
    console.error('[MEMORY DASHBOARD][MEMORY_DASHBOARD_FILE_STAT_FAILED] Failed to read file size:', filePath, error.message);
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

function parseTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeMemoryRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const timestamp = record.timestamp || record.createdAt || record.updatedAt || null;
  const parsedTimestamp = parseTimestamp(timestamp);
  const text = String(record.text || record.content || record.summary || '').trim();
  return {
    id: record.id || record.memoryId || `${timestamp || Date.now()}`,
    timestamp: parsedTimestamp ? parsedTimestamp.toISOString() : timestamp || null,
    text,
    category: String(record.category || record.type || 'general').trim() || 'general',
    importance: Number.isFinite(Number(record.importance)) ? Number(record.importance) : 3,
    tags: Array.isArray(record.tags) ? record.tags.filter(Boolean) : []
  };
}

function normalizeVisualEchoRecord(record) {
  if (!record || typeof record !== 'object') return null;
  return {
    timestamp: parseTimestamp(record.timestamp)?.toISOString() || record.timestamp || null,
    content: String(record.content || record.summary || '').trim()
  };
}

function buildMemoryDashboard() {
  const diagnostics = [];
  const longTermMemoriesPayload = readJsonFileSafe(MEMORY_FILE, { memories: [] }, diagnostics, 'long-term memory');
  const longTermMemoriesRaw = Array.isArray(longTermMemoriesPayload.memories) ? longTermMemoriesPayload.memories : [];
  const visualEchoesRaw = readJsonFileSafe(VISUAL_ECHO_FILE, [], diagnostics, 'visual echoes');
  const studyHistoryRaw = readJsonFileSafe(STUDY_MEMORY_FILE, [], diagnostics, 'study memory');
  const tradeHistoryRaw = readJsonFileSafe(TRADES_MEMORY_FILE, [], diagnostics, 'trade memory');

  const longTermMemories = longTermMemoriesRaw.map(normalizeMemoryRecord).filter(Boolean);
  const validStudyHistory = Array.isArray(studyHistoryRaw) ? studyHistoryRaw : [];
  const validVisualEchoes = Array.isArray(visualEchoesRaw) ? visualEchoesRaw.map(normalizeVisualEchoRecord).filter(Boolean) : [];
  const validTradeHistory = Array.isArray(tradeHistoryRaw) ? tradeHistoryRaw : [];

  const validMemoryDates = longTermMemories
    .map((memory) => parseTimestamp(memory.timestamp))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());

  const oldestMemoryTimestamp = validMemoryDates.length > 0 ? validMemoryDates[0].toISOString() : null;
  const latestMemoryTimestamp = validMemoryDates.length > 0 ? validMemoryDates[validMemoryDates.length - 1].toISOString() : null;

  const totalBytes =
    getFileSizeSafe(MEMORY_FILE) +
    getFileSizeSafe(VISUAL_ECHO_FILE) +
    getFileSizeSafe(STUDY_MEMORY_FILE) +
    getFileSizeSafe(TRADES_MEMORY_FILE);

  const breakdown = longTermMemories.reduce((acc, memory) => {
    const key = memory.category || 'general';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    stats: {
      factsCount: longTermMemories.length,
      studyCount: validStudyHistory.length,
      tradeCount: validTradeHistory.length,
      visualEchoCount: validVisualEchoes.length,
      oldestMemoryDate: oldestMemoryTimestamp,
      latestMemoryDate: latestMemoryTimestamp,
      storageUsedBytes: totalBytes,
      storageUsedLabel: formatBytes(totalBytes),
      summary: `${longTermMemories.length} facts | ${validStudyHistory.length} study entries | ${formatBytes(totalBytes)}`,
      breakdown
    },
    memories: longTermMemories.map(({ id, timestamp, text, category, importance, tags }) => ({
      id,
      timestamp,
      text,
      category,
      importance,
      tags: Array.isArray(tags) ? tags : []
    })),
    recentMemories: longTermMemories.slice(0, 5),
    visualEchoes: validVisualEchoes,
    health: {
      hasFacts: longTermMemories.length > 0,
      hasStudyHistory: validStudyHistory.length > 0,
      hasTradeHistory: validTradeHistory.length > 0,
      hasVisualEchoes: validVisualEchoes.length > 0
    },
    diagnostics
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

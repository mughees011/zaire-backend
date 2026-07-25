/**
 * Chat History Service — ZAIRE Multi-Session Chat Management
 * Stores and retrieves historical chat threads.
 */
const fs = require('fs');
const path = require('path');

const CHATS_DIR = path.join(__dirname, 'memory', 'chats');
const SESSION_TITLE_LIMIT = 40;

// Ensure chats directory exists
if (!fs.existsSync(CHATS_DIR)) {
  fs.mkdirSync(CHATS_DIR, { recursive: true });
}

function deriveSessionTitle(data = {}) {
  const existingTitle = String(data.title || '').trim();
  if (existingTitle && existingTitle !== 'Untitled Chat') {
    return existingTitle;
  }

  const messages = Array.isArray(data.messages) ? data.messages : [];
  const firstUserMsg = messages.find((message) => message.role === 'user' && String(message.content || '').trim());
  if (!firstUserMsg) {
    return 'Untitled Chat';
  }

  const content = String(firstUserMsg.content || '').replace(/\s+/g, ' ').trim();
  if (content.length <= SESSION_TITLE_LIMIT) {
    return content;
  }

  return `${content.slice(0, SESSION_TITLE_LIMIT).trimEnd()}...`;
}

/**
 * Get all saved chat sessions metadata.
 */
function getSessions(userId) {
  try {
    const files = fs.readdirSync(CHATS_DIR);
    const sessions = files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const filePath = path.join(CHATS_DIR, f);
        const stats = fs.statSync(filePath);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return {
          id: data.id,
          title: deriveSessionTitle(data),
          timestamp: data.updatedAt || stats.mtime.toISOString(),
          messageCount: data.messages.length,
          userId: data.userId
        };
      })
      .filter(s => s.userId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return sessions;
  } catch (e) {
    console.error('[CHATS] Failed to list sessions:', e.message);
    return [];
  }
}

/**
 * Get a specific chat session by ID.
 */
function getSession(id) {
  try {
    const filePath = path.join(CHATS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      const session = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return {
        ...session,
        title: deriveSessionTitle(session)
      };
    }
    return null;
  } catch (e) {
    console.error(`[CHATS] Failed to load session ${id}:`, e.message);
    return null;
  }
}

/**
 * Save or update a chat session.
 */
function saveSession(session) {
  try {
    const filePath = path.join(CHATS_DIR, `${session.id}.json`);
    session.updatedAt = new Date().toISOString();
    session.title = deriveSessionTitle(session);

    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error(`[CHATS] Failed to save session ${session.id}:`, e.message);
    return false;
  }
}

/**
 * Delete a chat session.
 */
function deleteSession(id) {
  try {
    const filePath = path.join(CHATS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (e) {
    console.error(`[CHATS] Failed to delete session ${id}:`, e.message);
    return false;
  }
}

/**
 * Rename a chat session.
 */
function renameSession(id, newTitle) {
  try {
    const filePath = path.join(CHATS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      data.title = newTitle;
      data.updatedAt = new Date().toISOString();
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    }
    return false;
  } catch (e) {
    console.error(`[CHATS] Failed to rename session ${id}:`, e.message);
    return false;
  }
}

module.exports = {
  getSessions,
  getSession,
  saveSession,
  deleteSession,
  renameSession
};

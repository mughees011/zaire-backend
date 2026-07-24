with open('index.js', 'r', encoding='utf-8') as f:
    c = f.read()

target = """      } catch (err) {
        console.warn('[ROUTER] Specialist unavailable, using core fallback:', err.message);
        const fallbackText = `Sir, the ${activeMode} specialist sidecar is offline, but ZAIRE Core is still connected. I can keep helping here while that module comes back online.`;
        socket.emit('ai_text_delta', fallbackText);
        socket.emit('ai_text_complete', { fullText: fallbackText });
        socket.emit('zaire_status', 'idle');
        return;
      }"""

replacement = """      } catch (err) {
        console.warn('[ROUTER] Specialist unavailable, using core fallback:', err.message);
      }"""

if target in c:
    print("Found target! Replacing...")
    c = c.replace(target, replacement)
    with open('index.js', 'w', encoding='utf-8') as f:
        f.write(c)
else:
    print("Target not found.")

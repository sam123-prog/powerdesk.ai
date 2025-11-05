const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Serve static frontend files from project root so you can open http://localhost:3000/index.html
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
const HF_KEY = process.env.HF_API_KEY;

// Storage layer: prefer SQLite (better-sqlite3) if available, otherwise fall back to JSON file storage.
let useSqlite = false;
let db, logMessage, getHistoryRows, clearAll;
const messagesJsonPath = path.join(__dirname, 'messages.json');
// SSE clients for real-time admin UI
const sseClients = [];

function sendSseEvent(obj) {
  const data = `data: ${JSON.stringify(obj)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(data);
    } catch (e) {
      // remove dead client
      sseClients.splice(i, 1);
    }
  }
}

try {
  const Database = require('better-sqlite3');
  const dbPath = path.join(__dirname, 'data.sqlite');
  db = new Database(dbPath);
  db.prepare(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT,
    incoming TEXT,
    reply TEXT,
    model TEXT,
    raw_response TEXT,
    user_agent TEXT,
    ip TEXT,
    page TEXT
  )`).run();

  logMessage = (record) => {
    try {
      const stmt = db.prepare('INSERT INTO messages (ts,incoming,reply,model,raw_response,user_agent,ip,page) VALUES (?,?,?,?,?,?,?,?)');
      stmt.run(record.ts, record.incoming, record.reply, record.model || null, record.raw_response || null, record.user_agent || null, record.ip || null, record.page || null);
    } catch (e) {
      console.error('DB write failed', e);
    }
  };

  getHistoryRows = (limit) => db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT ?').all(limit);
  clearAll = () => db.prepare('DELETE FROM messages').run();
  useSqlite = true;
  console.log('Using SQLite storage (data.sqlite)');
} catch (err) {
  // Fall back to JSON file logging
  console.warn('better-sqlite3 not available, falling back to messages.json storage');

  const fs = require('fs');

  function readAll() {
    try {
      if (!fs.existsSync(messagesJsonPath)) return [];
      const raw = fs.readFileSync(messagesJsonPath, 'utf8');
      return JSON.parse(raw || '[]');
    } catch (e) {
      console.error('Failed to read messages.json', e);
      return [];
    }
  }

  function writeAll(arr) {
    try {
      fs.writeFileSync(messagesJsonPath, JSON.stringify(arr, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to write messages.json', e);
    }
  }

  logMessage = (record) => {
    try {
      const arr = readAll();
      arr.push(Object.assign({ id: (arr.length ? (arr[arr.length-1].id || arr.length) + 1 : 1) }, record));
      writeAll(arr);
      try { sendSseEvent(record); } catch (e) { /* ignore */ }
    } catch (e) {
      console.error('JSON log failed', e);
    }
  };

  getHistoryRows = (limit) => {
    const arr = readAll().slice(-limit).reverse();
    return arr;
  };

  clearAll = () => writeAll([]);
}

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  const page = req.body.page || req.get('Referer') || null;
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    if (HF_KEY) {
      const prompt = message;
      const response = await fetch('https://api-inference.huggingface.co/models/google/flan-t5-small', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: prompt })
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(502).json({ error: 'HF API error', details: text });
      }

      const data = await response.json();
      let text;
      if (Array.isArray(data)) {
        text = data[0]?.generated_text || (typeof data[0] === 'string' ? data[0] : JSON.stringify(data));
      } else if (data?.generated_text) {
        text = data.generated_text;
      } else if (typeof data === 'string') {
        text = data;
      } else {
        text = JSON.stringify(data);
      }

      // Log to DB
      const record = {
        ts: new Date().toISOString(),
        incoming: message,
        reply: text,
        model: 'google/flan-t5-small',
        raw_response: JSON.stringify(data),
        user_agent: req.get('User-Agent') || null,
        ip: req.ip,
        page
      };
      logMessage(record);
      try { sendSseEvent(record); } catch (e) { }

      return res.json({ reply: text });
    } else {
      // Simple offline fallback reply
      const reply = simpleReply(message);

      // Log fallback to DB as well
      const record2 = {
        ts: new Date().toISOString(),
        incoming: message,
        reply,
        model: 'fallback',
        raw_response: null,
        user_agent: req.get('User-Agent') || null,
        ip: req.ip,
        page
      };
      logMessage(record2);
      try { sendSseEvent(record2); } catch (e) { }

      return res.json({ reply });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

function simpleReply(msg) {
  const lower = msg.toLowerCase();
  if (lower.includes('hello') || lower.includes('hi')) return 'Hello! I am Helodesk AI. How can I help?';
  if (lower.includes('price')) return 'Pricing depends on your plan — please share which product or plan you mean.';
  return "I'm running in offline mode. To enable AI replies, set HF_API_KEY in a .env file with a Hugging Face API key. For now I can echo: " + msg;
}

app.listen(PORT, () => console.log(`Powerdesk backend listening on http://localhost:${PORT}`));

// History endpoint (simple, returns last N records)
app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit || '200', 10);
  try {
      const rows = getHistoryRows(limit);
    res.json({ ok: true, rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Server-Sent Events endpoint for real-time message feed (admin UI)
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
  res.write(': connected\n\n');
  sseClients.push(res);
  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// Clear stored messages (dangerous - no auth for hackathon). Use with care.
app.post('/api/clear', (req, res) => {
  try {
    db.prepare('DELETE FROM messages').run();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

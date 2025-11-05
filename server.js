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

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
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

      return res.json({ reply: text });
    } else {
      // Simple offline fallback reply
      const reply = simpleReply(message);
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

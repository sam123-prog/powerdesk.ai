Powerdesk.ai — Backend & Chat Widget

What I added
- A small Express backend at `server.js` that exposes POST /api/chat. It forwards messages to the Hugging Face Inference API if you set `HF_API_KEY` in a `.env` file (see `.env.example`). If no key is present, the server returns a simple offline fallback reply.
- A floating chat widget (assets/chat-widget.js + assets/chat.css) that posts messages to `http://localhost:3000/api/chat` by default.

How to run (Windows / PowerShell)
1. Install Node.js (>=14) if you don't have it.
2. From the project root run:

```powershell
cd "c:\Users\Chinisha Gupta\OneDrive\Desktop\frontend\powerdesk.ai";
npm install
```

3. Create a `.env` file (copy `.env.example`) and paste your Hugging Face API key after `HF_API_KEY=`. If you don't have one, sign up at https://huggingface.co/ and create an access token (free tier available).

4. Start the server:

```powershell
npm start
```

5. Open your static HTML pages (e.g., `index.html`) in a browser. Click the floating chat button and send messages. The widget will POST to `http://localhost:3000/api/chat`.

Changing the API endpoint
If you host the backend elsewhere, set a global JS variable before loading the widget, e.g. in your HTML head:

```html
<script>window.POWERDESK_API_URL = 'https://my-server.example.com';</script>
```

Notes and next steps
- The Hugging Face inference call uses `google/flan-t5-small` (a lightweight instruction model). It requires an API key. The free tier has quotas.
- For production, add rate limiting, authentication, usage logging, and sanitize/limit prompt lengths.
- If you want, I can set up a single-command script that serves the static pages and backend together, or switch to a different model/provider.

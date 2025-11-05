// Simple floating chat widget that posts to the backend /api/chat
(function () {
  const API_URL = (window.POWERDESK_API_URL || 'http://localhost:3000') + '/api/chat';

  // create styles container
  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    (Array.isArray(children) ? children : [children]).forEach(c => c && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return e;
  }

  // widget elements
  const container = el('div', { id: 'pd-chat-container' });
  const btn = el('button', { id: 'pd-chat-btn', type: 'button' }, ['💬']);
  const panel = el('div', { id: 'pd-chat-panel', 'aria-hidden': 'true' });
  const header = el('div', { id: 'pd-chat-header' }, ['Helodesk AI']);
  const close = el('button', { id: 'pd-chat-close', title: 'Close' }, ['×']);
  const messages = el('div', { id: 'pd-chat-messages' });
  const form = el('form', { id: 'pd-chat-form' });
  const input = el('input', { id: 'pd-chat-input', placeholder: 'Ask a question...' });
  const send = el('button', { id: 'pd-chat-send', type: 'submit' }, ['Send']);

  header.appendChild(close);
  form.appendChild(input);
  form.appendChild(send);
  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(form);
  container.appendChild(btn);
  container.appendChild(panel);
  document.body.appendChild(container);

  // toggle
  btn.addEventListener('click', () => {
    panel.classList.toggle('open');
    panel.setAttribute('aria-hidden', panel.classList.contains('open') ? 'false' : 'true');
    input.focus();
  });
  close.addEventListener('click', () => btn.click());

  function addMessage(text, from = 'bot') {
    const m = el('div', { class: 'pd-msg ' + (from === 'user' ? 'user' : 'bot') });
    m.textContent = text;
    messages.appendChild(m);
    messages.scrollTop = messages.scrollHeight;
  }

  async function sendMessage(text) {
    addMessage(text, 'user');
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      if (data?.reply) addMessage(data.reply, 'bot');
      else addMessage('No reply (bad response)', 'bot');
    } catch (err) {
      addMessage('Error contacting server. Make sure backend is running at ' + API_URL, 'bot');
      console.error(err);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const txt = input.value.trim();
    if (!txt) return;
    input.value = '';
    sendMessage(txt);
  });

  // welcome
  addMessage('Welcome to Helodesk AI — ask me anything.');
})();

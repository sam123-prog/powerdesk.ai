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
  const btn = el('button', { id: 'pd-chat-btn', type: 'button', title: 'Help' }, ['💬']);
  const panel = el('div', { id: 'pd-chat-panel', 'aria-hidden': 'true' });
  const header = el('div', { id: 'pd-chat-header' });
  const title = el('div', { id: 'pd-chat-title' }, ['Helodesk AI']);
  const close = el('button', { id: 'pd-chat-close', title: 'Close' }, ['×']);
  const messages = el('div', { id: 'pd-chat-messages' });
  const form = el('form', { id: 'pd-chat-form' });
  const inputWrap = el('div', { id: 'pd-chat-input-wrap' });
  const input = el('textarea', { id: 'pd-chat-input', placeholder: 'Ask a question...' });
  const send = el('button', { id: 'pd-chat-send', type: 'submit' }, ['Send']);

  header.appendChild(title);
  header.appendChild(close);
  inputWrap.appendChild(input);
  inputWrap.appendChild(send);
  form.appendChild(inputWrap);
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
    setTimeout(()=> input.focus(), 120);
  });
  close.addEventListener('click', () => btn.click());

  function addMessage(text, from = 'bot') {
    const m = el('div', { class: 'pd-msg ' + (from === 'user' ? 'user' : 'bot') });
    // allow basic formatting/newlines
    m.textContent = text;
    messages.appendChild(m);
    messages.scrollTop = messages.scrollHeight;
  }

  function setTyping(on=true){
    if(on){
      if(!document.getElementById('pd-typing')){
        const t = el('div',{id:'pd-typing',class:'pd-msg bot'},['Helodesk is typing...']);
        messages.appendChild(t);
      }
    } else {
      const t = document.getElementById('pd-typing'); if(t) t.remove();
    }
  }

  async function sendMessage(text) {
    addMessage(text, 'user');
    setTyping(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, page: window.location.href })
      });
      const data = await res.json();
      setTyping(false);
      if (data?.reply) addMessage(data.reply, 'bot');
      else addMessage('No reply (bad response)', 'bot');
    } catch (err) {
      setTyping(false);
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

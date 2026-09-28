// Chat overlay, docked in the middle of the screen per spec. Enter focuses
// the input and sends; Escape blurs it back to driving controls.
export function createChat({ logEl, inputEl, onSend }) {
  const lines = [];

  function render() {
    // Build nodes directly (no innerHTML) so chat text from other players
    // can never be interpreted as markup.
    logEl.textContent = '';
    for (const line of lines.slice(-6)) {
      const div = document.createElement('div');
      div.className = 'line';
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = `${line.name}:`;
      div.appendChild(who);
      div.appendChild(document.createTextNode(' ' + line.text));
      logEl.appendChild(div);
    }
  }

  function push(msg) {
    lines.push(msg);
    if (lines.length > 30) lines.shift();
    render();
  }

  function reset() {
    lines.length = 0;
    render();
  }

  inputEl.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const text = inputEl.value.trim();
      if (text) onSend(text);
      inputEl.value = '';
      inputEl.blur();
    } else if (e.key === 'Escape') {
      inputEl.value = '';
      inputEl.blur();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement !== inputEl) {
      inputEl.focus();
      e.preventDefault();
    }
  });

  return { push, reset, isFocused: () => document.activeElement === inputEl };
}

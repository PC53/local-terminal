// Command input: open/close, keyboard nav, autocomplete UI, dispatch.
// The renderers live in commands/ and are invoked via the COMMANDS
// table from commands/registry.js.
import { state } from './state.js';
import { commandWrapper, commandInput, autocomplete } from './dom.js';
import { escapeHtml, escapeAttr } from './utils.js';
import { setStatus, showError } from './views.js';
import { COMMANDS, renderDES } from './commands/registry.js';

// ─── OPEN / CLOSE ─────────────────────────────────────────────────────────────
export function openCommandBar() {
  commandWrapper.classList.remove('hidden');
  commandInput.focus();
  commandInput.select();
  updateAutocomplete(commandInput.value);
}

export function closeCommandBar() {
  commandWrapper.classList.add('hidden');
  commandInput.blur();
  autocomplete.style.display = 'none';
  state.acSelected = -1;
}

// ─── KEYBOARD ─────────────────────────────────────────────────────────────────
function highlightAC(items) {
  items.forEach((el, i) => el.classList.toggle('selected', i === state.acSelected));
}

export function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === '`' || (e.key === '/' && document.activeElement !== commandInput)) {
      e.preventDefault();
      openCommandBar();
      return;
    }
    if (e.key === 'Escape') {
      closeCommandBar();
      return;
    }
  });

  commandInput.addEventListener('keydown', (e) => {
    const items = autocomplete.querySelectorAll('.ac-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.acSelected = Math.min(state.acSelected + 1, items.length - 1);
      highlightAC(items);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.acSelected = Math.max(state.acSelected - 1, -1);
      highlightAC(items);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (state.acSelected >= 0 && items[state.acSelected]) {
        commandInput.value = items[state.acSelected].dataset.fill;
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = (state.acSelected >= 0 && items[state.acSelected])
        ? items[state.acSelected].dataset.fill
        : commandInput.value;
      executeCommand(val);
      return;
    }
    if (e.key === 'ArrowUp' && state.history.length > 0) {
      state.historyIndex = Math.min(state.historyIndex + 1, state.history.length - 1);
      commandInput.value = state.history[state.historyIndex];
      return;
    }
  });

  commandInput.addEventListener('input', () => {
    state.acSelected = -1;
    updateAutocomplete(commandInput.value);
  });
}

// ─── AUTOCOMPLETE ─────────────────────────────────────────────────────────────
// For ADD the ticker is parts[2]; for all others it's parts[1].
const TICKER_COMMANDS = new Set(['DES', 'CHART', 'NEWS', 'FIN', 'ADD']);
const ADD_SUBTYPES    = new Set(['CHART', 'QUOTE', 'NEWS', 'WATCH']);

let _tickerCache = [];   // [{s: "AAPL", n: "Apple Inc."}, ...]

fetch('/tickers.json').then(r => r.json()).then(data => { _tickerCache = data; });

function updateAutocomplete(raw) {
  const val     = raw.trim().toUpperCase();
  const parts   = val.split(/\s+/);
  const cmdPart = parts[0];

  if (!val) {
    renderACCommands(Object.entries(COMMANDS));
    return;
  }

  const isNormalTickerPhase =
    TICKER_COMMANDS.has(cmdPart) &&
    cmdPart !== 'ADD' &&
    parts.length === 2 &&
    parts[1].length > 0;

  const isAddTickerPhase =
    cmdPart === 'ADD' &&
    parts.length === 3 &&
    ADD_SUBTYPES.has(parts[1]) &&
    parts[2].length > 0;

  if (isNormalTickerPhase || isAddTickerPhase) {
    const query  = isAddTickerPhase ? parts[2] : parts[1];
    const prefix = isAddTickerPhase ? `${parts[0]} ${parts[1]} ` : `${parts[0]} `;
    searchTickersLocal(query, prefix);
    return;
  }

  if (COMMANDS[cmdPart] && parts.length === 1) {
    const info = COMMANDS[cmdPart];
    renderAC([{ fill: cmdPart + ' ', cmd: cmdPart, desc: info.usage + ' — ' + info.desc }]);
    return;
  }

  if (COMMANDS[cmdPart] && parts.length >= 2) {
    autocomplete.style.display = 'none';
    return;
  }

  const matches = Object.entries(COMMANDS)
    .filter(([cmd]) => cmd.startsWith(cmdPart))
    .map(([cmd, info]) => ({
      fill: cmd + ' ',
      cmd,
      desc: info.usage + ' — ' + info.desc,
    }));

  if (matches.length === 0 || (matches.length === 1 && matches[0].cmd === cmdPart)) {
    autocomplete.style.display = 'none';
    return;
  }

  renderAC(matches);
}

function searchTickersLocal(query, prefix) {
  if (!query) { autocomplete.style.display = 'none'; return; }
  const q = query.toUpperCase();
  const matches = _tickerCache
    .filter(t => t.s.startsWith(q) || t.n.toUpperCase().includes(q))
    .sort((a, b) => {
      const aExact = a.s === q, bExact = b.s === q;
      const aSym   = a.s.startsWith(q), bSym = b.s.startsWith(q);
      if (aExact !== bExact) return aExact ? -1 : 1;
      if (aSym   !== bSym)   return aSym   ? -1 : 1;
      return a.s.localeCompare(b.s);
    })
    .slice(0, 8)
    .map(t => ({ fill: prefix + t.s + ' ', cmd: t.s, desc: t.n }));

  renderAC(matches);
}

function renderACCommands(entries) {
  renderAC(entries.map(([cmd, info]) => ({
    fill: cmd + ' ',
    cmd,
    desc: info.usage + ' — ' + info.desc,
  })));
}

function renderAC(items) {
  if (!items.length) {
    autocomplete.style.display = 'none';
    return;
  }
  autocomplete.innerHTML = items.map(item => `
    <div class="ac-item" data-fill="${escapeAttr(item.fill)}">
      <span class="ac-cmd">${escapeHtml(item.cmd)}</span>
      <span class="ac-desc">${escapeHtml(item.desc)}</span>
    </div>
  `).join('');
  autocomplete.style.display = 'block';
  autocomplete.querySelectorAll('.ac-item').forEach(el => {
    el.addEventListener('click', () => {
      commandInput.value = el.dataset.fill;
      commandInput.focus();
      autocomplete.style.display = 'none';
      state.acSelected = -1;
    });
  });
}

// ─── DISPATCH ─────────────────────────────────────────────────────────────────
export function executeCommand(input) {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) return;

  state.history.unshift(trimmed);
  if (state.history.length > 50) state.history.pop();
  state.historyIndex = -1;

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0];
  const ticker = parts[1] || '';

  closeCommandBar();
  setStatus(`Running: ${trimmed}`);

  if (cmd === 'ADD') {
    // ADD CHART AAPL / ADD QUOTE TSLA / ADD NEWS / ADD WATCH
    const cardType   = (parts[1] || 'quote').toLowerCase();
    const cardTicker = parts[2] || parts[1] || '';
    const addFn = COMMANDS.ADD && COMMANDS.ADD.fn;
    if (addFn) addFn(cardType, cardTicker);
    return;
  }

  const entry = COMMANDS[cmd];
  if (entry && entry.fn) {
    state.currentCommand = cmd;
    state.currentTicker = ticker;
    entry.fn(ticker);
  } else if (cmd.length <= 6 && /^[A-Z0-9.\-^]+$/.test(cmd)) {
    // Bare ticker shorthand — treat as DES
    state.currentCommand = 'DES';
    state.currentTicker = cmd;
    renderDES(cmd);
  } else {
    showError(`Unknown command: ${cmd}. Type HELP to see all commands.`);
  }
}

export function runCommand(cmd) {
  commandInput.value = cmd;
  executeCommand(cmd);
}

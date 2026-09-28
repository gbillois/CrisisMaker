/* CrisisMaker Assistant: a support chat on top of the core agent. It answers questions
   about the whole exercise and applies changes with the agent tools, with the same
   approvals, Stop and Undo as every other agent run. Nothing here runs at load time. */
const CM_ICON_PATH = 'M32.82 38.15Q37.93 38.15 41.42 40.88Q44.90 43.61 45.91 48.30H37.74Q37.01 46.75 35.71 45.94Q34.41 45.12 32.71 45.12Q30.07 45.12 28.51 47.00Q26.94 48.88 26.94 52.01Q26.94 55.19 28.51 57.07Q30.07 58.94 32.71 58.94Q34.41 58.94 35.71 58.13Q37.01 57.32 37.74 55.77H45.91Q44.90 60.45 41.42 63.18Q37.93 65.91 32.82 65.91Q28.80 65.91 25.70 64.15Q22.60 62.39 20.92 59.24Q19.23 56.08 19.23 52.01Q19.23 47.99 20.92 44.83Q22.60 41.68 25.70 39.92Q28.80 38.15 32.82 38.15Z M79.83 38.42V65.72H72.24V50.66L67.09 65.72H60.74L55.55 50.54V65.72H47.96V38.42H57.14L63.99 56.16L70.69 38.42Z';
let cmIconSeq = 0;
function crisisMakerIcon(size = 28, className = 'cm-icon') {
  const id = `cm-icon-grad-${++cmIconSeq}`;
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a33dc"/><stop offset="1" stop-color="#3a17a8"/></linearGradient></defs><rect x="2" y="2" width="96" height="96" rx="22" fill="url(#${id})"/><rect x="2.75" y="2.75" width="94.5" height="94.5" rx="21.25" fill="none" stroke="#fff" stroke-opacity="0.28" stroke-width="1.5"/><path fill="#fff" d="${CM_ICON_PATH}"/><circle cx="80" cy="20" r="9.5" fill="#04f06a" fill-opacity="0.22"/><circle cx="80" cy="20" r="6" fill="#04f06a"/></svg>`;
}

function assistantState() {
  if (!appState.assistant) appState.assistant = { open: false, messages: [], draft: '', focused: false };
  return appState.assistant;
}

function assistantSuggestions() {
  return [
    tt('What happens in each phase?', 'Que se passe-t-il à chaque phase ?', 'Was passiert in jeder Phase?'),
    tt('Which cell receives the fewest injects?', 'Quelle cellule reçoit le moins d’injects ?', 'Welche Zelle erhält die wenigsten Injects?'),
    tt('Which objectives are not covered?', 'Quels objectifs ne sont pas couverts ?', 'Welche Ziele sind nicht abgedeckt?'),
    tt('Who sends the most injects?', 'Qui envoie le plus d’injects ?', 'Wer sendet die meisten Injects?'),
    tt('What is left to do?', 'Que reste-t-il à faire ?', 'Was bleibt zu tun?'),
    tt('Summarise the exercise', 'Résume l’exercice', 'Fasse die Übung zusammen'),
    tt('Add a journalist to the cast', 'Ajoute un journaliste aux rôles', 'Füge einen Journalisten hinzu'),
    tt('Make the second phase more intense', 'Rends la deuxième phase plus intense', 'Mach die zweite Phase intensiver')
  ];
}

/* Plain text with line breaks and "- " bullets, escaped. */
function assistantFormat(text) {
  const lines = String(text || '').split('\n');
  let html = '', list = false;
  for (const line of lines) {
    const bullet = line.match(/^\s*[-•]\s+(.*)$/);
    if (bullet) { if (!list) { html += '<ul>'; list = true; } html += `<li>${escapeHtml(bullet[1])}</li>`; continue; }
    if (list) { html += '</ul>'; list = false; }
    html += line.trim() ? `<p>${escapeHtml(line)}</p>` : '';
  }
  return html + (list ? '</ul>' : '');
}

function renderAssistantMessage(message, index, messages) {
  if (message.role === 'user') return `<div class="assistant-msg is-user"><div class="assistant-bubble">${assistantFormat(message.text)}</div></div>`;
  const run = getCrisisAgent();
  const last = index === messages.length - 1;
  const canUndo = last && message.changes > 0 && run.origin === 'assistant' && run.checkpoint && !run.active && !run.busy;
  return `<div class="assistant-msg is-bot ${message.tone ? `is-${message.tone}` : ''}">
    ${crisisMakerIcon(26, 'cm-icon assistant-avatar')}
    <div class="assistant-bubble">
      ${assistantFormat(message.text)}
      ${message.issues?.length ? `<p class="assistant-note">${sbUiIcon('alert', 13)} ${escapeHtml(message.issues.join(' · '))}</p>` : ''}
      ${message.changes ? `<details class="assistant-changes"><summary>${sbUiIcon('check', 13)} ${message.changes} ${tt('change(s) applied', 'modification(s) appliquée(s)', 'Änderung(en) angewendet')}</summary><ul>${(message.actions || []).map((action) => `<li>${escapeHtml(action)}</li>`).join('')}</ul></details>` : ''}
      ${canUndo ? `<button class="btn btn-ghost btn-xs" data-agent-action="undo">${sbUiIcon('undo', 12)} ${tt('Undo these changes', 'Annuler ces modifications', 'Diese Änderungen rückgängig')}</button>` : ''}
    </div>
  </div>`;
}

/* The live state of the assistant's own run: working, a question or an approval. */
function renderAssistantLive(run) {
  if (run.origin !== 'assistant' || (!run.active && !run.busy)) return '';
  if (run.question) {
    return `<div class="assistant-msg is-bot">${crisisMakerIcon(26, 'cm-icon assistant-avatar')}<div class="assistant-bubble">
      <ol>${run.question.questions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
      <p class="assistant-note">${tt('Answer below, or', 'Répondez ci-dessous, ou', 'Unten antworten, oder')} <button class="btn btn-ghost btn-xs" data-assistant="skip">${tt('skip and let me assume', 'passez et laissez-moi supposer', 'überspringen, ich treffe Annahmen')}</button></p>
    </div></div>`;
  }
  if (run.pending) {
    return `<div class="assistant-msg is-bot">${crisisMakerIcon(26, 'cm-icon assistant-avatar')}<div class="assistant-bubble assistant-approval">
      <p><strong>${tt('May I apply this change?', 'Puis-je appliquer cette modification ?', 'Darf ich diese Änderung anwenden?')}</strong> ${escapeHtml(run.pending.reason || run.pending.tool)}</p>
      <details><summary>${tt('Details', 'Détails', 'Details')}</summary><pre>${escapeHtml(agentRedact(run.pending.arguments))}</pre></details>
      <div class="actions"><button class="btn btn-primary btn-xs" data-agent-action="approve">${tt('Apply', 'Appliquer', 'Anwenden')}</button><button class="btn btn-secondary btn-xs" data-agent-action="reject">${tt('Not now', 'Pas maintenant', 'Nicht jetzt')}</button></div>
    </div></div>`;
  }
  const action = [...run.log].reverse().find((entry) => entry.kind === 'action');
  return `<div class="assistant-msg is-bot is-working">${crisisMakerIcon(26, 'cm-icon assistant-avatar')}<div class="assistant-bubble">
    <p><span class="ai-spinner ai-spinner-primary"></span> ${action ? escapeHtml(action.message) : tt('Looking at the exercise…', 'J’examine l’exercice…', 'Ich prüfe die Übung…')}</p>
    <button class="btn btn-ghost btn-xs" data-agent-action="stop">${sbUiIcon('stop', 12)} ${tt('Stop', 'Arrêter', 'Stoppen')}</button>
  </div></div>`;
}

function renderAssistant() {
  if (appState.launchScreenOpen) return '';
  const state = assistantState();
  const run = getCrisisAgent();
  const ai = isLLMAvailable();
  const answering = run.origin === 'assistant' && run.status === 'question';
  const blocked = !ai || ((run.active || run.busy) && !answering);
  const fab = `<button class="assistant-fab ${state.open ? 'is-open' : ''}" data-assistant="toggle" aria-expanded="${state.open}" aria-label="${escapeAttribute(state.open ? tt('Close the assistant', 'Fermer l’assistant', 'Assistent schließen') : tt('Open the assistant', 'Ouvrir l’assistant', 'Assistent öffnen'))}">${state.open ? sbUiIcon('close', 24) : '<svg class="ui-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 3h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M19 8h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-1v3l-4-3h-5a2 2 0 0 1-2-2v-1h7a3 3 0 0 0 3-3z" opacity=".75"/></svg>'}</button>`;
  if (!state.open) return fab;
  const messages = state.messages;
  return `${fab}
    <section class="assistant-panel" data-agent-live role="dialog" aria-label="${escapeAttribute(tt('Assistant', 'Assistant', 'Assistent'))}">
      <header class="assistant-head">
        ${crisisMakerIcon(30)}
        <h2>${tt('Assistant', 'Assistant', 'Assistent')}</h2>
        ${messages.length ? `<button class="btn btn-ghost btn-sm" data-assistant="clear" ${run.active ? 'disabled' : ''}>${tt('Clear the conversation', 'Effacer la conversation', 'Unterhaltung löschen')}</button>` : ''}
        <button class="assistant-close" data-assistant="close" aria-label="${escapeAttribute(tt('Close', 'Fermer', 'Schließen'))}">${sbUiIcon('close', 18)}</button>
      </header>
      <p class="assistant-sub">${tt('Ask a question about your exercise, or ask for a change: phases, cells, actors, injects.', 'Posez une question sur votre exercice, ou demandez une modification : phases, cellules, acteurs, injects.', 'Stellen Sie eine Frage zu Ihrer Übung oder bitten Sie um eine Änderung: Phasen, Zellen, Akteure, Injects.')}</p>
      <div class="assistant-thread" data-assistant-thread>
        ${messages.length ? messages.map(renderAssistantMessage).join('') : `<div class="assistant-chips">${assistantSuggestions().map((item) => `<button class="assistant-chip" data-assistant-suggest="${escapeAttribute(item)}" ${blocked ? 'disabled' : ''}>${escapeHtml(item)}</button>`).join('')}</div>`}
        ${renderAssistantLive(run)}
      </div>
      ${ai ? '' : `<p class="assistant-warning">${sbUiIcon('alert', 13)} ${tt('Configure an AI connection in Settings to use the assistant.', 'Configurez une connexion IA dans les Paramètres pour utiliser l’assistant.', 'Konfigurieren Sie eine KI-Verbindung in den Einstellungen, um den Assistenten zu nutzen.')}</p>`}
      <form class="assistant-compose" data-assistant-form>
        <textarea data-assistant-input rows="2" maxlength="4000" placeholder="${escapeAttribute(answering ? tt('Your answers…', 'Vos réponses…', 'Ihre Antworten…') : tt('e.g. which cell receives the most injects?', 'Ex : quelle cellule reçoit le plus d’injects ?', 'z. B. welche Zelle erhält die meisten Injects?'))}" ${blocked ? 'disabled' : ''}>${escapeHtml(state.draft)}</textarea>
        <button type="submit" class="assistant-send" aria-label="${escapeAttribute(tt('Send', 'Envoyer', 'Senden'))}" ${blocked ? 'disabled' : ''}><svg class="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg></button>
      </form>
    </section>`;
}

/* Conversation for the agent, most recent last, bounded to the objective size. */
function assistantObjective(messages) {
  const lines = messages.slice(-12).map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.text}`);
  const latest = messages.at(-1)?.text || '';
  let transcript = lines.slice(0, -1).join('\n');
  const tail = `\n\nLatest request from the user:\n${latest}`;
  if (transcript.length + tail.length > 7800) transcript = transcript.slice(-(7800 - tail.length));
  return `${transcript ? `Conversation so far:\n${transcript}` : 'New conversation.'}${tail}`.slice(0, 7990);
}

async function assistantSend(text) {
  const state = assistantState();
  const run = getCrisisAgent();
  const value = String(text || '').trim();
  if (!value) return;
  if (run.origin === 'assistant' && run.status === 'question') {
    state.messages.push({ role: 'assistant', text: run.question.questions.map((item) => `- ${item}`).join('\n') }, { role: 'user', text: value });
    state.draft = '';
    run.answer(value);
    return;
  }
  if (run.active || run.busy || !isLLMAvailable()) return;
  state.messages.push({ role: 'user', text: value });
  state.draft = '';
  const started = await startCrisisAgent({ kind: 'assistant', mode: 'agent', objective: assistantObjective(state.messages), origin: 'assistant' });
  if (!started) {
    state.messages.push({ role: 'assistant', tone: 'error', text: tt('I cannot start right now: another AI operation is running. Try again when it finishes.', 'Je ne peux pas démarrer maintenant : une autre opération IA est en cours. Réessayez quand elle sera terminée.', 'Ich kann gerade nicht starten: Eine andere KI-Operation läuft. Versuchen Sie es danach erneut.') });
    App.render();
    return;
  }
  const actions = run.log.filter((entry) => entry.kind === 'action').map((entry) => entry.message);
  if (run.status === 'complete' && run.final) {
    state.messages.push({ role: 'assistant', text: run.final.summary, issues: run.final.issues, changes: run.changed, actions });
  } else if (run.status === 'stopped') {
    state.messages.push({ role: 'assistant', tone: 'warning', text: tt('Stopped. Changes already made are kept; you can undo them.', 'Arrêté. Les modifications déjà faites sont conservées ; vous pouvez les annuler.', 'Gestoppt. Bereits vorgenommene Änderungen bleiben erhalten und können rückgängig gemacht werden.'), changes: run.changed, actions });
  } else {
    const error = [...run.log].reverse().find((entry) => entry.kind === 'error' || entry.kind === 'warning');
    state.messages.push({ role: 'assistant', tone: 'error', text: error?.message || tt('I could not complete this request.', 'Je n’ai pas pu traiter cette demande.', 'Ich konnte diese Anfrage nicht abschließen.'), changes: run.changed, actions });
  }
  App.render();
}

function bindAssistantEvents() {
  const state = assistantState();
  document.querySelectorAll('[data-assistant]').forEach((button) => button.addEventListener('click', () => {
    const run = getCrisisAgent();
    switch (button.dataset.assistant) {
      case 'toggle': state.open = !state.open; state.focused = state.open; break;
      case 'close': state.open = false; break;
      case 'clear': if (!run.active) state.messages = []; break;
      case 'skip':
        if (run.origin === 'assistant' && run.status === 'question') {
          state.messages.push({ role: 'assistant', text: run.question.questions.map((item) => `- ${item}`).join('\n') }, { role: 'user', text: tt('Skip, make assumptions.', 'Passe, fais des hypothèses.', 'Überspringen, triff Annahmen.') });
          run.answer(null);
        }
        return;
    }
    App.render();
  }));
  document.querySelectorAll('[data-assistant-suggest]').forEach((chip) => chip.addEventListener('click', () => assistantSend(chip.dataset.assistantSuggest)));
  const input = document.querySelector('[data-assistant-input]');
  const form = document.querySelector('[data-assistant-form]');
  if (input) {
    input.addEventListener('input', () => { state.draft = input.value; });
    input.addEventListener('focus', () => { state.focused = true; });
    input.addEventListener('blur', () => { state.focused = false; });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form?.requestSubmit(); }
      if (event.key === 'Escape') { state.open = false; App.render(); }
    });
    // Re-renders follow the agent's progress: keep the caret where the user was typing.
    if (state.focused && !input.disabled) { input.focus({ preventScroll: true }); input.setSelectionRange(input.value.length, input.value.length); }
  }
  form?.addEventListener('submit', (event) => { event.preventDefault(); assistantSend(input?.value || ''); });
  const thread = document.querySelector('[data-assistant-thread]');
  if (thread) thread.scrollTop = thread.scrollHeight;
}

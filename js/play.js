/* Play tab: runs the exercise live for its pilot. A vertical chronogram of the phases and of
   every inject to send, a permanent control bar (clock, current phase, progress, next inject),
   smart filters, and status changes (draft, validated, sent) in one click.
   The run state lives in project.play so a page reload never loses a running exercise. */
const PLAY_SPEEDS = [1, 2, 5, 10, 30];
const PLAY_SOON_MINUTES = 5;
const PLAY_LATE_MINUTES = 2;
const PLAY_LOG_MAX = 2000;
const PLAY_LOG_TYPES = ['start', 'pause', 'resume', 'clock', 'speed', 'phase', 'status', 'sent', 'note', 'reset'];

/* The exercise log: what happened, at which exercise time and wall-clock time. */
function playLog(type, text, project = appState.scenario) {
  const play = playState(project);
  play.log.push({ t: Math.round(playNow(project) * 10) / 10, at: new Date().toISOString(), type, text: String(text).slice(0, 2000) });
  if (play.log.length > PLAY_LOG_MAX) play.log.splice(0, play.log.length - PLAY_LOG_MAX);
}

function playLogTypeLabel(type) {
  return { start: tt('Start', 'Démarrage', 'Start'), pause: tt('Pause', 'Pause', 'Pause'), resume: tt('Resume', 'Reprise', 'Fortsetzung'), clock: tt('Clock', 'Horloge', 'Uhr'), speed: tt('Speed', 'Vitesse', 'Tempo'), phase: tt('Phase', 'Phase', 'Phase'), status: tt('Status', 'Statut', 'Status'), sent: tt('Sent', 'Envoyé', 'Gesendet'), note: tt('Note', 'Note', 'Notiz'), reset: tt('Reset', 'Réinitialisation', 'Zurücksetzen') }[type] || type;
}

function playWallClock(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* CSV for Excel: one line per log entry, oldest first. */
function playLogCsv(project = appState.scenario) {
  const play = playState(project);
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = play.log.map((entry) => [sbFormatOffset(Math.floor(entry.t)), entry.at ? new Date(entry.at).toLocaleString() : '', project.scenario.start_date ? sbClockTime(entry.t, project.scenario.start_date) : '', playLogTypeLabel(entry.type), entry.text]);
  return '\ufeff' + [['Exercise time', 'Wall clock', 'Simulated time', 'Type', 'Event'], ...rows].map((row) => row.map(quote).join(';')).join('\r\n');
}

function playSaveLog() {
  const project = appState.scenario;
  if (!playState(project).log.length) { pushToast(tt('The log is empty.', 'Le journal est vide.', 'Das Protokoll ist leer.'), 'error'); return; }
  downloadBlob(new Blob([playLogCsv(project)], { type: 'text/csv;charset=utf-8' }), `${slugify(project.name || 'exercise')}_exercise-log.csv`);
  pushToast(tt('Exercise log saved.', 'Journal de l’exercice enregistré.', 'Übungsprotokoll gespeichert.'), 'success');
}

/* Full reset of the run, after two confirmations: clock, sent statuses and the log. */
function playResetAll() {
  const project = appState.scenario;
  const play = playState(project);
  const sent = (project.stimuli || []).filter((item) => item.status === 'sent');
  if (!window.confirm(tt(`Reset the play? The clock returns to H+0:00, the ${sent.length} sent inject(s) go back to Validated and the exercise log is cleared.`, `Réinitialiser le jeu ? L’horloge revient à H+0:00, les ${sent.length} inject(s) envoyé(s) repassent en Validé et le journal de l’exercice est effacé.`, `Spiel zurücksetzen? Die Uhr geht auf H+0:00, die ${sent.length} gesendeten Injects werden wieder Freigegeben und das Protokoll wird gelöscht.`))) return;
  if (!window.confirm(tt(`Last confirmation: this cannot be undone${play.log.length ? ` and the ${play.log.length} log entries will be lost (use Save log first if you need them)` : ''}. Reset now?`, `Dernière confirmation : c’est irréversible${play.log.length ? ` et les ${play.log.length} entrées du journal seront perdues (utilisez d’abord Save log si besoin)` : ''}. Réinitialiser maintenant ?`, `Letzte Bestätigung: Das kann nicht rückgängig gemacht werden${play.log.length ? ` und die ${play.log.length} Protokolleinträge gehen verloren (vorher Save log nutzen)` : ''}. Jetzt zurücksetzen?`))) return;
  for (const stimulus of sent) { stimulus.status = 'ready'; delete stimulus.sent_at; delete stimulus.sent_at_min; }
  for (const stimulus of project.stimuli || []) delete stimulus.sent_count;
  Object.assign(play, { running: false, offset_min: 0, run_since: null, started_at: '', last_phase: '', log: [] });
  playUI().notified = new Set();
  saveLocal(false);
  pushToast(tt('Play reset: ready for a new run.', 'Jeu réinitialisé : prêt pour une nouvelle session.', 'Spiel zurückgesetzt: bereit für einen neuen Durchlauf.'), 'success');
  App.render();
}

const PLAY_NORMALIZED = new WeakSet();
function playState(project = appState.scenario) {
  // Normalized once per object (loaded, imported or reset), then shared by reference.
  if (project.play && PLAY_NORMALIZED.has(project.play)) return project.play;
  const input = project.play && typeof project.play === 'object' ? project.play : {};
  project.play = {
    running: input.running === true,
    offset_min: Number.isFinite(input.offset_min) ? Math.max(0, input.offset_min) : 0,
    run_since: Number.isFinite(input.run_since) ? input.run_since : null,
    speed: PLAY_SPEEDS.includes(input.speed) ? input.speed : 1,
    started_at: typeof input.started_at === 'string' ? input.started_at : '',
    last_phase: typeof input.last_phase === 'string' ? input.last_phase : '',
    log: (Array.isArray(input.log) ? input.log : []).filter((entry) => entry && typeof entry.text === 'string').slice(-PLAY_LOG_MAX)
      .map((entry) => ({ t: Number.isFinite(entry.t) ? entry.t : 0, at: typeof entry.at === 'string' ? entry.at : '', type: PLAY_LOG_TYPES.includes(entry.type) ? entry.type : 'note', text: String(entry.text).slice(0, 2000) }))
  };
  if (project.play.running && !project.play.run_since) project.play.running = false;
  PLAY_NORMALIZED.add(project.play);
  return project.play;
}

function playUI() {
  if (!appState.playUI) appState.playUI = { q: '', quick: 'all', phase: '', cell: '', channel: '', sender: '', sort: 'time', follow: true, planned: true, notified: new Set() };
  return appState.playUI;
}

/* Exercise time in minutes since the start, at the current speed. */
function playNow(project = appState.scenario) {
  const play = playState(project);
  return play.offset_min + (play.running ? (Date.now() - play.run_since) / 60000 * play.speed : 0);
}

function playDuration(project = appState.scenario) {
  const storyboard = project.storyboard;
  const last = Math.max(0, ...(project.stimuli || []).map((item) => item.timestamp_offset_minutes + 1));
  return Math.max(storyboard?.duration_minutes || 0, last, 1);
}

function playClock(minutes) {
  const total = Math.max(0, Math.floor(minutes * 60));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function playCountdown(minutes) {
  const total = Math.max(0, Math.round(minutes * 60));
  const m = Math.floor(total / 60), s = total % 60;
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/* Play numbers: #01 to #NN in time order, shared with the ZIP export. */
function playNumbers(project = appState.scenario) {
  const numbers = new Map();
  (project === appState.scenario ? getSortedStimuli() : [...(project.stimuli || [])].sort((a, b) => a.timestamp_offset_minutes - b.timestamp_offset_minutes))
    .forEach((stimulus, index) => numbers.set(stimulus.id, index + 1));
  return numbers;
}

function playNumberLabel(number, total) {
  return `#${String(number).padStart(Math.max(2, String(total).length), '0')}`;
}

function playStatusLabel(status) {
  return { draft: tt('Draft', 'Brouillon', 'Entwurf'), ready: tt('Validated', 'Validé', 'Freigegeben'), sent: tt('Sent', 'Envoyé', 'Gesendet'), planned: tt('Planned', 'Prévu', 'Geplant') }[status] || status;
}

/* Every inject of the exercise, written or only planned, with its phase and play status. */
function playItems(project = appState.scenario) {
  const storyboard = project.storyboard;
  const numbers = playNumbers(project);
  const total = numbers.size;
  const items = sbExerciseItems(project).map((item) => {
    const stimulus = item.stimulus;
    const phase = storyboard ? sbMainBlockAt(storyboard, item.time) : null;
    const cell = sbCell(project, stimulus?.cell_id || item.cell_id);
    const status = stimulus ? (['draft', 'ready', 'sent'].includes(stimulus.status) ? stimulus.status : 'draft') : 'planned';
    return {
      key: item.key, stimulus, beat: item.beat, time: item.time, phase, cell,
      channel: stimulus?.channel || item.channel,
      title: item.title, sender: item.sender, intent: item.intent, status,
      number: stimulus ? numbers.get(stimulus.id) : null,
      numberLabel: stimulus ? playNumberLabel(numbers.get(stimulus.id), total) : ''
    };
  });
  return items.sort((a, b) => a.time - b.time || (a.number || 999) - (b.number || 999));
}

/* Timing class of an item against the exercise clock. */
function playTiming(item, now) {
  if (item.status === 'sent' || item.status === 'planned') return '';
  if (item.time <= now - PLAY_LATE_MINUTES) return 'is-late';
  if (item.time <= now) return 'is-due';
  if (item.time - now <= PLAY_SOON_MINUTES) return 'is-soon';
  return '';
}

function playQuickFilters() {
  return [
    ['all', tt('All', 'Tout', 'Alle')],
    ['now', tt('To send now', 'À envoyer maintenant', 'Jetzt senden')],
    ['late', tt('Late', 'En retard', 'Verspätet')],
    ['next', tt('Next 15 min', '15 prochaines min', 'Nächste 15 Min')],
    ['todo', tt('To validate', 'À valider', 'Freizugeben')],
    ['sent', tt('Sent', 'Envoyés', 'Gesendet')]
  ];
}

function playMatchesQuick(item, quick, now) {
  const timing = playTiming(item, now);
  switch (quick) {
    case 'now': return timing === 'is-due' || timing === 'is-late';
    case 'late': return timing === 'is-late';
    case 'next': return item.status !== 'sent' && item.status !== 'planned' && item.time >= now && item.time <= now + 15;
    case 'todo': return item.status === 'draft' || item.status === 'planned';
    case 'sent': return item.status === 'sent';
    default: return true;
  }
}

function playFilter(items, ui, now) {
  const q = ui.q.trim().toLowerCase();
  return items.filter((item) => {
    if (!ui.planned && item.status === 'planned') return false;
    if (!playMatchesQuick(item, ui.quick, now)) return false;
    if (ui.phase && (item.phase?.id || 'none') !== ui.phase) return false;
    if (ui.cell && (item.cell?.id || 'none') !== ui.cell) return false;
    if (ui.channel && item.channel !== ui.channel) return false;
    if (ui.sender && item.sender !== ui.sender) return false;
    if (q && ![item.title, item.sender, item.intent, item.cell?.name, item.phase?.title, channelLabel(item.channel), item.numberLabel].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
}

function playSort(items, sort) {
  const statusRank = { draft: 1, planned: 2, ready: 0, sent: 3 };
  const list = [...items];
  if (sort === 'status') list.sort((a, b) => statusRank[a.status] - statusRank[b.status] || a.time - b.time);
  else if (sort === 'cell') list.sort((a, b) => (a.cell?.name || '~').localeCompare(b.cell?.name || '~') || a.time - b.time);
  else if (sort === 'channel') list.sort((a, b) => channelLabel(a.channel).localeCompare(channelLabel(b.channel)) || a.time - b.time);
  return list;
}

// ── View ─────────────────────────────────────────────────────────────────────
function renderPlayView() {
  const project = appState.scenario;
  StoryboardHistory.ensure(project);
  const play = playState(project);
  const ui = playUI();
  const now = playNow(project);
  const items = playItems(project);
  const written = items.filter((item) => item.stimulus);
  const counts = { total: written.length, sent: written.filter((i) => i.status === 'sent').length, ready: written.filter((i) => i.status === 'ready').length, draft: written.filter((i) => i.status === 'draft').length, planned: items.length - written.length };
  const visible = playSort(playFilter(items, ui, now), ui.sort);
  const phases = project.storyboard ? sbMainBlocks(project.storyboard) : [];
  return `<section class="tab-page play-page" data-play-root>
    ${renderPlayGenerate(counts)}
    ${renderPlayBar(project, play, ui, items, now, counts, phases)}
    <div class="play-main">
    <article class="card play-chrono">
      <div class="section-header"><div><h3>${tt('Play exercise', 'Jouer l’exercice', 'Übung spielen')}</h3><p class="subtle">${tt('The whole chronogram, phase by phase. Change a status in one click; Modify opens the editor.', 'Tout le chronogramme, phase par phase. Changez un statut en un clic ; Modifier ouvre l’éditeur.', 'Das ganze Chronogramm, Phase für Phase. Status mit einem Klick ändern; Bearbeiten öffnet den Editor.')}</p></div>
        <span class="play-visible">${visible.length} / ${items.length} ${tt('injects shown', 'injects affichés', 'Injects angezeigt')}</span></div>
      ${renderPlayChrono(project, visible, ui, now, phases)}
    </article>
    ${renderPlayLog(project, play, ui)}
    </div>
  </section>`;
}

function renderPlayGenerate(counts) {
  const exporting = !!appState.ui?.actionLoading?.['export-all'];
  return `<article class="card play-generate">
    <div class="play-generate-text">
      <h3>${sbUiIcon('archive', 18)} ${tt('Generate all stimuli', 'Générer tous les stimuli', 'Alle Stimuli erzeugen')}</h3>
      <p class="subtle">${tt(`A ZIP with the ${counts.total} stimuli numbered in play order (#01 first), rendered as images, plus the chronogram (CSV for Excel) and the project file.`, `Un ZIP avec les ${counts.total} stimuli numérotés dans l’ordre de jeu (#01 en premier), en images, plus le chronogramme (CSV pour Excel) et le fichier projet.`, `Ein ZIP mit den ${counts.total} Stimuli in Spielreihenfolge nummeriert (#01 zuerst), als Bilder, plus Chronogramm (CSV für Excel) und Projektdatei.`)}</p>
      <div class="play-readiness">
        <span class="play-chip is-ready">${counts.ready} ${playStatusLabel('ready')}</span>
        <span class="play-chip is-draft">${counts.draft} ${playStatusLabel('draft')}</span>
        <span class="play-chip is-sent">${counts.sent} ${playStatusLabel('sent')}</span>
        ${counts.planned ? `<span class="play-chip is-planned">${counts.planned} ${tt('planned, not written', 'prévus non rédigés', 'geplant, nicht geschrieben')}</span><button class="btn btn-ghost btn-xs" data-route="detailed">${tt('Write them', 'Les rédiger', 'Schreiben')} ${sbUiIcon('chevronRight', 12)}</button>` : ''}
      </div>
    </div>
    <button class="btn btn-primary play-generate-btn" data-action="export-all" ${counts.total && !exporting ? '' : 'disabled'}>${sbUiIcon(exporting ? 'clock' : 'download', 16)} ${exportAllProgressLabel(tt('Generate all stimuli (.zip)', 'Générer tous les stimuli (.zip)', 'Alle Stimuli erzeugen (.zip)'), tt('Generating…', 'Génération…', 'Wird erzeugt…'))}</button>
  </article>`;
}

function renderPlayBar(project, play, ui, items, now, counts, phases) {
  const duration = playDuration(project);
  const phase = project.storyboard ? sbMainBlockAt(project.storyboard, Math.min(now, duration - 0.01)) : null;
  const next = items.find((item) => item.stimulus && item.status !== 'sent' && item.time > now);
  const late = items.filter((item) => playTiming(item, now) === 'is-late').length;
  const due = items.filter((item) => playTiming(item, now) === 'is-due').length;
  const progress = Math.min(100, Math.round(100 * now / duration));
  const clock = project.scenario.start_date ? sbClockTime(now, project.scenario.start_date) : '';
  const quickCount = (key) => items.filter((item) => (ui.planned || item.status !== 'planned') && playMatchesQuick(item, key, now)).length;
  const senders = [...new Set(items.map((item) => item.sender).filter(Boolean))].sort();
  const channels = [...new Set(items.map((item) => item.channel))].sort();
  const started = play.running || play.offset_min > 0;
  return `<div class="play-bar ${play.running ? 'is-running' : ''}" data-play-bar>
    <div class="play-bar-top">
      <span class="play-bar-title">${sbUiIcon('play', 13)} ${tt('Exercise control', 'Pilotage de l’exercice', 'Übungssteuerung')}${play.started_at ? ` · ${tt('started at', 'démarré à', 'gestartet um')} ${escapeHtml(playWallClock(play.started_at))}` : ''}</span>
      <button class="play-reset" data-play="reset-all" ${started || play.log.length || counts.sent ? '' : 'disabled'} title="${escapeAttribute(tt('Clock back to H+0:00, sent injects back to Validated, log cleared', 'Horloge à H+0:00, injects envoyés repassés en Validé, journal effacé', 'Uhr auf H+0:00, gesendete Injects wieder Freigegeben, Protokoll gelöscht'))}">${sbUiIcon('refresh', 13)} ${tt('Reset play', 'Réinitialiser le jeu', 'Spiel zurücksetzen')}</button>
    </div>
    <div class="play-bar-main">
      <div class="play-controls">
        <button class="play-start ${play.running ? 'is-pause' : ''}" data-play="toggle" title="${escapeAttribute(tt('Start or pause (Space)', 'Démarrer ou mettre en pause (Espace)', 'Start oder Pause (Leertaste)'))}">${play.running ? sbUiIcon('pause', 22) : sbUiIcon('play', 22)}<span>${play.running ? tt('Pause', 'Pause', 'Pause') : started ? tt('Resume', 'Reprendre', 'Fortsetzen') : tt('Start', 'Démarrer', 'Start')}</span></button>
        <div class="play-adjust">
          <button class="btn btn-secondary btn-xs" data-play="shift" data-play-value="-5" title="−5 min">−5</button>
          <button class="btn btn-secondary btn-xs" data-play="shift" data-play-value="-1" title="−1 min">−1</button>
          <button class="btn btn-secondary btn-xs" data-play="shift" data-play-value="1" title="+1 min">+1</button>
          <button class="btn btn-secondary btn-xs" data-play="shift" data-play-value="5" title="+5 min">+5</button>
        </div>
        <button class="btn btn-secondary btn-sm play-add" data-play="add" title="${escapeAttribute(tt('Create an inject at the current exercise time and open the editor', 'Créer un inject à l’heure actuelle de l’exercice et ouvrir l’éditeur', 'Inject zur aktuellen Übungszeit erstellen und Editor öffnen'))}">${sbUiIcon('plus', 14)} ${tt('Add inject now', 'Ajouter un inject', 'Inject jetzt hinzufügen')}</button>
        <label class="play-speed">${tt('Speed', 'Vitesse', 'Tempo')}<select data-play-speed>${PLAY_SPEEDS.map((speed) => `<option value="${speed}" ${play.speed === speed ? 'selected' : ''}>${speed === 1 ? tt('×1 real time', '×1 temps réel', '×1 Echtzeit') : `×${speed}`}</option>`).join('')}</select></label>
      </div>
      <div class="play-clock">
        <span class="play-label">${tt('Exercise time', 'Temps d’exercice', 'Übungszeit')}</span>
        <strong data-play-clock>${playClock(now)}</strong>
        <span class="play-sub" data-play-simulated>${clock ? `${tt('Simulated', 'Simulé', 'Simuliert')} ${escapeHtml(clock)}` : escapeHtml(sbFormatOffset(Math.floor(now)))}</span>
      </div>
      <div class="play-phase" style="--phase-color:${escapeAttribute(phase ? sbBlockColor(phase, project.storyboard) : 'var(--line-strong)')}">
        <span class="play-label">${tt('Current phase', 'Phase en cours', 'Aktuelle Phase')}</span>
        <strong data-play-phase>${escapeHtml(phase?.title || (now >= duration ? tt('Exercise complete', 'Exercice terminé', 'Übung beendet') : '—'))}</strong>
        <span class="play-sub" data-play-phase-left>${phase ? `${tt('ends in', 'se termine dans', 'endet in')} ${playCountdown(sbBlockEnd(phase) - now)}` : ''}</span>
      </div>
      <div class="play-next">
        <span class="play-label">${tt('Next inject', 'Prochain inject', 'Nächster Inject')}</span>
        <strong data-play-next>${next ? `${escapeHtml(next.numberLabel)} ${tt('in', 'dans', 'in')} ${playCountdown(next.time - now)}` : tt('None', 'Aucun', 'Keiner')}</strong>
        <span class="play-sub">${next ? escapeHtml(`${channelLabel(next.channel)}${next.cell ? ` → ${next.cell.name}` : ''}`) : ''}</span>
      </div>
      <div class="play-counters">
        <span class="play-counter"><strong data-play-sent>${counts.sent}/${counts.total}</strong>${tt('sent', 'envoyés', 'gesendet')}</span>
        <span class="play-counter is-due ${due ? '' : 'is-zero'}"><strong data-play-due>${due}</strong>${tt('to send', 'à envoyer', 'zu senden')}</span>
        <span class="play-counter is-late ${late ? '' : 'is-zero'}"><strong data-play-late>${late}</strong>${tt('late', 'en retard', 'verspätet')}</span>
      </div>
    </div>
    <div class="play-progress" title="${progress}%">
      <div class="play-progress-track">${phases.map((block) => `<i style="left:${(100 * block.start_minutes / duration).toFixed(2)}%;width:${(100 * block.duration_minutes / duration).toFixed(2)}%;background:${escapeAttribute(sbBlockColor(block, project.storyboard))}" title="${escapeAttribute(`${sbFormatOffset(block.start_minutes)} · ${block.title}`)}"></i>`).join('')}<b data-play-fill style="width:${progress}%"></b><em data-play-cursor style="left:${progress}%"></em></div>
      <span data-play-percent>${progress}%</span>
    </div>
    <div class="play-filters">
      <div class="play-quick">${playQuickFilters().map(([key, label]) => `<button class="play-quick-btn ${ui.quick === key ? 'active' : ''} is-${key}" data-play-quick="${key}">${escapeHtml(label)}<b>${quickCount(key)}</b></button>`).join('')}</div>
      <input type="search" class="play-search" data-play-filter="q" value="${escapeAttribute(ui.q)}" placeholder="${escapeAttribute(tt('Search #, title, sender, cell…', 'Rechercher #, titre, expéditeur, cellule…', 'Suche #, Titel, Absender, Zelle…'))}">
      <select data-play-filter="phase"><option value="">${tt('All phases', 'Toutes les phases', 'Alle Phasen')}</option>${phases.map((block) => `<option value="${block.id}" ${ui.phase === block.id ? 'selected' : ''}>${escapeHtml(`${sbFormatOffset(block.start_minutes)} · ${block.title}`)}</option>`).join('')}</select>
      <select data-play-filter="cell"><option value="">${tt('All cells', 'Toutes les cellules', 'Alle Zellen')}</option>${(project.cells || []).map((cell) => `<option value="${cell.id}" ${ui.cell === cell.id ? 'selected' : ''}>${escapeHtml(cell.name)}</option>`).join('')}</select>
      <select data-play-filter="channel"><option value="">${tt('All channels', 'Tous les canaux', 'Alle Kanäle')}</option>${channels.map((channel) => `<option value="${channel}" ${ui.channel === channel ? 'selected' : ''}>${escapeHtml(channelLabel(channel))}</option>`).join('')}</select>
      <select data-play-filter="sender"><option value="">${tt('All senders', 'Tous les expéditeurs', 'Alle Absender')}</option>${senders.map((sender) => `<option value="${escapeAttribute(sender)}" ${ui.sender === sender ? 'selected' : ''}>${escapeHtml(sender)}</option>`).join('')}</select>
      <select data-play-filter="sort"><option value="time" ${ui.sort === 'time' ? 'selected' : ''}>${tt('By time and phase', 'Par heure et phase', 'Nach Zeit und Phase')}</option><option value="status" ${ui.sort === 'status' ? 'selected' : ''}>${tt('By status', 'Par statut', 'Nach Status')}</option><option value="cell" ${ui.sort === 'cell' ? 'selected' : ''}>${tt('By cell', 'Par cellule', 'Nach Zelle')}</option><option value="channel" ${ui.sort === 'channel' ? 'selected' : ''}>${tt('By channel', 'Par canal', 'Nach Kanal')}</option></select>
      <label class="play-toggle"><input type="checkbox" data-play-toggle="follow" ${ui.follow ? 'checked' : ''}> ${tt('Follow the clock', 'Suivre le temps', 'Der Uhr folgen')}</label>
      <label class="play-toggle"><input type="checkbox" data-play-toggle="planned" ${ui.planned ? 'checked' : ''}> ${tt('Show planned', 'Afficher les prévus', 'Geplante zeigen')}</label>
    </div>
  </div>`;
}

function renderPlayRow(item, now) {
  const project = appState.scenario;
  const meta = CHANNEL_META[item.channel] || {};
  const clock = project.scenario.start_date ? sbClockTime(item.time, project.scenario.start_date) : '';
  const stimulus = item.stimulus;
  const sentAt = stimulus?.sent_at_min;
  return `<div class="play-row is-${item.status} ${playTiming(item, now)}" data-play-at="${item.time}" data-play-key="${escapeAttribute(item.key)}" ${stimulus ? `data-play-status="${item.status}"` : ''}>
    <div class="play-time"><strong>${escapeHtml(sbFormatOffset(item.time))}</strong>${clock ? `<span>${escapeHtml(clock)}</span>` : ''}</div>
    <span class="play-dot" style="--channel-color:${escapeAttribute(meta.color || '#6d687e')}"></span>
    <div class="play-num">${item.numberLabel || '—'}</div>
    <div class="play-body">
      <div class="play-title"><span class="play-channel" style="--channel-color:${escapeAttribute(meta.color || '#6d687e')}">${escapeHtml(channelLabel(item.channel))}</span><strong>${escapeHtml(item.title || '')}</strong>${stimulus?.added_in_play ? `<span class="play-added">${tt('Added during play', 'Ajouté en jeu', 'Im Spiel hinzugefügt')}</span>` : ''}</div>
      <div class="play-meta">${item.sender ? `<span>${sbIcon('users', 12)} ${escapeHtml(item.sender)}</span>` : ''}${item.cell ? `<span class="play-cell"><i style="background:${escapeAttribute(item.cell.color)}"></i>${escapeHtml(item.cell.name)}</span>` : `<span class="play-cell is-none">${tt('No recipient cell', 'Sans cellule destinataire', 'Ohne Empfängerzelle')}</span>`}${item.status === 'sent' && Number.isFinite(sentAt) ? `<span class="play-sent-at">${sbUiIcon('check', 12)} ${tt('sent at', 'envoyé à', 'gesendet um')} ${escapeHtml(sbFormatOffset(Math.round(sentAt)))}</span>` : ''}</div>
    </div>
    ${stimulus ? `<div class="play-status" role="group" aria-label="${escapeAttribute(tt('Status', 'Statut', 'Status'))}">${['draft', 'ready', 'sent'].map((status) => `<button class="${item.status === status ? 'active' : ''} is-${status}" data-play-set="${status}" data-stimulus-id="${stimulus.id}">${escapeHtml(playStatusLabel(status))}</button>`).join('')}</div>
      <div class="play-actions"><button class="btn btn-secondary btn-xs" data-action="open-stimulus-modal" data-stimulus-id="${stimulus.id}">${sbUiIcon('edit', 13)} ${tt('Modify', 'Modifier', 'Bearbeiten')}</button></div>`
      : `<div class="play-status is-planned-note">${tt('Planned, not written', 'Prévu, non rédigé', 'Geplant, nicht geschrieben')}</div><div class="play-actions"><button class="btn btn-ghost btn-xs" data-route="detailed">${sbUiIcon('edit', 13)} ${tt('Write', 'Rédiger', 'Schreiben')}</button></div>`}
  </div>`;
}

function renderPlayChrono(project, items, ui, now, phases) {
  if (!items.length) return `<p class="play-empty">${tt('No inject matches these filters.', 'Aucun inject ne correspond à ces filtres.', 'Kein Inject entspricht diesen Filtern.')}</p>`;
  const nowLine = `<div class="play-now" data-play-now><span>${tt('NOW', 'MAINTENANT', 'JETZT')} <b data-play-now-time>${escapeHtml(sbFormatOffset(Math.floor(now)))}</b></span></div>`;
  const rows = (list) => {
    let html = '', placed = false;
    for (const item of list) {
      if (!placed && ui.sort === 'time' && item.time > now) { html += nowLine; placed = true; }
      html += renderPlayRow(item, now);
    }
    return { html, placed };
  };
  if (ui.sort !== 'time') return `<div class="play-list">${rows(items).html}</div>`;
  const groups = [...phases.map((phase) => ({ phase, items: items.filter((item) => item.phase === phase) })), { phase: null, items: items.filter((item) => !item.phase) }].filter((group) => group.items.length);
  let nowPlaced = false;
  const html = groups.map((group) => {
    const phase = group.phase;
    const color = phase ? sbBlockColor(phase, project.storyboard) : 'var(--line-strong)';
    const state = phase ? (now >= sbBlockEnd(phase) ? 'is-past' : now >= phase.start_minutes ? 'is-current' : '') : '';
    const sent = group.items.filter((item) => item.status === 'sent').length;
    const written = group.items.filter((item) => item.stimulus).length;
    let body = '';
    for (const item of group.items) {
      if (!nowPlaced && item.time > now) { body += nowLine; nowPlaced = true; }
      body += renderPlayRow(item, now);
    }
    return `<section class="play-phase-group ${state}" style="--phase-color:${escapeAttribute(color)}">
      <header class="play-phase-head">
        <span class="play-phase-time">${phase ? `${escapeHtml(sbFormatOffset(phase.start_minutes))} – ${escapeHtml(sbFormatOffset(sbBlockEnd(phase)))}` : ''}</span>
        <strong>${phase ? escapeHtml(phase.title) : tt('Outside the storyline', 'Hors storyline', 'Außerhalb der Storyline')}</strong>
        ${state === 'is-current' ? `<span class="play-phase-live">${tt('In progress', 'En cours', 'Läuft')}</span>` : ''}
        <span class="play-phase-count">${sent}/${written} ${tt('sent', 'envoyés', 'gesendet')}</span>
        ${phase?.brief ? `<p>${escapeHtml(phase.brief)}</p>` : ''}
      </header>
      <div class="play-list">${body}</div>
    </section>`;
  }).join('');
  return html + (nowPlaced ? '' : `<div class="play-list">${nowLine}</div>`);
}

function renderPlayLog(project, play, ui) {
  const icons = { start: 'play', resume: 'play', pause: 'pause', clock: 'clock', speed: 'clock', phase: 'layers', status: 'edit', sent: 'check', note: 'message', reset: 'refresh' };
  const entries = [...play.log].reverse();
  return `<aside class="card play-log">
    <div class="play-log-head">
      <h3>${sbUiIcon('history', 16)} ${tt('Exercise log', 'Journal de l’exercice', 'Übungsprotokoll')}</h3>
      <button class="btn btn-secondary btn-sm" data-play="save-log" ${play.log.length ? '' : 'disabled'}>${sbUiIcon('download', 13)} ${tt('Save log', 'Enregistrer le journal', 'Protokoll speichern')}</button>
    </div>
    <form class="play-note" data-play-note-form>
      <input type="text" data-play-note maxlength="2000" value="${escapeAttribute(ui.note || '')}" placeholder="${escapeAttribute(tt('Add a note: decision, question, incident… (Enter)', 'Ajouter une note : décision, question, incident… (Entrée)', 'Notiz hinzufügen: Entscheidung, Frage, Vorfall… (Enter)'))}">
      <button type="submit" class="btn btn-primary btn-sm">${sbUiIcon('plus', 13)}</button>
    </form>
    <ol class="play-log-list">${entries.length ? entries.map((entry) => `<li class="is-${entry.type}">
      <span class="play-log-time"><strong>${escapeHtml(sbFormatOffset(Math.floor(entry.t)))}</strong><small>${escapeHtml(playWallClock(entry.at))}</small></span>
      <span class="play-log-icon">${sbUiIcon(icons[entry.type] || 'chevronRight', 13)}</span>
      <span class="play-log-text">${escapeHtml(entry.text)}</span>
    </li>`).join('') : `<li class="play-log-empty">${tt('Start the exercise: every start, pause, phase, status change and note is recorded here.', 'Démarrez l’exercice : chaque démarrage, pause, phase, changement de statut et note est consigné ici.', 'Übung starten: Jeder Start, jede Pause, Phase, Statusänderung und Notiz wird hier festgehalten.')}</li>`}</ol>
  </aside>`;
}

// ── Events and live clock ────────────────────────────────────────────────────
function playSetStatus(stimulus, status) {
  const project = appState.scenario;
  if (stimulus.status === status) return;
  const previous = stimulus.status;
  const number = playNumbers(project).get(stimulus.id);
  const title = sbStimulusLabel(stimulus);
  const label = `${playNumberLabel(number, (project.stimuli || []).length)} ${title.length > 80 ? `${title.slice(0, 79)}…` : title}`;
  const cell = sbCell(project, stimulus.cell_id);
  if (status === 'sent') {
    const delay = Math.round(playNow(project) - stimulus.timestamp_offset_minutes);
    const timing = delay > PLAY_LATE_MINUTES ? ` (${delay} min ${tt('late', 'de retard', 'verspätet')})` : delay < -PLAY_LATE_MINUTES ? ` (${-delay} min ${tt('early', 'd’avance', 'früh')})` : '';
    // States can go backwards to resend an inject: count every send.
    stimulus.sent_count = (stimulus.sent_count || 0) + 1;
    const resend = stimulus.sent_count > 1 ? ` · ${tt('re-sent', 'renvoyé', 'erneut gesendet')} (${stimulus.sent_count}×)` : '';
    playLog('sent', `${label}${cell ? ` → ${cell.name}` : ''}${timing}${resend}`, project);
  } else {
    playLog('status', `${label}: ${playStatusLabel(previous)} → ${playStatusLabel(status)}`, project);
  }
  stimulus.status = status;
  if (status === 'sent') { stimulus.sent_at = new Date().toISOString(); stimulus.sent_at_min = Math.round(playNow(project) * 10) / 10; }
  else { delete stimulus.sent_at; delete stimulus.sent_at_min; }
  stimulus.updated_at = new Date().toISOString();
  saveLocal(false);
}

/* A new inject created during the run, at the current exercise time; the editor opens on it. */
function playAddInject() {
  const project = appState.scenario;
  const ui = playUI();
  const time = Math.ceil(playNow(project));
  const cell = sbCell(project, ui.cell) || null;
  const stimulus = makeStimulus('email_internal', project.actors[0]?.id || '', time);
  stimulus.status = 'draft';
  stimulus.added_in_play = true;
  stimulus.generation_mode = 'manual';
  if (cell) stimulus.cell_id = cell.id;
  project.stimuli.push(stimulus);
  if (typeof setDefaultVideoForStimulus === 'function') setDefaultVideoForStimulus(stimulus);
  sortStimuli();
  const number = playNumbers(project).get(stimulus.id);
  playLog('status', `${tt('Inject added during play', 'Inject ajouté en cours de jeu', 'Inject während des Spiels hinzugefügt')}: ${playNumberLabel(number, project.stimuli.length)} ${tt('at', 'à', 'um')} ${sbFormatOffset(time)}${cell ? ` → ${cell.name}` : ''}`, project);
  saveLocal(false);
  appState.selectedStimulusId = stimulus.id;
  appState.stimulusModalId = stimulus.id;
  App.render();
}

function playToggle() {
  const play = playState();
  if (play.running) { play.offset_min = playNow(); play.running = false; play.run_since = null; playLog('pause', tt('Exercise paused', 'Exercice en pause', 'Übung pausiert')); }
  else {
    const first = !play.started_at && play.offset_min === 0;
    play.running = true; play.run_since = Date.now();
    if (!play.started_at) play.started_at = new Date().toISOString();
    playLog(first ? 'start' : 'resume', first ? tt('Exercise started', 'Exercice démarré', 'Übung gestartet') : tt('Exercise resumed', 'Exercice repris', 'Übung fortgesetzt'));
  }
  saveLocal(false);
  App.render();
}

function bindPlayEvents() {
  clearInterval(window._playTimer);
  if (appState.route !== 'play') return;
  const root = document.querySelector('[data-play-root]');
  if (!root) return;
  const ui = playUI();
  root.querySelectorAll('[data-play]').forEach((button) => button.addEventListener('click', () => {
    const play = playState();
    switch (button.dataset.play) {
      case 'toggle': playToggle(); return;
      case 'shift': {
        const now = playNow();
        const value = Number(button.dataset.playValue || 0);
        play.offset_min = Math.max(0, now + value);
        if (play.running) play.run_since = Date.now();
        playLog('clock', `${tt('Clock adjusted', 'Horloge recalée', 'Uhr angepasst')} ${value > 0 ? '+' : '−'}${Math.abs(value)} min → ${sbFormatOffset(Math.floor(play.offset_min))}`);
        break;
      }
      case 'reset-all': playResetAll(); return;
      case 'add': playAddInject(); return;
      case 'save-log': playSaveLog(); return;
    }
    saveLocal(false);
    App.render();
  }));
  root.querySelector('[data-play-speed]')?.addEventListener('change', (event) => {
    const play = playState();
    play.offset_min = playNow();
    if (play.running) play.run_since = Date.now();
    play.speed = Number(event.target.value) || 1;
    playLog('speed', `${tt('Speed', 'Vitesse', 'Tempo')} ×${play.speed}${play.speed === 1 ? ` (${tt('real time', 'temps réel', 'Echtzeit')})` : ''}`);
    saveLocal(false);
    App.render();
  });
  root.querySelectorAll('[data-play-quick]').forEach((button) => button.addEventListener('click', () => { ui.quick = button.dataset.playQuick; App.render(); }));
  root.querySelectorAll('select[data-play-filter]').forEach((select) => select.addEventListener('change', () => { ui[select.dataset.playFilter] = select.value; App.render(); }));
  const search = root.querySelector('input[data-play-filter="q"]');
  if (search) {
    search.addEventListener('input', () => {
      ui.q = search.value;
      clearTimeout(window._playSearchTimer);
      window._playSearchTimer = setTimeout(() => { ui.searchFocus = true; App.render(); }, 250);
    });
    if (ui.searchFocus) { ui.searchFocus = false; search.focus(); search.setSelectionRange(search.value.length, search.value.length); }
  }
  const note = root.querySelector('[data-play-note]');
  if (note) {
    note.addEventListener('input', () => { ui.note = note.value; });
    root.querySelector('[data-play-note-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = note.value.trim();
      if (!text) return;
      playLog('note', text);
      ui.note = '';
      ui.noteFocus = true;
      saveLocal(false);
      App.render();
    });
    if (ui.noteFocus) { ui.noteFocus = false; note.focus(); }
  }
  root.querySelectorAll('[data-play-toggle]').forEach((input) => input.addEventListener('change', () => { ui[input.dataset.playToggle] = input.checked; App.render(); }));
  root.querySelectorAll('[data-play-set]').forEach((button) => button.addEventListener('click', () => {
    const stimulus = getStimulus(button.dataset.stimulusId);
    if (!stimulus) return;
    playSetStatus(stimulus, button.dataset.playSet);
    App.render();
  }));
  if (!window._playKeysInstalled) {
    window._playKeysInstalled = true;
    window.addEventListener('keydown', (event) => {
      if (appState.route !== 'play' || event.code !== 'Space' || appState.stimulusModalId) return;
      if (event.target.closest?.('input, textarea, select, button, [contenteditable]')) return;
      event.preventDefault();
      playToggle();
    });
  }
  playTick(true);
  if (playState().running) window._playTimer = setInterval(() => playTick(false), 1000);
}

/* Updates the clock, phase, counters and row states in place, without a full render. */
function playTick(initial) {
  if (appState.route !== 'play') { clearInterval(window._playTimer); return; }
  const project = appState.scenario;
  const ui = playUI();
  const now = playNow(project);
  const duration = playDuration(project);
  const set = (selector, value) => { const element = document.querySelector(selector); if (element && element.textContent !== value) element.textContent = value; };
  set('[data-play-clock]', playClock(now));
  set('[data-play-now-time]', sbFormatOffset(Math.floor(now)));
  const clock = project.scenario.start_date ? sbClockTime(now, project.scenario.start_date) : '';
  set('[data-play-simulated]', clock ? `${tt('Simulated', 'Simulé', 'Simuliert')} ${clock}` : sbFormatOffset(Math.floor(now)));
  const phase = project.storyboard ? sbMainBlockAt(project.storyboard, Math.min(now, duration - 0.01)) : null;
  set('[data-play-phase]', phase?.title || (now >= duration ? tt('Exercise complete', 'Exercice terminé', 'Übung beendet') : '—'));
  const play = playState(project);
  if (play.running && phase && play.last_phase !== phase.id) {
    play.last_phase = phase.id;
    playLog('phase', `${tt('Phase started', 'Début de phase', 'Phase begonnen')}: ${phase.title}`, project);
    saveLocal(false);
    if (!initial) { App.render(); return; }
  }
  set('[data-play-phase-left]', phase ? `${tt('ends in', 'se termine dans', 'endet in')} ${playCountdown(sbBlockEnd(phase) - now)}` : '');
  const progress = Math.min(100, Math.round(100 * now / duration));
  const fill = document.querySelector('[data-play-fill]'); if (fill) fill.style.width = `${progress}%`;
  const cursor = document.querySelector('[data-play-cursor]'); if (cursor) cursor.style.left = `${progress}%`;
  set('[data-play-percent]', `${progress}%`);
  const items = playItems(project);
  const next = items.find((item) => item.stimulus && item.status !== 'sent' && item.time > now);
  set('[data-play-next]', next ? `${next.numberLabel} ${tt('in', 'dans', 'in')} ${playCountdown(next.time - now)}` : tt('None', 'Aucun', 'Keiner'));
  let due = 0, late = 0;
  const byKey = new Map(items.map((item) => [item.key, item]));
  document.querySelectorAll('[data-play-key]').forEach((row) => {
    const item = byKey.get(row.dataset.playKey);
    if (!item) return;
    const timing = playTiming(item, now);
    row.classList.toggle('is-due', timing === 'is-due');
    row.classList.toggle('is-late', timing === 'is-late');
    row.classList.toggle('is-soon', timing === 'is-soon');
  });
  for (const item of items) {
    const timing = playTiming(item, now);
    if (timing === 'is-due') due++;
    if (timing === 'is-late') late++;
    // One alert per inject when it becomes due while the clock runs.
    if (!initial && playState(project).running && (timing === 'is-due') && !ui.notified.has(item.key)) {
      ui.notified.add(item.key);
      pushToast(`${item.numberLabel} ${tt('to send now', 'à envoyer maintenant', 'jetzt senden')}: ${item.title}${item.cell ? ` → ${item.cell.name}` : ''}`, 'info');
    }
  }
  set('[data-play-due]', String(due));
  set('[data-play-late]', String(late));
  document.querySelector('[data-play-due]')?.parentElement?.classList.toggle('is-zero', !due);
  document.querySelector('[data-play-late]')?.parentElement?.classList.toggle('is-zero', !late);
  // Keep the NOW line between the right rows, and in view when following the clock.
  const line = document.querySelector('[data-play-now]');
  if (line && ui.sort === 'time') {
    const rows = [...document.querySelectorAll('[data-play-at]')];
    const target = rows.find((row) => Number(row.dataset.playAt) > now);
    const moved = target ? target.previousElementSibling !== line : line.nextElementSibling !== null;
    if (moved) {
      if (target) target.parentElement.insertBefore(line, target);
      else rows.at(-1)?.parentElement.appendChild(line);
    }
    if (ui.follow && playState(project).running && (moved || initial)) {
      const bar = document.querySelector('[data-play-bar]');
      const offset = (bar?.getBoundingClientRect().bottom || 0) + 80;
      const top = line.getBoundingClientRect().top;
      if (top < offset || top > window.innerHeight - 120) window.scrollBy({ top: top - offset, behavior: initial ? 'auto' : 'smooth' });
    }
  }
}

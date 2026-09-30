/* Guided exercise workflow tabs: Main storyline, Cells & actors, Detailed storyline
   and Summary. They share the storyboard engine (scenario-*.js); every detail editor
   opens at the bottom of the screen. */
const DS_CARD_WIDTH = 168;
const DS_ROW_HEIGHT = 46;
// [role, English, French, German]: translated when shown.
const CE_ACTOR_GROUPS = [
  ['attacker', 'Attackers', 'Attaquants', 'Angreifer'], ['journalist', 'Press & media', 'Presse et médias', 'Presse und Medien'],
  ['authority', 'Authorities & regulators', 'Autorités et régulateurs', 'Behörden und Aufsicht'],
  ['client_b2b', 'Business customers', 'Clients professionnels', 'Geschäftskunden'], ['client_b2c', 'Consumers', 'Particuliers', 'Privatkunden'],
  ['partner', 'Partners & suppliers', 'Partenaires et fournisseurs', 'Partner und Lieferanten'],
  ['analyst', 'Experts & analysts', 'Experts et analystes', 'Experten und Analysten'], ['internal', 'Internal senders (simulated)', 'Émetteurs internes (simulés)', 'Interne Absender (simuliert)']
];

/* The cell presets, in the application language: [name, description] (stored presets stay in English). */
const CE_CELL_PRESET_TEXT = {
  decision: [['Cellule décisionnelle', 'Comité exécutif : arbitrages, stratégie et engagements externes.'], ['Entscheidungszelle', 'Geschäftsleitung: Abwägungen, Strategie und externe Zusagen.']],
  operational: [['Cellule de crise opérationnelle', 'Coordonne la réponse, les impacts métier et la logistique.'], ['Operative Krisenzelle', 'Koordiniert die Reaktion, die geschäftlichen Auswirkungen und die Logistik.']],
  communication: [['Cellule communication', 'Communication interne et externe, médias et réseaux sociaux.'], ['Kommunikationszelle', 'Interne und externe Kommunikation, Medien und soziale Netzwerke.']],
  it: [['Cellule IT et technique', 'Investigation, confinement et reprise des systèmes d’information.'], ['IT- und Technikzelle', 'Untersuchung, Eindämmung und Wiederherstellung der IT-Systeme.']],
  legal: [['Cellule juridique et conformité', 'Notifications réglementaires, exposition juridique et assureurs.'], ['Rechts- und Compliance-Zelle', 'Behördenmeldungen, rechtliche Risiken und Versicherer.']],
  business: [['Cellule continuité d’activité', 'Mode dégradé, clients, fournisseurs et plans de continuité.'], ['Zelle Geschäftskontinuität', 'Notbetrieb, Kunden, Lieferanten und Kontinuitätspläne.']],
  hr: [['Cellule RH', 'Personnel, partenaires sociaux, bien-être et organisation interne.'], ['Personalzelle', 'Mitarbeitende, Sozialpartner, Wohlbefinden und interne Organisation.']]
};
function cePresetText(preset) {
  const [fr, de] = CE_CELL_PRESET_TEXT[preset.key] || [];
  return {
    name: tt(preset.name, fr?.[0] || preset.name, de?.[0] || preset.name),
    description: tt(preset.description, fr?.[1] || preset.description, de?.[1] || preset.description)
  };
}

function tabUI(name) {
  const ui = sbUI();
  if (!ui.tabs) ui.tabs = {};
  if (!ui.tabs[name]) {
    ui.tabs[name] = {
      detailed: { cell: 'all', selected: null, zoom: null, needsFit: true, scrollLeft: 0, scrollTop: 0, playhead: 0, focusTime: null },
      summary: { review: null },
      storyline: { editorOpen: true }
    }[name] || {};
  }
  return ui.tabs[name];
}

function tabProject() {
  const project = appState.scenario;
  if (!Array.isArray(project.cells)) project.cells = [];
  if (!project.exercise) project.exercise = { players_count: '', cells_count: '' };
  StoryboardHistory.ensure(project);
  return project;
}

function tabEmptyNote(text, route, label) {
  return `<div class="tab-empty"><p>${escapeHtml(text)}</p>${route ? `<button class="btn btn-primary btn-sm" data-route="${route}">${escapeHtml(label)}</button>` : ''}</div>`;
}

/* The Update button of the Main storyline, Cells & actors and Detailed storyline tabs:
   one dialog that reflects every change in cascade (phases → plans → actors → injects). */
function renderUpdateButton(project, pending = sbPendingSyncCount(project), label = tt('Update', 'Mettre à jour', 'Aktualisieren')) {
  return `<button class="sb-tool sb-tool-label sb-update ${pending ? 'has-changes' : ''}" data-sb-action="open-modal" data-sb-modal="sync" title="${escapeAttribute(pending ? tt(`${pending} change(s) to reflect in cascade: phases → inject plans → actors → injects`, `${pending} modification(s) à répercuter en cascade : phases → plans d’injects → acteurs → injects`, `${pending} Änderung(en) kaskadenartig zu übernehmen: Phasen → Inject-Pläne → Akteure → Injects`) : tt('Everything is up to date. Open to check.', 'Tout est à jour. Ouvrez pour vérifier.', 'Alles ist aktuell. Zum Prüfen öffnen.'))}">${sbUiIcon('sync')}<span>${escapeHtml(label)}</span>${pending ? `<span class="sb-count">${pending}</span>` : ''}</button>`;
}

/* The bar between the timeline and the bottom editor of the Main and Detailed storyline:
   drag it (or use the arrow keys) to share the height, double-click to reset. Each zone
   scrolls vertically when it gets too small. The height is kept per tab in appState.ui. */
const BE_MIN_EDITOR = 56;
const BE_MIN_TIMELINE = 80;

function editorHeights() {
  if (!appState.ui.editorHeights) appState.ui.editorHeights = {};
  return appState.ui.editorHeights;
}

function editorHeightStyle(key) {
  const height = editorHeights()[key];
  return Number.isFinite(height) ? `style="--be-height:${height}px"` : '';
}

function renderEditorSplitter(key) {
  return `<div class="resize-handle resize-handle-horizontal be-splitter" data-be-splitter="${key}" tabindex="0" role="separator" aria-orientation="horizontal" aria-label="${escapeAttribute(tt('Resize the timeline and the editor', 'Redimensionner la timeline et l’éditeur', 'Zeitleiste und Editor anpassen'))}" title="${escapeAttribute(tt('Drag to resize the timeline and the editor (double-click to reset)', 'Faites glisser pour redimensionner la timeline et l’éditeur (double-clic pour réinitialiser)', 'Ziehen, um Zeitleiste und Editor anzupassen (Doppelklick zum Zurücksetzen)'))}"></div>`;
}

function bindEditorSplitter(root) {
  const handle = root.querySelector('[data-be-splitter]');
  const timeline = handle?.previousElementSibling;
  const editor = handle?.nextElementSibling;
  if (!timeline || !editor) return;
  const key = handle.dataset.beSplitter;
  const total = () => timeline.getBoundingClientRect().height + editor.getBoundingClientRect().height;
  const apply = (height, space = total()) => {
    const value = Math.round(Math.min(Math.max(height, BE_MIN_EDITOR), Math.max(BE_MIN_EDITOR, space - BE_MIN_TIMELINE)));
    editorHeights()[key] = value;
    editor.style.setProperty('--be-height', `${value}px`);
  };
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    const startY = event.clientY;
    const startHeight = editor.getBoundingClientRect().height;
    const space = total();
    const move = (moveEvent) => apply(startHeight - (moveEvent.clientY - startY), space);
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
      document.body.classList.remove('is-resizing-panels');
    };
    document.body.classList.add('is-resizing-panels');
    try { handle.setPointerCapture(pointerId); } catch (_) { /* Older browsers. */ }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  });
  handle.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    apply(editor.getBoundingClientRect().height + (event.key === 'ArrowUp' ? 24 : -24));
  });
  handle.addEventListener('dblclick', () => {
    delete editorHeights()[key];
    editor.style.removeProperty('--be-height');
  });
}

// ═══ Main storyline ═════════════════════════════════════════════════════════
function renderStorylineView() {
  return sbWithRenderMemo(() => {
    const ui = sbUI();
    const project = tabProject();
    const storyboard = project.storyboard;
    sbCaptureFocus();
    if (ui.zoom === null) { ui.zoom = 3; ui.needsFit = true; }
    ui.playhead = Math.min(Math.max(0, ui.playhead), storyboard.duration_minutes);
    const readOnly = sbReadOnly();
    const block = sbSelectedBlock();
    const ai = isLLMAvailable();
    const stages = slPhaseTypes();
    return `<section class="sb-workspace sl-workspace ${readOnly ? 'is-readonly' : ''} ${sbCompact() ? 'is-compact' : ''}" data-sb-scope aria-label="${escapeAttribute(workflowTabLabel('storyline'))}">
      <header class="sb-toolbar">
        <div class="sb-tb-title"><span class="sb-eyebrow">${escapeHtml(workflowTabLabel('storyline'))}</span><div class="sb-tb-name-row"><strong class="sb-tb-name">${escapeHtml(project.name || tt('Untitled scenario', 'Scénario sans titre', 'Unbenanntes Szenario'))}</strong><span class="sb-chip sb-chip-rev">rev ${storyboard.rev}</span></div></div>
        <div class="sb-tb-group">
          <button class="sb-tool" data-sb-action="undo" ${StoryboardHistory.canUndo() ? '' : 'disabled'} title="${escapeAttribute(tt('Undo (Ctrl+Z)', 'Annuler (Ctrl+Z)', 'Rückgängig (Strg+Z)'))}">${sbUiIcon('undo')}</button>
          <button class="sb-tool" data-sb-action="redo" ${StoryboardHistory.canRedo() ? '' : 'disabled'} title="${escapeAttribute(tt('Redo (Ctrl+Shift+Z)', 'Rétablir (Ctrl+Maj+Z)', 'Wiederholen (Strg+Umschalt+Z)'))}">${sbUiIcon('redo')}</button>
          <button class="sb-tool sb-tool-label" data-sb-action="open-modal" data-sb-modal="versions" title="${escapeAttribute(tt('Versions', 'Versions', 'Versionen'))}">${sbUiIcon('history')}<span>${escapeHtml(tt('Versions', 'Versions', 'Versionen'))}</span></button>
        </div>
        ${storyboard.blocks.length ? renderSbTimelineTools() : ''}
        <div class="sb-tb-group">
          <label class="sl-add" title="${escapeAttribute(tt('Add a phase', 'Ajouter une phase', 'Phase hinzufügen'))}">${sbUiIcon('plus', 14)}<select data-sl-add ${readOnly ? 'disabled' : ''} aria-label="${escapeAttribute(tt('Add a phase', 'Ajouter une phase', 'Phase hinzufügen'))}"><option value="">${escapeHtml(tt('Add phase…', 'Ajouter une phase…', 'Phase hinzufügen…'))}</option>${stages.map(([key]) => `<option value="${key}">${escapeHtml(sbBlockTypeLabel(key))}</option>`).join('')}</select></label>
        </div>
        <div class="sb-tb-group sb-tb-output">${renderUpdateButton(project, undefined, tt('Update next tabs', 'Mettre à jour les onglets suivants', 'Folgende Tabs aktualisieren'))}</div>
      </header>
      ${renderSbStatusBar()}
      ${renderFramingBar(project, 'storyline')}
      <div class="sl-timeline">${storyboard.blocks.length ? renderSbTimeline(storyboard) : tabEmptyNote(tt('No phase yet. Pick a scenario in the Project library, generate one with AI in Context, or add a phase above.', 'Aucune phase pour l’instant. Choisissez un scénario dans la bibliothèque du Projet, générez-en un avec l’IA dans Contexte, ou ajoutez une phase ci-dessus.', 'Noch keine Phase. Wählen Sie ein Szenario in der Projekt-Bibliothek, erstellen Sie eines mit KI im Kontext oder fügen Sie oben eine Phase hinzu.'), 'scenario', tt('Context', 'Contexte', 'Kontext'))}</div>
      ${renderEditorSplitter('storyline')}
      <section class="bottom-editor sl-editor" aria-label="${escapeAttribute(tt('Phase editor', 'Éditeur de phase', 'Phasen-Editor'))}" ${editorHeightStyle('storyline')}>
        ${block ? renderPhaseEditor(storyboard, block) : `<div class="bottom-editor-empty">${sbUiIcon('layers', 18)}<span>${escapeHtml(tt('Select a phase on the timeline to edit what happens and its key stimuli. Drag its edges to change its duration.', 'Sélectionnez une phase sur la timeline pour modifier ce qui s’y passe et ses stimuli clés. Faites glisser ses bords pour changer sa durée.', 'Wählen Sie eine Phase auf der Zeitleiste, um den Ablauf und ihre wichtigsten Stimuli zu bearbeiten. Ziehen Sie ihre Ränder, um die Dauer zu ändern.'))}</span></div>`}
      </section>
      ${renderSbModal(storyboard)}
    </section>`;
  });
}

/* The phase types of the main storyline, the same in "Add phase" and the phase editor. The
   workstream types (cells, communication, legal…) are cells now, not phases; a phase that
   still has one keeps it in its own list. */
const SL_WORKSTREAM_TYPES = ['crisis_cell', 'communication', 'legal', 'hr', 'logistics', 'customers'];
function slPhaseTypes(current = null) {
  return Object.entries(SB_BLOCK_TYPES).filter(([key]) => key === current || !SL_WORKSTREAM_TYPES.includes(key));
}

function renderPhaseEditor(storyboard, block) {
  const project = appState.scenario;
  const readOnly = sbReadOnly() || block.locked ? 'disabled' : '';
  const ui = sbUI();
  // Per cell, every planned inject it receives (sent to it alone, to several cells or to all).
  const counts = new Map((project.cells || []).map((cell) => [cell.id, block.beats.filter((beat) => sbReaches(beat.cell_id, cell.id)).length]));
  const ai = isLLMAvailable();
  return `<div class="bottom-editor-head" style="--clip-color:${sbBlockColor(block, storyboard)}">
      <span class="sb-clip-icon">${sbIcon((SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom).icon, 16)}</span>
      <input class="be-title" data-sb-field="title" value="${escapeAttribute(block.title)}" aria-label="${escapeAttribute(tt('Phase title', 'Titre de la phase', 'Phasentitel'))}" ${readOnly}>
      <select data-sb-field="type" aria-label="${escapeAttribute(tt('Phase type', 'Type de phase', 'Phasentyp'))}" ${readOnly}>${slPhaseTypes(block.type).map(([key]) => sbOption(key, sbBlockTypeLabel(key), block.type)).join('')}</select>
      <label class="be-inline be-stress" title="${escapeAttribute(tt('Stress level of the phase: it sets its colour and the intensity the AI gives its injects', 'Niveau de stress de la phase : il fixe sa couleur et l’intensité que l’IA donne à ses injects', 'Stresslevel der Phase: Es bestimmt ihre Farbe und die Intensität, die die KI ihren Injects gibt'))}">${escapeHtml(tt('Stress', 'Stress', 'Stress'))}<select data-sb-field="stress" ${readOnly}>${sbOption(0, `Auto · ${sbStressLabel(SB_TYPE_STRESS[block.type] || 3)}`, block.stress)}${SB_STRESS_LEVELS.map((item) => sbOption(item.level, sbStressLabel(item.level), block.stress)).join('')}</select></label>
      <label class="be-inline">${escapeHtml(tt('Start', 'Début', 'Beginn'))} · ${sbFormatOffset(block.start_minutes)}<input type="number" min="0" step="${sbSnapStep()}" data-sb-field="start_minutes" value="${block.start_minutes}" ${readOnly}></label>
      <label class="be-inline">${escapeHtml(tt('Duration (min)', 'Durée (min)', 'Dauer (Min.)'))}<input type="number" min="5" step="${sbSnapStep()}" data-sb-field="duration_minutes" value="${block.duration_minutes}" ${readOnly}></label>
      <label class="be-inline" title="${escapeAttribute(tt(`Number of injects wanted in this phase, all cells together. Plan with AI adds the missing ones (${block.beats.length} planned now).`, `Nombre d’injects voulus dans cette phase, toutes cellules confondues. Planifier avec l’IA ajoute ceux qui manquent (${block.beats.length} prévu(s) actuellement).`, `Gewünschte Anzahl Injects in dieser Phase, alle Zellen zusammen. Planen mit KI ergänzt die fehlenden (${block.beats.length} derzeit geplant).`))}">${escapeHtml(tt('Injects', 'Injects', 'Injects'))} · ${escapeHtml(tt(`${block.beats.length} planned`, `${block.beats.length} prévu(s)`, `${block.beats.length} geplant`))}<input type="number" min="0" max="${SB_MAX_BEATS}" step="1" data-sb-field="stimuli_target" value="${Math.max(block.stimuli_target, block.beats.length)}" ${readOnly}></label>
      <span class="be-actions">
        <button class="sb-icon-btn ${block.locked ? 'is-on' : ''}" data-sb-action="toggle-lock" title="${escapeAttribute(block.locked ? tt('Unlock', 'Déverrouiller', 'Entsperren') : tt('Lock', 'Verrouiller', 'Sperren'))}" ${sbReadOnly() ? 'disabled' : ''}>${sbUiIcon(block.locked ? 'lock' : 'unlock', 15)}</button>
        <button class="sb-icon-btn" data-sb-action="duplicate-block" title="${escapeAttribute(tt('Duplicate', 'Dupliquer', 'Duplizieren'))}" ${sbReadOnly() ? 'disabled' : ''}>${sbUiIcon('copy', 15)}</button>
        <button class="sb-icon-btn is-danger" data-sb-action="delete-block" title="${escapeAttribute(tt('Delete', 'Supprimer', 'Löschen'))}" ${readOnly}>${sbUiIcon('trash', 15)}</button>
        <button class="sb-icon-btn" data-sb-action="deselect" title="${escapeAttribute(tt('Close (Esc)', 'Fermer (Échap)', 'Schließen (Esc)'))}">${sbUiIcon('close', 15)}</button>
      </span>
    </div>
    <div class="bottom-editor-body sl-editor-body">
      <label class="sb-mini-field sl-what">${escapeHtml(tt('What happens during this phase', 'Ce qui se passe pendant cette phase', 'Was in dieser Phase passiert'))}
        <textarea data-sb-field="brief" rows="3" placeholder="${escapeAttribute(`${tt('In plain words, what happens during this phase: the events, what the players discover, the pressure they face.', 'En termes simples, ce qui se passe pendant cette phase : les événements, ce que découvrent les joueurs, la pression qu’ils subissent.', 'In einfachen Worten, was in dieser Phase passiert: die Ereignisse, was die Spieler entdecken, der Druck, dem sie ausgesetzt sind.')} ${sbBlockTypeHint(block.type)}`)}" ${readOnly}>${escapeHtml(block.brief)}</textarea>
      </label>
      ${renderMainEvents(block, readOnly)}
      <div class="sl-foot">
        ${sbNeedsReplan(block) ? `<div class="sl-replan">${sbUiIcon('alert', 14)}<span>${escapeHtml(tt(`What happens changed: the ${block.beats.length} planned inject(s) still follow the previous version.`, `Le déroulé a changé : les ${block.beats.length} inject(s) prévu(s) suivent encore la version précédente.`, `Der Ablauf hat sich geändert: Die ${block.beats.length} geplanten Injects folgen noch der vorherigen Version.`))}</span>${renderUpdateButton(project)}</div>` : ''}
        <div class="sl-injects">${block.beats.length ? `<b>${block.beats.length}</b> ${escapeHtml(tt('injects planned', 'injects prévus', 'geplante Injects'))} · ${(project.cells || []).filter((cell) => counts.get(cell.id)).map((cell) => `<span class="cell-dot" style="--cell-color:${cell.color}"></span>${escapeHtml(cell.name)} ${counts.get(cell.id)}`).join(' · ')}` : escapeHtml(tt('No inject planned in this phase yet.', 'Aucun inject prévu dans cette phase pour l’instant.', 'In dieser Phase ist noch kein Inject geplant.'))} <button class="btn btn-ghost btn-xs" data-tab-action="open-detailed" data-tab-value="${block.id}">${escapeHtml(workflowTabLabel('detailed'))} →</button></div>
        <div class="sl-ai">
          <span class="sl-ai-label">${sbUiIcon('wand', 14)} ${escapeHtml(tt('Modify with AI', 'Modifier avec l’IA', 'Mit KI ändern'))}</span>
          <input type="text" data-sb-ui="rewrite" value="${escapeAttribute(ui.rewrite)}" placeholder="${escapeAttribute(tt('What to change, e.g. make it more ambiguous. Empty: the AI details the phase and plans its injects.', 'Ce qu’il faut changer, ex. : la rendre plus ambiguë. Vide : l’IA détaille la phase et planifie ses injects.', 'Was geändert werden soll, z. B. mehrdeutiger machen. Leer: Die KI detailliert die Phase und plant ihre Injects.'))}" aria-label="${escapeAttribute(tt('Instruction for the AI', 'Instruction pour l’IA', 'Anweisung für die KI'))}" ${readOnly}>
          <button class="btn btn-secondary btn-sm" data-sb-action="modify-block" ${ai && !readOnly ? '' : 'disabled'} title="${escapeAttribute(ai ? tt('With an instruction, the AI rewrites the phase; empty, it details it and plans its injects', 'Avec une instruction, l’IA réécrit la phase ; sans instruction, elle la détaille et planifie ses injects', 'Mit einer Anweisung schreibt die KI die Phase um; ohne Anweisung detailliert sie sie und plant ihre Injects') : tt('Configure an AI connection in Settings', 'Configurez une connexion IA dans les Paramètres', 'Richten Sie in den Einstellungen eine KI-Verbindung ein'))}">${sbUiIcon('wand', 13)} ${escapeHtml(tt('Modify with AI', 'Modifier avec l’IA', 'Mit KI ändern'))}</button>
        </div>
      </div>
    </div>`;
}

/* The main events of a phase: a line of text at a time (minutes from the phase start),
   such as "the ransom note appears on every screen". They frame the story; the AI plans
   the injects of every cell around them and never changes them. */
function renderMainEvents(block, readOnly) {
  const events = block.events || [];
  return `<section class="sl-events" aria-label="${escapeAttribute(tt('Main events', 'Événements principaux', 'Hauptereignisse'))}">
    <div class="sl-events-head">
      <strong>${sbUiIcon('star', 14)} ${escapeHtml(tt('Main events', 'Événements principaux', 'Hauptereignisse'))}</strong>
      <span class="subtle">${escapeHtml(tt('The moments that frame this phase; the injects are planned around them.', 'Les moments qui structurent cette phase ; les injects sont planifiés autour d’eux.', 'Die Momente, die diese Phase prägen; die Injects werden um sie herum geplant.'))}</span>
      <button class="btn btn-ghost btn-xs" data-tab-action="sl-event-add" data-tab-value="${block.id}" ${readOnly}>${sbUiIcon('plus', 12)} ${escapeHtml(tt('Add', 'Ajouter', 'Hinzufügen'))}</button>
    </div>
    ${events.map((event) => `<div class="sl-event">
      <label class="sl-event-time" title="${escapeAttribute(tt('Minutes from the phase start', 'Minutes depuis le début de la phase', 'Minuten ab Phasenbeginn'))}">${sbFormatOffset(block.start_minutes + event.offset_minutes)}<input type="number" min="0" max="${Math.max(0, block.duration_minutes - 1)}" step="1" data-sl-event="${escapeAttribute(event.id)}.at" value="${event.offset_minutes}" aria-label="${escapeAttribute(tt('Minutes from the phase start', 'Minutes depuis le début de la phase', 'Minuten ab Phasenbeginn'))}" ${readOnly}></label>
      <input type="text" data-sl-event="${escapeAttribute(event.id)}.text" value="${escapeAttribute(event.text)}" placeholder="${escapeAttribute(tt('e.g. The ransom note appears on every screen', 'Ex. : la demande de rançon s’affiche sur tous les écrans', 'z. B. Die Lösegeldforderung erscheint auf allen Bildschirmen'))}" aria-label="${escapeAttribute(tt('Main event', 'Événement principal', 'Hauptereignis'))}" ${readOnly}>
      <button class="sb-icon-btn is-danger" data-tab-action="sl-event-delete" data-tab-value="${escapeAttribute(event.id)}" title="${escapeAttribute(tt('Delete', 'Supprimer', 'Löschen'))}" ${readOnly}>${sbUiIcon('trash', 13)}</button>
    </div>`).join('') || `<p class="sl-main-empty">${escapeHtml(tt('None yet: add the moments that frame this phase, e.g. the ransom note, a TV flash, the regulator\'s call.', 'Aucun pour l’instant : ajoutez les moments qui structurent cette phase, ex. : la demande de rançon, un flash TV, l’appel du régulateur.', 'Noch keine: Fügen Sie die Momente hinzu, die diese Phase prägen, z. B. die Lösegeldforderung, eine TV-Eilmeldung, den Anruf der Aufsichtsbehörde.'))}</p>`}
  </section>`;
}

/* The phase and main event of an event id. */
function slFindEvent(storyboard, eventId) {
  for (const block of storyboard.blocks) {
    const event = (block.events || []).find((item) => item.id === eventId);
    if (event) return { block, event };
  }
  return null;
}

/* The recipients of an inject: "All cells", or any set of cells (none = unassigned). */function renderRecipientPicker(project, itemKey, cellId, readOnly) {
  const all = sbIsAllCells(cellId);
  const ids = sbRecipientIds(cellId);
  return `<div class="rcpt chip-toggles" data-rcpt="${escapeAttribute(itemKey)}" role="group" aria-label="${escapeAttribute(tt('Recipient cells', 'Cellules destinataires', 'Empfängerzellen'))}">
    <label class="chip-toggle rcpt-all"><input type="checkbox" value="${SB_ALL_CELLS}" ${all ? 'checked' : ''} ${readOnly}>${escapeHtml(tt('All cells', 'Toutes les cellules', 'Alle Zellen'))}</label>
    ${project.cells.map((cell) => `<label class="chip-toggle" style="--cell-color:${cell.color}"><input type="checkbox" value="${escapeAttribute(cell.id)}" ${all || ids.includes(cell.id) ? 'checked' : ''} ${all || readOnly ? 'disabled' : ''}><span class="cell-dot"></span>${escapeHtml(cell.name)}</label>`).join('')}
  </div>`;
}

/* Opens the full inject editor of an item, creating its inject first (empty, without AI)
   when it is still only planned. */
async function openItemEditor(project, key) {
  const item = tabItemByKey(project, key);
  if (!item) return;
  let stimulus = item.stimulus;
  if (!stimulus && item.kind === 'beat' && !sbReadOnly()) {
    await SbPipeline.run({ blockIds: [item.block.id], beatIds: [item.beat.id], plan: false, cast: true, write: false });
    stimulus = sbStimulusForBeat(project, item.beat.id);
  }
  if (!stimulus) return;
  appState.selectedStimulusId = stimulus.id;
  appState.stimulusModalId = stimulus.id;
}

/* In the full inject editor: the phase the inject belongs to and the cells that receive it. */
function stimulusItemKey(project, stimulus) {
  const beatId = stimulus.scenario_link?.beat_id;
  return beatId && slFindBeat(project.storyboard, beatId) ? `beat:${beatId}` : `stim:${stimulus.id}`;
}

function renderStimulusLinks(project, stimulus) {
  if (!project.storyboard) return '';
  const phases = sbMainBlocks(project.storyboard);
  const current = ExerciseModel.phaseOfStimulus(project, stimulus);
  const readOnly = sbReadOnly() ? 'disabled' : '';
  return `<label class="field">${escapeHtml(tt('Phase', 'Phase', 'Phase'))}
      <select data-stimulus-phase="${escapeAttribute(stimulus.id)}" ${readOnly || !phases.length ? 'disabled' : ''}>
        ${current ? '' : `<option value="" selected>${escapeHtml(tt('Outside the storyline', 'Hors storyline', 'Außerhalb der Storyline'))}</option>`}
        ${phases.map((block) => `<option value="${escapeAttribute(block.id)}" ${current?.id === block.id ? 'selected' : ''}>${escapeHtml(`${sbFormatOffset(block.start_minutes)} · ${block.title}`)}</option>`).join('')}
      </select>
    </label>
    <div class="field stimulus-recipients">${escapeHtml(tt('Received by', 'Reçu par', 'Empfangen von'))}
      ${renderRecipientPicker(project, stimulusItemKey(project, stimulus), stimulus.cell_id || '', readOnly)}
    </div>`;
}

function bindStimulusLinks() {
  const project = appState.scenario;
  const modal = document.querySelector('[data-stimulus-modal-body]');
  if (!modal || !project?.storyboard) return;
  modal.querySelectorAll('[data-stimulus-phase]').forEach((select) => select.addEventListener('change', () => {
    const stimulus = getStimulus(select.dataset.stimulusPhase);
    const block = sbBlock(project.storyboard, select.value);
    const item = stimulus && tabItemByKey(project, stimulusItemKey(project, stimulus));
    if (!block || !item || sbReadOnly()) return;
    // Into the chosen phase: its time stays when it already falls inside, else the phase start.
    const inside = item.time >= block.start_minutes && item.time < sbBlockEnd(block);
    dsMoveItem(project, item, inside ? item.time : block.start_minutes, undefined);
    if (item.kind === 'stimulus') {
      stimulus.scenario_link = sbNormalizeLink({ ...(stimulus.scenario_link || {}), block_id: block.id, beat_id: '', offset: Math.max(0, stimulus.timestamp_offset_minutes - block.start_minutes), at: stimulus.timestamp_offset_minutes });
    }
    saveLocal(false);
    App.render();
  }));
  modal.querySelectorAll('[data-rcpt]').forEach((group) => group.addEventListener('change', (event) => applyRecipientChange(project, group, event.target)));
}

/* A tick in a recipient picker: "All cells", or the set of ticked cells. */
function applyRecipientChange(project, group, box) {
  const item = tabItemByKey(project, group.dataset.rcpt);
  if (!item || sbReadOnly()) return;
  let value;
  // Unticking "All cells" keeps every cell ticked, ready to untick some.
  if (box.value === SB_ALL_CELLS) value = box.checked ? SB_ALL_CELLS : sbJoinRecipients(project, project.cells.map((cell) => cell.id));
  else value = sbJoinRecipients(project, [...group.querySelectorAll('input:checked')].map((input) => input.value).filter((id) => id !== SB_ALL_CELLS));
  dsMoveItem(project, item, item.time, value || 'none');
  App.render();
}

/* The phase and planned inject of a beat id. */
function slFindBeat(storyboard, beatId) {
  for (const block of storyboard.blocks) {
    const beat = block.beats.find((item) => item.id === beatId);
    if (beat) return { block, beat };
  }
  return null;
}


// ═══ Cells & actors ═════════════════════════════════════════════════════════
function renderCellsView() {
  return sbWithRenderMemo(() => {
    const project = tabProject();
    const storyboard = project.storyboard;
    sbCaptureFocus();
    const items = sbExerciseItems(project);
    const players = project.cells.reduce((sum, cell) => sum + cell.players.length, 0);
    const missingPresets = SB_CELL_PRESETS.filter((preset) => !project.cells.some((cell) => cell.key === preset.key));
    const actorsPlaceholder = tt('Ex: "Journalists from a national daily and a TV channel, the national cyber agency, the data protection authority, an angry B2C customer on social media and the ransomware group."', 'Ex. : « Des journalistes d’un quotidien national et d’une chaîne TV, l’agence nationale de cybersécurité, l’autorité de protection des données, un client particulier en colère sur les réseaux sociaux et le groupe de rançongiciel. »', 'Z. B.: „Journalisten einer überregionalen Tageszeitung und eines TV-Senders, die nationale Cybersicherheitsbehörde, die Datenschutzbehörde, ein verärgerter Privatkunde in sozialen Netzwerken und die Ransomware-Gruppe.“');
    const pending = sbPendingSyncCount(project);
    return `<section class="tab-page ce-page" data-sb-scope>
      <div class="ce-update ${pending ? 'has-changes' : ''}">
        <span>${pending ? `${sbUiIcon('alert', 14)} <b>${pending}</b> ${escapeHtml(tt('change(s) not yet reflected in the injects.', 'modification(s) pas encore répercutée(s) dans les injects.', 'Änderung(en) noch nicht in den Injects übernommen.'))}` : `${sbUiIcon('checkCircle', 14)} ${escapeHtml(tt('Injects are up to date with the cells and actors.', 'Les injects sont à jour avec les cellules et les acteurs.', 'Die Injects sind mit den Zellen und Akteuren auf dem neuesten Stand.'))}`} <span class="subtle">${escapeHtml(tt('Renamed a cell, changed its mission or edited an actor? Update adapts the injects concerned.', 'Cellule renommée, mission modifiée ou acteur édité ? Mettre à jour adapte les injects concernés.', 'Zelle umbenannt, Auftrag geändert oder Akteur bearbeitet? Aktualisieren passt die betroffenen Injects an.'))}</span></span>
        ${renderUpdateButton(project, pending)}
      </div>
      <article class="card">
        <div class="section-header">
          <div><h3>${escapeHtml(tt('Player cells', 'Cellules de joueurs', 'Spielerzellen'))}</h3><p class="subtle">${escapeHtml(tt('Groups of participants who receive injects.', 'Groupes de participants qui reçoivent les injects.', 'Teilnehmergruppen, die Injects erhalten.'))} ${project.exercise.players_count
            ? escapeHtml(tt(`${players} player(s) listed of ${project.exercise.players_count} expected.`, `${players} joueur(s) inscrit(s) sur ${project.exercise.players_count} attendu(s).`, `${players} Spieler erfasst von ${project.exercise.players_count} erwarteten.`))
            : escapeHtml(tt(`${players} player(s) listed.`, `${players} joueur(s) inscrit(s).`, `${players} Spieler erfasst.`))}</p></div>
          <div class="actions">
            ${missingPresets.map((preset) => `<button class="btn btn-ghost btn-xs" data-tab-action="add-cell" data-tab-value="${preset.key}" title="${escapeAttribute(cePresetText(preset).description)}">+ ${escapeHtml(cePresetText(preset).name)}</button>`).join('')}
            <button class="btn btn-primary btn-sm" data-tab-action="add-cell" data-tab-value="custom">${sbUiIcon('plus', 13)} ${escapeHtml(tt('New cell', 'Nouvelle cellule', 'Neue Zelle'))}</button>
          </div>
        </div>
        <div class="ce-grid">
          ${project.cells.map((cell) => renderCeCell(project, cell, items)).join('') || `<p class="sb-empty">${escapeHtml(tt('No cell yet. Add the cells playing the exercise (for example decision, operational and communication cells).', 'Aucune cellule pour l’instant. Ajoutez les cellules qui jouent l’exercice (par exemple cellules décisionnelle, opérationnelle et communication).', 'Noch keine Zelle. Fügen Sie die Zellen hinzu, die die Übung spielen (zum Beispiel Entscheidungs-, operative und Kommunikationszelle).'))}</p>`}
        </div>
      </article>
      ${renderCePlayers(project)}
      ${renderCeActors(project, storyboard, actorsPlaceholder)}
      ${renderSbModal(storyboard)}
    </section>`;
  });
}

/* A cell: its mission and its players, picked from the Players list (never typed here). */
function renderCeCell(project, cell, items) {
  const count = items.filter((item) => sbReaches(item.cell_id, cell.id)).length;
  const pool = cePlayerPool(project);
  const others = project.cells.filter((other) => other.id !== cell.id && other.players.length);
  const label = (player) => [player.name, player.role].filter(Boolean).join(' · ') || tt('Unnamed player', 'Joueur sans nom', 'Spieler ohne Namen');
  const picker = pool.length || others.length
    ? `<select class="ce-add-player" data-ce-cell-add="${cell.id}" aria-label="${escapeAttribute(tt('Add a player to this cell', 'Ajouter un joueur à cette cellule', 'Einen Spieler zu dieser Zelle hinzufügen'))}">
        <option value="">${escapeHtml(tt('+ Add a player from the list…', '+ Ajouter un joueur de la liste…', '+ Spieler aus der Liste hinzufügen…'))}</option>
        ${pool.length ? `<optgroup label="${escapeAttribute(tt('Not in a cell', 'Sans cellule', 'Ohne Zelle'))}">${pool.map((player) => `<option value="${player.id}">${escapeHtml(label(player))}</option>`).join('')}</optgroup>` : ''}
        ${others.map((other) => `<optgroup label="${escapeAttribute(tt(`Move from ${other.name}`, `Déplacer depuis ${other.name}`, `Verschieben aus ${other.name}`))}">${other.players.map((player) => `<option value="${player.id}">${escapeHtml(label(player))}</option>`).join('')}</optgroup>`).join('')}
      </select>`
    : `<p class="sb-help">${escapeHtml(tt('Add the players in the Players list below, then pick them here.', 'Ajoutez les joueurs dans la liste Joueurs ci-dessous, puis choisissez-les ici.', 'Fügen Sie die Spieler in der Spielerliste unten hinzu und wählen Sie sie dann hier aus.'))}</p>`;
  return `<div class="ce-cell" style="--cell-color:${cell.color}">
    <div class="ce-cell-head">
      <input type="color" data-ce-cell="${cell.id}.color" value="${cell.color}" aria-label="${escapeAttribute(tt('Cell colour', 'Couleur de la cellule', 'Zellenfarbe'))}">
      <input type="text" class="ce-cell-name" data-ce-cell="${cell.id}.name" value="${escapeAttribute(cell.name)}" aria-label="${escapeAttribute(tt('Cell name', 'Nom de la cellule', 'Zellenname'))}">
      <span class="sb-chip">${count} ${escapeHtml(tt('inject(s)', 'inject(s)', 'Inject(s)'))}</span>
      <button class="sb-icon-btn is-danger" data-tab-action="delete-cell" data-tab-value="${cell.id}" title="${escapeAttribute(tt('Delete cell', 'Supprimer la cellule', 'Zelle löschen'))}">${sbUiIcon('trash', 14)}</button>
    </div>
    <textarea data-ce-cell="${cell.id}.description" rows="2" placeholder="${escapeAttribute(tt('Mission of this cell', 'Mission de cette cellule', 'Auftrag dieser Zelle'))}" aria-label="${escapeAttribute(tt('Mission of this cell', 'Mission de cette cellule', 'Auftrag dieser Zelle'))}">${escapeHtml(cell.description)}</textarea>
    <ul class="ce-members">${cell.players.map((player) => `<li><span>${escapeHtml(label(player))}</span><button class="sb-icon-btn" data-tab-action="unassign-player" data-tab-value="${player.id}" title="${escapeAttribute(tt('Remove from this cell (the player stays in the list)', 'Retirer de cette cellule (le joueur reste dans la liste)', 'Aus dieser Zelle entfernen (der Spieler bleibt in der Liste)'))}">${sbUiIcon('close', 12)}</button></li>`).join('') || `<li class="is-empty">${escapeHtml(tt('No player yet.', 'Aucun joueur pour l’instant.', 'Noch kein Spieler.'))}</li>`}</ul>
    ${picker}
  </div>`;
}

/* The real participants, one table grouped by cell, like the simulated actors below. */
function renderCePlayers(project) {
  const all = ceAllPlayers(project);
  const expected = Number(project.exercise.players_count) || 0;
  const renamed = new Set(ceRenameImpacts(project).map((impact) => impact.player_id));
  const groups = [...project.cells.map((cell) => ({ key: cell.id, name: cell.name, color: cell.color, players: cell.players })), { key: '', name: tt('Not in a cell', 'Sans cellule', 'Ohne Zelle'), color: '#b9b3c9', players: cePlayerPool(project) }];
  const row = (player, cellId) => `<tr>
      <td><input type="text" data-ce-person="${player.id}.name" value="${escapeAttribute(player.name)}" placeholder="${escapeAttribute(tt('Name', 'Nom', 'Name'))}" aria-label="${escapeAttribute(tt('Name', 'Nom', 'Name'))}">${renamed.has(player.id) ? `<span class="ce-flag" title="${escapeAttribute(tt('The injects still show the previous name: Update writes the new one.', 'Les injects montrent encore l’ancien nom : Mettre à jour écrit le nouveau.', 'Die Injects zeigen noch den alten Namen: Aktualisieren schreibt den neuen.'))}">${sbUiIcon('sync', 11)} ${escapeHtml(tt('to update', 'à mettre à jour', 'zu aktualisieren'))}</span>` : ''}</td>
      <td><input type="text" data-ce-person="${player.id}.role" value="${escapeAttribute(player.role)}" placeholder="${escapeAttribute(tt('Role / title', 'Rôle / fonction', 'Rolle / Funktion'))}" aria-label="${escapeAttribute(tt('Role', 'Rôle', 'Rolle'))}"></td>
      <td><input type="email" data-ce-person="${player.id}.email" value="${escapeAttribute(player.email)}" placeholder="${escapeAttribute(tt('Email', 'E-mail', 'E-Mail'))}" aria-label="${escapeAttribute(tt('Email', 'E-mail', 'E-Mail'))}"></td>
      <td><select data-ce-assign="${player.id}" aria-label="${escapeAttribute(tt('Cell', 'Cellule', 'Zelle'))}">${sbOption('', tt('- No cell -', '- Aucune cellule -', '- Keine Zelle -'), cellId)}${project.cells.map((cell) => sbOption(cell.id, cell.name, cellId)).join('')}</select></td>
      <td><button class="sb-icon-btn is-danger" data-tab-action="delete-player" data-tab-value="${player.id}" title="${escapeAttribute(tt('Delete the player', 'Supprimer le joueur', 'Spieler löschen'))}">${sbUiIcon('trash', 13)}</button></td>
    </tr>`;
  return `<article class="card">
    <div class="section-header">
      <div><h3>${escapeHtml(tt('Players', 'Joueurs', 'Spieler'))}</h3><p class="subtle">${escapeHtml(tt('The real people who play the exercise, placed in the cells. The AI may invent them when the exercise is built; write the real names when you know them: Update then replaces the old names and roles in the injects.', 'Les personnes réelles qui jouent l’exercice, placées dans les cellules. L’IA peut les inventer à la construction de l’exercice ; saisissez les vrais noms quand vous les connaissez : Mettre à jour remplace alors les anciens noms et rôles dans les injects.', 'Die realen Personen, die die Übung spielen, verteilt auf die Zellen. Die KI kann sie beim Aufbau der Übung erfinden; tragen Sie die echten Namen ein, sobald Sie sie kennen: Aktualisieren ersetzt dann die alten Namen und Rollen in den Injects.'))} <b>${escapeHtml(expected ? tt(`${all.length} player(s) of ${expected} expected.`, `${all.length} joueur(s) sur ${expected} attendu(s).`, `${all.length} Spieler von ${expected} erwarteten.`) : tt(`${all.length} player(s).`, `${all.length} joueur(s).`, `${all.length} Spieler.`))}</b></p></div>
      <div class="actions"><button class="btn btn-primary btn-sm" data-tab-action="add-player" data-tab-value="">${sbUiIcon('plus', 13)} ${escapeHtml(tt('Player', 'Joueur', 'Spieler'))}</button></div>
    </div>
    <div class="ce-table-wrap"><table class="ce-table ce-people">
      <thead><tr><th>${escapeHtml(tt('Name', 'Nom', 'Name'))}</th><th>${escapeHtml(tt('Role / title', 'Rôle / fonction', 'Rolle / Funktion'))}</th><th>${escapeHtml(tt('Email', 'E-mail', 'E-Mail'))}</th><th>${escapeHtml(tt('Cell', 'Cellule', 'Zelle'))}</th><th></th></tr></thead>
      ${groups.filter((group) => group.players.length || group.key).map((group) => `<tbody>
        <tr class="ce-group-row" style="--cell-color:${group.color}"><th colspan="5"><i class="cell-dot"></i>${escapeHtml(group.name)} <span class="sb-chip">${group.players.length}</span>${group.key ? `<button class="btn btn-ghost btn-xs" data-tab-action="add-player" data-tab-value="${group.key}">${sbUiIcon('plus', 12)} ${escapeHtml(tt('Player', 'Joueur', 'Spieler'))}</button>` : ''}</th></tr>
        ${group.players.map((player) => row(player, group.key)).join('')}
      </tbody>`).join('')}
    </table></div>
  </article>`;
}

/* The simulated actors, one table grouped by category, with the storyline roles each plays. */
function renderCeActors(project, storyboard, placeholder) {
  const categories = ceActorCategories(project);
  const groups = [
    ...CE_ACTOR_GROUPS.map(([role, en, fr, de]) => ({ key: `role:${role}`, label: tt(en, fr, de), role, custom: null })),
    ...categories.map((category) => ({ key: `cat:${category.id}`, label: category.label, role: category.role, custom: category }))
  ];
  const byGroup = new Map(groups.map((group) => [group.key, []]));
  project.actors.forEach((actor) => byGroup.get(ceActorGroup(actor, categories))?.push(actor));
  const usage = new Map();
  storyboard.blocks.forEach((block) => block.beats.forEach((beat) => usage.set(beat.cast_id, (usage.get(beat.cast_id) || 0) + 1)));
  const planned = (cast) => tt(`${usage.get(cast.id) || 0} planned inject(s)`, `${usage.get(cast.id) || 0} inject(s) prévu(s)`, `${usage.get(cast.id) || 0} geplante(r) Inject(s)`);
  const unlinked = storyboard.cast.filter((cast) => !cast.actor_id || !getActor(cast.actor_id));
  const groupOptions = (value) => groups.map((group) => sbOption(group.key, group.label, value)).join('');
  const readOnly = sbReadOnly() ? 'disabled' : '';
  const row = (actor) => {
    const roles = storyboard.cast.filter((cast) => cast.actor_id === actor.id);
    return `<tr>
      <td><input type="text" data-actor-bind="${escapeAttribute(actor.id)}.name" value="${escapeAttribute(actor.name)}" placeholder="${escapeAttribute(tt('Name', 'Nom', 'Name'))}" aria-label="${escapeAttribute(tt('Name', 'Nom', 'Name'))}"></td>
      <td><input type="text" data-actor-bind="${escapeAttribute(actor.id)}.title" value="${escapeAttribute(actor.title)}" placeholder="${escapeAttribute(tt('Title', 'Fonction', 'Funktion'))}" aria-label="${escapeAttribute(tt('Title', 'Fonction', 'Funktion'))}"></td>
      <td><input type="text" data-actor-bind="${escapeAttribute(actor.id)}.organization" value="${escapeAttribute(actor.organization)}" placeholder="${escapeAttribute(tt('Organisation', 'Organisation', 'Organisation'))}" aria-label="${escapeAttribute(tt('Organisation', 'Organisation', 'Organisation'))}"></td>
      <td class="ce-roles-cell">${roles.map((cast) => `<span class="ce-role-chip" title="${escapeAttribute(`${roleLabel(cast.role)} · ${planned(cast)}`)}">${escapeHtml(cast.label)}<button type="button" data-tab-action="unlink-cast" data-tab-value="${cast.id}" aria-label="${escapeAttribute(tt('Unlink this role', 'Délier ce rôle', 'Diese Rolle lösen'))}" ${readOnly}>${sbUiIcon('close', 10)}</button></span>`).join('') || `<span class="subtle">-</span>`}</td>
      <td><input type="text" data-actor-bind="${escapeAttribute(actor.id)}.played_by" value="${escapeAttribute(actor.played_by || '')}" placeholder="${escapeAttribute(tt('Exercise team member', 'Membre de l’équipe d’animation', 'Mitglied des Übungsteams'))}" aria-label="${escapeAttribute(tt('Played by', 'Joué par', 'Gespielt von'))}"></td>
      <td><select data-actor-bind="${escapeAttribute(actor.id)}.language" aria-label="${escapeAttribute(tt('Language', 'Langue', 'Sprache'))}">${LANGUAGES.map((item) => sbOption(item.value, item.label, actor.language || 'en')).join('')}</select></td>
      <td><select data-ce-actor-group="${escapeAttribute(actor.id)}" aria-label="${escapeAttribute(tt('Category', 'Catégorie', 'Kategorie'))}">${groupOptions(ceActorGroup(actor, categories))}</select></td>
      <td><button class="sb-icon-btn is-danger" data-action="delete-actor" data-actor-id="${escapeAttribute(actor.id)}" title="${escapeAttribute(tt('Delete', 'Supprimer', 'Löschen'))}">${sbUiIcon('trash', 13)}</button></td>
    </tr>`;
  };
  const head = (group) => group.custom
    ? `<input type="text" class="ce-category-name" data-ce-category="${group.custom.id}.label" value="${escapeAttribute(group.custom.label)}" aria-label="${escapeAttribute(tt('Category name', 'Nom de la catégorie', 'Name der Kategorie'))}">
       <select data-ce-category="${group.custom.id}.role" title="${escapeAttribute(tt('Type of sender: it sets the usual channels and tone', 'Type d’émetteur : il fixe les canaux et le ton habituels', 'Art des Absenders: bestimmt die üblichen Kanäle und den Ton'))}" aria-label="${escapeAttribute(tt('Type', 'Type', 'Typ'))}">${ROLES.map((item) => sbOption(item.value, roleLabel(item.value), group.role)).join('')}</select>
       <button class="sb-icon-btn is-danger" data-tab-action="delete-category" data-tab-value="${group.custom.id}" title="${escapeAttribute(tt('Delete the category (its actors go back to their type)', 'Supprimer la catégorie (ses acteurs reviennent à leur type)', 'Kategorie löschen (ihre Akteure kehren zu ihrem Typ zurück)'))}">${sbUiIcon('trash', 12)}</button>`
    : `<strong>${escapeHtml(group.label)}</strong>`;
  return `<article class="card">
    <div class="section-header">
      <div><h3>${escapeHtml(tt('Simulated actors', 'Acteurs simulés', 'Simulierte Akteure'))}</h3><p class="subtle">${escapeHtml(tt('The characters outside the player cells who send the injects (attackers, press, authorities, customers, partners…), each played by a member of the exercise team. The storyline roles show which senders of the story each actor plays.', 'Les personnages hors des cellules de joueurs qui envoient les injects (attaquants, presse, autorités, clients, partenaires…), chacun joué par un membre de l’équipe d’animation. Les rôles de la storyline indiquent quels émetteurs de l’histoire chaque acteur joue.', 'Die Figuren außerhalb der Spielerzellen, die die Injects senden (Angreifer, Presse, Behörden, Kunden, Partner…), jeweils gespielt von einem Mitglied des Übungsteams. Die Storyline-Rollen zeigen, welche Absender der Geschichte jeder Akteur spielt.'))}</p></div>
      <div class="actions">
        <button class="btn btn-secondary btn-xs" data-sb-action="plan-cast" ${readOnly} ${isLLMAvailable() && storyboard.blocks.length ? '' : 'disabled'}>${sbUiIcon('wand', 12)} ${escapeHtml(tt('Suggest roles', 'Suggérer des rôles', 'Rollen vorschlagen'))}</button>
        <button class="btn btn-secondary btn-xs" data-tab-action="add-category">${sbUiIcon('plus', 12)} ${escapeHtml(tt('Category', 'Catégorie', 'Kategorie'))}</button>
        <select class="ce-add-actor" data-ce-add-actor aria-label="${escapeAttribute(tt('Add an actor', 'Ajouter un acteur', 'Akteur hinzufügen'))}"><option value="">${escapeHtml(tt('+ Actor in…', '+ Acteur dans…', '+ Akteur in…'))}</option>${groupOptions('')}</select>
      </div>
    </div>
    ${renderLLMConfigBlock('actors', placeholder)}
    ${unlinked.length ? `<div class="ce-unlinked">
      <strong>${sbUiIcon('alert', 13)} ${escapeHtml(tt('Storyline roles without an actor', 'Rôles de la storyline sans acteur', 'Storyline-Rollen ohne Akteur'))}</strong>
      <p class="sb-help">${escapeHtml(tt('Senders the story needs: pick the actor who plays each one, or create it.', 'Émetteurs dont l’histoire a besoin : choisissez l’acteur qui joue chacun, ou créez-le.', 'Absender, die die Geschichte braucht: Wählen Sie den Akteur, der jeden spielt, oder legen Sie ihn an.'))}</p>
      <div class="ce-table-wrap"><table class="ce-table"><tbody>${unlinked.map((cast) => `<tr>
        <td><input type="text" data-sb-cast="${cast.id}.label" value="${escapeAttribute(cast.label)}" aria-label="${escapeAttribute(tt('Role label', 'Libellé du rôle', 'Rollenbezeichnung'))}" ${readOnly}></td>
        <td><select data-sb-cast="${cast.id}.role" aria-label="${escapeAttribute(tt('Role type', 'Type de rôle', 'Rollentyp'))}" ${readOnly}>${ROLES.map((role) => sbOption(role.value, roleLabel(role.value), cast.role)).join('')}</select></td>
        <td><select data-sb-cast="${cast.id}.actor_id" aria-label="${escapeAttribute(tt('Actor', 'Acteur', 'Akteur'))}" ${readOnly}>${sbOption('', tt('- Pick an actor -', '- Choisir un acteur -', '- Akteur wählen -'), '')}${project.actors.map((item) => sbOption(item.id, `${item.name} · ${item.title || roleLabel(item.role)}`, '')).join('')}</select></td>
        <td class="subtle">${escapeHtml(planned(cast))}</td>
        <td class="ce-row-actions"><button class="btn btn-secondary btn-xs" data-tab-action="create-cast-actor" data-tab-value="${cast.id}" ${readOnly}>${sbUiIcon('plus', 12)} ${escapeHtml(tt('Create the actor', 'Créer l’acteur', 'Akteur anlegen'))}</button><button class="sb-icon-btn" data-sb-action="delete-cast" data-sb-cast-id="${cast.id}" title="${escapeAttribute(tt('Remove role', 'Retirer le rôle', 'Rolle entfernen'))}" ${readOnly}>${sbUiIcon('trash', 13)}</button></td>
      </tr>`).join('')}</tbody></table></div>
    </div>` : ''}
    <div class="ce-table-wrap"><table class="ce-table ce-people">
      <thead><tr><th>${escapeHtml(tt('Name', 'Nom', 'Name'))}</th><th>${escapeHtml(tt('Title', 'Fonction', 'Funktion'))}</th><th>${escapeHtml(tt('Organisation', 'Organisation', 'Organisation'))}</th><th>${escapeHtml(tt('Storyline roles', 'Rôles de la storyline', 'Storyline-Rollen'))}</th><th>${escapeHtml(tt('Played by', 'Joué par', 'Gespielt von'))}</th><th>${escapeHtml(tt('Language', 'Langue', 'Sprache'))}</th><th>${escapeHtml(tt('Category', 'Catégorie', 'Kategorie'))}</th><th></th></tr></thead>
      ${groups.filter((group) => byGroup.get(group.key).length || group.custom).map((group) => `<tbody>
        <tr class="ce-group-row"><th colspan="8"><span class="ce-group-title">${head(group)} <span class="sb-chip">${byGroup.get(group.key).length}</span><button class="btn btn-ghost btn-xs" data-tab-action="add-actor" data-tab-value="${group.key}">${sbUiIcon('plus', 12)} ${escapeHtml(tt('Actor', 'Acteur', 'Akteur'))}</button></span></th></tr>
        ${byGroup.get(group.key).map(row).join('')}
      </tbody>`).join('') || `<tbody><tr><td colspan="8" class="sb-empty">${escapeHtml(tt('No actor yet: add one, generate them with AI above, or build the exercise in Context.', 'Aucun acteur pour l’instant : ajoutez-en un, générez-les avec l’IA ci-dessus, ou construisez l’exercice dans Contexte.', 'Noch kein Akteur: Fügen Sie einen hinzu, erzeugen Sie sie oben mit KI oder bauen Sie die Übung im Kontext auf.'))}</td></tr></tbody>`}
    </table></div>
    ${storyboard.cast.length ? `<p class="sb-help ce-cast-foot">${escapeHtml(tt(`${storyboard.cast.length} storyline role(s), ${storyboard.cast.length - unlinked.length} played by an actor.`, `${storyboard.cast.length} rôle(s) de la storyline, ${storyboard.cast.length - unlinked.length} joué(s) par un acteur.`, `${storyboard.cast.length} Storyline-Rolle(n), ${storyboard.cast.length - unlinked.length} von einem Akteur gespielt.`))} <button class="btn btn-ghost btn-xs" data-sb-action="add-cast" ${readOnly}>${sbUiIcon('plus', 12)} ${escapeHtml(tt('Role', 'Rôle', 'Rolle'))}</button></p>` : ''}
  </article>`;
}

// ═══ Detailed storyline ═════════════════════════════════════════════════════
function dsItems(project) {
  return sbExerciseItems(project);
}

function dsSelectedItem(project, items = dsItems(project)) {
  const state = tabUI('detailed');
  return items.find((item) => item.key === state.selected) || null;
}

function renderDetailedView() {
  return sbWithRenderMemo(() => {
    const project = tabProject();
    const storyboard = project.storyboard;
    const state = tabUI('detailed');
    sbCaptureFocus();
    if (state.cell !== 'all' && state.cell !== 'none' && !sbCell(project, state.cell)) state.cell = 'all';
    if (state.zoom === null) { state.zoom = 3; state.needsFit = true; }
    const items = dsItems(project);
    const selected = dsSelectedItem(project, items);
    const readOnly = sbReadOnly();
    const ai = isLLMAvailable();
    const pending = sbPendingSyncCount(project);
    const counts = new Map();
    // An inject for all cells counts in every cell.
    items.forEach((item) => {
      const keys = sbIsAllCells(item.cell_id) ? project.cells.map((cell) => cell.id) : [sbHasRecipient(project, item.cell_id) ? item.cell_id : 'none'];
      keys.forEach((key) => counts.set(key, (counts.get(key) || 0) + 1));
    });
    const cellScope = state.cell !== 'all' && state.cell !== 'none' ? sbCell(project, state.cell) : null;
    const missing = items.filter((item) => item.kind === 'beat' && !item.stimulus && (!cellScope || sbReaches(item.cell_id, cellScope.id))).length;
    return `<section class="sb-workspace ds-workspace ${readOnly ? 'is-readonly' : ''} ${sbCompact() ? 'is-compact' : ''}" data-sb-scope aria-label="${escapeAttribute(workflowTabLabel('detailed'))}">
      <header class="sb-toolbar ds-toolbar">
        <div class="sb-tb-title"><span class="sb-eyebrow">${escapeHtml(workflowTabLabel('detailed'))}</span><div class="sb-tb-name-row"><strong class="sb-tb-name">${escapeHtml(project.name || tt('Untitled scenario', 'Scénario sans titre', 'Unbenanntes Szenario'))}</strong></div></div>
        <div class="ds-cells" role="tablist" aria-label="${escapeAttribute(tt('Cells', 'Cellules', 'Zellen'))}">
          <button class="ds-cell-chip ${state.cell === 'all' ? 'active' : ''}" data-tab-action="ds-cell" data-tab-value="all">${escapeHtml(tt('All cells', 'Toutes les cellules', 'Alle Zellen'))} <b>${items.length}</b></button>
          ${project.cells.map((cell) => `<button class="ds-cell-chip ${state.cell === cell.id ? 'active' : ''}" style="--cell-color:${cell.color}" data-tab-action="ds-cell" data-tab-value="${cell.id}"><i></i>${escapeHtml(cell.name)} <b>${counts.get(cell.id) || 0}</b></button>`).join('')}
          ${counts.get('none') ? `<button class="ds-cell-chip ${state.cell === 'none' ? 'active' : ''}" data-tab-action="ds-cell" data-tab-value="none">${escapeHtml(tt('Unassigned', 'Non attribués', 'Nicht zugewiesen'))} <b>${counts.get('none')}</b></button>` : ''}
        </div>
        <div class="sb-tb-group">
          <button class="sb-tool" data-sb-action="undo" ${StoryboardHistory.canUndo() ? '' : 'disabled'} title="${escapeAttribute(tt('Undo (Ctrl+Z)', 'Annuler (Ctrl+Z)', 'Rückgängig (Strg+Z)'))}">${sbUiIcon('undo')}</button>
          <button class="sb-tool" data-sb-action="redo" ${StoryboardHistory.canRedo() ? '' : 'disabled'} title="${escapeAttribute(tt('Redo (Ctrl+Shift+Z)', 'Rétablir (Ctrl+Maj+Z)', 'Wiederholen (Strg+Umschalt+Z)'))}">${sbUiIcon('redo')}</button>
        </div>
        <div class="sb-tb-group">
          <button class="sb-tool sb-tool-label" data-tab-action="ds-add" ${readOnly || !storyboard.blocks.length ? 'disabled' : ''} title="${escapeAttribute(tt('Add an inject at the playhead', 'Ajouter un inject à la tête de lecture', 'Inject am Abspielkopf hinzufügen'))}">${sbUiIcon('plus')}<span>${escapeHtml(tt('Inject', 'Inject', 'Inject'))}</span></button>
        </div>
        <div class="sb-tb-group sb-tb-output">
          ${renderUpdateButton(project, pending)}
          <button class="btn btn-primary btn-sm" data-tab-action="ds-generate" ${readOnly ? 'disabled' : ''}>${sbUiIcon('play', 13)} ${escapeHtml(tt('Generate', 'Générer', 'Generieren'))}${missing ? ` <span class="sb-count sb-count-light">${missing}</span>` : ''}</button>
        </div>
      </header>
      ${renderSbStatusBar()}
      ${renderFramingBar(project, 'detailed')}
      <div class="ds-timeline">${storyboard.blocks.length || items.length ? renderDetailedTimeline(project, items) : tabEmptyNote(tt('Build the main storyline first: its phases frame the injects of every cell.', 'Construisez d’abord la storyline principale : ses phases structurent les injects de chaque cellule.', 'Erstellen Sie zuerst die Haupt-Storyline: Ihre Phasen bilden den Rahmen für die Injects jeder Zelle.'), 'storyline', workflowTabLabel('storyline'))}</div>
      ${renderEditorSplitter('detailed')}
      <section class="bottom-editor ds-editor" aria-label="${escapeAttribute(tt('Inject editor', 'Éditeur d’inject', 'Inject-Editor'))}" ${editorHeightStyle('detailed')}>${selected ? renderInjectEditor(project, selected) : `<div class="bottom-editor-empty">${sbUiIcon('play', 18)}<span>${escapeHtml(tt('Select an inject to edit it. Drag it to change its time, or to another cell row to change its recipient.', 'Sélectionnez un inject pour le modifier. Faites-le glisser pour changer son heure, ou vers la ligne d’une autre cellule pour changer son destinataire.', 'Wählen Sie einen Inject, um ihn zu bearbeiten. Ziehen Sie ihn, um seine Zeit zu ändern, oder in die Zeile einer anderen Zelle, um den Empfänger zu ändern.'))} ${cellScope ? escapeHtml(tt(`“+ Inject” adds one for the ${cellScope.name} at the playhead.`, `« + Inject » en ajoute un pour la cellule ${cellScope.name} à la tête de lecture.`, `„+ Inject“ fügt am Abspielkopf einen für ${cellScope.name} hinzu.`)) : escapeHtml(tt('Pick a cell above to focus on its injects.', 'Choisissez une cellule ci-dessus pour vous concentrer sur ses injects.', 'Wählen Sie oben eine Zelle, um sich auf ihre Injects zu konzentrieren.'))}</span></div>`}</section>
      ${renderSbModal(storyboard)}
    </section>`;
  });
}

function dsRows(project, items) {
  const state = tabUI('detailed');
  if (state.cell === 'none') return [{ id: 'none', name: tt('Unassigned', 'Non attribués', 'Nicht zugewiesen'), color: '#6d687e' }];
  if (state.cell !== 'all') return project.cells.filter((cell) => cell.id === state.cell);
  const rows = [...project.cells];
  if (items.some((item) => !sbHasRecipient(project, item.cell_id))) rows.push({ id: 'none', name: tt('Unassigned', 'Non attribués', 'Nicht zugewiesen'), color: '#6d687e' });
  return rows;
}

function renderDetailedTimeline(project, items) {
  const storyboard = project.storyboard;
  const state = tabUI('detailed');
  const ppm = state.zoom;
  const header = sbHeaderWidth();
  const duration = Math.max(storyboard.duration_minutes, ...items.map((item) => item.time + 10));
  const width = Math.ceil((duration + 60) * ppm);
  const rows = dsRows(project, items);
  const phases = sbMainBlocks(storyboard);
  return `<div class="ds-scroll" id="ds-scroll">
    <div class="sb-canvas ds-canvas" style="width:${header + width}px;--ppm:${ppm};--hour:${(60 * ppm).toFixed(2)}px;--quarter:${(15 * ppm).toFixed(2)}px;--header:${header}px">
      <div class="sb-ruler-row">
        <div class="sb-corner"><span>${escapeHtml(tt('Cells', 'Cellules', 'Zellen'))}</span><small>${rows.length}</small></div>
        <div class="sb-ruler" data-ds-ruler style="width:${width}px">${renderSbRuler({ duration_minutes: duration }, ppm)}</div>
      </div>
      <div class="sb-track-row ds-phase-row is-main">
        <div class="sb-track-head"><strong>${escapeHtml(workflowTabLabel('storyline'))}</strong><small>${phases.length} ${escapeHtml(tt('phases', 'phases', 'Phasen'))}</small></div>
        <div class="sb-lane ds-phase-lane" style="width:${width}px">
          ${phases.map((block) => `<button class="ds-phase" data-tab-action="ds-phase" data-tab-value="${block.id}" style="left:${block.start_minutes * ppm}px;width:${Math.max(4, block.duration_minutes * ppm - 2)}px;--clip-color:${sbBlockColor(block, storyboard)}" title="${escapeAttribute(`${sbFormatOffset(block.start_minutes)} · ${block.title}: ${block.brief}`)}"><strong>${escapeHtml(block.title)}</strong><span>${escapeHtml(block.brief)}</span></button>`).join('')}
        </div>
      </div>
      ${rows.map((row) => renderDetailedRow(project, row, items.filter((item) => (row.id === 'none' ? !sbHasRecipient(project, item.cell_id) : sbReaches(item.cell_id, row.id))), width, ppm)).join('')}
      <div class="sb-end-zone" style="left:${header + storyboard.duration_minutes * ppm}px"></div>
      <div class="sb-playhead" id="ds-playhead" style="left:${header + state.playhead * ppm}px"><span class="sb-playhead-handle" data-ds-playhead>${sbFormatOffset(state.playhead)}</span></div>
    </div>
  </div>`;
}

function renderDetailedRow(project, row, items, width, ppm) {
  const state = tabUI('detailed');
  const span = (DS_CARD_WIDTH + 6) / ppm;
  const packing = sbPackTrack(items.map((item) => ({ id: item.key, start_minutes: item.time, duration_minutes: span })));
  const height = Math.max(1, packing.rows) * DS_ROW_HEIGHT + 12;
  const players = row.players ? row.players.length : 0;
  return `<div class="sb-track-row ds-row" style="--track-color:${row.color}">
    <div class="sb-track-head" style="height:${height}px"><strong>${escapeHtml(row.name)}</strong><small>${items.length} ${escapeHtml(tt('inject(s)', 'inject(s)', 'Inject(s)'))}${row.players ? ` · ${players} ${escapeHtml(tt('player(s)', 'joueur(s)', 'Spieler'))}` : ''}</small></div>
    <div class="sb-lane" data-ds-lane="${escapeAttribute(row.id)}" style="width:${width}px;height:${height}px">
      ${items.map((item) => {
        const color = sbChannelColor(item.channel);
        return `<div class="ds-card is-${item.status} ${state.selected === item.key ? 'is-selected' : ''}" data-ds-item="${escapeAttribute(item.key)}" tabindex="0" role="button" style="left:${(item.time * ppm).toFixed(1)}px;top:${packing.placement.get(item.key) * DS_ROW_HEIGHT + 6}px;width:${DS_CARD_WIDTH}px;--beat-color:${color}" title="${escapeAttribute(`${sbFormatOffset(item.time)} · ${channelLabel(item.channel)} · ${item.sender || tt('no sender', 'sans émetteur', 'ohne Absender')}${item.beat?.kind === 'nudge' ? ` · ${sbNudgeLabel()}` : ''}\n${item.title}\n${item.intent || ''}`)}">
          <span class="ds-card-meta"><i></i>${item.beat?.kind === 'nudge' ? `<span class="sb-nudge-tag">${escapeHtml(sbNudgeLabel())}</span>` : ''}${sbFormatOffset(item.time)} · ${escapeHtml(channelLabel(item.channel))}${sbIsAllCells(item.cell_id) ? ` · ${escapeHtml(tt('all cells', 'toutes les cellules', 'alle Zellen'))}` : ''}</span>
          <strong>${escapeHtml(item.title)}</strong>
        </div>`;
      }).join('')}
      ${!items.length ? `<span class="sb-lane-hint">${escapeHtml(tt('No inject for this cell yet', 'Aucun inject pour cette cellule pour l’instant', 'Noch kein Inject für diese Zelle'))}</span>` : ''}
    </div>
  </div>`;
}

function renderInjectEditor(project, item) {
  const storyboard = project.storyboard;
  const readOnly = sbReadOnly() ? 'disabled' : '';
  const ai = isLLMAvailable();
  const status = item.stimulus ? sbStimulusStatus(project, item.stimulus) : null;
  const phase = sbMainBlockAt(storyboard, item.time);
  const recipients = `<div class="sb-mini-field ds-to">${escapeHtml(tt('To', 'À', 'An'))}${renderRecipientPicker(project, item.key, item.cell_id, readOnly)}</div>`;
  const head = `<div class="bottom-editor-head" style="--clip-color:${sbChannelColor(item.channel)}">
      <span class="sb-status is-${item.status}">${escapeHtml(status?.label || (item.kind === 'beat' ? tt('Planned', 'Prévu', 'Geplant') : tt('Manual', 'Manuel', 'Manuell')))}</span>
      <label class="be-inline">${escapeHtml(tt('Time (min)', 'Heure (min)', 'Zeit (Min.)'))} · ${sbFormatOffset(item.time)}<input type="number" min="0" step="1" data-ds-time value="${item.time}" ${readOnly}></label>
      <span class="be-phase">${escapeHtml(tt('Phase:', 'Phase :', 'Phase:'))} <b>${escapeHtml(phase?.title || '-')}</b></span>
      <span class="be-actions">
        ${item.stimulus ? `<button class="btn btn-secondary btn-sm" data-sb-action="open-stimulus" data-sb-stimulus="${escapeAttribute(item.stimulus.id)}">${sbUiIcon('open', 13)} ${escapeHtml(tt('Full editor', 'Éditeur complet', 'Vollständiger Editor'))}</button>` : ''}
        ${item.stimulus?.scenario_link ? `<button class="sb-icon-btn ${item.stimulus.scenario_link.locked ? 'is-on' : ''}" data-sb-action="lock-stimulus" data-sb-stimulus="${escapeAttribute(item.stimulus.id)}" title="${escapeAttribute(item.stimulus.scenario_link.locked ? tt('Unlock', 'Déverrouiller', 'Entsperren') : tt('Lock: never modified by sync', 'Verrouiller : jamais modifié par la synchronisation', 'Sperren: wird bei der Synchronisierung nie geändert'))}" ${readOnly}>${sbUiIcon(item.stimulus.scenario_link.locked ? 'lock' : 'unlock', 15)}</button>` : ''}
        <button class="sb-icon-btn is-danger" data-tab-action="ds-delete" title="${escapeAttribute(tt('Delete (Del)', 'Supprimer (Suppr)', 'Löschen (Entf)'))}" ${readOnly}>${sbUiIcon('trash', 15)}</button>
        <button class="sb-icon-btn" data-tab-action="ds-deselect" title="${escapeAttribute(tt('Close (Esc)', 'Fermer (Échap)', 'Schließen (Esc)'))}">${sbUiIcon('close', 15)}</button>
      </span>
    </div>`;
  if (item.kind === 'beat') {
    const beat = item.beat;
    const templates = beat.channel === 'article_press' ? Object.entries(ARTICLE_TEMPLATE_LIBRARY) : beat.channel === 'breaking_news_tv' ? Object.entries(TV_TEMPLATE_LIBRARY) : [];
    return `${head}
      <div class="bottom-editor-body ds-editor-body">
        <div class="ds-fields">
          ${recipients}
          <label class="sb-mini-field">${escapeHtml(tt('Channel', 'Canal', 'Kanal'))}<select data-ds-beat="channel" ${readOnly}>${Object.keys(TEMPLATE_LIBRARY).map((channel) => sbOption(channel, channelLabel(channel), beat.channel)).join('')}</select></label>
          ${templates.length ? `<label class="sb-mini-field">${escapeHtml(tt('Outlet', 'Média', 'Medium'))}<select data-ds-beat="template_id" ${readOnly}>${sbOption('', tt('Default', 'Par défaut', 'Standard'), beat.template_id)}${templates.map(([key, value]) => sbOption(key, value.label || key, beat.template_id)).join('')}</select></label>` : ''}
          <label class="sb-mini-field">${escapeHtml(tt('From', 'De', 'Von'))}<select data-ds-beat="cast_id" ${readOnly}>${sbOption('', tt('- Sender role -', '- Rôle émetteur -', '- Absenderrolle -'), beat.cast_id)}${storyboard.cast.map((cast) => sbOption(cast.id, `${cast.label}${cast.actor_id && getActor(cast.actor_id) ? ` (${getActor(cast.actor_id).name})` : ''}`, beat.cast_id)).join('')}</select></label>
          <label class="chip-toggle ds-nudge" title="${escapeAttribute(tt('A nudge relaunches or redirects players who stall or go off track: a follow-up asking for a decision, a call back, a deadline reminder.', 'Une relance remobilise ou réoriente les joueurs qui bloquent ou s’égarent : relance demandant une décision, rappel d’un journaliste, rappel d’échéance.', 'Ein Impuls stößt Spieler neu an oder lenkt sie um, wenn sie stocken oder abschweifen: Nachfrage nach einer Entscheidung, Rückruf, Fristerinnerung.'))}"><input type="checkbox" data-ds-beat="kind" ${beat.kind === 'nudge' ? 'checked' : ''} ${readOnly}>${escapeHtml(sbNudgeLabel())}</label>
          <label class="sb-mini-field ds-title">${escapeHtml(tt('Title', 'Titre', 'Titel'))}<input type="text" data-ds-beat="title" value="${escapeAttribute(beat.title)}" placeholder="${escapeAttribute(tt('Inject title', 'Titre de l’inject', 'Inject-Titel'))}" ${readOnly}></label>
        </div>
        <label class="sb-mini-field ds-intent">${escapeHtml(tt('What it says and the reaction or decision it should trigger', 'Ce qu’il dit et la réaction ou la décision qu’il doit provoquer', 'Was er aussagt und welche Reaktion oder Entscheidung er auslösen soll'))}
          <textarea data-ds-beat="intent" rows="3" ${readOnly}>${escapeHtml(beat.intent)}</textarea>
        </label>
        <div class="ds-editor-actions">
          ${item.stimulus
            ? `<button class="btn btn-secondary btn-sm" data-tab-action="ds-rewrite" ${ai && !readOnly ? '' : 'disabled'} title="${escapeAttribute(status?.manual ? tt('Adapts the content, keeping your manual edits', 'Adapte le contenu en conservant vos modifications manuelles', 'Passt den Inhalt an und behält Ihre manuellen Änderungen') : tt('Rewrites the content from the plan', 'Réécrit le contenu à partir du plan', 'Schreibt den Inhalt anhand des Plans neu'))}">${sbUiIcon('wand', 13)} ${escapeHtml(status?.manual ? tt('Adapt with AI', 'Adapter avec l’IA', 'Mit KI anpassen') : tt('Rewrite with AI', 'Réécrire avec l’IA', 'Mit KI neu schreiben'))}</button>`
            : `<button class="btn btn-primary btn-sm" data-tab-action="ds-create" ${readOnly}>${sbUiIcon('play', 13)} ${escapeHtml(ai ? tt('Create and write with AI', 'Créer et rédiger avec l’IA', 'Mit KI erstellen und schreiben') : tt('Create inject', 'Créer l’inject', 'Inject erstellen'))}</button>`}
        </div>
      </div>`;
  }
  const stimulus = item.stimulus;
  return `${head}
    <div class="bottom-editor-body ds-editor-body">
      <div class="ds-fields">
        ${recipients}
        <label class="sb-mini-field">${escapeHtml(tt('Channel', 'Canal', 'Kanal'))}<input type="text" value="${escapeAttribute(channelLabel(stimulus.channel))}" disabled></label>
        <label class="sb-mini-field">${escapeHtml(tt('From', 'De', 'Von'))}<select data-ds-stim="actor_id" ${readOnly}>${project.actors.map((actor) => sbOption(actor.id, `${actor.name} · ${roleLabel(actor.role)}`, stimulus.actor_id)).join('')}</select></label>
        <label class="sb-mini-field ds-title">${escapeHtml(tt('Title', 'Titre', 'Titel'))}<input type="text" data-ds-stim="name" value="${escapeAttribute(stimulus.name || '')}" placeholder="${escapeAttribute(sbStimulusLabel(stimulus))}" ${readOnly}></label>
      </div>
      <p class="sb-help">${escapeHtml(tt('This inject is not part of the storyline plan (created by hand, imported or orphan). It keeps its content; edit it in the full editor.', 'Cet inject ne fait pas partie du plan de la storyline (créé à la main, importé ou orphelin). Il garde son contenu ; modifiez-le dans l’éditeur complet.', 'Dieser Inject gehört nicht zum Plan der Storyline (manuell erstellt, importiert oder verwaist). Er behält seinen Inhalt; bearbeiten Sie ihn im vollständigen Editor.'))}</p>
    </div>`;
}

// ═══ Summary ═════════════════════════════════════════════════════════════════
/* Check & Challenge: is the exercise ready to play? One readiness verdict from three signals
   (automatic checks, the AI challenge, the ready-to-play checklist), then the load per cell
   and phase, the live checks, the AI challenge and the checklist. */
function ccChecklistProgress() {
  if (typeof checkerGetChecklistCategories !== 'function') return { done: 0, total: 0 };
  const checklist = checkerChecklist();
  const checked = checklist.checked || {}, custom = checklist.customItems || {};
  let done = 0, total = 0;
  for (const category of checkerGetChecklistCategories()) {
    const items = [...category.items, ...(custom[category.key] || [])];
    total += items.length;
    items.forEach((_, index) => { if (checked[`${category.key}_${index}`]) done++; });
  }
  return { done, total };
}

/* Live rule checks: the storyline structure and the exercise (cells, rhythm, recipients). */
function ccRuleIssues(project) {
  const seen = new Set();
  return [...sbExerciseChecks(project), ...sbStructuralChecks(project.storyboard, project)].filter((issue) => {
    const key = `${issue.code}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* AI signal: the timing review score and the challenge's axis verdicts, when they exist. */
function ccAiScore(summaryState) {
  const scores = [];
  if (Number.isFinite(summaryState.review?.score)) scores.push(summaryState.review.score);
  const axes = appState.checkerState.mode === 'scenario' ? appState.checkerState.analysisResult?.axes : null;
  if (Array.isArray(axes) && axes.length) {
    const value = { satisfactory: 100, acceptable: 60, insufficient: 20 };
    scores.push(Math.round(axes.reduce((sum, axis) => sum + (value[axis.verdict] ?? 50), 0) / axes.length));
  }
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
}

/* No storyline and no inject: nothing to check, so no score and no verdict. */
function ccNothingToCheck(project) {
  return !project.storyboard?.blocks?.length && !sbExerciseItems(project).length;
}

function ccReadiness(project, rules, summaryState) {
  const ai = ccAiScore(summaryState);
  const list = ccChecklistProgress();
  const checklist = list.total ? Math.round(100 * list.done / list.total) : null;
  if (ccNothingToCheck(project)) return { structure: null, ai, checklist, list, overall: null, verdict: 'empty' };
  const structure = sbScore(rules);
  const signals = [structure, ai, checklist].filter((value) => value !== null);
  const overall = Math.round(signals.reduce((a, b) => a + b, 0) / signals.length);
  const verdict = overall >= 80 && ai !== null ? 'ready' : overall >= 60 ? 'almost' : 'work';
  return { structure, ai, checklist, list, overall, verdict };
}

/* One AI challenge: the five-axis analysis, plus the cell-by-cell timing review of the scenario. */
async function ccChallenge() {
  const project = appState.scenario;
  const cs = appState.checkerState;
  const summary = tabUI('summary');
  const tasks = [];
  if (cs.mode === 'file' ? cs.parsedData : (project.stimuli || []).length) tasks.push(checkerRunAnalysis());
  if (cs.mode !== 'file' && project.storyboard?.blocks?.length) {
    tasks.push((async () => {
      try { summary.review = await SbAI.reviewExercise(); }
      catch (error) { pushToast(error?.name === 'AbortError' ? tt('Review stopped.', 'Revue arrêtée.', 'Prüfung gestoppt.') : sbErrorMessage(error), 'error'); }
      App.render();
    })());
  }
  await Promise.all(tasks);
  // The last challenge of the scenario is saved with the project: reopened the next day, the
  // exercise keeps its findings and its readiness score.
  if (cs.mode !== 'file' && appState.scenario === project && (cs.analysisResult || summary.review)) {
    project.challenge = { result: cs.analysisResult || null, review: summary.review || null, at: new Date().toISOString() };
    cs.challengeRestoredFor = project.id;
    saveLocal(false);
  }
}

/* Puts back the last saved challenge of the project once per opening, when none is in memory. */
function ccRestoreChallenge(project) {
  const cs = appState.checkerState;
  if (cs.challengeRestoredFor === project.id || cs.mode === 'file' || cs.analysisLoading) return;
  cs.challengeRestoredFor = project.id;
  // Another project: the results in memory belong to the previous one.
  const summary = tabUI('summary');
  cs.analysisResult = null; cs.analysisError = null; summary.review = null;
  const saved = project.challenge;
  if (!saved || typeof saved !== 'object') return;
  if (saved.result && typeof checkerNormalizeResult === 'function') cs.analysisResult = checkerNormalizeResult(saved.result);
  if (saved.review && typeof saved.review === 'object') summary.review = saved.review;
}

function renderSummaryView() {
  ccRestoreChallenge(tabProject());
  return sbWithRenderMemo(() => {
    const project = tabProject();
    const storyboard = project.storyboard;
    const state = tabUI('summary');
    const items = sbExerciseItems(project);
    const phases = sbMainBlocks(storyboard);
    const duration = Math.max(storyboard.duration_minutes, ...items.map((item) => item.time));
    const generated = items.filter((item) => item.stimulus).length;
    const players = project.cells.reduce((sum, cell) => sum + cell.players.length, 0);
    const rules = ccRuleIssues(project);
    const readiness = ccReadiness(project, rules, state);
    const cs = appState.checkerState;
    const fileLoaded = !!cs.parsedData;
    const source = fileLoaded && cs.mode === 'file' ? 'file' : 'scenario';
    if (cs.mode !== source) cs.mode = source;
    const kpi = (value, label) => `<div class="su-kpi"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`;
    const verdicts = {
      ready: tt('Ready to play', 'Prêt à jouer', 'Spielbereit'), almost: tt('Almost ready', 'Presque prêt', 'Fast bereit'),
      work: tt('Needs work', 'À retravailler', 'Überarbeitung nötig'), empty: tt('Nothing to check yet', 'Rien à vérifier pour l’instant', 'Noch nichts zu prüfen')
    };
    // The next steps, from what actually holds the score down.
    const errors = rules.filter((issue) => issue.severity === 'error').length;
    const steps = [
      errors ? tt(`fix the ${errors} error${errors > 1 ? 's' : ''} in the automatic checks`, `corriger ${errors > 1 ? `les ${errors} erreurs` : 'l’erreur'} des contrôles automatiques`, `${errors > 1 ? `die ${errors} Fehler` : 'den Fehler'} der automatischen Prüfungen beheben`) : '',
      readiness.ai === null ? tt('challenge the exercise with AI', 'challenger l’exercice avec l’IA', 'die Übung mit KI hinterfragen') : (readiness.ai < 80 && cs.analysisResult?.priority_actions?.length ? tt('work through the priority actions of the challenge', 'traiter les actions prioritaires du challenge', 'die vorrangigen Maßnahmen der Challenge abarbeiten') : ''),
      readiness.list.total && readiness.list.done < readiness.list.total ? tt(`tick the ready-to-play checklist (${readiness.list.done}/${readiness.list.total})`, `cocher la checklist « Prêt à jouer » (${readiness.list.done}/${readiness.list.total})`, `die Spielbereit-Checkliste abhaken (${readiness.list.done}/${readiness.list.total})`) : ''
    ].filter(Boolean);
    const hint = readiness.verdict === 'empty'
      ? tt('Build the main storyline or plan injects first (Context, Main storyline, Detailed storyline): the checks start once there is something to check.', 'Construisez d’abord la storyline principale ou planifiez des injects (Contexte, Storyline principale, Storyline détaillée) : les contrôles démarrent dès qu’il y a quelque chose à vérifier.', 'Erstellen Sie zuerst die Haupt-Storyline oder planen Sie Injects (Kontext, Haupt-Storyline, Detaillierte Storyline): Die Prüfungen beginnen, sobald es etwas zu prüfen gibt.')
      : steps.length ? tt(`Next: ${steps.join(', then ')}.`, `Ensuite : ${steps.join(', puis ')}.`, `Als Nächstes: ${steps.join(', dann ')}.`) : tt('The checks, the AI challenge and the checklist agree.', 'Les contrôles, le challenge IA et la checklist concordent.', 'Prüfungen, KI-Challenge und Checkliste stimmen überein.');
    const gauge = (label, value, hint, action = '') => `<div class="cc-gauge ${value === null ? 'is-empty' : value >= 80 ? 'is-good' : value >= 60 ? 'is-mid' : 'is-low'}">
      <span class="cc-gauge-label">${escapeHtml(label)}${action}</span>
      <strong>${value === null ? '—' : `${value}<small>/100</small>`}</strong>
      <span class="cc-gauge-bar"><i style="width:${value || 0}%"></i></span>
      <span class="cc-gauge-hint">${escapeHtml(hint)}</span>
    </div>`;
    // The live review: the rules, plus the AI timing findings of the last challenge.
    const aiIssues = (state.review?.issues || []).filter((issue) => issue.source === 'ai');
    const review = { score: null, summary: state.review?.summary || '', issues: [...rules, ...aiIssues] };
    const running = cs.analysisLoading || !!SbAI.busy;
    const canChallenge = isLLMAvailable() && !running && (source === 'file' || generated || storyboard.blocks.length);
    // Launch the AI challenge from its gauge: the results show in the "Challenge with AI" card below.
    const launch = `<button class="btn btn-primary btn-xs cc-launch" data-action="checker-analyze" ${canChallenge ? '' : 'disabled'} title="${escapeAttribute(isLLMAvailable() ? (running ? tt('The challenge is running', 'Le challenge est en cours', 'Die Challenge läuft') : tt('Challenge the exercise with AI', 'Challenger l’exercice avec l’IA', 'Die Übung mit KI hinterfragen')) : tt('Configure an AI connection in Settings first', 'Configurez d’abord une connexion IA dans les Paramètres', 'Richten Sie zuerst in den Einstellungen eine KI-Verbindung ein'))}">${sbUiIcon(running ? 'clock' : 'sparkles', 12)} ${escapeHtml(running ? tt('Running…', 'En cours…', 'Läuft…') : tt('Launch', 'Lancer', 'Starten'))}</button>`;
    state.liveIssues = review.issues;
    return `<section class="tab-page su-page" data-sb-scope>
      ${renderSbStatusBar()}
      <article class="card cc-readiness is-${readiness.verdict}">
        <div class="cc-verdict">
          <span class="page-eyebrow">${escapeHtml(tt('Readiness', 'Préparation', 'Einsatzbereitschaft'))}</span>
          <strong>${escapeHtml(verdicts[readiness.verdict])}</strong>
          <span class="cc-overall">${readiness.overall === null ? '-' : `${readiness.overall}<small>/100</small>`}</span>
          <p class="subtle">${escapeHtml(hint)}</p>
        </div>
        <div class="cc-gauges">
          ${gauge(tt('Automatic checks', 'Contrôles automatiques', 'Automatische Prüfungen'), readiness.structure, readiness.verdict === 'empty' ? tt('Nothing to check yet', 'Rien à vérifier pour l’instant', 'Noch nichts zu prüfen') : tt(`${rules.filter((issue) => issue.severity === 'error').length} error(s), ${rules.filter((issue) => issue.severity === 'warning').length} warning(s)`, `${rules.filter((issue) => issue.severity === 'error').length} erreur(s), ${rules.filter((issue) => issue.severity === 'warning').length} avertissement(s)`, `${rules.filter((issue) => issue.severity === 'error').length} Fehler, ${rules.filter((issue) => issue.severity === 'warning').length} Warnung(en)`))}
          ${gauge(tt('AI challenge', 'Challenge IA', 'KI-Challenge'), readiness.ai, readiness.ai === null ? tt('Not run yet', 'Pas encore lancé', 'Noch nicht ausgeführt') : tt('Last challenge of the current scenario', 'Dernier challenge du scénario actuel', 'Letzte Challenge des aktuellen Szenarios'), launch)}
          ${gauge(tt('Ready-to-play checklist', 'Checklist « Prêt à jouer »', 'Spielbereit-Checkliste'), readiness.checklist, tt(`${readiness.list.done} / ${readiness.list.total} items checked`, `${readiness.list.done} / ${readiness.list.total} éléments cochés`, `${readiness.list.done} / ${readiness.list.total} Punkte abgehakt`))}
        </div>
        <div class="su-kpis cc-kpis">
          ${kpi(escapeHtml(sbFormatDuration(duration)), tt('Duration', 'Durée', 'Dauer'))}
          ${kpi(phases.length, tt('Phases', 'Phases', 'Phasen'))}
          ${kpi(`${generated}<small>/${items.length}</small>`, tt('Injects written', 'Injects rédigés', 'Geschriebene Injects'))}
          ${kpi(project.cells.length, tt('Cells', 'Cellules', 'Zellen'))}
          ${kpi(players || escapeHtml(project.exercise.players_count || 0), tt('Players', 'Joueurs', 'Spieler'))}
          ${kpi(project.actors.length, tt('Actors', 'Acteurs', 'Akteure'))}
        </div>
      </article>
      <article class="card">
        <div class="section-header"><div><h3>${escapeHtml(tt('Load by cell and phase', 'Charge par cellule et par phase', 'Last pro Zelle und Phase'))}</h3><p class="subtle">${escapeHtml(tt('Injects received by each cell in each phase, and their rhythm every 30 minutes.', 'Injects reçus par chaque cellule dans chaque phase, et leur rythme toutes les 30 minutes.', 'Von jeder Zelle in jeder Phase erhaltene Injects und ihr Rhythmus alle 30 Minuten.'))}</p></div></div>
        ${renderSummaryOverview(project, items, phases, duration)}
      </article>
      <div class="cc-grid">
        <article class="card cc-checks">
          <div class="section-header"><div><h3>${escapeHtml(tt('Automatic checks', 'Contrôles automatiques', 'Automatische Prüfungen'))}</h3><p class="subtle">${escapeHtml(aiIssues.length
            ? tt('Always up to date: storyline, cells, rhythm, recipients and senders, plus the AI timing findings.', 'Toujours à jour : storyline, cellules, rythme, destinataires et émetteurs, plus les constats de timing de l’IA.', 'Immer aktuell: Storyline, Zellen, Rhythmus, Empfänger und Absender, dazu die Timing-Befunde der KI.')
            : tt('Always up to date: storyline, cells, rhythm, recipients and senders.', 'Toujours à jour : storyline, cellules, rythme, destinataires et émetteurs.', 'Immer aktuell: Storyline, Zellen, Rhythmus, Empfänger und Absender.'))}</p></div></div>
          ${renderSummaryReview(project, review)}
        </article>
        <article class="card cc-challenge">
          <div class="section-header"><div><h3>${escapeHtml(tt('Challenge with AI', 'Challenger avec l’IA', 'Mit KI hinterfragen'))}</h3><p class="subtle">${escapeHtml(source === 'file'
            ? tt('A critical senior designer reviews the external exercise file on five quality axes: priority actions, verdicts and findings.', 'Un concepteur senior exigeant examine le fichier d’exercice externe selon cinq axes qualité : actions prioritaires, verdicts et constats.', 'Ein kritischer, erfahrener Übungsdesigner prüft die externe Übungsdatei nach fünf Qualitätsachsen: vorrangige Maßnahmen, Bewertungen und Befunde.')
            : tt('A critical senior designer reviews the exercise on five quality axes, and its timing cell by cell: priority actions, verdicts and findings.', 'Un concepteur senior exigeant examine l’exercice selon cinq axes qualité, et son timing cellule par cellule : actions prioritaires, verdicts et constats.', 'Ein kritischer, erfahrener Übungsdesigner prüft die Übung nach fünf Qualitätsachsen und ihr Timing Zelle für Zelle: vorrangige Maßnahmen, Bewertungen und Befunde.'))}</p></div></div>
          <div class="cc-source" role="group" aria-label="${escapeAttribute(tt('What to challenge', 'Ce qu’il faut challenger', 'Was hinterfragt werden soll'))}">
            <button class="${source === 'scenario' ? 'active' : ''}" data-action="checker-set-mode" data-mode="scenario">${sbUiIcon('layers', 14)} ${escapeHtml(tt('Current scenario', 'Scénario actuel', 'Aktuelles Szenario'))}</button>
            <button class="${source === 'file' ? 'active' : ''}" data-action="checker-set-mode" data-mode="file" ${fileLoaded ? '' : `disabled title="${escapeAttribute(tt('Load an external exercise file in the Context tab first', 'Chargez d’abord un fichier d’exercice externe dans l’onglet Contexte', 'Laden Sie zuerst im Tab Kontext eine externe Übungsdatei'))}"`}>${sbUiIcon('sheet', 14)} ${escapeHtml(fileLoaded ? (cs.file?.name || tt('External file', 'Fichier externe', 'Externe Datei')) : tt('External file', 'Fichier externe', 'Externe Datei'))}</button>
            ${fileLoaded ? '' : `<button class="btn btn-ghost btn-xs" data-route="scenario">${escapeHtml(tt('Load a file in Context', 'Charger un fichier dans Contexte', 'Datei im Kontext laden'))} ${sbUiIcon('chevronRight', 12)}</button>`}
          </div>
          ${cs.analysisResult || cs.analysisLoading || cs.analysisError ? '' : `<div class="cc-run">
            <button class="btn btn-primary" data-action="checker-analyze" ${canChallenge ? '' : 'disabled'}>${sbUiIcon('sparkles', 15)} ${escapeHtml(tt('Challenge with AI', 'Challenger avec l’IA', 'Mit KI hinterfragen'))}</button>
            ${isLLMAvailable() ? '' : `<p class="agent-warning">${escapeHtml(tt('Configure an AI connection in Settings to challenge the exercise.', 'Configurez une connexion IA dans les Paramètres pour challenger l’exercice.', 'Richten Sie in den Einstellungen eine KI-Verbindung ein, um die Übung zu hinterfragen.'))}</p>`}
          </div>`}
          ${typeof renderCheckerResults === 'function' ? renderCheckerResults() : ''}
        </article>
      </div>
      ${typeof renderCheckerChecklist === 'function' ? renderCheckerChecklist() : ''}
    </section>`;
  });
}

function renderSummaryOverview(project, items, phases, duration) {
  const rows = [...project.cells];
  if (items.some((item) => !sbHasRecipient(project, item.cell_id))) rows.push({ id: 'none', name: tt('Unassigned', 'Non attribués', 'Nicht zugewiesen'), color: '#6d687e' });
  // The phase of each inject comes from the exercise model: its linked phase, else the phase at its time.
  const phaseOf = new Map(ExerciseModel.of(project).injects.map((inject) => [inject.key, inject.phase_id]));
  const inPhase = (item, block) => phaseOf.get(item.key) === block.id;
  const reaches = (item, row) => (row.id === 'none' ? !sbHasRecipient(project, item.cell_id) : sbReaches(item.cell_id, row.id));
  const max = Math.max(1, ...rows.flatMap((row) => phases.map((block) => items.filter((item) => reaches(item, row) && inPhase(item, block)).length)));
  const buckets = Math.max(1, Math.ceil(duration / 30));
  // Phase names head their own column, so names and counts always line up.
  return `${phases.length ? '' : `<p class="sb-empty">${escapeHtml(tt('No phase', 'Aucune phase', 'Keine Phase'))}</p>`}
    <div class="su-heat-wrap"><table class="su-heat">
      <thead><tr><th>${escapeHtml(tt('Cell', 'Cellule', 'Zelle'))}</th>${phases.map((block) => `<th class="su-phase" style="--clip-color:${sbBlockColor(block, project.storyboard)}" title="${escapeAttribute(`${sbFormatOffset(block.start_minutes)} · ${block.title}`)}"><span>${escapeHtml(block.title)}</span><small>${escapeHtml(sbFormatOffset(block.start_minutes))}</small></th>`).join('')}<th>${escapeHtml(tt('Total', 'Total', 'Gesamt'))}</th><th>${escapeHtml(tt('Load (per 30 min)', 'Charge (par 30 min)', 'Last (pro 30 Min.)'))}</th></tr></thead>
      <tbody>${rows.map((row) => {
        const own = items.filter((item) => reaches(item, row));
        const load = Array.from({ length: buckets }, (_, index) => own.filter((item) => Math.floor(item.time / 30) === index).length);
        const peak = Math.max(1, ...load);
        return `<tr>
          <th><span class="cell-dot" style="--cell-color:${row.color}"></span>${escapeHtml(row.name)}</th>
          ${phases.map((block) => { const count = own.filter((item) => inPhase(item, block)).length; return `<td style="--heat:${(count / max).toFixed(2)}" class="${count ? '' : 'is-zero'}">${count || ''}</td>`; }).join('')}
          <td><b>${own.length}</b></td>
          <td><span class="su-load">${load.map((value) => `<i style="height:${Math.round(100 * value / peak)}%" class="${value > 3 ? 'is-high' : value === 0 ? 'is-zero' : ''}" title="${value}"></i>`).join('')}</span></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
}

function renderSummaryReview(project, review = tabUI('summary').review) {
  if (!review) return `<p class="sb-empty">${escapeHtml(tt('Run the checks to review the rhythm and consistency of the exercise.', 'Lancez les contrôles pour vérifier le rythme et la cohérence de l’exercice.', 'Führen Sie die Prüfungen aus, um Rhythmus und Konsistenz der Übung zu kontrollieren.'))}</p>`;
  const cellName = (id) => sbCell(project, id)?.name || '';
  const rank = { error: 0, warning: 1, info: 2 };
  const groups = new Map();
  review.issues.forEach((issue, index) => {
    const key = issue.source === 'ai' ? 'ai' : issue.code || 'other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ issue, index });
  });
  const ordered = [...groups.entries()].sort(([, a], [, b]) => Math.min(...a.map((entry) => rank[entry.issue.severity] ?? 2)) - Math.min(...b.map((entry) => rank[entry.issue.severity] ?? 2)));
  const renderIssue = ({ issue, index }) => `<li class="is-${issue.severity}">
      <span>${issue.at !== null && issue.at !== undefined ? `<b>${sbFormatOffset(issue.at)}</b> ` : ''}${cellName(issue.cell_id) ? `<i>${escapeHtml(cellName(issue.cell_id))}</i> · ` : ''}${escapeHtml(issue.display || issue.message)}${issue.suggestion ? `<br><small>${escapeHtml(issue.suggestion)}</small>` : ''}</span>
      ${issue.item_key || issue.cell_id || (issue.at !== null && issue.at !== undefined) ? `<button class="btn btn-ghost btn-xs" data-tab-action="su-issue" data-tab-value="${index}">${escapeHtml(tt('Go to', 'Voir', 'Zeigen'))}</button>` : ''}
    </li>`;
  return `${review.summary ? `<p class="su-review-summary">${review.score !== null && review.score !== undefined ? `<b>${review.score}/100</b> ` : ''}${escapeHtml(review.summary)}</p>` : ''}
    ${review.issues.length ? `<div class="su-issue-groups">${ordered.map(([key, entries]) => {
      const severity = entries.reduce((best, entry) => ((rank[entry.issue.severity] ?? 2) < (rank[best] ?? 2) ? entry.issue.severity : best), 'info');
      return `<details class="su-issue-group is-${severity}" ${entries.length <= 3 || key === 'ai' ? 'open' : ''}>
        <summary><b>${entries.length}</b>${escapeHtml(SU_ISSUE_LABELS[key] ? tt(...SU_ISSUE_LABELS[key]) : key)}</summary>
        <ul class="sb-issues">${entries.map(renderIssue).join('')}</ul>
      </details>`;
    }).join('')}</div>` : `<ul class="sb-issues"><li class="is-info"><span>${escapeHtml(tt('No issue found.', 'Aucun problème détecté.', 'Kein Problem gefunden.'))}</span></li></ul>`}`;
}

// [English, French, German], translated when shown.
const SU_ISSUE_LABELS = {
  ai: ['AI review', 'Revue IA', 'KI-Prüfung'],
  empty: ['No inject yet', 'Aucun inject pour l’instant', 'Noch kein Inject'],
  no_cells: ['No player cell', 'Aucune cellule de joueurs', 'Keine Spielerzelle'],
  cell_idle: ['Cells without inject', 'Cellules sans inject', 'Zellen ohne Inject'],
  gap: ['Dead times', 'Temps morts', 'Leerlaufzeiten'],
  peak: ['Overloads', 'Surcharges', 'Überlastungen'],
  cell_no_nudge: ['Cells without nudge inject', 'Cellules sans inject de relance', 'Zellen ohne Impuls-Inject'],
  phase_empty: ['Phases without inject', 'Phases sans inject', 'Phasen ohne Inject'],
  no_cell: ['Injects without recipient cell', 'Injects sans cellule destinataire', 'Injects ohne Empfängerzelle'],
  no_sender: ['Injects without sender', 'Injects sans émetteur', 'Injects ohne Absender'],
  orphan: ['Injects no longer matching the storyline', 'Injects qui ne correspondent plus à la storyline', 'Injects, die nicht mehr zur Storyline passen'],
  after_end: ['Injects after the end', 'Injects après la fin', 'Injects nach dem Ende'],
  no_main: ['No phase on the main storyline', 'Aucune phase sur la storyline principale', 'Keine Phase auf der Haupt-Storyline'],
  no_trigger: ['No trigger phase', 'Pas de phase de déclenchement', 'Keine Auslöserphase'],
  no_exit: ['No closing phase', 'Pas de phase de clôture', 'Keine Abschlussphase'],
  late_start: ['Late start', 'Début tardif', 'Später Beginn'],
  overlap: ['Overlapping phases', 'Phases qui se chevauchent', 'Überlappende Phasen'],
  beyond_end: ['Phases after the end', 'Phases après la fin', 'Phasen nach dem Ende'],
  no_brief: ['Phases without description', 'Phases sans déroulé', 'Phasen ohne Ablauf'],
  beat_outside: ['Injects outside their phase', 'Injects hors de leur phase', 'Injects außerhalb ihrer Phase'],
  beat_count: ['Inject counts to check', 'Nombres d’injects à vérifier', 'Zu prüfende Inject-Anzahlen'],
  no_stimuli: ['Phases without planned inject', 'Phases sans inject prévu', 'Phasen ohne geplanten Inject'],
  too_dense: ['Crowded phases', 'Phases trop chargées', 'Überladene Phasen'],
  beat_no_sender: ['Planned injects without sender', 'Injects prévus sans émetteur', 'Geplante Injects ohne Absender'],
  objective_uncovered: ['Objectives not covered', 'Objectifs non couverts', 'Nicht abgedeckte Ziele'],
  no_objectives: ['No learning objectives', 'Aucun objectif pédagogique', 'Keine Lernziele'],
  cast_unused: ['Unused roles', 'Rôles inutilisés', 'Ungenutzte Rollen'],
  low_pressure: ['Low pressure', 'Pression faible', 'Geringer Druck'],
  event_time: ['Main events at another time than they say', 'Événements principaux placés à une autre heure que celle indiquée', 'Hauptereignisse zu einer anderen Zeit als angegeben'],
  other: ['Other', 'Autres', 'Sonstige']
};

// ═══ Context tab helpers ══════════════════════════════════════════════
function renderContextGlance(project) {
  const sectors = ['Banking', 'Insurance', 'Energy', 'Healthcare', 'Transport', 'Industry', 'Telecom', 'Retail', 'Public sector', 'Pharmaceutical', 'Technology', 'Other'];
  // The stored sector stays in English; the list shows it in the application language.
  const sectorLabels = {
    Banking: ['Banque', 'Bankwesen'], Insurance: ['Assurance', 'Versicherung'], Energy: ['Énergie', 'Energie'], Healthcare: ['Santé', 'Gesundheitswesen'],
    Transport: ['Transport', 'Verkehr'], Industry: ['Industrie', 'Industrie'], Telecom: ['Télécommunications', 'Telekommunikation'], Retail: ['Distribution', 'Einzelhandel'],
    'Public sector': ['Secteur public', 'Öffentlicher Sektor'], Pharmaceutical: ['Pharmaceutique', 'Pharmaindustrie'], Technology: ['Technologie', 'Technologie'], Other: ['Autre', 'Sonstige']
  };
  const sectorLabel = (sector) => tt(sector, sectorLabels[sector]?.[0] || sector, sectorLabels[sector]?.[1] || sector);
  const duration = project.storyboard?.duration_minutes || SB_DEFAULT_DURATION;
  // "Other" or a sector typed by hand: the select shows Other, a field next to it holds the text.
  const otherSector = Boolean(project.client.sector) && !sectors.slice(0, -1).includes(project.client.sector);
  const players = project.cells.reduce((sum, cell) => sum + cell.players.length, 0);
  const logo = project.client.logo_url || '';
  return `<article class="card cx-frame" data-sb-scope>
    <div class="section-header"><div><h3>${escapeHtml(tt('Context', 'Contexte', 'Kontext'))}</h3><p class="subtle">${escapeHtml(tt('Who the exercise is for, how long it plays, the simulated clock, the audience, what the players must learn and what really happened. The AI generation fills the empty fields; complete or correct any of them, then Update.', 'Pour qui est l’exercice, combien de temps il dure, l’horloge simulée, le public, ce que les joueurs doivent apprendre et ce qui s’est réellement passé. La génération IA remplit les champs vides ; complétez ou corrigez-les, puis Mettre à jour.', 'Für wen die Übung ist, wie lange sie dauert, die simulierte Uhr, das Publikum, was die Spieler lernen sollen und was wirklich passiert ist. Die KI-Erstellung füllt die leeren Felder; ergänzen oder korrigieren Sie sie, dann Aktualisieren.'))}</p></div></div>
    <div class="cx-row cx-row-client">
      <label class="field">${escapeHtml(tt('Exercise name', 'Nom de l’exercice', 'Name der Übung'))}<input type="text" data-bind="name" value="${escapeAttribute(project.name || '')}" placeholder="${escapeAttribute(tt('e.g. Operation Cold Chain', 'Ex. : Opération Chaîne du froid', 'z. B. Operation Kühlkette'))}"></label>
      <label class="field">${escapeHtml(tt('Client name', 'Nom du client', 'Name des Auftraggebers'))}<input type="text" data-bind="client.name" value="${escapeAttribute(project.client.name || '')}" placeholder="${escapeAttribute(tt('Organisation name', 'Nom de l’organisation', 'Name der Organisation'))}"></label>
      <label class="field">${escapeHtml(tt('Sector', 'Secteur', 'Branche'))}<span class="cx-sector ${otherSector ? 'is-other' : ''}"><select data-cx-sector aria-label="${escapeAttribute(tt('Sector', 'Secteur', 'Branche'))}">${project.client.sector ? '' : `<option value="" selected disabled>${escapeHtml(tt('Choose a sector', 'Choisissez un secteur', 'Branche wählen'))}</option>`}${sectors.map((sector) => sbOption(sector, sectorLabel(sector), otherSector ? 'Other' : project.client.sector)).join('')}</select>${otherSector ? `<input type="text" data-cx-sector-other value="${escapeAttribute(project.client.sector === 'Other' ? '' : project.client.sector)}" placeholder="${escapeAttribute(tt('Type the sector', 'Saisissez le secteur', 'Branche eingeben'))}" aria-label="${escapeAttribute(tt('Other sector', 'Autre secteur', 'Andere Branche'))}">` : ''}</span></label>
      <div class="field cx-logo">
        <span>${escapeHtml(tt('Logo', 'Logo', 'Logo'))}</span>
        <div class="cx-logo-row">
          ${logo ? `<img class="cx-logo-preview" src="${escapeAttribute(logo)}" alt="${escapeAttribute(tt('Client logo', 'Logo du client', 'Logo des Auftraggebers'))}">` : `<span class="cx-logo-empty">${sbUiIcon('image', 18)}</span>`}
          <label class="btn btn-secondary btn-sm cx-logo-pick">${sbUiIcon('upload', 14)} ${escapeHtml(logo ? tt('Replace', 'Remplacer', 'Ersetzen') : tt('Upload a file', 'Importer un fichier', 'Datei hochladen'))}<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" data-cx-logo hidden></label>
          ${logo ? `<button class="btn btn-ghost btn-sm" data-cx-logo-clear>${sbUiIcon('trash', 13)} ${escapeHtml(tt('Remove', 'Retirer', 'Entfernen'))}</button>` : ''}
        </div>
      </div>
    </div>
    <div class="cx-row cx-row-frame">
      <label class="field">${escapeHtml(tt('Exercise duration (h:min)', 'Durée de l’exercice (h:min)', 'Übungsdauer (h:min)'))}<input type="text" inputmode="numeric" data-sc-duration value="${sbFormatHoursMinutes(duration)}" placeholder="${escapeAttribute(tt('e.g. 0:45 or 3:00', 'ex. : 0:45 ou 3:00', 'z. B. 0:45 oder 3:00'))}" title="${escapeAttribute(tt('Hours and minutes, e.g. 0:45, 1:30 or 3:00', 'Heures et minutes, ex. : 0:45, 1:30 ou 3:00', 'Stunden und Minuten, z. B. 0:45, 1:30 oder 3:00'))}"><span class="helper">${sbFormatDuration(duration)}</span></label>
      <label class="field">${escapeHtml(tt('Simulated start date', 'Date de début simulée', 'Simuliertes Startdatum'))}<input type="datetime-local" data-bind="scenario.start_date" value="${escapeAttribute(project.scenario.start_date || '')}"></label>
      <label class="field">${escapeHtml(tt('Simulated end date', 'Date de fin simulée', 'Simuliertes Enddatum'))}<input type="datetime-local" data-bind="scenario.end_date" value="${escapeAttribute(project.scenario.end_date || '')}" min="${escapeAttribute(project.scenario.start_date || '')}"></label>
      <label class="field">${escapeHtml(tt('Timezone', 'Fuseau horaire', 'Zeitzone'))}<select data-bind="scenario.timezone">${TIMEZONES.map((item) => sbOption(item, item, project.scenario.timezone)).join('')}</select></label>
      <label class="field">${escapeHtml(tt('Number of crisis cells', 'Nombre de cellules de crise', 'Anzahl der Krisenzellen'))}<input type="number" min="0" max="20" step="1" data-sc-cells value="${escapeAttribute(project.exercise.cells_count || project.cells.length || '')}" placeholder="${escapeAttribute(tt('e.g. 3', 'ex. : 3', 'z. B. 3'))}"><span class="helper">${escapeHtml(tt(`${project.cells.length} cell(s) defined`, `${project.cells.length} cellule(s) définie(s)`, `${project.cells.length} Zelle(n) definiert`))}</span></label>
      <label class="field">${escapeHtml(tt('Number of players', 'Nombre de joueurs', 'Anzahl der Spieler'))}<input type="number" min="0" max="10000" step="1" data-sc-players value="${escapeAttribute(project.exercise.players_count ?? '')}" placeholder="${escapeAttribute(tt('e.g. 15', 'ex. : 15', 'z. B. 15'))}"><span class="helper">${escapeHtml(tt(`${players} listed in Cells & actors`, `${players} inscrit(s) dans Cellules et acteurs`, `${players} in Zellen und Akteure erfasst`))}</span></label>
    </div>
    ${typeof renderDurationConflict === 'function' ? renderDurationConflict(project) : ''}
    <div class="cx-row cx-row-lang">
      <label class="field">${escapeHtml(tt('Primary language', 'Langue principale', 'Hauptsprache'))}<select data-bind="client.language">${LANGUAGES.map((item) => sbOption(item.value, item.label, project.client.language || 'en')).join('')}</select></label>
      <label class="field">${escapeHtml(tt('Default inject language', 'Langue par défaut des injects', 'Standardsprache der Injects'))}<select data-bind="settings.inject_language">${LANGUAGES.map((item) => sbOption(item.value, item.label, project.settings.inject_language || 'en')).join('')}</select></label>
    </div>
    <div class="cx-design">
      <div class="cx-design-col">
        <div class="cx-design-head"><strong>${escapeHtml(tt('Learning objectives', 'Objectifs pédagogiques', 'Lernziele'))}</strong><span class="helper">${escapeHtml(tt('What the players must practise or learn, in your own words. Name a cell or a category of players when an objective concerns only them: the AI works out who each objective is for and puts every cell in situations that test it.', 'Ce que les joueurs doivent pratiquer ou apprendre, avec vos propres mots. Nommez une cellule ou une catégorie de joueurs quand un objectif ne concerne qu’eux : l’IA détermine à qui s’adresse chaque objectif et place chaque cellule dans des situations qui le mettent à l’épreuve.', 'Was die Spieler üben oder lernen sollen, in Ihren eigenen Worten. Nennen Sie eine Zelle oder eine Spielergruppe, wenn ein Ziel nur sie betrifft: Die KI ermittelt, für wen jedes Ziel gilt, und bringt jede Zelle in Situationen, die es auf die Probe stellen.'))}</span></div>
        <textarea class="cx-objectives" data-bind="scenario.learning_objectives" rows="12" placeholder="${escapeAttribute(tt('e.g.\nEveryone: apply the crisis management procedure and keep a shared situation picture.\nExecutives: decide on isolation under uncertainty and document each decision.\nCommunication: hold consistent messages without premature disclosure.\nLegal: meet the NIS2 and GDPR notification deadlines.', 'Ex. :\nTous : appliquer la procédure de gestion de crise et partager une même vision de la situation.\nDirection : décider de l’isolement dans l’incertitude et documenter chaque décision.\nCommunication : tenir des messages cohérents sans divulgation prématurée.\nJuridique : respecter les délais de notification NIS2 et RGPD.', 'Z. B.:\nAlle: das Krisenmanagementverfahren anwenden und ein gemeinsames Lagebild pflegen.\nGeschäftsleitung: unter Unsicherheit über die Isolation entscheiden und jede Entscheidung dokumentieren.\nKommunikation: konsistente Botschaften ohne vorzeitige Offenlegung vertreten.\nRecht: die Meldefristen nach NIS2 und DSGVO einhalten.')).replace(/\n/g, '&#10;')}">${escapeHtml(project.scenario.learning_objectives || '')}</textarea>
      </div>
      <div class="cx-design-col">
        <div class="cx-design-head"><strong>${escapeHtml(tt('Incident timeline', 'Chronologie de l’incident', 'Zeitlicher Ablauf des Vorfalls'))}</strong><span class="helper">${escapeHtml(tt('What really happened, in order: how the attacker got in and moved, what was detected and when, how the teams reacted and what it cost the business. Phases, alerts and technical injects follow it.', 'Ce qui s’est réellement passé, dans l’ordre : comment l’attaquant est entré et s’est déplacé, ce qui a été détecté et quand, comment les équipes ont réagi et ce que cela a coûté à l’activité. Les phases, les alertes et les injects techniques en découlent.', 'Was wirklich passiert ist, der Reihe nach: wie der Angreifer eindrang und sich bewegte, was wann entdeckt wurde, wie die Teams reagierten und was es das Unternehmen kostete. Phasen, Alarme und technische Injects folgen daraus.'))}</span></div>
        <textarea class="cx-attack" data-bind="scenario.attack_path" rows="12" placeholder="${escapeAttribute(tt('One event per line, in order, with its date or time when known. e.g.\nD-21: initial access, phishing email with a malicious attachment to an accounts payable clerk\nD-20: a loader installs a remote access beacon; nobody notices\nD-10: Kerberoasting of a service account, then lateral movement to the file servers\nD-3: 400 GB of HR and finance data sent to cloud storage\nD-day 06:40: hypervisors encrypted, backups deleted, ransom note\nD-day 07:15: the SOC escalates, the crisis cell is called at 08:00', 'Un événement par ligne, dans l’ordre, avec sa date ou son heure si elle est connue. Ex. :\nJ-21 : accès initial, e-mail d’hameçonnage avec une pièce jointe malveillante envoyé à un comptable fournisseurs\nJ-20 : un loader installe une balise d’accès à distance ; personne ne le remarque\nJ-10 : Kerberoasting d’un compte de service, puis mouvement latéral vers les serveurs de fichiers\nJ-3 : 400 Go de données RH et financières envoyés vers un stockage cloud\nJour J 06:40 : hyperviseurs chiffrés, sauvegardes supprimées, demande de rançon\nJour J 07:15 : le SOC escalade, la cellule de crise est convoquée à 08:00', 'Ein Ereignis pro Zeile, der Reihe nach, mit Datum oder Uhrzeit, falls bekannt. Z. B.:\nT-21: Erstzugriff, Phishing-E-Mail mit schädlichem Anhang an einen Kreditorenbuchhalter\nT-20: ein Loader installiert einen Fernzugriffs-Beacon; niemand bemerkt es\nT-10: Kerberoasting eines Dienstkontos, dann laterale Bewegung zu den Dateiservern\nT-3: 400 GB Personal- und Finanzdaten werden in einen Cloud-Speicher übertragen\nTag X 06:40: Hypervisoren verschlüsselt, Backups gelöscht, Lösegeldforderung\nTag X 07:15: das SOC eskaliert, der Krisenstab wird für 08:00 einberufen')).replace(/\n/g, '&#10;')}">${escapeHtml(project.scenario.attack_path || '')}</textarea>
      </div>
    </div>
  </article>`;
}

/* The designer's source file: an existing exercise (deck or chronogram), a proposal or an
   exercise brief. The AI generation and the agent read it; Check & Challenge can audit its
   chronogram as it is. */
function renderContextExerciseFile() {
  const cs = appState.checkerState || {};
  const loaded = !!cs.parsedData;
  if (typeof renderCheckerDropZone !== 'function') return '';
  return `<div class="cx-file ${loaded ? 'is-loaded' : ''}">
    ${loaded ? renderCheckerImported({ inner: true }) : renderCheckerDropZone({ inner: true, title: tt('Drop a deck, a proposal, a brief or a chronogram here', 'Déposez ici un support, une proposition, un cahier des charges ou un chronogramme', 'Foliensatz, Angebot, Briefing oder Chronogramm hier ablegen') })}
  </div>`;
}

/* A bounded excerpt of the loaded file, for the agent (getReferenceFile reads all of it). */
function contextExerciseFileExcerpt() {
  const cs = appState.checkerState || {};
  const pd = cs.parsedData;
  if (!pd || typeof checkerSerializeChronogram !== 'function') return '';
  const text = pd.doc
    ? CrisisDocReader.outline(pd.doc, pd.analysis, { limit: 3000 })
    : String(checkerSerializeChronogram({ withDocument: false })?.serialized || '');
  const limit = 3200;
  return `Source file "${cs.file?.name || 'file'}" loaded by the designer (an existing exercise, a proposal or a brief): read it in full with getReferenceFile and build from it (its context, objectives, players, phases, incident timeline and injects), adapted to the frame; do not copy it blindly. Excerpt:\n${text.length > limit ? `${text.slice(0, limit)}\n[… truncated]` : text}`;
}

/* Objective handed to the builder agent: the context fields are in its state, this adds intent. */
/* The library scenario loaded in Project, if any. */
function contextLibraryTemplate(project) {
  const id = project.storyboard?.meta?.library_id;
  return id ? sbFindTemplate(id) : null;
}

function contextAgentObjective(project) {
  const storyboard = project.storyboard;
  const template = contextLibraryTemplate(project);
  const brief = String(storyboard.meta.brief || '').trim();
  return [
    'Build the exercise from the Context tab so the Main storyline, Cells & actors and Detailed storyline tabs are ready to use.',
    `Context, objectives and ideas from the designer: ${brief || '(none given: ask what you need)'}`,
    template ? `Library scenario selected in the Project tab, to adapt: "${template.name}" (${storyboard.blocks.length} phases already on the main storyline).` : (storyboard.blocks.length ? `An existing main storyline has ${storyboard.blocks.length} phases: improve it rather than starting over, unless the context asks otherwise.` : 'No main storyline yet.'),
    `Fit the play duration of ${storyboard.duration_minutes} minutes, ${project.exercise.cells_count || project.cells.length || 'a suitable number of'} player cells and ${project.exercise.players_count || 'an unknown number of'} players.`,
    contextExerciseFileExcerpt()
  ].filter(Boolean).join('\n').slice(0, 7900);
}

// ═══ Events ══════════════════════════════════════════════════════════════════
function tabItemByKey(project, key) {
  return sbExerciseItems(project).find((item) => item.key === key) || null;
}

/* Moves an inject in time and/or to another cell; a planned inject follows the phase
   covering its new time, and its written stimulus moves with it (one undo step). */
function dsMoveItem(project, item, time, cellId) {
  StoryboardHistory.track();
  const storyboard = project.storyboard;
  const at = Math.max(0, Math.round(time));
  const cell = cellId === 'none' ? '' : cellId;
  if (item.kind === 'beat') {
    const target = sbMainBlockAt(storyboard, Math.min(at, Math.max(0, storyboard.duration_minutes - 1))) || item.block;
    const beat = item.beat;
    if (target !== item.block) {
      item.block.beats = item.block.beats.filter((entry) => entry.id !== beat.id);
      target.beats.push(beat);
      target.stimuli_target = Math.max(target.stimuli_target, target.beats.length);
    }
    beat.offset_minutes = Math.max(0, Math.min(at - target.start_minutes, target.duration_minutes - 1));
    target.beats.sort((a, b) => a.offset_minutes - b.offset_minutes);
    if (cell !== undefined) beat.cell_id = cell;
    if (item.stimulus) {
      const link = item.stimulus.scenario_link;
      item.stimulus.timestamp_offset_minutes = sbBeatAbsolute(target, beat);
      if (link) { link.block_id = target.id; link.offset = beat.offset_minutes; link.at = item.stimulus.timestamp_offset_minutes; }
      if (cell !== undefined) item.stimulus.cell_id = cell;
      item.stimulus.updated_at = new Date().toISOString();
    }
  } else {
    const stimulus = item.stimulus;
    stimulus.timestamp_offset_minutes = at;
    if (cell !== undefined) stimulus.cell_id = cell;
    const link = stimulus.scenario_link;
    const block = sbMainBlockAt(storyboard, at);
    if (link && !link.beat_id && block) { link.block_id = block.id; link.offset = Math.max(0, at - block.start_minutes); link.at = at; }
    stimulus.updated_at = new Date().toISOString();
  }
  sortStimuli();
  StoryboardHistory.commit('Move inject');
}

/* The recipient after dropping an inject from one cell row onto another: that cell takes
   the place of the row it came from (an inject for several cells keeps the others), the
   Unassigned row removes every recipient. undefined: no change (an inject for all cells
   is already in every row). */
function dsDropRecipient(project, item, fromRow, toRow) {
  if (!toRow || toRow === fromRow || sbIsAllCells(item.cell_id)) return undefined;
  if (toRow === 'none') return 'none';
  return sbJoinRecipients(project, [...sbRecipientIds(item.cell_id).filter((id) => id !== fromRow), toRow]);
}

function dsAddInject(project) {
  const state = tabUI('detailed');
  const storyboard = project.storyboard;
  const block = sbMainBlockAt(storyboard, state.playhead);
  if (!block) throw new AgentValidationError(tt('Add a phase to the main storyline first.', 'Ajoutez d’abord une phase à la storyline principale.', 'Fügen Sie zuerst der Haupt-Storyline eine Phase hinzu.'));
  const cellId = sbCell(project, state.cell)?.id || project.cells[0]?.id || '';
  const cell = sbCell(project, cellId);
  const channel = cell ? (Object.entries(SB_CHANNEL_TO_CELL).find(([, key]) => key === cell.key)?.[0] || 'email_internal') : 'email_internal';
  const beat = sbMakeBeat({ offset_minutes: Math.max(0, Math.min(state.playhead - block.start_minutes, block.duration_minutes - 1)), channel, cell_id: cellId, title: tt('New inject', 'Nouvel inject', 'Neuer Inject') });
  block.beats.push(beat);
  block.beats.sort((a, b) => a.offset_minutes - b.offset_minutes);
  if (!block.plan_hash) sbMarkPlanned(block);
  block.stimuli_target = Math.max(block.stimuli_target, block.beats.length);
  StoryboardHistory.commit('Add inject');
  state.selected = `beat:${beat.id}`;
}

function dsDeleteSelected(project) {
  const state = tabUI('detailed');
  const item = dsSelectedItem(project);
  if (!item) return;
  if (!window.confirm(item.stimulus
    ? tt(`Delete "${item.title}"? Its written inject is deleted too.`, `Supprimer « ${item.title} » ? L’inject rédigé est supprimé aussi.`, `„${item.title}“ löschen? Der geschriebene Inject wird ebenfalls gelöscht.`)
    : tt(`Delete "${item.title}"?`, `Supprimer « ${item.title} » ?`, `„${item.title}“ löschen?`))) return;
  StoryboardHistory.track();
  if (item.kind === 'beat') item.block.beats = item.block.beats.filter((beat) => beat.id !== item.beat.id);
  if (item.stimulus) project.stimuli = project.stimuli.filter((stimulus) => stimulus.id !== item.stimulus.id);
  StoryboardHistory.commit('Delete inject');
  state.selected = null;
  saveLocal(false);
}

function dsFitZoom() {
  const scroller = document.getElementById('ds-scroll');
  const state = tabUI('detailed');
  if (!scroller || !scroller.clientWidth) return false;
  const duration = Math.max(60, appState.scenario.storyboard.duration_minutes);
  // Room for a whole card after the last minute: an inject near the end is not cut at the right edge.
  const next = Math.min(SB_ZOOM_MAX, Math.max(SB_ZOOM_MIN, Math.floor(100 * (scroller.clientWidth - sbHeaderWidth() - DS_CARD_WIDTH - 16) / duration) / 100));
  const changed = Math.abs(next - state.zoom) > 0.01;
  state.zoom = next;
  return changed;
}

async function tabHandleAction(event) {
  const element = event.currentTarget;
  const action = element.dataset.tabAction;
  const value = element.dataset.tabValue;
  const project = tabProject();
  const storyboard = project.storyboard;
  const detailed = tabUI('detailed');
  const summary = tabUI('summary');
  const readOnlyAllowed = ['sl-event-focus', 'ds-cell', 'ds-phase', 'ds-deselect', 'su-issue', 'open-detailed'];
  if (sbReadOnly() && !readOnlyAllowed.includes(action)) return;
  try {
    switch (action) {
      case 'open-detailed': {
        const block = sbBlock(storyboard, value);
        appState.route = 'detailed';
        if (block) { detailed.playhead = block.start_minutes; detailed.focusTime = block.start_minutes; }
        break;
      }
      case 'add-cell': {
        const preset = SB_CELL_PRESETS.find((item) => item.key === value);
        const cell = value === 'custom' || !preset ? sbMakeCell('custom', { name: tt(`Cell ${project.cells.length + 1}`, `Cellule ${project.cells.length + 1}`, `Zelle ${project.cells.length + 1}`) }) : sbMakeCell(value, cePresetText(preset));
        StoryboardHistory.track();
        project.cells.push(cell);
        project.exercise.cells_count = project.cells.length;
        StoryboardHistory.commit('Add cell');
        saveLocal(false);
        break;
      }
      case 'delete-cell': {
        const cell = sbCell(project, value);
        if (!cell) return;
        // Injects for several cells lose this one only; those for it alone become unassigned.
        const reached = sbExerciseItems(project).filter((item) => sbRecipientIds(item.cell_id).includes(value));
        const alone = reached.filter((item) => sbRecipientIds(item.cell_id).length === 1).length;
        const effects = [
          alone ? tt(`${alone} become unassigned`, `${alone} n’auront plus de destinataire`, `${alone} werden keiner Zelle mehr zugewiesen`) : '',
          reached.length - alone ? tt(`${reached.length - alone} keep their other recipient cells`, `${reached.length - alone} gardent leurs autres cellules destinataires`, `${reached.length - alone} behalten ihre anderen Empfängerzellen`) : ''
        ].filter(Boolean).join(', ');
        if (!window.confirm(reached.length
          ? tt(`Delete the ${cell.name}? It receives ${reached.length} inject(s): ${effects}.`, `Supprimer la cellule ${cell.name} ? Elle reçoit ${reached.length} inject(s) : ${effects}.`, `Zelle ${cell.name} löschen? Sie erhält ${reached.length} Inject(s): ${effects}.`)
          : tt(`Delete the ${cell.name}?`, `Supprimer la cellule ${cell.name} ?`, `Zelle ${cell.name} löschen?`))) return;
        StoryboardHistory.track();
        project.cells = project.cells.filter((item) => item.id !== value);
        const without = (cellId) => (sbRecipientIds(cellId).includes(value) ? sbJoinRecipients(project, sbRecipientIds(cellId).filter((id) => id !== value)) : cellId);
        storyboard.blocks.forEach((block) => block.beats.forEach((beat) => { beat.cell_id = without(beat.cell_id); }));
        project.stimuli.forEach((stimulus) => { stimulus.cell_id = without(stimulus.cell_id); });
        project.exercise.cells_count = project.cells.length;
        if (detailed.cell === value) { detailed.cell = 'all'; detailed.selected = null; }
        StoryboardHistory.commit('Delete cell');
        saveLocal(false);
        break;
      }
      case 'add-player': {
        // A new player joins the list (and the cell of the group where it was added, if any).
        StoryboardHistory.track();
        const player = sbNormalizePlayer({ id: uid('player') });
        const cell = value ? sbCell(project, value) : null;
        (cell ? cell.players : cePlayerPool(project)).push(player);
        StoryboardHistory.commit('Add player');
        saveLocal(false);
        tabUI('cells').focusPlayer = player.id;
        break;
      }
      case 'delete-player': {
        const entry = ceFindPlayer(project, value);
        if (!entry) break;
        StoryboardHistory.track();
        if (entry.cell) entry.cell.players = entry.cell.players.filter((player) => player.id !== value);
        else project.player_pool = cePlayerPool(project).filter((player) => player.id !== value);
        StoryboardHistory.commit('Delete player');
        saveLocal(false);
        break;
      }
      case 'unassign-player':
        StoryboardHistory.track();
        if (ceMovePlayer(project, value, '')) StoryboardHistory.commit('Remove player from cell');
        saveLocal(false);
        break;
      case 'add-actor': {
        // value: "role:<type>" (built-in group) or "cat:<id>" (a category of the project).
        const [kind, key] = String(value).split(':');
        const category = kind === 'cat' ? ceActorCategories(project).find((item) => item.id === key) : null;
        const role = category ? category.role : sbRoleValue(key || value);
        StoryboardHistory.track();
        const actor = addActor({ role, name: tt(`New ${(category?.label || roleLabel(role)).toLowerCase()}`, `${category?.label || roleLabel(role)} (nouveau)`, `Neu: ${category?.label || roleLabel(role)}`), title: category?.label || roleLabel(role), ...(category ? { category: category.id } : {}) }, false);
        StoryboardHistory.commit('Add actor');
        saveLocal(false);
        if (actor?.id) tabUI('cells').focusActor = actor.id;
        break;
      }
      case 'add-category': {
        StoryboardHistory.track();
        const categories = ceActorCategories(project);
        categories.push({ id: uid('category'), label: tt('New category', 'Nouvelle catégorie', 'Neue Kategorie'), role: 'partner' });
        StoryboardHistory.commit('Add actor category');
        saveLocal(false);
        tabUI('cells').focusCategory = categories[categories.length - 1].id;
        break;
      }
      case 'delete-category':
        StoryboardHistory.track();
        project.actor_categories = ceActorCategories(project).filter((item) => item.id !== value);
        project.actors.forEach((actor) => { if (actor.category === value) delete actor.category; });
        StoryboardHistory.commit('Delete actor category');
        saveLocal(false);
        break;
      case 'unlink-cast': {
        const cast = storyboard.cast.find((item) => item.id === value);
        if (!cast) break;
        cast.actor_id = '';
        StoryboardHistory.commit('Unlink role');
        break;
      }
      case 'create-cast-actor': {
        const cast = storyboard.cast.find((item) => item.id === value);
        if (!cast) break;
        StoryboardHistory.track();
        sbCreateActorForCast(project, cast);
        StoryboardHistory.commit('Create actor for role');
        saveLocal(false);
        break;
      }
      case 'ds-cell':
        detailed.cell = value;
        detailed.selected = null;
        break;
      case 'ds-phase': {
        const block = sbBlock(storyboard, value);
        if (block) { detailed.playhead = block.start_minutes; detailed.focusTime = block.start_minutes; }
        break;
      }
      case 'ds-deselect':
        detailed.selected = null;
        break;
      case 'ds-add':
        dsAddInject(project);
        break;
      case 'sl-event-add': {
        const block = sbBlock(storyboard, value);
        if (!block || block.locked) break;
        const last = (block.events || []).reduce((max, event) => Math.max(max, event.offset_minutes), -5);
        const event = sbMakeEvent({ offset_minutes: Math.min(Math.max(0, block.duration_minutes - 1), last + 5) });
        block.events = [...(block.events || []), event].sort((a, b) => a.offset_minutes - b.offset_minutes);
        StoryboardHistory.commit('Add main event');
        App.render();
        document.querySelector(`[data-sl-event="${event.id}.text"]`)?.focus();
        return;
      }
      case 'sl-event-delete': {
        const found = slFindEvent(storyboard, value);
        if (!found) break;
        found.block.events = found.block.events.filter((event) => event.id !== value);
        StoryboardHistory.commit('Delete main event');
        break;
      }
      case 'sl-event-focus': {
        const found = slFindEvent(storyboard, value);
        if (!found) break;
        sbUI().selected = [found.block.id];
        App.render();
        document.querySelector(`[data-sl-event="${value}.text"]`)?.focus();
        return;
      }
      case 'ds-delete':
        dsDeleteSelected(project);
        break;
      case 'ds-generate':
        sbUI().generate.scope = detailed.cell !== 'all' && sbCell(project, detailed.cell) ? 'cell' : 'all';
        sbUI().generate.cellId = sbCell(project, detailed.cell)?.id || '';
        sbUI().modal = 'generate';
        SbPipeline.log = [];
        break;
      case 'ds-create': {
        const item = dsSelectedItem(project);
        if (item?.kind !== 'beat') break;
        const result = await SbPipeline.run({ blockIds: [item.block.id], beatIds: [item.beat.id], plan: false, cast: true, write: isLLMAvailable() });
        pushToast(result.created
          ? (result.written ? tt('Inject created and written.', 'Inject créé et rédigé.', 'Inject erstellt und geschrieben.') : tt('Inject created.', 'Inject créé.', 'Inject erstellt.'))
          : tt('Nothing created.', 'Rien n’a été créé.', 'Nichts erstellt.'), result.created ? 'success' : 'info');
        break;
      }
      case 'ds-rewrite': {
        const item = dsSelectedItem(project);
        if (!item?.stimulus) break;
        const manual = sbIsManuallyEdited(item.stimulus);
        await SbPipeline.applyImpacts([{ id: 'single', kind: 'outdated', target: 'stimulus', stimulus_id: item.stimulus.id, block_id: item.block?.id, beat_id: item.beat?.id || '', label: item.title, action: manual ? 'adapt' : 'regenerate' }]);
        pushToast(manual ? tt('Inject adapted, keeping your edits.', 'Inject adapté, vos modifications sont conservées.', 'Inject angepasst, Ihre Änderungen bleiben erhalten.') : tt('Inject rewritten.', 'Inject réécrit.', 'Inject neu geschrieben.'), 'success');
        break;
      }
      case 'su-issue': {
        const issue = (summary.liveIssues || summary.review?.issues)?.[Number(value)];
        if (!issue) break;
        appState.route = 'detailed';
        detailed.cell = sbCell(project, issue.cell_id) ? issue.cell_id : 'all';
        detailed.selected = issue.item_key || null;
        if (issue.at !== null && issue.at !== undefined) { detailed.playhead = issue.at; detailed.focusTime = issue.at; }
        break;
      }
      default:
        return;
    }
  } catch (error) {
    pushToast(sbErrorMessage(error), 'error');
  }
  App.render();
}

function tabBindInputs(root) {
  const project = tabProject();
  const storyboard = project.storyboard;
  const detailed = tabUI('detailed');
  const summary = tabUI('summary');
  root.querySelectorAll('[data-tab-action]').forEach((element) => element.addEventListener('click', tabHandleAction));

  root.querySelectorAll('[data-sl-add]').forEach((select) => select.addEventListener('change', () => {
    if (!select.value) return;
    sbUI().ripple = true;
    sbAddBlock(select.value);
  }));

  root.querySelectorAll('[data-sc-duration]').forEach((input) => input.addEventListener('change', () => {
    const minutes = sbParseDuration(input.value);
    // Shorter than the phases: Force duration or Cancel, under the field (Context generation).
    const result = minutes === null ? 'invalid' : cgSetDuration(minutes, project);
    if (result === 'invalid') pushToast(tt('Type the duration as hours:minutes, e.g. 0:45, 1:30 or 3:00.', 'Saisissez la durée en heures:minutes, ex. : 0:45, 1:30 ou 3:00.', 'Geben Sie die Dauer als Stunden:Minuten ein, z. B. 0:45, 1:30 oder 3:00.'), 'warning');
    else if (minutes < 30) pushToast(tt('An exercise lasts at least 30 minutes.', 'Un exercice dure au moins 30 minutes.', 'Eine Übung dauert mindestens 30 Minuten.'), 'info');
    App.render();
  }));
  root.querySelectorAll('[data-sc-cells]').forEach((input) => input.addEventListener('change', () => {
    const count = sbInt(input.value, 0, 0, 20);
    project.exercise.cells_count = count;
    sbSetCellsCount(project, count);
    saveLocal(false);
    App.render();
  }));
  root.querySelectorAll('[data-cx-sector]').forEach((select) => select.addEventListener('change', () => {
    project.client.sector = select.value;
    saveLocal(false);
    App.render();
    if (select.value === 'Other') document.querySelector('[data-cx-sector-other]')?.focus();
  }));
  root.querySelectorAll('[data-cx-sector-other]').forEach((input) => input.addEventListener('change', () => {
    project.client.sector = input.value.trim() || 'Other';
    saveLocal(false);
    App.render();
  }));
  root.querySelectorAll('[data-cx-logo]').forEach((input) => input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { pushToast(tt('Choose an image file for the logo.', 'Choisissez un fichier image pour le logo.', 'Wählen Sie eine Bilddatei für das Logo.'), 'error'); return; }
    if (file.size > 1024 * 1024) { pushToast(tt('Logo too large (max 1 MB).', 'Logo trop volumineux (max. 1 Mo).', 'Logo zu groß (max. 1 MB).'), 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => { project.client.logo_url = String(reader.result || ''); saveLocal(false); App.render(); };
    reader.readAsDataURL(file);
  }));
  root.querySelectorAll('[data-cx-logo-clear]').forEach((button) => button.addEventListener('click', () => {
    project.client.logo_url = '';
    saveLocal(false);
    App.render();
  }));
  root.querySelectorAll('[data-cx-mode]').forEach((select) => select.addEventListener('change', () => { tabUI('context').mode = select.value === 'auto' ? 'auto' : 'agent'; }));
  root.querySelectorAll('[data-cx-library]').forEach((select) => select.addEventListener('change', () => {
    // The generic scenario the AI generation adapts (as chosen in the Project library).
    project.storyboard.meta.library_id = select.value && sbFindTemplate(select.value) ? select.value : '';
    saveLocal(false);
    App.render();
  }));
  root.querySelectorAll('[data-cx-load-basic]').forEach((button) => button.addEventListener('click', () => {
    const template = contextLibraryTemplate(project);
    if (!template || !sbUseTemplate(template, 'replace')) return;
    appState.route = 'storyline';
    pushToast(tt(`"${template.name}" loaded as it is. Refine the phases, then plan and write the injects.`, `« ${template.name} » chargé tel quel. Affinez les phases, puis planifiez et rédigez les injects.`, `„${template.name}“ unverändert geladen. Verfeinern Sie die Phasen, dann planen und schreiben Sie die Injects.`), 'success');
    App.render();
  }));
  root.querySelectorAll('[data-sc-players]').forEach((input) => input.addEventListener('change', () => {
    project.exercise.players_count = input.value === '' ? '' : sbInt(input.value, 0, 0, 10000);
    saveLocal(false);
  }));

  root.querySelectorAll('[data-ce-cell]').forEach((input) => {
    const [cellId, field] = input.dataset.ceCell.split('.');
    input.addEventListener(field === 'color' ? 'change' : 'input', () => {
      const cell = sbCell(project, cellId);
      if (!cell) return;
      cell[field] = field === 'color' ? (/^#[0-9a-f]{6}$/i.test(input.value) ? input.value : cell.color) : sbText(input.value, field === 'name' ? 160 : 1000);
      clearTimeout(window._ceSaveTimer);
      window._ceSaveTimer = setTimeout(() => saveLocal(false), 500);
      if (field === 'color') App.render();
    });
  });
  // Players: edited in the list; a new name, role or email is kept apart from the one the
  // injects show, until Update writes it into them.
  root.querySelectorAll('[data-ce-person]').forEach((input) => {
    const [playerId, field] = input.dataset.cePerson.split('.');
    input.addEventListener('input', () => {
      const entry = ceFindPlayer(project, playerId);
      if (!entry) return;
      ceEditPlayer(entry.player, field, input.value);
      clearTimeout(window._ceSaveTimer);
      window._ceSaveTimer = setTimeout(() => saveLocal(false), 500);
    });
    // The Update count and the cell pickers follow once the field is left.
    input.addEventListener('change', () => { saveLocal(false); App.render(); });
  });
  root.querySelectorAll('[data-ce-assign]').forEach((select) => select.addEventListener('change', () => {
    StoryboardHistory.track();
    if (ceMovePlayer(project, select.dataset.ceAssign, select.value)) StoryboardHistory.commit('Move player');
    saveLocal(false);
    App.render();
  }));
  root.querySelectorAll('[data-ce-cell-add]').forEach((select) => select.addEventListener('change', () => {
    if (!select.value) return;
    StoryboardHistory.track();
    if (ceMovePlayer(project, select.value, select.dataset.ceCellAdd)) StoryboardHistory.commit('Add player to cell');
    saveLocal(false);
    App.render();
  }));
  root.querySelectorAll('[data-ce-category]').forEach((input) => {
    const [categoryId, field] = input.dataset.ceCategory.split('.');
    input.addEventListener('change', () => {
      const category = ceActorCategories(project).find((item) => item.id === categoryId);
      if (!category) return;
      StoryboardHistory.track();
      if (field === 'label') category.label = sbText(input.value, 120) || category.label;
      if (field === 'role') {
        category.role = sbRoleValue(input.value);
        // The actors of the category take its type (channels and tone follow).
        project.actors.forEach((actor) => { if (actor.category === category.id) actor.role = category.role; });
      }
      StoryboardHistory.commit('Edit actor category');
      saveLocal(false);
      App.render();
    });
  });
  root.querySelectorAll('[data-ce-actor-group]').forEach((select) => select.addEventListener('change', () => {
    const actor = getActor(select.dataset.ceActorGroup);
    const [kind, key] = select.value.split(':');
    if (!actor || !key) return;
    StoryboardHistory.track();
    if (kind === 'cat') {
      const category = ceActorCategories(project).find((item) => item.id === key);
      if (category) { actor.category = category.id; actor.role = category.role; }
    } else { delete actor.category; actor.role = sbRoleValue(key); }
    StoryboardHistory.commit('Move actor');
    saveLocal(false);
    App.render();
  }));
  root.querySelectorAll('[data-ce-add-actor]').forEach((select) => select.addEventListener('change', () => {
    if (!select.value) return;
    tabHandleAction({ currentTarget: { dataset: { tabAction: 'add-actor', tabValue: select.value } } });
  }));
  // A row just added: its first field takes the focus.
  const ui = tabUI('cells');
  const focus = ui.focusPlayer ? root.querySelector(`[data-ce-person="${ui.focusPlayer}.name"]`) : ui.focusActor ? root.querySelector(`[data-actor-bind="${ui.focusActor}.name"]`) : ui.focusCategory ? root.querySelector(`[data-ce-category="${ui.focusCategory}.label"]`) : null;
  ui.focusPlayer = ui.focusActor = ui.focusCategory = null;
  if (focus) { focus.focus(); focus.select?.(); }

  // Resolved once per render (bindings are rebuilt at each render), not at every keystroke.
  let selectedItem;
  const selected = () => (selectedItem === undefined ? (selectedItem = dsSelectedItem(project)) : selectedItem);
  root.querySelectorAll('[data-ds-beat]').forEach((input) => {
    const field = input.dataset.dsBeat;
    const isText = field === 'title' || field === 'intent';
    input.addEventListener(isText ? 'input' : 'change', () => {
      const item = selected();
      if (item?.kind !== 'beat') return;
      if (isText) {
        item.beat[field] = sbText(input.value, field === 'title' ? 300 : 2000);
        StoryboardHistory.commit('Edit inject', { debounce: true });
        return;
      }
      if (field === 'channel') { item.beat.channel = sbValidChannel(input.value); item.beat.template_id = ''; }
      else if (field === 'template_id') item.beat.template_id = sbValidTemplateId(item.beat.channel, input.value);
      else if (field === 'cast_id') item.beat.cast_id = storyboard.cast.some((cast) => cast.id === input.value) ? input.value : '';
      else if (field === 'kind') { if (input.checked) item.beat.kind = 'nudge'; else delete item.beat.kind; }
      StoryboardHistory.commit('Edit inject');
      App.render();
    });
    if (isText) input.addEventListener('change', () => StoryboardHistory.flush());
  });
  // Main events, edited in the phase editor of the Main storyline.
  root.querySelectorAll('[data-sl-event]').forEach((input) => {
    const [eventId, field] = input.dataset.slEvent.split('.');
    input.addEventListener(field === 'text' ? 'input' : 'change', () => {
      const found = slFindEvent(storyboard, eventId);
      if (!found || found.block.locked) return;
      if (field === 'text') {
        found.event.text = sbText(input.value, 1000);
        StoryboardHistory.commit('Edit main event', { debounce: true });
        return;
      }
      found.event.offset_minutes = sbInt(input.value, found.event.offset_minutes, 0, Math.max(0, found.block.duration_minutes - 1));
      found.block.events.sort((a, b) => a.offset_minutes - b.offset_minutes);
      StoryboardHistory.commit('Move main event');
      App.render();
    });
    if (field === 'text') input.addEventListener('change', () => { StoryboardHistory.flush(); renderAfterPointer(); });
  });
  root.querySelectorAll('[data-ds-time]').forEach((input) => input.addEventListener('change', () => {
    const item = selected();
    if (!item) return;
    dsMoveItem(project, item, sbInt(input.value, item.time, 0, SB_MAX_DURATION), undefined);
    detailed.playhead = sbInt(input.value, item.time, 0, SB_MAX_DURATION);
    App.render();
  }));
  root.querySelectorAll('[data-rcpt]').forEach((group) => group.addEventListener('change', (event) => applyRecipientChange(project, group, event.target)));
  root.querySelectorAll('[data-ds-stim]').forEach((input) => input.addEventListener('change', () => {
    const item = selected();
    if (item?.kind !== 'stimulus') return;
    const field = input.dataset.dsStim;
    if (field === 'actor_id' && getActor(input.value)) item.stimulus.actor_id = input.value;
    if (field === 'name') item.stimulus.name = sbText(input.value, 500);
    item.stimulus.updated_at = new Date().toISOString();
    saveLocal(false);
    renderAfterPointer();
  }));

}

function dsBindTimeline(root) {
  const project = tabProject();
  const state = tabUI('detailed');
  const scroller = root.querySelector('#ds-scroll');
  if (!scroller) return;
  scroller.scrollLeft = state.scrollLeft || 0;
  scroller.scrollTop = state.scrollTop || 0;
  if (state.focusTime !== null && state.focusTime !== undefined) {
    const left = state.focusTime * state.zoom;
    if (left < scroller.scrollLeft || left > scroller.scrollLeft + scroller.clientWidth - sbHeaderWidth() - 80) scroller.scrollLeft = Math.max(0, left - 60);
    state.focusTime = null;
  }
  state.scrollLeft = scroller.scrollLeft;
  scroller.addEventListener('scroll', () => { state.scrollLeft = scroller.scrollLeft; state.scrollTop = scroller.scrollTop; }, { passive: true });
  scroller.addEventListener('wheel', (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    state.zoom = Math.min(SB_ZOOM_MAX, Math.max(SB_ZOOM_MIN, state.zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15)));
    sbRenderSoon();
  }, { passive: false });

  const scrub = (event) => {
    if (event.button !== 0) return;
    const ruler = root.querySelector('[data-ds-ruler]');
    const playhead = root.querySelector('#ds-playhead');
    if (!ruler || !playhead) return;
    event.preventDefault();
    const update = (clientX) => {
      const minute = Math.max(0, Math.round((clientX - ruler.getBoundingClientRect().left) / state.zoom));
      state.playhead = minute;
      playhead.style.left = `${sbHeaderWidth() + minute * state.zoom}px`;
      const label = playhead.querySelector('[data-ds-playhead]');
      if (label) label.textContent = sbFormatOffset(minute);
    };
    update(event.clientX);
    const move = (moveEvent) => update(moveEvent.clientX);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); App.render(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  root.querySelector('[data-ds-ruler]')?.addEventListener('pointerdown', scrub);
  root.querySelector('[data-ds-playhead]')?.addEventListener('pointerdown', scrub);

  root.querySelectorAll('[data-ds-lane]').forEach((lane) => lane.addEventListener('pointerdown', (event) => {
    if (event.target !== lane || event.button !== 0) return;
    state.playhead = Math.max(0, Math.round((event.clientX - lane.getBoundingClientRect().left) / state.zoom));
    state.selected = null;
    App.render();
  }));

  root.querySelectorAll('[data-ds-item]').forEach((card) => {
    card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.selected = card.dataset.dsItem; App.render(); } });
    card.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const key = card.dataset.dsItem;
      // Double-click (two presses on the same inject): the full inject editor. Detected here:
      // the first click re-renders the card, so the browser never sees a dblclick.
      const now = Date.now();
      if (dsLastPress.key === key && now - dsLastPress.at < 400) {
        dsLastPress = { key: '', at: 0 };
        event.preventDefault();
        openItemEditor(project, key).catch((error) => pushToast(sbErrorMessage(error), 'error')).finally(() => App.render());
        return;
      }
      dsLastPress = { key, at: now };
      state.selected = key;
      if (sbReadOnly()) { App.render(); return; }
      event.preventDefault();
      const item = tabItemByKey(project, key);
      if (!item) return;
      const canvas = card.closest('.ds-canvas');
      const startX = event.clientX;
      const startY = event.clientY;
      const originLeft = parseFloat(card.style.left) || 0;
      // The row it is dragged from: an inject for all cells shows in every cell row.
      const originLane = card.closest('[data-ds-lane]')?.dataset.dsLane || (item.cell_id || 'none');
      let moved = false;
      let lane = null;
      try { card.setPointerCapture(event.pointerId); } catch (_) { /* Older browsers. */ }
      const move = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        if (!moved && Math.abs(dx) < 4 && Math.abs(moveEvent.clientY - startY) < 4) return;
        moved = true;
        document.body.classList.add('sb-dragging');
        const minutes = Math.max(0, sbSnap(item.time + dx / state.zoom));
        const dy = moveEvent.clientY - startY;
        card.style.left = `${minutes * state.zoom}px`;
        card.style.transform = `translateY(${dy}px)`;
        // The dragged card sits under the pointer: the row is what lies beneath it.
        const under = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY).find((node) => !card.contains(node));
        const hovered = under?.closest('[data-ds-lane]');
        canvas.querySelectorAll('.sb-lane.is-drop-target').forEach((node) => node.classList.remove('is-drop-target'));
        lane = hovered ? hovered.dataset.dsLane : null;
        const recipient = dsDropRecipient(project, item, originLane, lane);
        if (hovered && recipient !== undefined) hovered.classList.add('is-drop-target');
        sbDragTip(canvas, `${sbFormatOffset(minutes)}${recipient !== undefined ? ` → ${sbRecipientName(project, recipient) || 'Unassigned'}` : ''}`, sbHeaderWidth() + minutes * state.zoom, card.offsetTop + card.parentElement.offsetTop + dy - 26);
      };
      const up = (upEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.classList.remove('sb-dragging');
        canvas.querySelector('.sb-drag-tip')?.remove();
        if (moved) {
          const minutes = Math.max(0, sbSnap(item.time + (upEvent.clientX - startX) / state.zoom));
          const cell = dsDropRecipient(project, item, originLane, lane);
          if (minutes !== item.time || cell !== undefined) dsMoveItem(project, item, minutes, cell);
          else card.style.left = `${originLeft}px`;
        }
        App.render();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  });
}

let dsLastPress = { key: '', at: 0 };

function bindScenarioTabsEvents() {
  if (!['scenario', 'storyline', 'cells', 'detailed', 'summary'].includes(appState.route)) return;
  document.querySelectorAll('[data-sb-scope]').forEach((root) => { tabBindInputs(root); bindEditorSplitter(root); });
  if (appState.route === 'detailed') {
    const root = document.querySelector('.ds-workspace');
    const state = tabUI('detailed');
    if (root) dsBindTimeline(root);
    if (state.needsFit) {
      state.needsFit = false;
      if (dsFitZoom()) { App.render(); return; }
    }
  }
}

/* Keyboard shortcuts of the Detailed storyline. */
function dsOnKeyDown(event) {
  // Not behind an overlay (settings, launch screen, import): Ctrl+Z would undo unseen edits.
  if (appState.route !== 'detailed' || appState.stimulusModalId || sbUI().modal || appState.settingsDrawerOpen || appState.launchScreenOpen || appState.chronogramImport) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || '') || event.target?.isContentEditable;
  if (typing) return;
  const state = tabUI('detailed');
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (event.key === 'Escape' && state.selected) { state.selected = null; App.render(); return; }
  if (mod && (key === 'z' || key === 'y')) {
    event.preventDefault();
    if (sbReadOnly()) return;
    const label = key === 'y' || event.shiftKey ? StoryboardHistory.redo() : StoryboardHistory.undo();
    if (label) pushToast(key === 'y' || event.shiftKey ? tt(`Redone: ${label}`, `Rétabli : ${sbHistoryLabel(label)}`, `Wiederholt: ${sbHistoryLabel(label)}`) : tt(`Undone: ${label}`, `Annulé : ${sbHistoryLabel(label)}`, `Rückgängig gemacht: ${sbHistoryLabel(label)}`), 'info');
    App.render();
    return;
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && state.selected && !sbReadOnly()) {
    event.preventDefault();
    dsDeleteSelected(tabProject());
    App.render();
  }
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('keydown', dsOnKeyDown);

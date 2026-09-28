/* Guided exercise workflow tabs: Main storyline, Cells & actors, Detailed storyline
   and Summary. They share the storyboard engine (scenario-*.js); every detail editor
   opens at the bottom of the screen. */
const DS_CARD_WIDTH = 168;
const DS_ROW_HEIGHT = 46;
const SU_SPEEDS = [30, 60, 180, 600];
const CE_ACTOR_GROUPS = [
  ['attacker', 'Attackers'], ['journalist', 'Press & media'], ['authority', 'Authorities & regulators'],
  ['client_b2b', 'Business customers'], ['client_b2c', 'Consumers'], ['partner', 'Partners & suppliers'],
  ['analyst', 'Experts & analysts'], ['internal', 'Internal senders (simulated)']
];

function tabUI(name) {
  const ui = sbUI();
  if (!ui.tabs) ui.tabs = {};
  if (!ui.tabs[name]) {
    ui.tabs[name] = {
      detailed: { cell: 'all', selected: null, zoom: null, needsFit: true, scrollLeft: 0, scrollTop: 0, playhead: 0, planCount: 3, focusTime: null },
      summary: { time: 0, speed: 60, playing: false, preview: null, review: null },
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
    const stages = Object.entries(SB_BLOCK_TYPES).filter(([key]) => !['crisis_cell', 'communication', 'legal', 'hr', 'logistics', 'customers'].includes(key));
    return `<section class="sb-workspace sl-workspace ${readOnly ? 'is-readonly' : ''} ${sbCompact() ? 'is-compact' : ''}" data-sb-scope aria-label="Main storyline">
      <header class="sb-toolbar">
        <div class="sb-tb-title"><span class="sb-eyebrow">Main storyline</span><div class="sb-tb-name-row"><strong class="sb-tb-name">${escapeHtml(project.name || 'Untitled scenario')}</strong><span class="sb-chip sb-chip-rev">rev ${storyboard.rev}</span></div></div>
        <div class="sb-tb-group">
          <button class="sb-tool" data-sb-action="undo" ${StoryboardHistory.canUndo() ? '' : 'disabled'} title="Undo (Ctrl+Z)">${sbUiIcon('undo')}</button>
          <button class="sb-tool" data-sb-action="redo" ${StoryboardHistory.canRedo() ? '' : 'disabled'} title="Redo (Ctrl+Shift+Z)">${sbUiIcon('redo')}</button>
          <button class="sb-tool sb-tool-label" data-sb-action="open-modal" data-sb-modal="versions" title="Versions">${sbUiIcon('history')}<span>Versions</span></button>
        </div>
        <div class="sb-tb-group">
          <label class="sl-add">${sbUiIcon('plus', 14)}<select data-sl-add ${readOnly ? 'disabled' : ''} aria-label="Add a phase"><option value="">Add phase…</option>${stages.map(([key, type]) => `<option value="${key}">${escapeHtml(type.label)}</option>`).join('')}</select></label>
          <button class="sb-tool sb-tool-label" data-sb-action="deepen-all" ${ai && storyboard.blocks.length && !readOnly ? '' : 'disabled'} title="Write the details of every phase with AI">${sbUiIcon('layers')}<span>Detail with AI</span></button>
          <button class="sb-tool sb-tool-label" data-route="scenario" title="Start again from the library or an AI draft">${sbUiIcon('wand')}<span>Start from…</span></button>
        </div>
      </header>
      ${renderSbStatusBar()}
      <div class="sl-timeline">${storyboard.blocks.length ? renderSbTimeline(storyboard) : tabEmptyNote('No phase yet. Pick a scenario in the library, draft one with AI, or add a phase above.', 'scenario', 'Scenario & context')}</div>
      <section class="bottom-editor sl-editor" aria-label="Phase editor">
        ${block ? renderPhaseEditor(storyboard, block) : `<div class="bottom-editor-empty">${sbUiIcon('layers', 18)}<span>Select a phase on the timeline to edit what happens. Drag its edges to change its duration; the following phases follow (ripple).</span></div>`}
      </section>
      ${renderSbModal(storyboard)}
    </section>`;
  });
}

function renderPhaseEditor(storyboard, block) {
  const project = appState.scenario;
  const readOnly = sbReadOnly() || block.locked ? 'disabled' : '';
  const ui = sbUI();
  const objectives = sbObjectivesList(project);
  const counts = new Map();
  block.beats.forEach((beat) => counts.set(beat.cell_id, (counts.get(beat.cell_id) || 0) + 1));
  const ai = isLLMAvailable();
  return `<div class="bottom-editor-head" style="--clip-color:${sbBlockColor(block, storyboard)}">
      <span class="sb-clip-icon">${sbIcon((SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom).icon, 16)}</span>
      <input class="be-title" data-sb-field="title" value="${escapeAttribute(block.title)}" aria-label="Phase title" ${readOnly}>
      <select data-sb-field="type" aria-label="Phase type" ${readOnly}>${Object.entries(SB_BLOCK_TYPES).map(([key, value]) => sbOption(key, value.label, block.type)).join('')}</select>
      <label class="be-inline">Start · ${sbFormatOffset(block.start_minutes)}<input type="number" min="0" step="5" data-sb-field="start_minutes" value="${block.start_minutes}" ${readOnly}></label>
      <label class="be-inline">Duration (min)<input type="number" min="5" step="5" data-sb-field="duration_minutes" value="${block.duration_minutes}" ${readOnly}></label>
      <span class="be-actions">
        <button class="sb-icon-btn ${block.locked ? 'is-on' : ''}" data-sb-action="toggle-lock" title="${block.locked ? 'Unlock' : 'Lock'}" ${sbReadOnly() ? 'disabled' : ''}>${sbUiIcon(block.locked ? 'lock' : 'unlock', 15)}</button>
        <button class="sb-icon-btn" data-sb-action="duplicate-block" title="Duplicate" ${sbReadOnly() ? 'disabled' : ''}>${sbUiIcon('copy', 15)}</button>
        <button class="sb-icon-btn is-danger" data-sb-action="delete-block" title="Delete" ${readOnly}>${sbUiIcon('trash', 15)}</button>
        <button class="sb-icon-btn" data-sb-action="deselect" title="Close (Esc)">${sbUiIcon('close', 15)}</button>
      </span>
    </div>
    <div class="bottom-editor-body sl-editor-body">
      <label class="sb-mini-field sl-what">What happens during this phase
        <textarea data-sb-field="brief" rows="4" placeholder="${escapeAttribute((SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom).hint)}" ${readOnly}>${escapeHtml(block.brief)}</textarea>
      </label>
      <div class="sl-side">
        ${objectives.length ? `<div class="sb-mini-field">Objectives tested<div class="chip-toggles">${objectives.map((objective) => `<label class="chip-toggle"><input type="checkbox" data-sb-objective="${escapeAttribute(objective)}" ${block.objectives.includes(objective) ? 'checked' : ''} ${readOnly}><span>${escapeHtml(objective)}</span></label>`).join('')}</div></div>` : ''}
        <div class="sl-injects">${block.beats.length ? `<b>${block.beats.length}</b> injects planned · ${(project.cells || []).filter((cell) => counts.get(cell.id)).map((cell) => `<span class="cell-dot" style="--cell-color:${cell.color}"></span>${escapeHtml(cell.name)} ${counts.get(cell.id)}`).join(' · ')}` : 'No inject planned in this phase yet.'} <button class="btn btn-ghost btn-xs" data-tab-action="open-detailed" data-tab-value="${block.id}">Detailed storyline →</button></div>
        <details class="sl-details"><summary>Details: hidden story, dilemmas, notes</summary>
          <textarea data-sb-field="narrative" rows="4" placeholder="What really happens, what players know and do not know, decisions and dilemmas" ${readOnly}>${escapeHtml(block.narrative)}</textarea>
          <textarea data-sb-field="notes" rows="2" placeholder="Facilitation notes" ${readOnly}>${escapeHtml(block.notes)}</textarea>
        </details>
        <div class="sl-ai">
          <input type="text" data-sb-ui="rewrite" value="${escapeAttribute(ui.rewrite)}" placeholder="Ask the AI: e.g. make it more ambiguous, add a regulator deadline…" ${readOnly}>
          <button class="btn btn-secondary btn-sm" data-sb-action="rewrite-block" ${ai && !readOnly ? '' : 'disabled'}>${sbUiIcon('wand', 13)} Rewrite</button>
          <button class="btn btn-secondary btn-sm" data-sb-action="deepen-block" data-sb-level="2" ${ai && !readOnly ? '' : 'disabled'}>Detail</button>
        </div>
      </div>
    </div>`;
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
    const actorsPlaceholder = 'Ex: "Journalists from a national daily and a TV channel, the national cyber agency, the data protection authority, an angry B2C customer on social media and the ransomware group."';
    return `<section class="tab-page ce-page" data-sb-scope>
      <article class="card">
        <div class="section-header">
          <div><h3>Player cells</h3><p class="subtle">Groups of participants who receive injects. ${players} player(s) listed${project.exercise.players_count ? ` of ${escapeHtml(project.exercise.players_count)} expected` : ''}.</p></div>
          <div class="actions">
            ${missingPresets.map((preset) => `<button class="btn btn-ghost btn-xs" data-tab-action="add-cell" data-tab-value="${preset.key}" title="${escapeAttribute(preset.description)}">+ ${escapeHtml(preset.name)}</button>`).join('')}
            <button class="btn btn-primary btn-sm" data-tab-action="add-cell" data-tab-value="custom">${sbUiIcon('plus', 13)} New cell</button>
          </div>
        </div>
        <div class="ce-grid">
          ${project.cells.map((cell) => {
            const count = items.filter((item) => item.cell_id === cell.id).length;
            return `<div class="ce-cell" style="--cell-color:${cell.color}">
              <div class="ce-cell-head">
                <input type="color" data-ce-cell="${cell.id}.color" value="${cell.color}" aria-label="Cell colour">
                <input type="text" class="ce-cell-name" data-ce-cell="${cell.id}.name" value="${escapeAttribute(cell.name)}" aria-label="Cell name">
                <span class="sb-chip">${count} inject(s)</span>
                <button class="sb-icon-btn is-danger" data-tab-action="delete-cell" data-tab-value="${cell.id}" title="Delete cell">${sbUiIcon('trash', 14)}</button>
              </div>
              <textarea data-ce-cell="${cell.id}.description" rows="2" placeholder="Mission of this cell">${escapeHtml(cell.description)}</textarea>
              <table class="ce-players">
                <thead><tr><th>Player</th><th>Role</th><th>Email</th><th></th></tr></thead>
                <tbody>${cell.players.map((player) => `<tr>
                  <td><input type="text" data-ce-player="${cell.id}.${player.id}.name" value="${escapeAttribute(player.name)}" placeholder="Name"></td>
                  <td><input type="text" data-ce-player="${cell.id}.${player.id}.role" value="${escapeAttribute(player.role)}" placeholder="Role"></td>
                  <td><input type="text" data-ce-player="${cell.id}.${player.id}.email" value="${escapeAttribute(player.email)}" placeholder="Email"></td>
                  <td><button class="sb-icon-btn" data-tab-action="delete-player" data-tab-value="${cell.id}.${player.id}" title="Remove">${sbUiIcon('close', 13)}</button></td>
                </tr>`).join('')}</tbody>
              </table>
              <button class="btn btn-ghost btn-xs" data-tab-action="add-player" data-tab-value="${cell.id}">${sbUiIcon('plus', 12)} Player</button>
            </div>`;
          }).join('') || '<p class="sb-empty">No cell yet. Add the cells playing the exercise (for example decision, operational and communication cells).</p>'}
        </div>
      </article>
      <article class="card">
        <div class="section-header">
          <div><h3>Simulated actors</h3><p class="subtle">People and organisations outside the exercise who send the injects, grouped by type.</p></div>
        </div>
        ${renderLLMConfigBlock('actors', actorsPlaceholder)}
        <div class="ce-groups">
          ${CE_ACTOR_GROUPS.map(([role, label]) => {
            const actors = project.actors.filter((actor) => actor.role === role);
            return `<div class="ce-group">
              <div class="ce-group-head"><strong>${escapeHtml(label)}</strong><span class="sb-chip">${actors.length}</span><button class="btn btn-ghost btn-xs" data-tab-action="add-actor" data-tab-value="${role}">${sbUiIcon('plus', 12)} Add</button></div>
              ${actors.map((actor) => `<div class="ce-actor">
                <input type="text" data-actor-bind="${escapeAttribute(actor.id)}.name" value="${escapeAttribute(actor.name)}" aria-label="Name" placeholder="Name">
                <input type="text" data-actor-bind="${escapeAttribute(actor.id)}.title" value="${escapeAttribute(actor.title)}" aria-label="Title" placeholder="Title">
                <input type="text" data-actor-bind="${escapeAttribute(actor.id)}.organization" value="${escapeAttribute(actor.organization)}" aria-label="Organisation" placeholder="Organisation">
                <select data-actor-bind="${escapeAttribute(actor.id)}.role" aria-label="Group">${ROLES.map((item) => sbOption(item.value, roleLabel(item.value), actor.role)).join('')}</select>
                <select data-actor-bind="${escapeAttribute(actor.id)}.language" aria-label="Language">${LANGUAGES.map((item) => sbOption(item.value, item.label, actor.language || 'en')).join('')}</select>
                <button class="sb-icon-btn is-danger" data-action="delete-actor" data-actor-id="${escapeAttribute(actor.id)}" title="Delete">${sbUiIcon('trash', 13)}</button>
              </div>`).join('') || '<p class="sb-empty">None.</p>'}
            </div>`;
          }).join('')}
        </div>
      </article>
      <article class="card">
        <div class="section-header"><div><h3>Storyline roles</h3><p class="subtle">Roles used as senders in the storyline, and the actor who plays each of them.</p></div></div>
        <div class="ce-roles">${renderSbCast(storyboard)}</div>
      </article>
    </section>`;
  });
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
    items.forEach((item) => counts.set(item.cell_id || 'none', (counts.get(item.cell_id || 'none') || 0) + 1));
    const cellScope = state.cell !== 'all' && state.cell !== 'none' ? sbCell(project, state.cell) : null;
    const missing = items.filter((item) => item.kind === 'beat' && !item.stimulus && (!cellScope || item.cell_id === cellScope.id)).length;
    return `<section class="sb-workspace ds-workspace ${readOnly ? 'is-readonly' : ''} ${sbCompact() ? 'is-compact' : ''}" data-sb-scope aria-label="Detailed storyline">
      <header class="sb-toolbar ds-toolbar">
        <div class="sb-tb-title"><span class="sb-eyebrow">Detailed storyline</span><div class="sb-tb-name-row"><strong class="sb-tb-name">${escapeHtml(project.name || 'Untitled scenario')}</strong></div></div>
        <div class="ds-cells" role="tablist" aria-label="Cells">
          <button class="ds-cell-chip ${state.cell === 'all' ? 'active' : ''}" data-tab-action="ds-cell" data-tab-value="all">All cells <b>${items.length}</b></button>
          ${project.cells.map((cell) => `<button class="ds-cell-chip ${state.cell === cell.id ? 'active' : ''}" style="--cell-color:${cell.color}" data-tab-action="ds-cell" data-tab-value="${cell.id}"><i></i>${escapeHtml(cell.name)} <b>${counts.get(cell.id) || 0}</b></button>`).join('')}
          ${counts.get('none') ? `<button class="ds-cell-chip ${state.cell === 'none' ? 'active' : ''}" data-tab-action="ds-cell" data-tab-value="none">Unassigned <b>${counts.get('none')}</b></button>` : ''}
          <button class="ds-cell-chip is-add" data-route="cells" title="Manage cells">+ Cell</button>
        </div>
        <div class="sb-tb-group">
          <button class="sb-tool" data-sb-action="undo" ${StoryboardHistory.canUndo() ? '' : 'disabled'} title="Undo (Ctrl+Z)">${sbUiIcon('undo')}</button>
          <button class="sb-tool" data-sb-action="redo" ${StoryboardHistory.canRedo() ? '' : 'disabled'} title="Redo (Ctrl+Shift+Z)">${sbUiIcon('redo')}</button>
        </div>
        <div class="sb-tb-group">
          <button class="sb-tool sb-tool-label" data-tab-action="ds-add" ${readOnly || !storyboard.blocks.length ? 'disabled' : ''} title="Add an inject at the playhead">${sbUiIcon('plus')}<span>Inject</span></button>
          <span class="ds-plan"><input type="number" min="1" max="10" data-tab-ui="planCount" value="${state.planCount}" aria-label="Number of injects to plan" ${cellScope ? '' : 'disabled'}><button class="sb-tool sb-tool-label" data-tab-action="ds-plan" ${ai && cellScope && !readOnly ? '' : 'disabled'} title="${cellScope ? `Plan injects for the ${escapeAttribute(cellScope.name)} in the phase at the playhead` : 'Select a cell first'}">${sbUiIcon('wand')}<span>Plan with AI</span></button></span>
        </div>
        <div class="sb-tb-group sb-tb-output">
          <button class="sb-tool sb-tool-label" data-sb-action="open-modal" data-sb-modal="sync" title="Propagate storyline changes">${sbUiIcon('sync')}<span>Sync</span>${pending ? `<span class="sb-count">${pending}</span>` : ''}</button>
          <button class="btn btn-primary btn-sm" data-tab-action="ds-generate" ${readOnly ? 'disabled' : ''}>${sbUiIcon('play', 13)} Generate${missing ? ` <span class="sb-count sb-count-light">${missing}</span>` : ''}</button>
        </div>
      </header>
      ${renderSbStatusBar()}
      <div class="ds-timeline">${storyboard.blocks.length || items.length ? renderDetailedTimeline(project, items) : tabEmptyNote('Build the main storyline first: its phases frame the injects of every cell.', 'storyline', 'Main storyline')}</div>
      <section class="bottom-editor ds-editor" aria-label="Inject editor">${selected ? renderInjectEditor(project, selected) : `<div class="bottom-editor-empty">${sbUiIcon('play', 18)}<span>Select an inject to edit it. Drag it to change its time, or to another cell row to change its recipient. ${cellScope ? `“+ Inject” adds one for the ${escapeHtml(cellScope.name)} at the playhead.` : 'Pick a cell above to focus on its injects.'}</span></div>`}</section>
      ${renderSbModal(storyboard)}
    </section>`;
  });
}

function dsRows(project, items) {
  const state = tabUI('detailed');
  if (state.cell === 'none') return [{ id: 'none', name: 'Unassigned', color: '#6d687e' }];
  if (state.cell !== 'all') return project.cells.filter((cell) => cell.id === state.cell);
  const rows = [...project.cells];
  if (items.some((item) => !item.cell_id || !sbCell(project, item.cell_id))) rows.push({ id: 'none', name: 'Unassigned', color: '#6d687e' });
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
        <div class="sb-corner"><span>Cells</span><small>${rows.length}</small></div>
        <div class="sb-ruler" data-ds-ruler style="width:${width}px">${renderSbRuler({ duration_minutes: duration }, ppm)}</div>
      </div>
      <div class="sb-track-row ds-phase-row is-main">
        <div class="sb-track-head"><strong>Main storyline</strong><small>${phases.length} phases</small></div>
        <div class="sb-lane ds-phase-lane" style="width:${width}px">
          ${phases.map((block) => `<button class="ds-phase" data-tab-action="ds-phase" data-tab-value="${block.id}" style="left:${block.start_minutes * ppm}px;width:${Math.max(4, block.duration_minutes * ppm - 2)}px;--clip-color:${sbBlockColor(block, storyboard)}" title="${escapeAttribute(`${sbFormatOffset(block.start_minutes)} · ${block.title}: ${block.brief}`)}"><strong>${escapeHtml(block.title)}</strong><span>${escapeHtml(block.brief)}</span></button>`).join('')}
        </div>
      </div>
      ${rows.map((row) => renderDetailedRow(project, row, items.filter((item) => (row.id === 'none' ? !item.cell_id || !sbCell(project, item.cell_id) : item.cell_id === row.id)), width, ppm)).join('')}
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
    <div class="sb-track-head" style="height:${height}px"><strong>${escapeHtml(row.name)}</strong><small>${items.length} inject(s)${row.players ? ` · ${players} player(s)` : ''}</small></div>
    <div class="sb-lane" data-ds-lane="${escapeAttribute(row.id)}" style="width:${width}px;height:${height}px">
      ${items.map((item) => {
        const color = sbChannelColor(item.channel);
        return `<div class="ds-card is-${item.status} ${state.selected === item.key ? 'is-selected' : ''}" data-ds-item="${escapeAttribute(item.key)}" tabindex="0" role="button" style="left:${(item.time * ppm).toFixed(1)}px;top:${packing.placement.get(item.key) * DS_ROW_HEIGHT + 6}px;width:${DS_CARD_WIDTH}px;--beat-color:${color}" title="${escapeAttribute(`${sbFormatOffset(item.time)} · ${channelLabel(item.channel)} · ${item.sender || 'no sender'}\n${item.title}\n${item.intent || ''}`)}">
          <span class="ds-card-meta"><i></i>${sbFormatOffset(item.time)} · ${escapeHtml(channelLabel(item.channel))}</span>
          <strong>${escapeHtml(item.title)}</strong>
        </div>`;
      }).join('')}
      ${!items.length ? '<span class="sb-lane-hint">No inject for this cell yet</span>' : ''}
    </div>
  </div>`;
}

function renderInjectEditor(project, item) {
  const storyboard = project.storyboard;
  const readOnly = sbReadOnly() ? 'disabled' : '';
  const ai = isLLMAvailable();
  const status = item.stimulus ? sbStimulusStatus(project, item.stimulus) : null;
  const phase = sbMainBlockAt(storyboard, item.time);
  const cellSelect = `<select data-ds-cell aria-label="Recipient cell" ${readOnly}>${sbOption('', 'Unassigned', item.cell_id)}${project.cells.map((cell) => sbOption(cell.id, cell.name, item.cell_id)).join('')}</select>`;
  const head = `<div class="bottom-editor-head" style="--clip-color:${sbChannelColor(item.channel)}">
      <span class="sb-status is-${item.status}">${escapeHtml(status?.label || (item.kind === 'beat' ? 'Planned' : 'Manual'))}</span>
      <label class="be-inline">Time (min) · ${sbFormatOffset(item.time)}<input type="number" min="0" step="1" data-ds-time value="${item.time}" ${readOnly}></label>
      <span class="be-phase">Phase: <b>${escapeHtml(phase?.title || '-')}</b></span>
      <label class="be-inline">To ${cellSelect}</label>
      <span class="be-actions">
        ${item.stimulus ? `<button class="btn btn-secondary btn-sm" data-sb-action="open-stimulus" data-sb-stimulus="${escapeAttribute(item.stimulus.id)}">${sbUiIcon('open', 13)} Full editor</button>` : ''}
        ${item.stimulus?.scenario_link ? `<button class="sb-icon-btn ${item.stimulus.scenario_link.locked ? 'is-on' : ''}" data-sb-action="lock-stimulus" data-sb-stimulus="${escapeAttribute(item.stimulus.id)}" title="${item.stimulus.scenario_link.locked ? 'Unlock' : 'Lock: never modified by sync'}" ${readOnly}>${sbUiIcon(item.stimulus.scenario_link.locked ? 'lock' : 'unlock', 15)}</button>` : ''}
        <button class="sb-icon-btn is-danger" data-tab-action="ds-delete" title="Delete (Del)" ${readOnly}>${sbUiIcon('trash', 15)}</button>
        <button class="sb-icon-btn" data-tab-action="ds-deselect" title="Close (Esc)">${sbUiIcon('close', 15)}</button>
      </span>
    </div>`;
  if (item.kind === 'beat') {
    const beat = item.beat;
    const templates = beat.channel === 'article_press' ? Object.entries(ARTICLE_TEMPLATE_LIBRARY) : beat.channel === 'breaking_news_tv' ? Object.entries(TV_TEMPLATE_LIBRARY) : [];
    return `${head}
      <div class="bottom-editor-body ds-editor-body">
        <div class="ds-fields">
          <label class="sb-mini-field">Channel<select data-ds-beat="channel" ${readOnly}>${Object.keys(TEMPLATE_LIBRARY).map((channel) => sbOption(channel, channelLabel(channel), beat.channel)).join('')}</select></label>
          ${templates.length ? `<label class="sb-mini-field">Outlet<select data-ds-beat="template_id" ${readOnly}>${sbOption('', 'Default', beat.template_id)}${templates.map(([key, value]) => sbOption(key, value.label || key, beat.template_id)).join('')}</select></label>` : ''}
          <label class="sb-mini-field">From<select data-ds-beat="cast_id" ${readOnly}>${sbOption('', '- Sender role -', beat.cast_id)}${storyboard.cast.map((cast) => sbOption(cast.id, `${cast.label}${cast.actor_id && getActor(cast.actor_id) ? ` (${getActor(cast.actor_id).name})` : ''}`, beat.cast_id)).join('')}</select></label>
          <label class="sb-mini-field ds-title">Title<input type="text" data-ds-beat="title" value="${escapeAttribute(beat.title)}" placeholder="Inject title" ${readOnly}></label>
        </div>
        <label class="sb-mini-field ds-intent">What it says and the reaction or decision it should trigger
          <textarea data-ds-beat="intent" rows="3" ${readOnly}>${escapeHtml(beat.intent)}</textarea>
        </label>
        <div class="ds-editor-actions">
          ${item.stimulus
            ? `<button class="btn btn-secondary btn-sm" data-tab-action="ds-rewrite" ${ai && !readOnly ? '' : 'disabled'} title="${status?.manual ? 'Adapts the content, keeping your manual edits' : 'Rewrites the content from the plan'}">${sbUiIcon('wand', 13)} ${status?.manual ? 'Adapt with AI' : 'Rewrite with AI'}</button>`
            : `<button class="btn btn-primary btn-sm" data-tab-action="ds-create" ${readOnly}>${sbUiIcon('play', 13)} ${ai ? 'Create and write with AI' : 'Create inject'}</button>`}
        </div>
      </div>`;
  }
  const stimulus = item.stimulus;
  return `${head}
    <div class="bottom-editor-body ds-editor-body">
      <div class="ds-fields">
        <label class="sb-mini-field">Channel<input type="text" value="${escapeAttribute(channelLabel(stimulus.channel))}" disabled></label>
        <label class="sb-mini-field">From<select data-ds-stim="actor_id" ${readOnly}>${project.actors.map((actor) => sbOption(actor.id, `${actor.name} · ${roleLabel(actor.role)}`, stimulus.actor_id)).join('')}</select></label>
        <label class="sb-mini-field ds-title">Title<input type="text" data-ds-stim="name" value="${escapeAttribute(stimulus.name || '')}" placeholder="${escapeAttribute(sbStimulusLabel(stimulus))}" ${readOnly}></label>
      </div>
      <p class="sb-help">This inject is not part of the storyline plan (created by hand, imported or orphan). It keeps its content; edit it in the full editor.</p>
    </div>`;
}

// ═══ Summary ═════════════════════════════════════════════════════════════════
function renderSummaryView() {
  return sbWithRenderMemo(() => {
    const project = tabProject();
    const storyboard = project.storyboard;
    const state = tabUI('summary');
    const items = sbExerciseItems(project);
    const phases = sbMainBlocks(storyboard);
    const duration = Math.max(storyboard.duration_minutes, ...items.map((item) => item.time));
    state.time = Math.min(Math.max(0, state.time), duration);
    const generated = items.filter((item) => item.stimulus).length;
    const players = project.cells.reduce((sum, cell) => sum + cell.players.length, 0);
    const kpi = (value, label) => `<div class="su-kpi"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`;
    return `<section class="tab-page su-page" data-sb-scope>
      ${renderSbStatusBar()}
      <div class="su-kpis">
        ${kpi(escapeHtml(sbFormatDuration(duration)), 'Duration')}
        ${kpi(phases.length, 'Phases')}
        ${kpi(`${generated}<small>/${items.length}</small>`, 'Injects written')}
        ${kpi(project.cells.length, 'Cells')}
        ${kpi(players || escapeHtml(project.exercise.players_count || 0), 'Players')}
        ${kpi(project.actors.length, 'Actors')}
      </div>
      <article class="card">
        <div class="section-header"><div><h3>Overview</h3><p class="subtle">Phases, and injects received by each cell in each phase.</p></div></div>
        ${renderSummaryOverview(project, items, phases, duration)}
      </article>
      <article class="card su-play" data-su-play>
        <div class="section-header">
          <div><h3>Play the exercise</h3><p class="subtle">Injects reach each cell as time passes. Click one to preview it.</p></div>
          <div class="su-controls">
            <button class="btn btn-primary btn-sm" data-tab-action="su-toggle">${state.playing ? `${sbUiIcon('stop', 13)} Pause` : `${sbUiIcon('play', 13)} Play`}</button>
            <button class="btn btn-secondary btn-sm" data-tab-action="su-restart" title="Back to the start">${sbUiIcon('undo', 13)}</button>
            <select data-su-speed aria-label="Speed">${SU_SPEEDS.map((speed) => sbOption(speed, `×${speed}`, state.speed)).join('')}</select>
            <span class="su-time" data-su-time>${sbFormatOffset(state.time)}</span>
          </div>
        </div>
        <input type="range" class="su-scrub" min="0" max="${duration}" step="1" value="${Math.round(state.time)}" data-su-scrub aria-label="Exercise time">
        <div class="su-phase-now" data-su-phase>${escapeHtml(sbMainBlockAt(storyboard, state.time)?.title || '')}</div>
        <div class="su-columns" data-su-columns>${renderSummaryColumns(project, items)}</div>
        <div class="su-preview" data-su-preview>${renderSummaryPreview(project, items)}</div>
      </article>
      <article class="card">
        <div class="section-header">
          <div><h3>Review</h3><p class="subtle">Rhythm per cell, dead times, overloads and inconsistencies.</p></div>
          <div class="actions">
            <button class="btn btn-secondary btn-sm" data-tab-action="su-checks">Run checks</button>
            <button class="btn btn-primary btn-sm" data-tab-action="su-ai" ${isLLMAvailable() && !sbBusy() ? '' : 'disabled'}>${sbUiIcon('wand', 13)} Check with AI</button>
          </div>
        </div>
        ${renderSummaryReview(project)}
      </article>
    </section>`;
  });
}

function renderSummaryOverview(project, items, phases, duration) {
  const rows = [...project.cells];
  if (items.some((item) => !sbCell(project, item.cell_id))) rows.push({ id: 'none', name: 'Unassigned', color: '#6d687e' });
  const inPhase = (item, block) => item.time >= block.start_minutes && item.time < sbBlockEnd(block);
  const max = Math.max(1, ...rows.flatMap((row) => phases.map((block) => items.filter((item) => (row.id === 'none' ? !sbCell(project, item.cell_id) : item.cell_id === row.id) && inPhase(item, block)).length)));
  const buckets = Math.max(1, Math.ceil(duration / 30));
  return `<div class="su-band">${phases.map((block) => `<span style="flex:${block.duration_minutes};--clip-color:${sbBlockColor(block, project.storyboard)}" title="${escapeAttribute(`${sbFormatOffset(block.start_minutes)} · ${block.title}`)}">${escapeHtml(block.title)}</span>`).join('') || '<span class="sb-empty">No phase</span>'}</div>
    <div class="su-heat-wrap"><table class="su-heat">
      <thead><tr><th>Cell</th>${phases.map((block) => `<th title="${escapeAttribute(block.title)}">${escapeHtml(sbFormatOffset(block.start_minutes))}</th>`).join('')}<th>Total</th><th>Load (per 30 min)</th></tr></thead>
      <tbody>${rows.map((row) => {
        const own = items.filter((item) => (row.id === 'none' ? !sbCell(project, item.cell_id) : item.cell_id === row.id));
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

function renderSummaryColumns(project, items) {
  const state = tabUI('summary');
  const rows = [...project.cells];
  if (items.some((item) => !sbCell(project, item.cell_id))) rows.push({ id: 'none', name: 'Unassigned', color: '#6d687e' });
  if (!rows.length) return '<p class="sb-empty">No cell yet.</p>';
  return rows.map((row) => {
    const own = items.filter((item) => (row.id === 'none' ? !sbCell(project, item.cell_id) : item.cell_id === row.id) && item.time <= state.time).reverse();
    return `<div class="su-col" style="--cell-color:${row.color}">
      <div class="su-col-head"><span class="cell-dot"></span>${escapeHtml(row.name)}<b>${own.length}</b></div>
      <ol>${own.slice(0, 30).map((item) => `<li class="${state.time - item.time < 3 ? 'is-new' : ''} ${state.preview === item.key ? 'is-selected' : ''}" data-su-item="${escapeAttribute(item.key)}" style="--beat-color:${sbChannelColor(item.channel)}"><span>${sbFormatOffset(item.time)} · ${escapeHtml(channelLabel(item.channel))}</span><strong>${escapeHtml(item.title)}</strong></li>`).join('') || '<li class="is-waiting">Waiting…</li>'}</ol>
    </div>`;
  }).join('');
}

function renderSummaryPreview(project, items) {
  const state = tabUI('summary');
  const item = items.find((entry) => entry.key === state.preview);
  if (!item) return '';
  const cell = sbCell(project, item.cell_id);
  return `<div class="su-preview-head"><strong>${escapeHtml(item.title)}</strong><span>${sbFormatOffset(item.time)} · ${escapeHtml(channelLabel(item.channel))} · from ${escapeHtml(item.sender || '-')} · to ${escapeHtml(cell?.name || 'unassigned')}</span><button class="btn btn-ghost btn-xs" data-tab-action="su-goto" data-tab-value="${escapeAttribute(item.key)}">Edit →</button></div>
    ${item.stimulus ? `<div class="su-preview-render">${renderStimulusPreview(item.stimulus, `su-preview-${item.stimulus.id}`)}</div>` : `<p class="sb-help">Planned, not written yet: ${escapeHtml(item.intent || '')}</p>`}`;
}

function renderSummaryReview(project) {
  const review = tabUI('summary').review;
  if (!review) return '<p class="sb-empty">Run the checks to review the rhythm and consistency of the exercise.</p>';
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
      <span>${issue.at !== null && issue.at !== undefined ? `<b>${sbFormatOffset(issue.at)}</b> ` : ''}${cellName(issue.cell_id) ? `<i>${escapeHtml(cellName(issue.cell_id))}</i> · ` : ''}${escapeHtml(issue.message)}${issue.suggestion ? `<br><small>${escapeHtml(issue.suggestion)}</small>` : ''}</span>
      ${issue.item_key || issue.cell_id || (issue.at !== null && issue.at !== undefined) ? `<button class="btn btn-ghost btn-xs" data-tab-action="su-issue" data-tab-value="${index}">Go to</button>` : ''}
    </li>`;
  return `${review.summary ? `<p class="su-review-summary">${review.score !== null && review.score !== undefined ? `<b>${review.score}/100</b> ` : ''}${escapeHtml(review.summary)}</p>` : ''}
    ${review.issues.length ? `<div class="su-issue-groups">${ordered.map(([key, entries]) => {
      const severity = entries.reduce((best, entry) => ((rank[entry.issue.severity] ?? 2) < (rank[best] ?? 2) ? entry.issue.severity : best), 'info');
      return `<details class="su-issue-group is-${severity}" ${entries.length <= 3 || key === 'ai' ? 'open' : ''}>
        <summary><b>${entries.length}</b>${escapeHtml(SU_ISSUE_LABELS[key] || key)}</summary>
        <ul class="sb-issues">${entries.map(renderIssue).join('')}</ul>
      </details>`;
    }).join('')}</div>` : '<ul class="sb-issues"><li class="is-info"><span>No issue found.</span></li></ul>'}`;
}

const SU_ISSUE_LABELS = {
  ai: 'AI review', empty: 'No inject yet', no_cells: 'No player cell', cell_idle: 'Cells without inject', gap: 'Dead times', peak: 'Overloads',
  phase_empty: 'Phases without inject', no_cell: 'Injects without recipient cell', no_sender: 'Injects without sender', orphan: 'Injects no longer matching the storyline',
  after_end: 'Injects after the end', other: 'Other'
};

const SuPlayer = {
  timer: null,
  last: 0,
  start() {
    const state = tabUI('summary');
    state.playing = true;
    this.last = Date.now();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 250);
  },
  stop() {
    tabUI('summary').playing = false;
    clearInterval(this.timer);
    this.timer = null;
  },
  tick() {
    const state = tabUI('summary');
    if (appState.route !== 'summary') { this.stop(); return; }
    const now = Date.now();
    const project = appState.scenario;
    const items = sbExerciseItems(project);
    const duration = Math.max(project.storyboard.duration_minutes, ...items.map((item) => item.time));
    state.time = Math.min(duration, state.time + state.speed * (now - this.last) / 60000);
    this.last = now;
    if (state.time >= duration) { this.stop(); App.render(); return; }
    suRefreshPlayback(project, items);
  }
};

function suRefreshPlayback(project, items = sbExerciseItems(project)) {
  const state = tabUI('summary');
  const time = document.querySelector('[data-su-time]');
  if (time) time.textContent = sbFormatOffset(state.time);
  const scrub = document.querySelector('[data-su-scrub]');
  if (scrub && document.activeElement !== scrub) scrub.value = String(Math.round(state.time));
  const phase = document.querySelector('[data-su-phase]');
  if (phase) phase.textContent = sbMainBlockAt(project.storyboard, state.time)?.title || '';
  const columns = document.querySelector('[data-su-columns]');
  if (columns) sbWithRenderMemo(() => { columns.innerHTML = renderSummaryColumns(project, items); });
}

// ═══ Scenario & context helpers ══════════════════════════════════════════════
function renderContextGlance(project) {
  const sectors = ['Banking', 'Insurance', 'Energy', 'Healthcare', 'Transport', 'Industry', 'Telecom', 'Retail', 'Public sector', 'Pharmaceutical', 'Technology', 'Other'];
  const hours = Math.round((project.storyboard?.duration_minutes || SB_DEFAULT_DURATION) / 30) / 2;
  const players = project.cells.reduce((sum, cell) => sum + cell.players.length, 0);
  return `<article class="card sc-glance" data-sb-scope>
    <div class="section-header"><div><h3>Exercise at a glance</h3><p class="subtle">Five answers to frame everything else.</p></div></div>
    <div class="sc-glance-grid">
      <label class="field">Client<input type="text" data-bind="client.name" value="${escapeAttribute(project.client.name || '')}" placeholder="Organisation name"></label>
      <label class="field">Duration (hours)<input type="number" min="0.5" max="168" step="0.5" data-sc-duration value="${hours}"></label>
      <label class="field">Sector<select data-bind="client.sector">${[...new Set([project.client.sector, ...sectors].filter(Boolean))].map((sector) => sbOption(sector, sector, project.client.sector)).join('')}</select></label>
      <label class="field">Number of cells<input type="number" min="0" max="20" step="1" data-sc-cells value="${escapeAttribute(project.exercise.cells_count || project.cells.length || '')}" placeholder="e.g. 3"><span class="helper">${project.cells.length} cell(s) defined</span></label>
      <label class="field">Number of players<input type="number" min="0" max="10000" step="1" data-sc-players value="${escapeAttribute(project.exercise.players_count ?? '')}" placeholder="e.g. 15"><span class="helper">${players} listed in Cells & actors</span></label>
    </div>
    <details class="sc-more"><summary>More settings: languages, start date, timezone, logo</summary>
      <div class="field-grid cols-3">
        <label class="field">Primary language<select data-bind="client.language">${LANGUAGES.map((item) => sbOption(item.value, item.label, project.client.language || 'en')).join('')}</select></label>
        <label class="field">Inject language<select data-bind="settings.inject_language">${LANGUAGES.map((item) => sbOption(item.value, item.label, project.settings.inject_language || 'en')).join('')}</select></label>
        <label class="field">Start date<input type="datetime-local" data-bind="scenario.start_date" value="${escapeAttribute(project.scenario.start_date || '')}"></label>
        <label class="field">Timezone<select data-bind="scenario.timezone">${TIMEZONES.map((item) => sbOption(item, item, project.scenario.timezone)).join('')}</select></label>
        <label class="field" style="grid-column: span 2">Logo (URL or data URI)<input type="url" data-bind="client.logo_url" value="${escapeAttribute(project.client.logo_url || '')}" placeholder="https://..."></label>
      </div>
    </details>
  </article>`;
}

function renderContextDetails(project) {
  const storyboard = project.storyboard;
  const types = ['Ransomware', 'Data Breach', 'Supply Chain', 'DDoS', 'Insider Threat', 'Fraud', 'Other'];
  return `<article class="card" data-sb-scope>
    <div class="section-header"><div><h3>Scenario details</h3><p class="subtle">Used by every AI operation, the Agent and the Checker.</p></div></div>
    <div class="field-grid cols-2">
      <label class="field">Scenario name<input type="text" data-bind="name" value="${escapeAttribute(project.name || '')}"></label>
      <label class="field">Type<select data-bind="scenario.type">${[...new Set([project.scenario.type, ...types].filter(Boolean))].map((type) => sbOption(type, type, project.scenario.type)).join('')}</select></label>
      <label class="field">Summary<textarea data-bind="scenario.summary" rows="4">${escapeHtml(project.scenario.summary || '')}</textarea></label>
      <label class="field">Exercise objectives · one per line<textarea data-sb-project="scenario.objectives" rows="4" placeholder="Decide on isolation under uncertainty&#10;Notify authorities on time">${escapeHtml(project.scenario.objectives || '')}</textarea></label>
      <label class="field">Synopsis · the hidden story<textarea data-sb-meta="synopsis" rows="4">${escapeHtml(storyboard.meta.synopsis)}</textarea></label>
      <label class="field">Threat<textarea data-sb-meta="threat" rows="4" placeholder="Threat actor, initial access, impact">${escapeHtml(storyboard.meta.threat)}</textarea></label>
      <label class="field">Detailed context<textarea data-bind="scenario.detailed_context" rows="3" placeholder="Affected systems, attack vector, compromised data…">${escapeHtml(project.scenario.detailed_context || '')}</textarea></label>
      <label class="field">Narrative arc<textarea data-sb-project="scenario.narrative_arc" rows="3">${escapeHtml(project.scenario.narrative_arc || '')}</textarea></label>
      <label class="field" style="grid-column:1/-1">Designer brief<textarea data-sb-meta="brief" rows="2" placeholder="Audience, what you want to test, constraints, tone…">${escapeHtml(storyboard.meta.brief)}</textarea></label>
    </div>
  </article>`;
}

// ═══ Events ══════════════════════════════════════════════════════════════════
function tabItemByKey(project, key) {
  return sbExerciseItems(project).find((item) => item.key === key) || null;
}

/* Moves an inject in time and/or to another cell; a planned inject follows the phase
   covering its new time, and its written stimulus moves with it. */
function dsMoveItem(project, item, time, cellId) {
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
    StoryboardHistory.commit('Move inject');
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
  saveLocal(false);
}

function dsAddInject(project) {
  const state = tabUI('detailed');
  const storyboard = project.storyboard;
  const block = sbMainBlockAt(storyboard, state.playhead);
  if (!block) throw new AgentValidationError('Add a phase to the main storyline first.');
  const cellId = sbCell(project, state.cell)?.id || project.cells[0]?.id || '';
  const cell = sbCell(project, cellId);
  const channel = cell ? (Object.entries(SB_CHANNEL_TO_CELL).find(([, key]) => key === cell.key)?.[0] || 'email_internal') : 'email_internal';
  const beat = sbMakeBeat({ offset_minutes: Math.max(0, Math.min(state.playhead - block.start_minutes, block.duration_minutes - 1)), channel, cell_id: cellId, title: 'New inject' });
  block.beats.push(beat);
  block.beats.sort((a, b) => a.offset_minutes - b.offset_minutes);
  block.stimuli_target = Math.max(block.stimuli_target, block.beats.length);
  StoryboardHistory.commit('Add inject');
  state.selected = `beat:${beat.id}`;
}

function dsDeleteSelected(project) {
  const state = tabUI('detailed');
  const item = dsSelectedItem(project);
  if (!item) return;
  if (!window.confirm(`Delete "${item.title}"?${item.stimulus ? ' Its written inject is deleted too.' : ''}`)) return;
  if (item.kind === 'beat') {
    item.block.beats = item.block.beats.filter((beat) => beat.id !== item.beat.id);
    StoryboardHistory.commit('Delete inject');
  }
  if (item.stimulus) project.stimuli = project.stimuli.filter((stimulus) => stimulus.id !== item.stimulus.id);
  state.selected = null;
  saveLocal(false);
}

function dsFitZoom() {
  const scroller = document.getElementById('ds-scroll');
  const state = tabUI('detailed');
  if (!scroller || !scroller.clientWidth) return false;
  const duration = Math.max(60, appState.scenario.storyboard.duration_minutes);
  const next = Math.min(SB_ZOOM_MAX, Math.max(SB_ZOOM_MIN, Math.floor(100 * (scroller.clientWidth - sbHeaderWidth() - 30) / duration) / 100));
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
  const readOnlyAllowed = ['ds-cell', 'ds-phase', 'ds-deselect', 'su-toggle', 'su-restart', 'su-checks', 'su-goto', 'su-issue', 'open-detailed'];
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
        const cell = value === 'custom' ? sbMakeCell('custom', { name: `Cell ${project.cells.length + 1}` }) : sbMakeCell(value);
        project.cells.push(cell);
        project.exercise.cells_count = project.cells.length;
        saveLocal(false);
        break;
      }
      case 'delete-cell': {
        const cell = sbCell(project, value);
        const used = sbExerciseItems(project).filter((item) => item.cell_id === value).length;
        if (!cell || !window.confirm(`Delete the ${cell.name}?${used ? ` Its ${used} inject(s) become unassigned.` : ''}`)) return;
        project.cells = project.cells.filter((item) => item.id !== value);
        storyboard.blocks.forEach((block) => block.beats.forEach((beat) => { if (beat.cell_id === value) beat.cell_id = ''; }));
        project.stimuli.forEach((stimulus) => { if (stimulus.cell_id === value) stimulus.cell_id = ''; });
        project.exercise.cells_count = project.cells.length;
        StoryboardHistory.commit('Delete cell');
        saveLocal(false);
        break;
      }
      case 'add-player': {
        const cell = sbCell(project, value);
        if (cell) cell.players.push(sbNormalizePlayer({ id: uid('player') }));
        saveLocal(false);
        break;
      }
      case 'delete-player': {
        const [cellId, playerId] = value.split('.');
        const cell = sbCell(project, cellId);
        if (cell) cell.players = cell.players.filter((player) => player.id !== playerId);
        saveLocal(false);
        break;
      }
      case 'add-actor':
        addActor({ role: value, name: `New ${roleLabel(value).toLowerCase()}`, title: roleLabel(value) }, false);
        saveLocal(false);
        break;
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
      case 'ds-delete':
        dsDeleteSelected(project);
        break;
      case 'ds-plan': {
        const block = sbMainBlockAt(storyboard, detailed.playhead);
        const cell = sbCell(project, detailed.cell);
        if (!block || !cell) throw new AgentValidationError('Select a cell and place the playhead in a phase.');
        const added = await sbRunAI(`Plan injects for the ${cell.name}`, () => SbAI.planCellInjects(block.id, cell.id, detailed.planCount));
        if (added?.[0]) detailed.selected = `beat:${added[0].id}`;
        break;
      }
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
        pushToast(result.created ? `Inject created${result.written ? ' and written' : ''}.` : 'Nothing created.', result.created ? 'success' : 'info');
        break;
      }
      case 'ds-rewrite': {
        const item = dsSelectedItem(project);
        if (!item?.stimulus) break;
        const manual = sbIsManuallyEdited(item.stimulus);
        await SbPipeline.applyImpacts([{ id: 'single', kind: 'outdated', target: 'stimulus', stimulus_id: item.stimulus.id, block_id: item.block?.id, beat_id: item.beat?.id || '', label: item.title, action: manual ? 'adapt' : 'regenerate' }]);
        pushToast(manual ? 'Inject adapted, keeping your edits.' : 'Inject rewritten.', 'success');
        break;
      }
      case 'su-toggle':
        if (summary.playing) SuPlayer.stop();
        else {
          const items = sbExerciseItems(project);
          const duration = Math.max(storyboard.duration_minutes, ...items.map((item) => item.time));
          if (summary.time >= duration) summary.time = 0;
          SuPlayer.start();
        }
        break;
      case 'su-restart':
        SuPlayer.stop();
        summary.time = 0;
        summary.preview = null;
        break;
      case 'su-checks':
        summary.review = { score: null, summary: '', issues: sbExerciseChecks(project), checked_at: new Date().toISOString() };
        break;
      case 'su-ai':
        try {
          summary.review = await SbAI.reviewExercise();
        } catch (error) {
          pushToast(error?.name === 'AbortError' ? 'Review stopped.' : sbErrorMessage(error), 'error');
        }
        break;
      case 'su-goto': {
        const item = tabItemByKey(project, value);
        if (!item) break;
        SuPlayer.stop();
        appState.route = 'detailed';
        detailed.cell = sbCell(project, item.cell_id) ? item.cell_id : 'all';
        detailed.selected = item.key;
        detailed.playhead = item.time;
        detailed.focusTime = item.time;
        break;
      }
      case 'su-issue': {
        const issue = summary.review?.issues?.[Number(value)];
        if (!issue) break;
        SuPlayer.stop();
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
    const minutes = Math.round(Math.max(0.5, Number(input.value) || 0) * 60);
    storyboard.duration_minutes = Math.max(30, minutes, sbStoryboardEnd(storyboard));
    StoryboardHistory.commit('Change duration');
    App.render();
  }));
  root.querySelectorAll('[data-sc-cells]').forEach((input) => input.addEventListener('change', () => {
    const count = sbInt(input.value, 0, 0, 20);
    project.exercise.cells_count = count;
    sbSetCellsCount(project, count);
    saveLocal(false);
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
  root.querySelectorAll('[data-ce-player]').forEach((input) => {
    const [cellId, playerId, field] = input.dataset.cePlayer.split('.');
    input.addEventListener('input', () => {
      const player = sbCell(project, cellId)?.players.find((item) => item.id === playerId);
      if (!player) return;
      player[field] = sbText(input.value, 200);
      clearTimeout(window._ceSaveTimer);
      window._ceSaveTimer = setTimeout(() => saveLocal(false), 500);
    });
  });

  const selected = () => dsSelectedItem(project);
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
      StoryboardHistory.commit('Edit inject');
      App.render();
    });
    if (isText) input.addEventListener('change', () => StoryboardHistory.flush());
  });
  root.querySelectorAll('[data-ds-time]').forEach((input) => input.addEventListener('change', () => {
    const item = selected();
    if (!item) return;
    dsMoveItem(project, item, sbInt(input.value, item.time, 0, SB_MAX_DURATION), undefined);
    detailed.playhead = sbInt(input.value, item.time, 0, SB_MAX_DURATION);
    App.render();
  }));
  root.querySelectorAll('[data-ds-cell]').forEach((select) => select.addEventListener('change', () => {
    const item = selected();
    if (!item) return;
    dsMoveItem(project, item, item.time, select.value || 'none');
    App.render();
  }));
  root.querySelectorAll('[data-ds-stim]').forEach((input) => input.addEventListener('change', () => {
    const item = selected();
    if (item?.kind !== 'stimulus') return;
    const field = input.dataset.dsStim;
    if (field === 'actor_id' && getActor(input.value)) item.stimulus.actor_id = input.value;
    if (field === 'name') item.stimulus.name = sbText(input.value, 500);
    item.stimulus.updated_at = new Date().toISOString();
    saveLocal(false);
    App.render();
  }));
  root.querySelectorAll('[data-tab-ui]').forEach((input) => input.addEventListener('change', () => {
    detailed[input.dataset.tabUi] = sbInt(input.value, 3, 1, 10);
  }));

  // Summary playback controls.
  root.querySelectorAll('[data-su-speed]').forEach((select) => select.addEventListener('change', () => { summary.speed = Number(select.value) || 60; }));
  root.querySelectorAll('[data-su-scrub]').forEach((input) => input.addEventListener('input', () => {
    summary.time = Number(input.value) || 0;
    suRefreshPlayback(project);
  }));
  root.querySelectorAll('[data-su-play]').forEach((container) => container.addEventListener('click', (event) => {
    const entry = event.target.closest('[data-su-item]');
    if (!entry) return;
    summary.preview = entry.dataset.suItem;
    const preview = container.querySelector('[data-su-preview]');
    if (preview) sbWithRenderMemo(() => { preview.innerHTML = renderSummaryPreview(project, sbExerciseItems(project)); });
    container.querySelectorAll('[data-su-item]').forEach((node) => node.classList.toggle('is-selected', node.dataset.suItem === summary.preview));
    preview?.querySelector('[data-tab-action]')?.addEventListener('click', tabHandleAction);
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
    App.render();
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
      state.selected = key;
      if (sbReadOnly()) { App.render(); return; }
      event.preventDefault();
      const item = tabItemByKey(project, key);
      if (!item) return;
      const canvas = card.closest('.ds-canvas');
      const startX = event.clientX;
      const startY = event.clientY;
      const originLeft = parseFloat(card.style.left) || 0;
      let moved = false;
      let lane = null;
      try { card.setPointerCapture(event.pointerId); } catch (_) { /* Older browsers. */ }
      const move = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        if (!moved && Math.abs(dx) < 4 && Math.abs(moveEvent.clientY - startY) < 4) return;
        moved = true;
        document.body.classList.add('sb-dragging');
        const minutes = Math.max(0, sbSnap(item.time + dx / state.zoom));
        card.style.left = `${minutes * state.zoom}px`;
        card.style.transform = `translateY(${moveEvent.clientY - startY}px)`;
        const hovered = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest('[data-ds-lane]');
        canvas.querySelectorAll('.sb-lane.is-drop-target').forEach((node) => node.classList.remove('is-drop-target'));
        lane = hovered ? hovered.dataset.dsLane : null;
        if (hovered) hovered.classList.add('is-drop-target');
        sbDragTip(canvas, `${sbFormatOffset(minutes)}${lane && lane !== (item.cell_id || 'none') ? ` → ${sbCell(project, lane)?.name || 'Unassigned'}` : ''}`, sbHeaderWidth() + minutes * state.zoom, card.offsetTop + card.parentElement.offsetTop - 26);
      };
      const up = (upEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.classList.remove('sb-dragging');
        canvas.querySelector('.sb-drag-tip')?.remove();
        if (moved) {
          const minutes = Math.max(0, sbSnap(item.time + (upEvent.clientX - startX) / state.zoom));
          const cell = lane && lane !== (item.cell_id || 'none') ? lane : undefined;
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

function bindScenarioTabsEvents() {
  if (!['scenario', 'storyline', 'cells', 'detailed', 'summary'].includes(appState.route)) {
    if (SuPlayer.timer) SuPlayer.stop();
    return;
  }
  document.querySelectorAll('[data-sb-scope]').forEach((root) => tabBindInputs(root));
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
  if (appState.route !== 'detailed' || appState.stimulusModalId || sbUI().modal) return;
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
    if (label) pushToast(`${key === 'y' || event.shiftKey ? 'Redone' : 'Undone'}: ${label}`, 'info');
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

/* Crisis steps tab: one timeline with the crisis steps on the main row and one
   row per crisis cell, and the details of the selected block docked at the
   bottom (wide screens). Also renders the Scenario tab (brief, AI build,
   library, detailed scenario) and the storyline roles of the Actors tab. */

/* Compact layout for laptop screens (13" and similar). */
function sbCompact() {
  return typeof window !== 'undefined' && Number(window.innerWidth) > 0 && window.innerWidth < 1440;
}
function sbHeaderWidth() {
  return sbCompact() ? 150 : 184;
}
function sbRowHeight(main) {
  return sbCompact() ? (main ? 62 : 54) : (main ? 70 : 58);
}
const SB_ZOOM_MIN = 0.6;
const SB_ZOOM_MAX = 24;
const SB_SNAP = 5;

function sbUI() {
  if (!appState.ui.builder) {
    appState.ui.builder = {
      selected: [],
      zoom: null,
      scrollLeft: 0,
      scrollTop: 0,
      modal: null,
      libraryCategory: '',
      libraryOpen: null,
      detailsCollapsed: false,
      previewId: null,
      diffVersionId: null,
      impacts: null,
      generate: { scope: 'all', plan: true, cast: true, write: true },
      skeleton: { duration: null, injects: '' },
      rewrite: '',
      versionLabel: '',
      templateName: '',
      focus: null
    };
  }
  return appState.ui.builder;
}

function sbStoryboard() {
  return StoryboardHistory.ensure(appState.scenario);
}

function sbSelectedBlock() {
  const ui = sbUI();
  const storyboard = sbStoryboard();
  ui.selected = ui.selected.filter((id) => sbBlock(storyboard, id));
  return ui.selected.length === 1 ? sbBlock(storyboard, ui.selected[0]) : null;
}

function sbBusy() {
  return !!(SbAI.busy || SbPipeline.active);
}

function sbReadOnly() {
  const agent = typeof crisisAgentRunner !== 'undefined' ? crisisAgentRunner : null;
  return sbBusy() || !!(agent?.active || agent?.busy);
}

function sbOption(value, label, current) {
  return `<option value="${escapeAttribute(value)}" ${String(value) === String(current) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function sbChannelColor(channel) {
  return CHANNEL_META[channel]?.color || '#5d7384';
}

/* Crisis cells of the storyboard (every row except the crisis steps). */
function sbCells(storyboard) {
  return storyboard.tracks.filter((track) => track.kind !== 'main');
}
function sbIsMainBlock(storyboard, block) {
  return sbTrack(storyboard, block.track_id)?.kind === 'main';
}

function sbSvg(path, size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
const SB_UI_ICONS = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>',
  wand: '<path d="m15 4 5 5"/><path d="M4 20 16 8"/><path d="M19 13v4"/><path d="M17 15h4"/><path d="M8 3v3"/><path d="M6.5 4.5h3"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  play: '<path d="m6 4 14 8-14 8z"/>',
  sync: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  agent: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  open: '<path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v7H3V3h7"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>'
};
function sbUiIcon(name, size = 16) {
  return sbSvg(SB_UI_ICONS[name] || '', size);
}

// ── Crisis steps view ────────────────────────────────────────────────────────
function renderScenarioBuilderView() {
  return sbWithRenderMemo(renderScenarioBuilderMarkup);
}

function renderScenarioBuilderMarkup() {
  const ui = sbUI();
  const storyboard = sbStoryboard();
  sbCaptureFocus();
  if (ui.zoom === null) { ui.zoom = 3; ui.needsFit = true; }
  const readOnly = sbReadOnly();
  return `<section class="sb-workspace ${readOnly ? 'is-readonly' : ''} ${sbCompact() ? 'is-compact' : ''}" data-sb-scope aria-label="Crisis steps">
    ${renderSbToolbar(storyboard)}
    ${renderSbStatusBar()}
    ${renderSbTimeline(storyboard)}
    ${renderSbDetails(storyboard)}
    ${renderSbModal(storyboard)}
  </section>`;
}

function renderSbToolbar(storyboard) {
  const project = appState.scenario;
  const coherence = storyboard.meta.coherence;
  const pending = sbPendingSyncCount(project);
  const missing = storyboard.blocks.reduce((sum, block) => sum + block.beats.filter((beat) => !sbStimulusForBeat(project, beat.id)).length, 0);
  const ai = isLLMAvailable();
  const aiTitle = ai ? '' : ' (configure AI in Settings)';
  const validated = storyboard.meta.validated_rev;
  const readOnly = sbReadOnly() ? 'disabled' : '';
  const steps = sbMainBlocks(storyboard).length;
  return `<header class="sb-toolbar">
    <div class="sb-tb-title">
      <span class="sb-eyebrow">Crisis steps</span>
      <div class="sb-tb-name-row">
        <strong class="sb-tb-name" title="${escapeAttribute(project.name || 'Untitled scenario')}">${escapeHtml(project.name || 'Untitled scenario')}</strong>
        <span class="sb-chip" title="Exercise duration, crisis steps and crisis cells">${escapeHtml(sbFormatDuration(storyboard.duration_minutes))} · ${steps} step${steps === 1 ? '' : 's'} · ${sbCells(storyboard).length} cells</span>
        ${validated !== null ? `<span class="sb-chip sb-chip-ok" title="Validated revision">${sbUiIcon('check', 12)} validated${validated !== storyboard.rev ? ' · changed since' : ''}</span>` : ''}
      </div>
    </div>
    <div class="sb-tb-group" role="group" aria-label="History">
      <button class="sb-tool" data-sb-action="undo" ${StoryboardHistory.canUndo() ? '' : 'disabled'} title="Undo ${escapeAttribute(StoryboardHistory.lastLabel('undo'))} (Ctrl+Z)">${sbUiIcon('undo')}</button>
      <button class="sb-tool" data-sb-action="redo" ${StoryboardHistory.canRedo() ? '' : 'disabled'} title="Redo ${escapeAttribute(StoryboardHistory.lastLabel('redo'))} (Ctrl+Shift+Z)">${sbUiIcon('redo')}</button>
      <button class="sb-tool sb-tool-label" data-sb-action="open-modal" data-sb-modal="versions" title="Versions and autosaves">${sbUiIcon('history')}<span>Versions</span></button>
    </div>
    <div class="sb-tb-group" role="group" aria-label="Add">
      <button class="sb-tool sb-tool-label" data-sb-action="add-block" data-sb-track="${sbMainTrack(storyboard).id}" ${readOnly} title="Add a crisis step at the end of the storyline">${sbUiIcon('plus', 14)}<span>Step</span></button>
      <button class="sb-tool sb-tool-label" data-sb-action="add-track" ${readOnly} title="Add a crisis cell row">${sbUiIcon('plus', 14)}<span>Crisis cell</span></button>
    </div>
    <div class="sb-tb-group" role="group" aria-label="Zoom">
      <button class="sb-tool" data-sb-action="zoom-out" title="Zoom out (-)">${sbUiIcon('minus')}</button>
      <button class="sb-tool" data-sb-action="zoom-fit" title="Fit the whole exercise">${sbUiIcon('fit')}</button>
      <button class="sb-tool" data-sb-action="zoom-in" title="Zoom in (+)">${sbUiIcon('plus')}</button>
    </div>
    <div class="sb-tb-group" role="group" aria-label="AI design">
      <button class="sb-tool sb-tool-label" data-sb-action="deepen-all" ${ai && storyboard.blocks.length ? '' : 'disabled'} title="Write the story and plan the injects of every block${aiTitle}">${sbUiIcon('layers')}<span>Detail all with AI</span></button>
      <button class="sb-tool sb-tool-label" data-sb-action="open-modal" data-sb-modal="coherence" title="Check global coherence">${sbScoreDot(coherence?.score)}<span>Coherence</span></button>
    </div>
    <div class="sb-tb-group sb-tb-output" role="group" aria-label="Injects">
      <button class="sb-tool sb-tool-label" data-sb-action="open-modal" data-sb-modal="sync" title="Propagate changes to actors and injects">${sbUiIcon('sync')}<span>Sync</span>${pending ? `<span class="sb-count">${pending}</span>` : ''}</button>
      <button class="btn btn-primary btn-sm sb-generate-btn" data-sb-action="open-modal" data-sb-modal="generate" title="Create actors and injects from the crisis steps">${sbUiIcon('play', 14)} Generate injects${missing ? ` <span class="sb-count sb-count-light">${missing}</span>` : ''}</button>
    </div>
  </header>`;
}

function sbScoreDot(score) {
  if (score === undefined || score === null) return sbUiIcon('check');
  const tone = score >= 80 ? 'good' : score >= 60 ? 'mid' : 'low';
  return `<span class="sb-score-dot is-${tone}">${score}</span>`;
}

function renderSbStatusBar() {
  const busy = SbAI.busy || (SbPipeline.active ? SbPipeline.label || 'Generating' : '');
  if (busy) {
    const progress = SbPipeline.active && SbPipeline.total ? Math.round(100 * SbPipeline.step / SbPipeline.total) : null;
    return `<div class="sb-statusbar is-busy" role="status"><span class="ai-spinner"></span><span>${escapeHtml(busy)}…</span>${progress !== null ? `<span class="sb-progress"><i style="width:${progress}%"></i></span>` : '<span class="sb-progress is-indeterminate"><i></i></span>'}<button class="btn btn-secondary btn-xs" data-sb-action="${SbPipeline.active ? 'stop-pipeline' : 'stop-ai'}">${sbUiIcon('stop', 12)} Stop</button></div>`;
  }
  if (SbAI.lastError) return `<div class="sb-statusbar is-error" role="alert"><span>⚠ ${escapeHtml(SbAI.lastError)}</span><button class="btn btn-secondary btn-xs" data-sb-action="dismiss-error">Dismiss</button></div>`;
  return '';
}

function sbScoreRing(score) {
  const value = Number.isFinite(score) ? score : null;
  const circumference = 2 * Math.PI * 15;
  const tone = value === null ? 'none' : value >= 80 ? 'good' : value >= 60 ? 'mid' : 'low';
  return `<span class="sb-ring is-${tone}"><svg viewBox="0 0 36 36" width="38" height="38"><circle cx="18" cy="18" r="15" class="sb-ring-track"/><circle cx="18" cy="18" r="15" class="sb-ring-value" stroke-dasharray="${value === null ? 0 : (circumference * value / 100).toFixed(1)} ${circumference.toFixed(1)}"/></svg><b>${value === null ? '-' : value}</b></span>`;
}

// ── Timeline ─────────────────────────────────────────────────────────────────
function renderSbTimeline(storyboard) {
  const ui = sbUI();
  const ppm = ui.zoom;
  const width = Math.ceil((storyboard.duration_minutes + 60) * ppm);
  return `<section class="sb-timeline-panel" aria-label="Timeline">
    <div class="sb-timeline-scroll" id="sb-timeline-scroll">
      <div class="sb-canvas" style="width:${sbHeaderWidth() + width}px;--ppm:${ppm};--hour:${(60 * ppm).toFixed(2)}px;--quarter:${(15 * ppm).toFixed(2)}px;--header:${sbHeaderWidth()}px">
        <div class="sb-ruler-row">
          <div class="sb-corner"><span>Timeline</span><small>${escapeHtml(sbFormatDuration(storyboard.duration_minutes))}</small></div>
          <div class="sb-ruler" style="width:${width}px">${renderSbRuler(storyboard, ppm)}</div>
        </div>
        ${storyboard.tracks.map((track, index) => renderSbTrack(storyboard, track, index, width)).join('')}
        ${storyboard.tracks.length < 2 ? `<div class="sb-no-cells"><span>No crisis cell yet.</span><button class="btn btn-ghost btn-xs" data-sb-action="add-track" ${sbReadOnly() ? 'disabled' : ''}>${sbUiIcon('plus', 12)} Add a crisis cell</button></div>` : ''}
        <div class="sb-end-zone" style="left:${sbHeaderWidth() + storyboard.duration_minutes * ppm}px"></div>
      </div>
    </div>
  </section>`;
}

function renderSbRuler(storyboard, ppm) {
  const hourPx = 60 * ppm;
  const step = hourPx < 38 ? 240 : hourPx < 70 ? 120 : hourPx > 360 ? 15 : hourPx > 180 ? 30 : 60;
  const startDate = appState.scenario.scenario.start_date;
  const marks = [];
  for (let minute = 0; minute <= storyboard.duration_minutes + 60; minute += step) {
    const clock = minute % 60 === 0 ? sbClockTime(minute, startDate) : '';
    marks.push(`<span class="sb-tick ${minute % 60 === 0 ? 'is-hour' : ''}" style="left:${minute * ppm}px"><b>${sbFormatOffset(minute)}</b>${clock ? `<small>${escapeHtml(clock.split(' ')[1])}</small>` : ''}</span>`);
  }
  return marks.join('');
}

function renderSbTrack(storyboard, track, index, width) {
  const blocks = sbSortedBlocks(storyboard, track.id);
  const packing = sbPackTrack(blocks);
  const main = track.kind === 'main';
  const rowHeight = sbRowHeight(main);
  const height = packing.rows * rowHeight + 10;
  const injects = blocks.reduce((sum, block) => sum + block.stimuli_target, 0);
  const readOnly = sbReadOnly() ? 'disabled' : '';
  const unit = main ? 'step' : 'block';
  return `<div class="sb-track-row ${main ? 'is-main' : ''}" style="--track-color:${track.color}">
    <div class="sb-track-head" style="height:${height}px">
      <input class="sb-track-name" data-sb-track-name="${track.id}" value="${escapeAttribute(track.name)}" aria-label="${main ? 'Crisis steps row name' : 'Crisis cell name'}" ${readOnly}>
      <div class="sb-track-meta">
      <small>${blocks.length} ${unit}${blocks.length === 1 ? '' : 's'} · ${injects} inj.</small>
      <span class="sb-track-actions">
        <button class="sb-icon-btn" data-sb-action="add-block" data-sb-track="${track.id}" ${readOnly} title="${main ? 'Add a crisis step' : `Add a block to ${escapeAttribute(track.name)}`}">${sbUiIcon('plus', 13)}</button>
        ${main ? '' : `<button class="sb-icon-btn" data-sb-action="move-track" data-sb-track="${track.id}" data-sb-value="-1" ${index <= 1 || readOnly ? 'disabled' : ''} title="Move up">${sbUiIcon('up', 13)}</button>
        <button class="sb-icon-btn" data-sb-action="move-track" data-sb-track="${track.id}" data-sb-value="1" ${index === storyboard.tracks.length - 1 || readOnly ? 'disabled' : ''} title="Move down">${sbUiIcon('down', 13)}</button>
        <button class="sb-icon-btn is-danger" data-sb-action="delete-track" data-sb-track="${track.id}" ${readOnly} title="Remove this crisis cell">${sbUiIcon('trash', 13)}</button>`}
      </span>
      </div>
    </div>
    <div class="sb-lane" data-sb-lane="${track.id}" style="width:${width}px;height:${height}px" title="Double-click to add a ${unit} here">
      ${blocks.map((block) => renderSbClip(storyboard, block, packing.placement.get(block.id) * rowHeight + 5, rowHeight - 8)).join('')}
      ${!blocks.length ? `<span class="sb-lane-hint">Double-click to add a ${unit}</span>` : ''}
    </div>
  </div>`;
}

function renderSbClip(storyboard, block, top, height) {
  const ui = sbUI();
  const project = appState.scenario;
  const ppm = ui.zoom;
  const type = SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom;
  const selected = ui.selected.includes(block.id);
  const statuses = sbStimuliForBlock(project, block.id).map((stimulus) => sbStimulusStatus(project, stimulus));
  const outdated = statuses.filter((status) => status && ['outdated', 'orphan', 'retime'].includes(status.key)).length;
  const widthPx = block.duration_minutes * ppm;
  const injects = `${block.beats.length || block.stimuli_target}${block.beats.length && block.beats.length !== block.stimuli_target ? `/${block.stimuli_target}` : ''}`;
  const beats = block.beats.map((beat) => {
    const stimulus = sbStimulusForBeat(project, beat.id);
    const status = stimulus ? sbStimulusStatus(project, stimulus)?.key : 'planned';
    return `<i class="sb-beat is-${status}" style="left:${(100 * Math.min(beat.offset_minutes, block.duration_minutes - 1) / block.duration_minutes).toFixed(2)}%;--beat-color:${sbChannelColor(beat.channel)}" title="${escapeAttribute(`${sbFormatOffset(sbBeatAbsolute(block, beat))} · ${channelLabel(beat.channel)} · ${beat.title}`)}"></i>`;
  }).join('');
  return `<div class="sb-clip ${selected ? 'is-selected' : ''} ${block.locked ? 'is-locked' : ''} ${widthPx < 90 ? 'is-narrow' : ''}" data-sb-clip="${block.id}" tabindex="0" role="button" aria-pressed="${selected}" aria-label="${escapeAttribute(`${block.title}, ${sbFormatOffset(block.start_minutes)} to ${sbFormatOffset(sbBlockEnd(block))}`)}" title="${escapeAttribute(`${block.title}\n${sbFormatOffset(block.start_minutes)} → ${sbFormatOffset(sbBlockEnd(block))}${block.brief ? `\n${block.brief}` : ''}`)}"
      style="left:${(block.start_minutes * ppm).toFixed(1)}px;width:${Math.max(6, widthPx).toFixed(1)}px;top:${top}px;height:${height}px;--clip-color:${sbBlockColor(block, storyboard)}">
    <span class="sb-clip-handle is-left" data-sb-resize="left"></span>
    <div class="sb-clip-body">
      <div class="sb-clip-head"><span class="sb-clip-icon">${sbIcon(type.icon, 13)}</span><strong>${escapeHtml(block.title)}</strong></div>
      <div class="sb-clip-meta">
        <span class="sb-clip-sub">${sbFormatOffset(block.start_minutes)} · ${escapeHtml(sbFormatDuration(block.duration_minutes))} · ${injects} inj.</span>
        <span class="sb-clip-flags">
          ${block.locked ? `<span class="sb-flag" title="Locked">${sbUiIcon('lock', 11)}</span>` : ''}
          ${outdated ? `<span class="sb-flag is-warn" title="${outdated} inject(s) need sync">${outdated}</span>` : ''}
        </span>
      </div>
    </div>
    <div class="sb-clip-beats">${beats}</div>
    <span class="sb-clip-handle is-right" data-sb-resize="right"></span>
  </div>`;
}

// ── Details (bottom panel) ───────────────────────────────────────────────────
function renderSbDetails(storyboard) {
  const ui = sbUI();
  const block = sbSelectedBlock();
  if (ui.selected.length > 1) return renderSbMultiDetails(storyboard);
  if (!block) return renderSbEmptyDetails(storyboard);
  const main = sbIsMainBlock(storyboard, block);
  const type = SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom;
  const readOnly = sbReadOnly() || block.locked ? 'disabled' : '';
  const busy = sbReadOnly() ? 'disabled' : '';
  const ai = isLLMAvailable();
  const track = sbTrack(storyboard, block.track_id);
  const head = `<header class="sb-details-head">
      <span class="sb-details-icon">${sbIcon(type.icon, 16)}</span>
      <input class="sb-details-title" data-sb-field="title" value="${escapeAttribute(block.title)}" aria-label="Title" ${readOnly}>
      <label class="sb-inline-label">Row<select data-sb-field="track_id" ${readOnly}>${storyboard.tracks.map((item) => sbOption(item.id, item.name, block.track_id)).join('')}</select></label>
      ${main ? `<label class="sb-inline-label">Type<select data-sb-field="type" ${readOnly}>${Object.entries(SB_BLOCK_TYPES).filter(([, value]) => value.group !== 'workstream').map(([key, value]) => sbOption(key, value.label, block.type)).join('')}</select></label>` : ''}
      <label class="sb-inline-label">Start<input type="number" min="0" step="5" data-sb-field="start_minutes" value="${block.start_minutes}" ${readOnly}><span>${sbFormatOffset(block.start_minutes)}</span></label>
      <label class="sb-inline-label">Duration<input type="number" min="5" step="5" data-sb-field="duration_minutes" value="${block.duration_minutes}" ${readOnly}><span>min</span></label>
      <label class="sb-inline-label">Injects<input type="number" min="0" max="${SB_MAX_BEATS}" step="1" data-sb-field="stimuli_target" value="${block.stimuli_target}" ${readOnly}></label>
      <span class="sb-details-actions">
        <button class="sb-icon-btn ${block.locked ? 'is-on' : ''}" data-sb-action="toggle-lock" title="${block.locked ? 'Unlock' : 'Lock (protects from AI and sync)'}" ${busy}>${sbUiIcon(block.locked ? 'lock' : 'unlock', 15)}</button>
        <button class="sb-icon-btn" data-sb-action="duplicate-block" ${busy} title="Duplicate (Ctrl+D)">${sbUiIcon('copy', 15)}</button>
        <button class="sb-icon-btn" data-sb-action="send-to-agent" ${busy} title="Open the Agent tab with a brief scoped to this block">${sbUiIcon('agent', 15)}</button>
        <button class="sb-icon-btn is-danger" data-sb-action="delete-block" ${readOnly} title="Delete (Del)">${sbUiIcon('trash', 15)}</button>
        <button class="sb-icon-btn" data-sb-action="toggle-details" title="${ui.detailsCollapsed ? 'Show details' : 'Hide details'}">${sbUiIcon(ui.detailsCollapsed ? 'up' : 'down', 15)}</button>
      </span>
    </header>`;
  if (ui.detailsCollapsed) {
    return `<section class="sb-details is-collapsed" aria-label="Details" style="--clip-color:${sbBlockColor(block, storyboard)}">${head}</section>`;
  }
  return `<section class="sb-details" aria-label="Details" style="--clip-color:${sbBlockColor(block, storyboard)}">
    ${head}
    <div class="sb-details-body">
      <div class="sb-details-col">
        <label class="sb-mini-field">What happens${main ? '' : ` in ${escapeHtml(track?.name || 'this cell')}`}
          <textarea data-sb-field="brief" rows="4" placeholder="${escapeAttribute(type.hint)}" ${readOnly}>${escapeHtml(block.brief)}</textarea>
        </label>
        ${renderSbObjectives(block, readOnly)}
      </div>
      <div class="sb-details-col">
        <label class="sb-mini-field">Detailed story · what players know, dilemmas, expected decisions
          <textarea data-sb-field="narrative" rows="5" placeholder="What really happens, what players know and do not know, which decisions they face, possible consequences…" ${readOnly}>${escapeHtml(block.narrative)}</textarea>
        </label>
        <div class="sb-ask-ai">
          <input type="text" data-sb-ui="rewrite" value="${escapeAttribute(ui.rewrite)}" placeholder="${escapeAttribute(ai ? 'Ask the AI to change this block (e.g. the attacker calls the CEO)' : 'Configure AI in Settings to rewrite with AI')}" ${ai && !readOnly ? '' : 'disabled'}>
          <button class="btn btn-secondary btn-xs" data-sb-action="rewrite-block" ${ai && !readOnly ? '' : 'disabled'}>Apply</button>
          <button class="btn btn-secondary btn-xs" data-sb-action="deepen-block" data-sb-level="2" ${ai && !readOnly ? '' : 'disabled'} title="Write the detailed story with AI">${sbUiIcon('wand', 12)} ${block.narrative.trim() ? 'Rewrite story' : 'Write story'}</button>
        </div>
      </div>
      ${renderSbBeats(storyboard, block, readOnly)}
    </div>
  </section>`;
}

function renderSbObjectives(block, readOnly) {
  const objectives = sbObjectivesList(appState.scenario);
  const all = [...objectives, ...block.objectives.filter((objective) => !objectives.includes(objective))];
  return `<div class="sb-mini-field">Objectives tested
    ${all.length ? `<div class="sb-objective-chips">${all.map((objective) => `<label class="${block.objectives.includes(objective) ? 'on' : ''}"><input type="checkbox" data-sb-objective="${escapeAttribute(objective)}" ${block.objectives.includes(objective) ? 'checked' : ''} ${readOnly}><span>${escapeHtml(objective)}</span></label>`).join('')}</div>`
      : '<p class="sb-empty">Add the exercise objectives in the Scenario tab to link them to blocks.</p>'}
  </div>`;
}

function renderSbBeats(storyboard, block, readOnly) {
  const project = appState.scenario;
  const ai = isLLMAvailable();
  const channels = Object.keys(TEMPLATE_LIBRARY);
  return `<div class="sb-details-col sb-details-injects">
    <div class="sb-plan-head">
      <span>Planned injects · ${block.beats.length}/${block.stimuli_target}</span>
      <span class="sb-inline">
        <button class="btn btn-secondary btn-xs" data-sb-action="deepen-block" data-sb-level="3" ${ai && !readOnly && block.beats.length < Math.max(1, block.stimuli_target) ? '' : 'disabled'} title="Plan the missing injects with AI">${sbUiIcon('wand', 12)} Plan with AI</button>
        <button class="btn btn-secondary btn-xs" data-sb-action="add-beat" ${readOnly}>${sbUiIcon('plus', 12)} Inject</button>
        <button class="btn btn-primary btn-xs" data-sb-action="generate-block" ${sbReadOnly() ? 'disabled' : ''} title="Create the injects of this block">${sbUiIcon('play', 11)} Generate</button>
      </span>
    </div>
    <div class="sb-beats">
      ${block.beats.map((beat) => {
        const stimulus = sbStimulusForBeat(project, beat.id);
        const status = stimulus ? sbStimulusStatus(project, stimulus) : null;
        const templates = beat.channel === 'article_press' ? Object.entries(ARTICLE_TEMPLATE_LIBRARY) : beat.channel === 'breaking_news_tv' ? Object.entries(TV_TEMPLATE_LIBRARY) : [];
        return `<div class="sb-beat-line" style="--beat-color:${sbChannelColor(beat.channel)}">
          <label class="sb-beat-time" title="Minutes from the block start">+<input type="number" min="0" max="${Math.max(0, block.duration_minutes - 1)}" data-sb-beat="${beat.id}.offset_minutes" value="${beat.offset_minutes}" ${readOnly}><em>${sbFormatOffset(sbBeatAbsolute(block, beat))}</em></label>
          <select data-sb-beat="${beat.id}.channel" aria-label="Channel" ${readOnly}>${channels.map((channel) => sbOption(channel, channelLabel(channel), beat.channel)).join('')}</select>
          ${templates.length ? `<select data-sb-beat="${beat.id}.template_id" aria-label="Outlet" ${readOnly}>${sbOption('', 'Default outlet', beat.template_id)}${templates.map(([key, value]) => sbOption(key, value.label || key, beat.template_id)).join('')}</select>` : ''}
          <select data-sb-beat="${beat.id}.cast_id" aria-label="Sender" ${readOnly}>${sbOption('', '- Sender -', beat.cast_id)}${storyboard.cast.map((cast) => sbOption(cast.id, cast.label, beat.cast_id)).join('')}</select>
          <input type="text" class="sb-beat-title" data-sb-beat="${beat.id}.title" value="${escapeAttribute(beat.title)}" placeholder="Inject title" aria-label="Inject title" ${readOnly}>
          <span class="sb-beat-state">${stimulus
            ? `<button class="sb-status is-${status?.key}" data-sb-action="open-stimulus" data-sb-stimulus="${escapeAttribute(stimulus.id)}" title="Open the inject">${escapeHtml(status?.label || '')} ${sbUiIcon('open', 10)}</button>`
            : `<button class="sb-status is-planned" data-sb-action="generate-beat" data-sb-beat-id="${beat.id}" ${sbReadOnly() ? 'disabled' : ''} title="Create this inject">${sbUiIcon('play', 10)} Create</button>`}</span>
          <button class="sb-icon-btn" data-sb-action="delete-beat" data-sb-beat-id="${beat.id}" title="Remove" ${readOnly}>${sbUiIcon('trash', 13)}</button>
          <input type="text" class="sb-beat-intent" data-sb-beat="${beat.id}.intent" value="${escapeAttribute(beat.intent)}" placeholder="What it says and the pressure or decision it creates" aria-label="Inject intent" ${readOnly}>
        </div>`;
      }).join('') || `<p class="sb-empty">No inject planned yet. Add them one by one or let the AI plan ${block.stimuli_target || 'them'}.${storyboard.cast.length ? '' : ' Senders are the roles defined in the Actors tab.'}</p>`}
    </div>
  </div>`;
}

/* The panel keeps the same height with or without a selection, so the timeline
   above never jumps when a block is selected or deselected. */
function renderSbMultiDetails(storyboard) {
  const blocks = sbUI().selected.map((id) => sbBlock(storyboard, id)).filter(Boolean);
  const busy = sbReadOnly() ? 'disabled' : '';
  return `<section class="sb-details is-empty" aria-label="Details">
    <strong class="sb-details-lead">${blocks.length} blocks selected</strong>
    <span class="sb-multi-list">${blocks.map((block) => `<button data-sb-action="select-block" data-sb-block="${block.id}" style="--clip-color:${sbBlockColor(block, storyboard)}">${escapeHtml(block.title)}</button>`).join('')}</span>
    <p class="sb-help">Drag one of them to move them together, or use the arrow keys.</p>
    <span class="sb-inline">
      <button class="btn btn-secondary btn-xs" data-sb-action="deepen-selection" ${isLLMAvailable() && !busy ? '' : 'disabled'}>${sbUiIcon('layers', 12)} Detail with AI</button>
      <button class="btn btn-primary btn-xs" data-sb-action="generate-block" ${busy}>${sbUiIcon('play', 11)} Generate injects</button>
      <button class="btn btn-secondary btn-xs" data-sb-action="delete-block" ${busy}>${sbUiIcon('trash', 12)} Delete</button>
      <button class="btn btn-ghost btn-xs" data-sb-action="deselect">Clear selection</button>
    </span>
  </section>`;
}

function renderSbEmptyDetails(storyboard) {
  const project = appState.scenario;
  const unlinked = project.stimuli.filter((stimulus) => !sbStimulusLink(stimulus)).length;
  const stats = sbStats(storyboard, project.stimuli);
  const empty = !storyboard.blocks.length;
  return `<section class="sb-details is-empty" aria-label="Details">
    <span class="sb-empty-icon">${sbUiIcon('layers', 20)}</span>
    <strong class="sb-details-lead">${empty ? 'No crisis step yet' : 'Select a block to see its details here'}</strong>
    <p class="sb-help">${empty
      ? 'Build the scenario in the <button class="sb-link-btn" data-route="scenario">Scenario</button> tab, or double-click a row above to add a block.'
      : 'Double-click an empty spot of a row to add a block. Drag a block to move it, drag its edges to change its duration. Ctrl+Z undoes, Del deletes, Ctrl+D duplicates.'}</p>
    <span class="sb-facts">
      <span><b>${sbMainBlocks(storyboard).length}</b> crisis steps</span>
      <span><b>${stats.blocks - sbMainBlocks(storyboard).length}</b> crisis cell blocks</span>
      <span><b>${stats.beats}/${stats.planned}</b> injects planned</span>
      <span><b>${stats.generated}</b> generated</span>
    </span>
    ${unlinked && storyboard.blocks.length ? `<button class="btn btn-secondary btn-xs" data-sb-action="auto-link" ${sbReadOnly() ? 'disabled' : ''} title="Link injects created by hand or imported to the crisis step covering their time">${sbUiIcon('link', 12)} Link ${unlinked} existing inject(s) to the steps</button>` : ''}
  </section>`;
}

// ── Scenario tab ─────────────────────────────────────────────────────────────
function renderScenarioTab() {
  return sbWithRenderMemo(() => {
    const storyboard = sbStoryboard();
    sbCaptureFocus();
    return `<section class="sb-context" data-sb-scope>
      ${renderSbStatusBar()}
      ${renderScenarioBrief(storyboard)}
      ${renderScenarioLibraryCard(storyboard)}
      ${renderScenarioFraming(storyboard)}
      ${sbUI().modal === 'preview' ? renderSbPreviewModal() : ''}
    </section>`;
  });
}

const SB_SECTORS = [['Banking', 'Banque'], ['Energy', 'Énergie'], ['Healthcare', 'Santé'], ['Transport', 'Transport'], ['Industry', 'Industrie'], ['Telecom', 'Telecom'], ['Retail', 'Retail'], ['Public sector', 'Public'], ['Other', 'Autre']];

function renderScenarioBrief(storyboard) {
  const ui = sbUI();
  const project = appState.scenario;
  const readOnly = sbReadOnly() ? 'disabled' : '';
  const ai = isLLMAvailable();
  const linked = project.stimuli.filter((stimulus) => sbStimulusLink(stimulus)).length;
  const hours = (ui.skeleton.duration || storyboard.duration_minutes) / 60;
  const cells = sbCells(storyboard);
  const customCells = cells.filter((track) => !SB_TRACK_PRESETS.some((preset) => preset.key === track.key));
  const sectorKnown = SB_SECTORS.some(([en, fr]) => project.client.sector === en || project.client.sector === fr);
  return `<article class="card sb-describe">
    <div class="section-header">
      <div class="sb-step-title"><span class="sb-step-num">1</span><div><h3>Describe the crisis</h3><p class="subtle">A few lines are enough: what happens, to whom and what you want to test. The AI writes the detailed scenario, the crisis steps and the roles; you can then edit everything.</p></div></div>
    </div>
    <div class="sb-describe-grid">
      <div class="sb-describe-main">
        <label class="field">Macro scenario
          <textarea data-sb-meta="brief" rows="8" placeholder="e.g. Ransomware attack on a regional hospital group on a Sunday night. Patient records and imaging are encrypted, the attackers threaten to publish health data. We want to test the executive crisis cell on isolation, patient safety, communication and regulatory notifications." ${readOnly}>${escapeHtml(storyboard.meta.brief)}</textarea>
        </label>
        <label class="field">Exercise objectives · one per line
          <textarea data-sb-project="scenario.objectives" rows="4" placeholder="Leave empty to let the AI propose them, e.g.&#10;Decide on isolation under uncertainty&#10;Notify authorities on time" ${readOnly}>${escapeHtml(project.scenario.objectives || '')}</textarea>
        </label>
      </div>
      <div class="sb-describe-side">
        <div class="field-grid cols-2">
          <label class="field">Organisation<input type="text" data-bind="client.name" value="${escapeAttribute(project.client.name || '')}" placeholder="Client name"></label>
          <label class="field">Sector<select data-bind="client.sector">${sectorKnown ? '' : sbOption(project.client.sector || '', project.client.sector || '-', project.client.sector || '')}${SB_SECTORS.map(([en, fr]) => `<option value="${en}" ${project.client.sector === en || project.client.sector === fr ? 'selected' : ''}>${tt(en, fr)}</option>`).join('')}</select></label>
          <label class="field">Duration (hours)<input type="number" min="0.5" max="${SB_MAX_DURATION / 60}" step="0.5" data-sb-duration-hours value="${Number(hours.toFixed(2))}" ${readOnly}></label>
          <label class="field">Target injects<input type="number" min="0" step="1" data-sb-ui="skeleton.injects" value="${escapeAttribute(ui.skeleton.injects)}" placeholder="Automatic"></label>
          <label class="field">Start<input type="datetime-local" data-bind="scenario.start_date" value="${escapeAttribute(project.scenario.start_date || '')}"></label>
          <label class="field">Timezone<select data-bind="scenario.timezone">${TIMEZONES.map((item) => sbOption(item, item, project.scenario.timezone)).join('')}</select></label>
          <label class="field">Crisis type<select data-bind="scenario.type">${SB_CRISIS_TYPES.includes(project.scenario.type) ? '' : sbOption(project.scenario.type || '', project.scenario.type || '-', project.scenario.type || '')}${SB_CRISIS_TYPES.map((type) => sbOption(type, type, project.scenario.type)).join('')}</select></label>
          <label class="field">Inject language<select data-bind="settings.inject_language">${LANGUAGES.map((item) => sbOption(item.value, item.label, project.settings.inject_language || 'en')).join('')}</select></label>
        </div>
        <div class="field">Crisis cells
          <div class="sb-cell-toggles">${SB_TRACK_PRESETS.filter((preset) => preset.kind !== 'main').map((preset) => {
            const on = cells.some((track) => track.key === preset.key);
            return `<label class="${on ? 'on' : ''}" style="--track-color:${preset.color}"><input type="checkbox" data-sb-cell-toggle="${preset.key}" ${on ? 'checked' : ''} ${readOnly}><span>${escapeHtml(preset.name)}</span></label>`;
          }).join('')}${customCells.map((track) => `<label class="on" style="--track-color:${track.color}"><input type="checkbox" data-sb-cell-toggle="id:${track.id}" checked ${readOnly}><span>${escapeHtml(track.name)}</span></label>`).join('')}</div>
        </div>
        <details class="sb-more">
          <summary>More settings</summary>
          <div class="field-grid cols-2">
            <label class="field">Primary language<select data-bind="client.language">${LANGUAGES.map((item) => sbOption(item.value, item.label, project.client.language || 'en')).join('')}</select></label>
            <label class="field">Logo (URL or data URI)<input type="url" data-bind="client.logo_url" value="${escapeAttribute(project.client.logo_url || '')}" placeholder="https://..."></label>
          </div>
        </details>
      </div>
    </div>
    ${storyboard.blocks.length ? `<p class="agent-warning">Building again replaces the current crisis steps. A version is saved first and Undo is available${linked ? `; ${linked} linked inject(s) will be listed in Sync` : ''}.</p>` : ''}
    ${!ai ? '<p class="agent-warning">Configure an AI connection in Settings to build the scenario with AI, or start from a ready-made scenario below.</p>' : ''}
    <div class="sb-describe-actions">
      <button class="btn btn-primary" data-sb-action="generate-skeleton" ${ai && !sbBusy() ? '' : 'disabled'}>${sbUiIcon('wand', 15)} Build the detailed scenario with AI</button>
      <span class="subtle">Writes the story, threat, objectives, crisis steps and crisis cell activities, and the roles who send injects.</span>
    </div>
  </article>`;
}

function renderScenarioLibraryCard(storyboard) {
  const ui = sbUI();
  const open = ui.libraryOpen === null ? !storyboard.blocks.length : ui.libraryOpen;
  const count = sbLibraryEntries().length;
  return `<article class="card sb-library-card ${open ? 'is-open' : ''}">
    <button class="sb-library-toggle" data-sb-action="toggle-library" aria-expanded="${open}">
      <span class="sb-context-subtitle">${sbIcon('database', 15)} Or start from a ready-made scenario · ${count}</span>
      <span class="subtle">${open ? 'Hide' : 'Show the library'} ${sbUiIcon(open ? 'up' : 'down', 14)}</span>
    </button>
    ${open ? `<div class="sb-context-library">${renderSbLibrary()}</div>` : ''}
  </article>`;
}

function renderScenarioFraming(storyboard) {
  const project = appState.scenario;
  const readOnly = sbReadOnly() ? 'disabled' : '';
  const steps = sbMainBlocks(storyboard);
  return `<article class="card sb-framing">
    <div class="section-header">
      <div class="sb-step-title"><span class="sb-step-num">2</span><div><h3>Detailed scenario</h3><p class="subtle">Written by the AI or by you. Used as context by every AI feature: injects, agent and checker.</p></div></div>
    </div>
    <div class="field-grid cols-2">
      <label class="field">Scenario name<input type="text" data-sb-project="name" value="${escapeAttribute(project.name || '')}" placeholder="Untitled scenario" ${readOnly}></label>
      <label class="field">Threat<textarea data-sb-meta="threat" rows="2" placeholder="Threat actor, initial access, impact" ${readOnly}>${escapeHtml(storyboard.meta.threat)}</textarea></label>
      <label class="field">Summary<textarea data-sb-project="scenario.summary" rows="4" placeholder="The crisis in a few sentences, injected into every AI prompt" ${readOnly}>${escapeHtml(project.scenario.summary || '')}</textarea></label>
      <label class="field">Narrative arc<textarea data-sb-project="scenario.narrative_arc" rows="4" placeholder="How pressure builds and how the exercise ends" ${readOnly}>${escapeHtml(project.scenario.narrative_arc || '')}</textarea></label>
      <label class="field">Detailed story · the hidden story<textarea data-sb-meta="synopsis" rows="9" placeholder="What really happens from the attacker's first move to the end of the crisis" ${readOnly}>${escapeHtml(storyboard.meta.synopsis)}</textarea></label>
      <label class="field">Technical context<textarea data-sb-project="scenario.detailed_context" rows="9" placeholder="Affected systems, attack vector, compromised data, business impact…" ${readOnly}>${escapeHtml(project.scenario.detailed_context || '')}</textarea></label>
    </div>
    <div class="sb-context-phases">
      <span class="sb-context-subtitle">Crisis steps</span>
      ${steps.length ? `<ol>${steps.map((block) => `<li style="--clip-color:${sbBlockColor(block, storyboard)}"><b>${sbFormatOffset(block.start_minutes)}</b> ${escapeHtml(block.title)}</li>`).join('')}</ol>` : '<span class="subtle">No step yet: build the scenario with AI or pick a ready-made one.</span>'}
    </div>
    <div class="sb-next-steps">
      <button class="btn btn-secondary btn-sm" data-route="actors">${sbIcon('users', 14)} Next: Actors ${sbUiIcon('arrow', 14)}</button>
      <button class="btn btn-primary btn-sm" data-route="builder">${sbIcon('flag', 14)} Crisis steps ${sbUiIcon('arrow', 14)}</button>
    </div>
  </article>`;
}

// ── Actors tab: roles of the storyline ───────────────────────────────────────
function renderStoryboardRoles() {
  return sbWithRenderMemo(() => {
    const storyboard = sbStoryboard();
    const project = appState.scenario;
    sbCaptureFocus();
    const usage = new Map();
    storyboard.blocks.forEach((block) => block.beats.forEach((beat) => usage.set(beat.cast_id, (usage.get(beat.cast_id) || 0) + 1)));
    const readOnly = sbReadOnly() ? 'disabled' : '';
    const missing = storyboard.cast.filter((cast) => !sbFindActorForCast(project, cast)).length;
    return `<section class="sb-roles" data-sb-scope>
      ${renderSbStatusBar()}
      <article class="card">
        <div class="section-header">
          <div>
            <h3>Roles in the crisis steps</h3>
            <p class="subtle">Who sends the injects planned in the Crisis steps tab. Each role is played by one of the actors above${missing ? `; ${missing} role(s) have no actor yet` : ''}.</p>
          </div>
          <div class="actions">
            <button class="btn btn-secondary" data-sb-action="plan-cast" ${readOnly} ${isLLMAvailable() && storyboard.blocks.length ? '' : 'disabled'}>${sbUiIcon('wand', 13)} Suggest roles</button>
            <button class="btn btn-secondary" data-sb-action="create-actors" ${readOnly} ${storyboard.cast.length ? '' : 'disabled'}>Create missing actors</button>
            <button class="btn btn-primary" data-sb-action="add-cast" ${readOnly}>${sbUiIcon('plus', 13)} Add role</button>
          </div>
        </div>
        ${storyboard.cast.length ? `<div style="overflow-x:auto;">
          <table class="table sb-roles-table">
            <thead><tr><th>Role</th><th>Type</th><th>Organisation</th><th>Played by</th><th>Injects</th><th></th></tr></thead>
            <tbody>${storyboard.cast.map((cast) => {
              const actor = cast.actor_id ? getActor(cast.actor_id) : null;
              return `<tr>
                <td><input type="text" data-sb-cast="${cast.id}.label" value="${escapeAttribute(cast.label)}" aria-label="Role label" ${readOnly}></td>
                <td><select data-sb-cast="${cast.id}.role" aria-label="Role type" ${readOnly}>${ROLES.map((role) => sbOption(role.value, roleLabel(role.value), cast.role)).join('')}</select></td>
                <td><input type="text" data-sb-cast="${cast.id}.organization" value="${escapeAttribute(cast.organization)}" placeholder="Organisation" aria-label="Organisation" ${readOnly}></td>
                <td><select class="sb-cast-actor ${actor ? 'is-linked' : ''}" data-sb-cast="${cast.id}.actor_id" aria-label="Actor" ${readOnly}>
                  ${sbOption('', '- No actor yet -', cast.actor_id)}
                  ${project.actors.map((item) => sbOption(item.id, `${item.name} · ${item.title || roleLabel(item.role)}`, actor?.id || '')).join('')}
                </select></td>
                <td class="sb-roles-usage">${usage.get(cast.id) || 0}</td>
                <td><button class="btn btn-ghost" data-sb-action="delete-cast" data-sb-cast-id="${cast.id}" ${readOnly}>Delete</button></td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>` : '<p class="sb-empty">No role yet. Roles are created when the scenario is built with AI or loaded from the library, or added here.</p>'}
      </article>
    </section>`;
  });
}

// ── Library (Scenario tab) ────────────────────────────────────────────────────
function renderSbLibrary() {
  const ui = sbUI();
  ui.libraryCategory = ui.libraryCategory || '';
  const entries = sbLibraryEntries();
  const categories = [...new Set(entries.map((entry) => entry.category || 'Custom'))];
  const visible = entries.filter((entry) => !ui.libraryCategory || (entry.category || 'Custom') === ui.libraryCategory);
  return `<div class="sb-library-tools">
      <input type="search" class="sb-search" data-sb-filter="library" placeholder="Search scenarios…" aria-label="Search the library">
      <div class="sb-chips">${['', ...categories].map((category) => `<button class="sb-filter-chip ${ui.libraryCategory === category ? 'active' : ''}" data-sb-action="library-category" data-sb-value="${escapeAttribute(category)}">${escapeHtml(category || 'All')}</button>`).join('')}</div>
    </div>
    <div class="sb-library-list">
      ${visible.map(renderSbTemplateCard).join('') || '<p class="sb-empty">No scenario in this category.</p>'}
    </div>
    <div class="sb-library-footer">
      <label class="sb-mini-field">Save the current scenario as a template
        <span class="sb-inline"><input type="text" data-sb-ui="templateName" value="${escapeAttribute(ui.templateName)}" placeholder="Template name"><button class="btn btn-secondary btn-xs" data-sb-action="save-template">Save</button></span>
      </label>
      <button class="btn btn-ghost btn-xs" data-sb-action="import-template">${sbUiIcon('upload', 12)} Import a template file</button>
    </div>`;
}


function sbMiniTimeline(template) {
  const duration = Number(template.duration_minutes) || SB_DEFAULT_DURATION;
  const blocks = Array.isArray(template.blocks) ? template.blocks : [];
  const rows = [...new Set(blocks.map((block) => block.track || 'main'))];
  return `<div class="sb-mini-timeline" aria-hidden="true">${rows.slice(0, 5).map((row) => `<div class="sb-mini-row ${row === 'main' ? 'is-main' : ''}">${blocks.filter((block) => (block.track || 'main') === row).map((block) => `<i style="left:${(100 * (block.start || 0) / duration).toFixed(2)}%;width:${Math.max(1, 100 * (block.duration || 0) / duration).toFixed(2)}%;background:${(SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom).color}"></i>`).join('')}</div>`).join('')}</div>`;
}


function renderSbTemplateCard(template) {
  const stats = sbTemplateStats(template);
  const search = `${template.name} ${template.category} ${(template.tags || []).join(' ')} ${template.summary || ''}`.toLowerCase();
  return `<article class="sb-template-card" data-sb-search="${escapeAttribute(search)}">
    <div class="sb-template-head">
      <span class="sb-template-icon">${sbIcon(template.icon || 'square', 18)}</span>
      <div><strong>${escapeHtml(template.name)}</strong><small>${escapeHtml(template.category || 'Custom')}${template.builtin ? '' : ' · My template'}</small></div>
    </div>
    <p>${escapeHtml(template.summary || '')}</p>
    ${sbMiniTimeline(template)}
    <div class="sb-template-meta"><span>${escapeHtml(sbFormatDuration(stats.duration))}</span><span>${stats.blocks} blocks</span><span>${stats.injects} injects</span></div>
    <div class="sb-template-actions">
      <button class="btn btn-secondary btn-xs" data-sb-action="preview-template" data-sb-template="${escapeAttribute(template.id)}">Preview</button>
      <button class="btn btn-primary btn-xs" data-sb-action="use-template" data-sb-template="${escapeAttribute(template.id)}" data-sb-mode="replace">Use</button>
    </div>
  </article>`;
}

// ── Modals ───────────────────────────────────────────────────────────────────
function sbModalShell(title, body, footer = '', size = '') {
  return `<div class="modal-backdrop sb-modal-backdrop" data-sb-backdrop>
    <div class="modal-box sb-modal ${size}" role="dialog" aria-modal="true" aria-label="${escapeAttribute(title)}">
      <div class="modal-header"><h3>${title}</h3><button class="btn btn-secondary btn-xs" data-sb-action="close-modal" aria-label="Close">${sbUiIcon('close', 14)}</button></div>
      <div class="modal-body sb-modal-body">${body}</div>
      ${footer ? `<div class="sb-modal-foot">${footer}</div>` : ''}
    </div>
  </div>`;
}


function renderSbModal(storyboard) {
  const ui = sbUI();
  switch (ui.modal) {
    case 'versions': return renderSbVersionsModal(storyboard);
    case 'coherence': return renderSbCoherenceModal(storyboard);
    case 'generate': return renderSbGenerateModal(storyboard);
    case 'sync': return renderSbSyncModal(storyboard);
    case 'preview': return renderSbPreviewModal();
    default: return '';
  }
}


function renderSbVersionsModal(storyboard) {
  const ui = sbUI();
  const versions = StoryboardHistory.versions();
  const selected = ui.diffVersionId ? StoryboardHistory.findVersion(ui.diffVersionId) : null;
  const diff = selected ? StoryboardHistory.diff(selected.id) : null;
  const kinds = { named: 'Named', auto: 'Autosave', ai: 'Before AI', generation: 'Before generation', restore: 'Before restore' };
  const body = `<div class="sb-versions">
      <div class="sb-versions-list">
        <div class="sb-version-save">
          <input type="text" data-sb-ui="versionLabel" value="${escapeAttribute(ui.versionLabel)}" placeholder="Name this version (e.g. V1 sent to client)">
          <button class="btn btn-secondary btn-xs" data-sb-action="save-version">${sbUiIcon('star', 12)} Save</button>
        </div>
        <button class="btn btn-ghost btn-xs" data-sb-action="mark-validated">${sbUiIcon('check', 12)} Mark current storyboard as validated</button>
        <ol>${versions.map((version) => `<li class="${selected?.id === version.id ? 'active' : ''} is-${version.kind}">
          <button data-sb-action="compare-version" data-sb-version="${version.id}">
            <strong>${escapeHtml(version.label)}</strong>
            <small>${escapeHtml(kinds[version.kind] || version.kind)} · rev ${version.rev} · ${escapeHtml(new Date(version.created_at).toLocaleString())}</small>
            <small>${version.stats?.blocks ?? '?'} blocks · ${version.stats?.beats ?? '?'} planned injects</small>
          </button>
        </li>`).join('') || '<li class="sb-empty">No version yet. Versions are saved before every AI operation, restore and generation, every 5 minutes while you edit, and when you name one.</li>'}</ol>
      </div>
      <div class="sb-versions-detail">
        ${selected ? `<h4>${escapeHtml(selected.label)}</h4>
          <p class="sb-help">Changes from this version to the current storyboard.</p>
          ${renderSbDiff(diff)}
          <div class="actions">
            <button class="btn btn-primary btn-sm" data-sb-action="restore-version" data-sb-version="${selected.id}">Restore this version</button>
            <button class="btn btn-secondary btn-sm" data-sb-action="delete-version" data-sb-version="${selected.id}">${sbUiIcon('trash', 12)} Delete</button>
          </div>` : `<p class="sb-empty">Select a version to compare it with the current storyboard. Undo/redo (${StoryboardHistory.undoStack.length}/${StoryboardHistory.redoStack.length}) covers every edit of this session.</p>`}
      </div>
    </div>`;
  return sbModalShell('Versions', body, '', 'sb-modal-wide');
}


function renderSbDiff(diff) {
  if (!diff || !diff.count) return '<p class="sb-empty">Identical to the current storyboard.</p>';
  const fieldLabels = { title: 'title', type: 'type', track_id: 'track', start_minutes: 'start', duration_minutes: 'duration', stimuli_target: 'inject count', brief: 'brief', narrative: 'narrative', objectives: 'objectives', beats: 'inject plan', status: 'status', locked: 'lock', notes: 'notes' };
  return `<ul class="sb-diff">
    ${diff.added.map((item) => `<li class="is-added">+ ${escapeHtml(item.title)} <small>added since</small></li>`).join('')}
    ${diff.removed.map((item) => `<li class="is-removed">− ${escapeHtml(item.title)} <small>removed since</small></li>`).join('')}
    ${diff.changed.map((item) => `<li class="is-changed">~ ${escapeHtml(item.title)} <small>${item.fields.map((field) => fieldLabels[field] || field).join(', ')}</small></li>`).join('')}
    ${diff.meta.length ? `<li class="is-changed">~ Scenario <small>${diff.meta.join(', ')}</small></li>` : ''}
    ${diff.cast.added.length + diff.cast.removed.length + diff.cast.changed.length ? `<li class="is-changed">~ Cast <small>${[...diff.cast.added.map((label) => `+${label}`), ...diff.cast.removed.map((label) => `−${label}`), ...diff.cast.changed].map(escapeHtml).join(', ')}</small></li>` : ''}
  </ul>`;
}


function renderSbCoherenceModal(storyboard) {
  const report = storyboard.meta.coherence;
  const issues = report?.issues || [];
  const groups = [['error', 'Errors'], ['warning', 'Warnings'], ['info', 'Suggestions']];
  const body = `<div class="sb-coherence-head">
      ${sbScoreRing(report?.score)}
      <div>
        <strong>${report ? `Score ${report.score}/100` : 'Not checked yet'}</strong>
        <p class="sb-help">${report ? `${escapeHtml(report.summary || 'Deterministic checks only.')} Checked on rev ${report.checked_rev}${report.checked_rev !== storyboard.rev ? ' (storyboard changed since)' : ''}.` : 'Run the checks to review structure, timing, objectives coverage and workstream balance.'}</p>
      </div>
    </div>
    ${groups.map(([severity, title]) => {
      const list = issues.map((issue, index) => ({ issue, index })).filter(({ issue }) => issue.severity === severity);
      if (!list.length) return '';
      return `<h4 class="sb-issue-title is-${severity}">${title} · ${list.length}</h4><ul class="sb-issues">${list.map(({ issue, index }) => `<li class="is-${severity}">
        <span>${issue.source === 'ai' ? '<b class="sb-flag is-ai">AI</b> ' : ''}${escapeHtml(issue.message)}</span>
        <span class="sb-inline">
          ${issue.block_ids.length ? `<button class="btn btn-ghost btn-xs" data-sb-action="select-blocks" data-sb-blocks="${escapeAttribute(issue.block_ids.join(','))}">Show</button>` : ''}
          ${issue.fix ? `<button class="btn btn-secondary btn-xs" data-sb-action="apply-fix" data-sb-issue="${index}" title="${escapeAttribute(Object.entries(issue.fix.patch).map(([key, value]) => `${key}: ${value}`).join('\n'))}">Apply fix</button>` : ''}
        </span>
      </li>`).join('')}</ul>`;
    }).join('')}`;
  const footer = `<button class="btn btn-secondary btn-sm" data-sb-action="run-coherence" data-sb-value="rules" ${sbBusy() ? 'disabled' : ''}>Run checks</button>
    <button class="btn btn-primary btn-sm" data-sb-action="run-coherence" data-sb-value="ai" ${isLLMAvailable() && !sbBusy() && storyboard.blocks.length ? '' : 'disabled'}>${sbUiIcon('wand', 13)} Checks + AI review</button>`;
  return sbModalShell('Global coherence', body, footer, 'sb-modal-wide');
}


function renderSbGenerateModal(storyboard) {
  const ui = sbUI();
  const project = appState.scenario;
  const options = ui.generate;
  const selection = ui.selected.map((id) => sbBlock(storyboard, id)).filter(Boolean);
  const scope = options.scope === 'selection' && selection.length ? selection : sbSortedBlocks(storyboard);
  const toPlan = scope.filter((block) => !block.locked && block.beats.length < block.stimuli_target);
  const missing = scope.reduce((sum, block) => sum + block.beats.filter((beat) => !sbStimulusForBeat(project, beat.id)).length, 0);
  const toPlanCount = toPlan.reduce((sum, block) => sum + block.stimuli_target - block.beats.length, 0);
  const castMissing = storyboard.cast.filter((cast) => !sbFindActorForCast(project, cast)).length;
  const running = SbPipeline.active;
  const ai = isLLMAvailable();
  const body = `<div class="sb-generate">
      <div class="sb-mini-field">Scope
        <div class="sb-segmented">
          <button class="${options.scope !== 'selection' ? 'active' : ''}" data-sb-action="generate-scope" data-sb-value="all">All blocks · ${storyboard.blocks.length}</button>
          <button class="${options.scope === 'selection' ? 'active' : ''}" data-sb-action="generate-scope" data-sb-value="selection" ${selection.length ? '' : 'disabled'}>Selection · ${selection.length} block(s)</button>
        </div>
      </div>
      <div class="sb-pipeline">
        <label class="${options.plan && ai ? 'on' : ''}"><input type="checkbox" data-sb-generate="plan" ${options.plan && ai ? 'checked' : ''} ${ai ? '' : 'disabled'}><span><b>1 · Plan</b>Complete the inject plan with AI (${toPlanCount} to plan in ${toPlan.length} block(s))</span></label>
        <label class="${options.cast ? 'on' : ''}"><input type="checkbox" data-sb-generate="cast" ${options.cast ? 'checked' : ''}><span><b>2 · Cast</b>Create missing actors for the roles (${castMissing} role(s) without actor)</span></label>
        <label class="on"><input type="checkbox" checked disabled><span><b>3 · Create</b>Create one inject per planned item (${missing} ready now), linked to its block</span></label>
        <label class="${options.write && ai ? 'on' : ''}"><input type="checkbox" data-sb-generate="write" ${options.write && ai ? 'checked' : ''} ${ai ? '' : 'disabled'}><span><b>4 · Write</b>Write each inject with AI in ${escapeHtml(sbLanguageName(project))}, with the storyboard as context</span></label>
      </div>
      ${!ai ? '<p class="agent-warning">AI is not configured: injects already planned will be created as drafts, without content.</p>' : ''}
      ${SbPipeline.log.length ? `<ol class="agent-log sb-log">${SbPipeline.log.map((entry) => `<li class="agent-log-${entry.kind === 'error' ? 'error' : entry.kind === 'warning' ? 'warning' : 'success'}"><span>${entry.kind === 'success' ? '✓' : entry.kind === 'info' ? '→' : '⚠'} ${escapeHtml(entry.message)}</span></li>`).join('')}</ol>` : ''}
    </div>`;
  const footer = `${SbPipeline.checkpoint && SbPipeline.checkpoint.projectId === project.id && !running ? `<button class="btn btn-ghost btn-sm" data-sb-action="undo-generation" title="Restore actors, injects and storyboard from before ${escapeAttribute(SbPipeline.checkpoint.label)}">${sbUiIcon('undo', 13)} Undo ${escapeHtml(SbPipeline.checkpoint.label)}</button>` : ''}
    ${running ? `<button class="btn btn-secondary btn-sm" data-sb-action="stop-pipeline">${sbUiIcon('stop', 13)} Stop</button>` : `<button class="btn btn-primary btn-sm" data-sb-action="start-generation" ${sbReadOnly() || !scope.length ? 'disabled' : ''}>${sbUiIcon('play', 13)} Start</button>`}`;
  return sbModalShell('Generate actors and injects', body, footer, 'sb-modal-wide');
}


function renderSbSyncModal(storyboard) {
  const ui = sbUI();
  if (!ui.impacts) ui.impacts = sbComputeImpacts(appState.scenario);
  const impacts = ui.impacts;
  const kinds = [
    ['retime', 'Timing', 'Blocks or planned injects moved: injects are rescheduled; content is untouched.'],
    ['outdated', 'Content', 'Brief, narrative or inject plan changed after the inject was written. Manual edits are adapted, not overwritten.'],
    ['orphan', 'Orphans', 'Injects whose block or planned item was removed.'],
    ['missing', 'New injects', 'Planned injects without a stimulus yet.'],
    ['actor_missing', 'Missing actors', 'Roles used by planned injects without an actor.'],
    ['actor_outdated', 'Actors', 'Roles changed since their actor was created.']
  ];
  const actionLabels = { apply: 'Apply', skip: 'Skip', unlink: 'Keep, unlink', delete: 'Delete inject', regenerate: 'Regenerate', adapt: 'Adapt, keep manual edits', accept: 'Keep as is', create: 'Create', update: 'Update actor' };
  const body = `${impacts.length ? kinds.map(([kind, title, help]) => {
      const list = impacts.filter((impact) => impact.kind === kind);
      if (!list.length) return '';
      return `<section class="sb-sync-group"><h4>${escapeHtml(title)} · ${list.length}</h4><p class="sb-help">${escapeHtml(help)}</p>
        <ul class="sb-sync-list">${list.map((impact) => `<li>
          <span class="sb-sync-label">${escapeHtml(impact.label)}${impact.manual ? ' <span class="sb-status is-manual">manual</span>' : ''}<small>${escapeHtml(impact.detail || '')}</small></span>
          <select data-sb-impact="${impact.id}" ${SbPipeline.active ? 'disabled' : ''}>${impact.options.map((option) => sbOption(option, actionLabels[option] || option, impact.action)).join('')}</select>
        </li>`).join('')}</ul></section>`;
    }).join('') : '<p class="sb-empty">Everything is in sync: injects and actors match the storyboard.</p>'}
    ${SbPipeline.log.length ? `<ol class="agent-log sb-log">${SbPipeline.log.slice(-12).map((entry) => `<li class="agent-log-${entry.kind === 'error' ? 'error' : entry.kind === 'warning' ? 'warning' : 'success'}"><span>${escapeHtml(entry.message)}</span></li>`).join('')}</ol>` : ''}`;
  const count = impacts.filter((impact) => impact.action !== 'skip').length;
  const footer = `${SbPipeline.checkpoint && SbPipeline.checkpoint.projectId === appState.scenario.id && !SbPipeline.active ? `<button class="btn btn-ghost btn-sm" data-sb-action="undo-generation">${sbUiIcon('undo', 13)} Undo ${escapeHtml(SbPipeline.checkpoint.label)}</button>` : ''}
    <button class="btn btn-secondary btn-sm" data-sb-action="refresh-sync" ${SbPipeline.active ? 'disabled' : ''}>${sbUiIcon('sync', 13)} Refresh</button>
    ${SbPipeline.active ? `<button class="btn btn-secondary btn-sm" data-sb-action="stop-pipeline">${sbUiIcon('stop', 13)} Stop</button>` : `<button class="btn btn-primary btn-sm" data-sb-action="apply-sync" ${count && !sbReadOnly() ? '' : 'disabled'}>Apply ${count} change(s)</button>`}`;
  return sbModalShell('Synchronise actors and injects', body, footer, 'sb-modal-wide');
}


function renderSbPreviewModal() {
  const ui = sbUI();
  const template = sbFindTemplate(ui.previewId);
  if (!template) return '';
  const stats = sbTemplateStats(template);
  const cast = new Map((template.cast || []).map((item) => [String(item.key), item.label]));
  const tracks = [...new Set((template.blocks || []).map((block) => block.track || 'main'))];
  const body = `<div class="sb-preview-head">
      <span class="sb-template-icon is-large">${sbIcon(template.icon || 'square', 24)}</span>
      <div><p class="sb-help">${escapeHtml(template.category || 'Custom')} · ${escapeHtml(sbFormatDuration(stats.duration))} · ${stats.blocks} blocks · ${stats.injects} injects</p>
      <p>${escapeHtml(template.summary || '')}</p>
      ${template.threat ? `<p class="sb-help"><b>Threat.</b> ${escapeHtml(template.threat)}</p>` : ''}</div>
    </div>
    <div class="sb-preview-timeline">${tracks.map((track) => `<div class="sb-preview-row"><span>${escapeHtml(SB_TRACK_PRESETS.find((preset) => preset.key === track)?.name || track)}</span><div>${(template.blocks || []).filter((block) => (block.track || 'main') === track).map((block) => `<i style="left:${(100 * block.start / stats.duration).toFixed(2)}%;width:${(100 * block.duration / stats.duration).toFixed(2)}%;--clip-color:${(SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom).color}" title="${escapeAttribute(`${sbFormatOffset(block.start)} · ${block.title}`)}">${escapeHtml(block.title)}</i>`).join('')}</div></div>`).join('')}</div>
    ${(template.objectives || []).length ? `<h4>Objectives</h4><ol class="sb-preview-objectives">${template.objectives.map((objective) => `<li>${escapeHtml(objective)}</li>`).join('')}</ol>` : ''}
    <h4>Crisis steps and cells</h4>
    <div class="sb-preview-blocks">${[...(template.blocks || [])].sort((a, b) => a.start - b.start).map((block) => `<details style="--clip-color:${(SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom).color}">
        <summary><span>${sbFormatOffset(block.start)}</span><strong>${escapeHtml(block.title)}</strong><small>${escapeHtml(SB_TRACK_PRESETS.find((preset) => preset.key === (block.track || 'main'))?.name || '')} · ${block.stimuli || (block.beats || []).length} injects</small></summary>
        <p>${escapeHtml(block.brief || '')}</p>${block.narrative ? `<p class="sb-help">${escapeHtml(block.narrative)}</p>` : ''}
        ${(block.beats || []).length ? `<ul>${block.beats.map((beat) => `<li><i class="sb-dot" style="background:${sbChannelColor(beat.channel)}"></i>${sbFormatOffset(block.start + beat.at)} · ${escapeHtml(channelLabel(beat.channel))} · <b>${escapeHtml(cast.get(String(beat.cast)) || '')}</b> ${escapeHtml(beat.title)}</li>`).join('')}</ul>` : ''}
      </details>`).join('')}</div>
    ${(template.cast || []).length ? `<h4>Roles</h4><div class="sb-chips">${template.cast.map((item) => `<span class="sb-filter-chip">${escapeHtml(item.label)}</span>`).join('')}</div>` : ''}`;
  const hasBlocks = sbStoryboard().blocks.length > 0;
  const footer = `${template.builtin ? '' : `<button class="btn btn-ghost btn-sm" data-sb-action="delete-template" data-sb-template="${escapeAttribute(template.id)}">${sbUiIcon('trash', 13)} Delete</button>`}
    <button class="btn btn-ghost btn-sm" data-sb-action="export-template" data-sb-template="${escapeAttribute(template.id)}">${sbUiIcon('download', 13)} Export</button>
    ${hasBlocks ? `<button class="btn btn-secondary btn-sm" data-sb-action="use-template" data-sb-template="${escapeAttribute(template.id)}" data-sb-mode="insert">Insert after the current steps</button>` : ''}
    <button class="btn btn-secondary btn-sm" data-sb-action="adapt-template" data-sb-template="${escapeAttribute(template.id)}" ${isLLMAvailable() && !sbBusy() ? '' : 'disabled'} title="Adapt names, systems, regulators and media to your organisation">${sbUiIcon('wand', 13)} Adapt with AI</button>
    <button class="btn btn-primary btn-sm" data-sb-action="use-template" data-sb-template="${escapeAttribute(template.id)}" data-sb-mode="replace">Use this scenario</button>`;
  return sbModalShell(escapeHtml(template.name), body, footer, 'sb-modal-wide');
}

// ── Focus preservation across full re-renders ────────────────────────────────
const SB_FOCUS_KEYS = ['sbField', 'sbMeta', 'sbProject', 'sbBeat', 'sbCast', 'sbTrackName', 'sbUi'];
function sbCaptureFocus() {
  const element = typeof document !== 'undefined' ? document.activeElement : null;
  const ui = sbUI();
  if (!element || !element.closest?.('[data-sb-scope]')) { ui.focus = null; return; }
  const key = SB_FOCUS_KEYS.find((name) => element.dataset?.[name] !== undefined);
  ui.focus = key ? { key, value: element.dataset[key], start: element.selectionStart, end: element.selectionEnd } : null;
}
function sbRestoreFocus() {
  const ui = sbUI();
  const focus = ui.focus;
  ui.focus = null;
  if (!focus) return;
  const attribute = `data-${focus.key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
  const element = [...document.querySelectorAll(`[${attribute}]`)].find((item) => item.getAttribute(attribute) === focus.value);
  if (!element || element.disabled) return;
  element.focus({ preventScroll: true });
  try { if (focus.start !== null && focus.start !== undefined) element.setSelectionRange(focus.start, focus.end); } catch (_) { /* Not a text field. */ }
}

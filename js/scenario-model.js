/* Scenario Builder model: storyboard schema, presets, normalisation, diff and
   deterministic checks. Pure data helpers; nothing touches the DOM at load. */
const STORYBOARD_SCHEMA = 1;
const SB_DEFAULT_DURATION = 300;
const SB_MAX_DURATION = 10080;
const SB_MAX_BLOCKS = 80;
const SB_MAX_BEATS = 24;

const SB_TRACK_PRESETS = [
  { key: 'main', name: 'Main storyline', kind: 'main', color: '#451dc7' },
  { key: 'technical', name: 'Technical response', kind: 'workstream', color: '#2563eb' },
  { key: 'governance', name: 'Crisis cell & decisions', kind: 'workstream', color: '#211248' },
  { key: 'communication', name: 'Communication', kind: 'workstream', color: '#7c3aed' },
  { key: 'legal', name: 'Legal & regulatory', kind: 'workstream', color: '#0f766e' },
  { key: 'business', name: 'Business & continuity', kind: 'workstream', color: '#d48c00' },
  { key: 'people', name: 'People & logistics', kind: 'workstream', color: '#e11d48' }
];

const SB_BLOCK_TYPES = {
  trigger: { label: 'Trigger & detection', group: 'stage', color: '#dc2626', track: 'main', duration: 45, stimuli: 3, icon: 'bolt', hint: 'Weak signals, first alerts and the event that starts the crisis.' },
  investigation: { label: 'Investigation & qualification', group: 'stage', color: '#2563eb', track: 'main', duration: 60, stimuli: 4, icon: 'search', hint: 'Understand what happened: scope, attacker, affected assets, first hypotheses.' },
  containment: { label: 'Containment & isolation', group: 'stage', color: '#ea580c', track: 'main', duration: 45, stimuli: 3, icon: 'shield', hint: 'Isolate systems, cut access, weigh business impact against spread.' },
  eradication: { label: 'Threat eradication', group: 'stage', color: '#9333ea', track: 'main', duration: 45, stimuli: 3, icon: 'target', hint: 'Remove the attacker, reset credentials, clean persistence.' },
  continuity: { label: 'Business continuity', group: 'stage', color: '#d48c00', track: 'main', duration: 60, stimuli: 3, icon: 'route', hint: 'Degraded mode, workarounds, priorities for critical activities.' },
  recovery: { label: 'Recovery & rebuild', group: 'stage', color: '#1aa574', track: 'main', duration: 45, stimuli: 3, icon: 'refresh', hint: 'Restore, rebuild and restart services in a trusted way.' },
  exit: { label: 'Crisis exit & lessons learned', group: 'stage', color: '#30c38f', track: 'main', duration: 30, stimuli: 2, icon: 'flag', hint: 'Close the crisis, communicate, capture lessons learned.' },
  twist: { label: 'Twist / escalation', group: 'stage', color: '#f43f5e', track: 'main', duration: 30, stimuli: 2, icon: 'spark', hint: 'An aggravating event that raises the pressure or changes the situation.' },
  crisis_cell: { label: 'Crisis cell & governance', group: 'workstream', color: '#211248', track: 'governance', duration: 60, stimuli: 2, icon: 'users', hint: 'Activation, roles, decision cadence, executive arbitration.' },
  communication: { label: 'Communication', group: 'workstream', color: '#7c3aed', track: 'communication', duration: 90, stimuli: 4, icon: 'megaphone', hint: 'Internal messages, media, social networks, public statements.' },
  legal: { label: 'Legal & regulatory', group: 'workstream', color: '#0f766e', track: 'legal', duration: 60, stimuli: 2, icon: 'scale', hint: 'Notifications (GDPR, NIS2, sector), complaint, insurers, contracts.' },
  hr: { label: 'HR & people', group: 'workstream', color: '#e11d48', track: 'people', duration: 60, stimuli: 2, icon: 'heart', hint: 'Staff information, workload, unions, wellbeing, insider aspects.' },
  logistics: { label: 'Logistics', group: 'workstream', color: '#b45309', track: 'people', duration: 60, stimuli: 2, icon: 'box', hint: 'Premises, equipment, crisis room, suppliers, physical operations.' },
  customers: { label: 'Customers & partners', group: 'workstream', color: '#0a66c2', track: 'business', duration: 60, stimuli: 3, icon: 'handshake', hint: 'Clients, partners and suppliers asking questions or applying pressure.' },
  custom: { label: 'Custom block', group: 'custom', color: '#6d687e', track: 'main', duration: 30, stimuli: 2, icon: 'square', hint: 'Anything specific to your exercise.' }
};

/* The stress level of a phase sets its colour: pale green when the crisis calms down,
   pale red at the peak. Each phase type has a default level; a phase can override it. */
const SB_STRESS_LEVELS = [
  { level: 1, label: 'Calm', color: '#2e9e5b' },
  { level: 2, label: 'Low', color: '#7aa82a' },
  { level: 3, label: 'Tension', color: '#d69e00' },
  { level: 4, label: 'High', color: '#ea6a0c' },
  { level: 5, label: 'Peak', color: '#dc2626' }
];
const SB_TYPE_STRESS = { trigger: 3, investigation: 3, containment: 4, eradication: 3, continuity: 4, recovery: 2, exit: 1, twist: 5, custom: 3 };
function sbBlockStress(block) {
  return block?.stress || SB_TYPE_STRESS[block?.type] || 3;
}
function sbStressLevel(level) {
  return SB_STRESS_LEVELS.find((item) => item.level === level) || SB_STRESS_LEVELS[2];
}

const SB_ICON_PATHS = {
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  route: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  flag: '<path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/>',
  spark: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8"/><path d="M22 21a7 7 0 0 0-5-6.7"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l6 5V5L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 8a5 5 0 0 1 0 8"/>',
  scale: '<path d="M12 3v18"/><path d="M5 7h14"/><path d="m5 7-3 7a4 4 0 0 0 6 0z"/><path d="m19 7-3 7a4 4 0 0 0 6 0z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
  handshake: '<path d="m11 17 2 2a1 1 0 0 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 0 0 3-3l-3.9-3.9a2 2 0 0 0-2.8 0l-.9.9a2 2 0 0 1-2.8-2.8L12 4.9a5 5 0 0 1 6.4.3L22 8"/><path d="M2 8l3.6-3.6a5 5 0 0 1 5.5-1"/><path d="m2 14 5 5"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  package: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m7.5 5.5 9 5"/><path d="M12 13v8"/>',
  wave: '<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M2 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M2 6c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
  mask: '<path d="M3 7c3-2 15-2 18 0 0 7-3 11-9 11S3 14 3 7z"/><circle cx="8.5" cy="10.5" r="1.5"/><circle cx="15.5" cy="10.5" r="1.5"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-6 6-6 9-1-1-2-2-2-4-1 2-1 4-1 7 0 4 3 7 7 7z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  factory: '<path d="M2 21V9l6 4V9l6 4V5h6v16z"/><path d="M6 17h2"/><path d="M11 17h2"/><path d="M16 17h2"/>'
};

function sbIcon(name, size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SB_ICON_PATHS[name] || SB_ICON_PATHS.square}</svg>`;
}

// ── Small value helpers ──────────────────────────────────────────────────────
function sbText(value, max = 8000) {
  if (value === null || value === undefined) return '';
  return String(value).slice(0, max);
}
function sbInt(value, fallback, min = 0, max = SB_MAX_DURATION) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
function sbTextList(value, maxItems = 20, maxLength = 600) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\n+/) : [];
  return list.map((item) => sbText(item, maxLength).replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, maxItems);
}
/* Identifiers end up in HTML attributes: only accept safe characters. */
function sbSafeId(value, prefix) {
  const text = typeof value === 'string' ? value : '';
  return /^[A-Za-z0-9_-]{1,120}$/.test(text) ? text : (prefix ? uid(prefix) : '');
}
function sbChannelKeys() {
  return Object.keys(typeof TEMPLATE_LIBRARY === 'object' ? TEMPLATE_LIBRARY : {});
}
function sbValidChannel(channel) {
  return sbChannelKeys().includes(channel) ? channel : 'email_internal';
}
function sbValidTemplateId(channel, templateId) {
  if (!templateId) return '';
  if (channel === 'article_press') return ARTICLE_TEMPLATE_LIBRARY[templateId] ? templateId : '';
  if (channel === 'breaking_news_tv') return TV_TEMPLATE_LIBRARY[templateId] ? templateId : '';
  return '';
}
function sbRoleValue(role) {
  const roles = (typeof ROLES !== 'undefined' ? ROLES : []).map((item) => item.value);
  return roles.includes(role) ? role : 'internal';
}
function sbFormatOffset(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(value / 60);
  const mins = String(value % 60).padStart(2, '0');
  return `H+${hours}:${mins}`;
}
/* An exercise duration typed as h:min ("0:45", "1:30", "1h30", "3h"), minutes ("45 min")
   or plain hours ("3", "2.5"). Returns whole minutes, or null when it cannot be read. */
function sbParseDuration(text) {
  const value = String(text ?? '').trim().toLowerCase();
  let match = value.match(/^(\d+)\s*(?::|h)\s*(\d{1,2})?\s*(?:min|mn|m)?$/);
  if (match) return Number(match[2] || 0) < 60 ? Number(match[1]) * 60 + Number(match[2] || 0) : null;
  match = value.match(/^(\d+)\s*(?:min|mn|m)$/);
  if (match) return Number(match[1]);
  match = value.match(/^(\d+(?:[.,]\d+)?)$/);
  return match ? Math.round(Number(match[1].replace(',', '.')) * 60) : null;
}
function sbFormatHoursMinutes(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
function sbFormatDuration(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  if (!hours) return `${mins} min`;
  return mins ? `${hours} h ${String(mins).padStart(2, '0')}` : `${hours} h`;
}
function sbClockTime(minutes, startDate) {
  const start = Date.parse(startDate || '');
  if (!Number.isFinite(start)) return '';
  const date = new Date(start + Math.round(Number(minutes) || 0) * 60000);
  const pad = (value) => String(value).padStart(2, '0');
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ── Stable hashing (used to detect manual edits and outdated content) ────────
function sbStableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(sbStableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => `${JSON.stringify(key)}:${sbStableStringify(value[key])}`).join(',')}}`;
}
function sbHash(value) {
  const text = typeof value === 'string' ? value : sbStableStringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

// ── Factories ────────────────────────────────────────────────────────────────
function sbDefaultTracks(keys = null) {
  const wanted = keys && keys.length ? keys : SB_TRACK_PRESETS.map((preset) => preset.key);
  const tracks = SB_TRACK_PRESETS.filter((preset) => preset.key === 'main' || wanted.includes(preset.key))
    .map((preset) => ({ id: `track_${preset.key}`, key: preset.key, name: preset.name, kind: preset.kind, color: preset.color, collapsed: false }));
  return tracks;
}

function sbEmptyStoryboard(duration = SB_DEFAULT_DURATION) {
  return {
    schema: STORYBOARD_SCHEMA,
    rev: 0,
    duration_minutes: sbInt(duration, SB_DEFAULT_DURATION, 30, SB_MAX_DURATION),
    tracks: sbDefaultTracks(['main', 'technical', 'governance', 'communication', 'legal', 'business']),
    blocks: [],
    cast: [],
    // library_id: scenario loaded from the library in Project; template_id: last one applied.
    meta: { synopsis: '', threat: '', brief: '', template_id: '', library_id: '', validated_rev: null, coherence: null }
  };
}

function sbMakeBlock(type = 'custom', values = {}, storyboard = null) {
  const preset = SB_BLOCK_TYPES[type] || SB_BLOCK_TYPES.custom;
  const track = storyboard ? (sbTrackByKey(storyboard, preset.track) || sbMainTrack(storyboard)) : null;
  return sbNormalizeBlock({
    id: uid('block'),
    type: SB_BLOCK_TYPES[type] ? type : 'custom',
    title: preset.label,
    track_id: track?.id || 'track_main',
    start_minutes: 0,
    duration_minutes: preset.duration,
    stimuli_target: preset.stimuli,
    ...values
  }, storyboard);
}

function sbMakeBeat(values = {}) {
  return sbNormalizeBeat({ id: uid('beat'), offset_minutes: 0, channel: 'email_internal', title: '', intent: '', cast_id: '', ...values });
}

function sbMakeCast(values = {}) {
  return sbNormalizeCast({ id: uid('cast'), label: 'New role', role: 'internal', organization: '', description: '', actor_id: '', ...values });
}

// ── Normalisation ────────────────────────────────────────────────────────────
function sbNormalizeBeat(input = {}) {
  const channel = sbValidChannel(input.channel);
  return {
    id: sbSafeId(input.id, 'beat'),
    offset_minutes: sbInt(input.offset_minutes ?? input.at, 0, 0, SB_MAX_DURATION),
    channel,
    template_id: sbValidTemplateId(channel, input.template_id),
    cast_id: sbSafeId(input.cast_id),
    cell_id: sbSafeRecipient(input.cell_id),
    title: sbText(input.title, 300),
    intent: sbText(input.intent, 2000),
    // A main stimulus frames the whole story: set by the designer, kept by every AI re-plan.
    main: input.main === true
  };
}

function sbNormalizeCast(input = {}) {
  return {
    id: sbSafeId(input.id, 'cast'),
    label: sbText(input.label || input.name, 200) || 'Role',
    role: sbRoleValue(input.role),
    organization: sbText(input.organization, 200),
    description: sbText(input.description, 1000),
    actor_id: sbSafeId(input.actor_id)
  };
}

function sbNormalizeBlock(input = {}, storyboard = null) {
  const type = SB_BLOCK_TYPES[input.type] ? input.type : 'custom';
  const preset = SB_BLOCK_TYPES[type];
  const trackIds = storyboard ? storyboard.tracks.map((track) => track.id) : null;
  let trackId = sbSafeId(input.track_id);
  if (trackIds && !trackIds.includes(trackId)) trackId = (sbTrackByKey(storyboard, preset.track) || sbMainTrack(storyboard))?.id || trackIds[0];
  const duration = sbInt(input.duration_minutes, preset.duration, 5, SB_MAX_DURATION);
  const beats = (Array.isArray(input.beats) ? input.beats : []).slice(0, SB_MAX_BEATS).map(sbNormalizeBeat)
    .map((beat) => ({ ...beat, offset_minutes: Math.min(beat.offset_minutes, Math.max(0, duration - 1)) }))
    .sort((a, b) => a.offset_minutes - b.offset_minutes);
  return {
    id: sbSafeId(input.id, 'block'),
    type,
    title: sbText(input.title, 200) || preset.label,
    track_id: trackId || 'track_main',
    start_minutes: sbInt(input.start_minutes, 0, 0, SB_MAX_DURATION),
    duration_minutes: duration,
    stimuli_target: sbInt(input.stimuli_target, preset.stimuli, 0, SB_MAX_BEATS),
    brief: sbText(input.brief, 4000),
    narrative: sbText(input.narrative, 8000),
    objectives: sbTextList(input.objectives, 12, 600),
    key_cast: (Array.isArray(input.key_cast) ? input.key_cast : []).map((id) => sbSafeId(id)).filter(Boolean).slice(0, 20),
    beats,
    status: ['draft', 'refined', 'validated'].includes(input.status) ? input.status : 'draft',
    locked: input.locked === true,
    color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : '',
    // 0: the default of its type (SB_TYPE_STRESS); 1 to 5: set by the designer.
    stress: sbInt(input.stress, 0, 0, 5),
    notes: sbText(input.notes, 4000),
    ai_rev: Number.isInteger(input.ai_rev) ? input.ai_rev : null,
    // Hash of what the phase said when its inject plan was made (see sbPlanSourceHash).
    plan_hash: sbText(input.plan_hash, 40)
  };
}

function normalizeStoryboard(input, legacyPhases = []) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.blocks)) {
    const storyboard = sbEmptyStoryboard();
    if (Array.isArray(legacyPhases) && legacyPhases.length) sbApplyPhases(storyboard, legacyPhases);
    return storyboard;
  }
  const storyboard = {
    schema: STORYBOARD_SCHEMA,
    rev: sbInt(input.rev, 0, 0, Number.MAX_SAFE_INTEGER),
    duration_minutes: sbInt(input.duration_minutes, SB_DEFAULT_DURATION, 30, SB_MAX_DURATION),
    tracks: [],
    blocks: [],
    cast: [],
    meta: {}
  };
  const seenTracks = new Set();
  storyboard.tracks = (Array.isArray(input.tracks) ? input.tracks : []).slice(0, 16).map((track) => {
    const preset = SB_TRACK_PRESETS.find((item) => item.key === track?.key);
    return {
      id: sbSafeId(track?.id, 'track'),
      key: sbSafeId(track?.key) || 'custom',
      name: sbText(track?.name, 120) || preset?.name || 'Track',
      kind: track?.kind === 'main' ? 'main' : 'workstream',
      color: /^#[0-9a-f]{6}$/i.test(track?.color || '') ? track.color : (preset?.color || '#6d687e'),
      collapsed: track?.collapsed === true
    };
  }).filter((track) => !seenTracks.has(track.id) && seenTracks.add(track.id));
  if (!storyboard.tracks.some((track) => track.kind === 'main')) storyboard.tracks.unshift(sbDefaultTracks(['main'])[0]);
  // Exactly one main track, always first.
  const mainIndex = storyboard.tracks.findIndex((track) => track.kind === 'main');
  storyboard.tracks = [storyboard.tracks[mainIndex], ...storyboard.tracks.filter((_, index) => index !== mainIndex).map((track) => ({ ...track, kind: 'workstream' }))];
  storyboard.cast = (Array.isArray(input.cast) ? input.cast : []).slice(0, 60).map(sbNormalizeCast);
  const seenBlocks = new Set();
  storyboard.blocks = input.blocks.slice(0, SB_MAX_BLOCKS).map((block) => sbNormalizeBlock(block, storyboard))
    .filter((block) => !seenBlocks.has(block.id) && seenBlocks.add(block.id));
  const meta = input.meta && typeof input.meta === 'object' ? input.meta : {};
  storyboard.meta = {
    synopsis: sbText(meta.synopsis, 8000),
    threat: sbText(meta.threat, 2000),
    brief: sbText(meta.brief, 8000),
    template_id: sbText(meta.template_id, 120),
    library_id: sbText(meta.library_id, 120),
    validated_rev: Number.isInteger(meta.validated_rev) ? meta.validated_rev : null,
    coherence: meta.coherence && typeof meta.coherence === 'object' ? sbNormalizeCoherence(meta.coherence) : null
  };
  storyboard.duration_minutes = Math.max(storyboard.duration_minutes, sbStoryboardEnd(storyboard));
  return storyboard;
}

function sbNormalizeCoherence(value) {
  return {
    score: sbInt(value.score, 0, 0, 100),
    summary: sbText(value.summary, 4000),
    checked_rev: Number.isInteger(value.checked_rev) ? value.checked_rev : null,
    checked_at: sbText(value.checked_at, 40),
    issues: (Array.isArray(value.issues) ? value.issues : []).slice(0, 60).map((issue) => ({
      severity: ['error', 'warning', 'info'].includes(issue?.severity) ? issue.severity : 'info',
      code: sbText(issue?.code, 60) || 'ai_review',
      block_ids: (Array.isArray(issue?.block_ids) ? issue.block_ids : []).map((id) => sbSafeId(id)).filter(Boolean).slice(0, 12),
      message: sbText(issue?.message, 1500),
      fix: issue?.fix && typeof issue.fix === 'object' && typeof issue.fix.block_id === 'string' && issue.fix.patch && typeof issue.fix.patch === 'object'
        ? { block_id: sbSafeId(issue.fix.block_id), patch: sbPickBlockPatch(issue.fix.patch) }
        : null,
      source: issue?.source === 'ai' ? 'ai' : 'rules'
    }))
  };
}

function sbPickBlockPatch(patch = {}) {
  const clean = {};
  for (const key of ['title', 'brief', 'narrative', 'notes']) if (typeof patch[key] === 'string') clean[key] = sbText(patch[key], key === 'narrative' ? 8000 : 4000);
  if (patch.start_minutes !== undefined) clean.start_minutes = sbInt(patch.start_minutes, 0, 0, SB_MAX_DURATION);
  if (patch.duration_minutes !== undefined) clean.duration_minutes = sbInt(patch.duration_minutes, 30, 5, SB_MAX_DURATION);
  if (patch.stimuli_target !== undefined) clean.stimuli_target = sbInt(patch.stimuli_target, 2, 0, SB_MAX_BEATS);
  if (patch.objectives !== undefined) clean.objectives = sbTextList(patch.objectives, 12, 600);
  return clean;
}

function sbNormalizeLink(link) {
  if (!link || typeof link !== 'object' || typeof link.block_id !== 'string') return undefined;
  return {
    block_id: sbSafeId(link.block_id),
    beat_id: sbSafeId(link.beat_id),
    offset: sbInt(link.offset, 0, 0, SB_MAX_DURATION),
    at: link.at === null || link.at === undefined || link.at === '' || !Number.isFinite(Number(link.at)) ? null : Number(link.at),
    source_hash: sbText(link.source_hash, 40),
    content_hash: sbText(link.content_hash, 40),
    // Sender and recipient cell as they were when the inject was written.
    actor_hash: sbText(link.actor_hash, 40),
    cell_hash: sbText(link.cell_hash, 40),
    rev: sbInt(link.rev, 0, 0, Number.MAX_SAFE_INTEGER),
    locked: link.locked === true
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────
function sbMainTrack(storyboard) {
  return storyboard.tracks.find((track) => track.kind === 'main') || storyboard.tracks[0];
}
function sbTrackByKey(storyboard, key) {
  return storyboard.tracks.find((track) => track.key === key);
}
function sbTrack(storyboard, id) {
  return storyboard.tracks.find((track) => track.id === id);
}
function sbBlock(storyboard, id) {
  return storyboard.blocks.find((block) => block.id === id);
}
function sbBlockEnd(block) {
  return block.start_minutes + block.duration_minutes;
}
function sbStoryboardEnd(storyboard) {
  return storyboard.blocks.reduce((max, block) => Math.max(max, sbBlockEnd(block)), 0);
}
function sbSortedBlocks(storyboard, trackId = null) {
  return storyboard.blocks
    .filter((block) => !trackId || block.track_id === trackId)
    .sort((a, b) => a.start_minutes - b.start_minutes || a.duration_minutes - b.duration_minutes);
}
function sbMainBlocks(storyboard) {
  return sbSortedBlocks(storyboard, sbMainTrack(storyboard)?.id);
}
function sbBlockColor(block) {
  return sbStressLevel(sbBlockStress(block)).color;
}
function sbDetailLevel(block) {
  if (block.beats.length) return 3;
  if (block.narrative.trim()) return 2;
  return 1;
}
function sbBeatAbsolute(block, beat) {
  return block.start_minutes + Math.min(beat.offset_minutes, Math.max(0, block.duration_minutes - 1));
}
function sbCastLabel(storyboard, castId) {
  return storyboard.cast.find((cast) => cast.id === castId)?.label || '';
}

/* Interval partitioning so overlapping blocks of one lane stack in sub-rows. */
function sbPackTrack(blocks) {
  const rowsEnd = [];
  const placement = new Map();
  for (const block of [...blocks].sort((a, b) => a.start_minutes - b.start_minutes || b.duration_minutes - a.duration_minutes)) {
    let row = rowsEnd.findIndex((end) => end <= block.start_minutes);
    if (row === -1) { row = rowsEnd.length; rowsEnd.push(0); }
    rowsEnd[row] = sbBlockEnd(block);
    placement.set(block.id, row);
  }
  return { rows: Math.max(1, rowsEnd.length), placement };
}

// ── Phases compatibility (scenario.phases is derived from the main track) ────
function sbDerivePhases(storyboard) {
  const blocks = sbMainBlocks(storyboard);
  const phases = [];
  blocks.forEach((block, index) => {
    const next = blocks[index + 1];
    const start = Math.max(block.start_minutes, phases.length ? phases[phases.length - 1].end_minutes : 0);
    const end = next ? Math.min(sbBlockEnd(block), Math.max(next.start_minutes, start + 1)) : sbBlockEnd(block);
    if (end > start) phases.push({ name: block.title, start_minutes: start, end_minutes: end, purpose: (block.brief || block.narrative || '').slice(0, 1500) });
  });
  return phases.slice(0, 20);
}

function sbGuessType(text = '') {
  const value = String(text).toLowerCase();
  const rules = [
    ['trigger', /trigger|detect|alert|d[ée]clench|onset|initial|kick.?off|start/],
    ['investigation', /investig|forensic|qualif|analys|triage|understand/],
    ['containment', /contain|isolat|confin|block/],
    ['eradication', /eradic|remov|clean|suppress|evict/],
    ['continuity', /continu|degraded|d[ée]grad|bcp|workaround/],
    ['recovery', /recover|restor|rebuild|reconstr|restart|reprise/],
    ['exit', /exit|closure|close|lesson|retex|sortie|wrap|debrief/],
    ['twist', /twist|escalat|aggrav|rebond/],
    ['communication', /comm|media|press|social/],
    ['legal', /legal|regulat|notif|cnil|gdpr|rgpd|nis2|dora|juridi/],
    ['crisis_cell', /crisis cell|cellule|governance|gouvernance|decision|board|comex|executive/],
    ['hr', /\bhr\b|people|staff|rh\b|employee|salari/],
    ['logistics', /logist/],
    ['customers', /customer|client|partner|supplier|fournisseur/]
  ];
  return (rules.find(([, pattern]) => pattern.test(value)) || ['custom'])[0];
}

function sbApplyPhases(storyboard, phases) {
  const main = sbMainTrack(storyboard);
  const existing = sbMainBlocks(storyboard);
  const ordered = [...phases].sort((a, b) => a.start_minutes - b.start_minutes);
  const used = new Set();
  const blocks = ordered.map((phase) => {
    const match = existing.find((block) => !used.has(block.id) && block.title.trim().toLowerCase() === String(phase.name || '').trim().toLowerCase())
      || existing.find((block) => !used.has(block.id) && block.start_minutes === phase.start_minutes);
    if (match) used.add(match.id);
    const values = {
      title: sbText(phase.name, 200),
      start_minutes: phase.start_minutes,
      duration_minutes: Math.max(5, phase.end_minutes - phase.start_minutes),
      brief: match?.brief || sbText(phase.purpose, 4000)
    };
    if (match) {
      Object.assign(match, sbNormalizeBlock({ ...match, ...values }, storyboard));
      return match;
    }
    return sbMakeBlock(sbGuessType(phase.name), { ...values, track_id: main.id }, storyboard);
  });
  storyboard.blocks = [...storyboard.blocks.filter((block) => block.track_id !== main.id), ...blocks];
  storyboard.duration_minutes = Math.max(storyboard.duration_minutes, sbStoryboardEnd(storyboard));
  return storyboard;
}

// ── Editing primitives (callers commit history) ──────────────────────────────
function sbDuplicateBlock(storyboard, blockId) {
  const block = sbBlock(storyboard, blockId);
  if (!block) return null;
  const copy = sbNormalizeBlock({
    ...deepClone(block),
    id: uid('block'),
    title: `${block.title} (copy)`,
    start_minutes: sbBlockEnd(block),
    status: 'draft',
    locked: false,
    ai_rev: null,
    beats: block.beats.map((beat) => ({ ...beat, id: uid('beat') }))
  }, storyboard);
  storyboard.blocks.push(copy);
  storyboard.duration_minutes = Math.max(storyboard.duration_minutes, sbBlockEnd(copy));
  return copy;
}

/* Ripple edit: when a main-track block changes its end, shift everything after it. */
function sbRipple(storyboard, block, previousEnd) {
  const delta = sbBlockEnd(block) - previousEnd;
  if (!delta) return 0;
  let moved = 0;
  for (const other of storyboard.blocks) {
    if (other.id === block.id || other.locked) continue;
    if (other.start_minutes >= previousEnd) {
      other.start_minutes = Math.max(0, other.start_minutes + delta);
      moved++;
    }
  }
  storyboard.duration_minutes = Math.max(30, storyboard.duration_minutes + delta, sbStoryboardEnd(storyboard));
  return moved;
}

function sbNextMainStart(storyboard) {
  return sbMainBlocks(storyboard).reduce((max, block) => Math.max(max, sbBlockEnd(block)), 0);
}

// ── Templates (library entries and AI skeletons share this shape) ────────────
function sbTemplateToStoryboard(template, options = {}) {
  const trackKeys = Array.isArray(template.tracks) && template.tracks.length ? template.tracks : [...new Set((template.blocks || []).map((block) => block.track || 'main'))];
  const storyboard = sbEmptyStoryboard(template.duration_minutes || SB_DEFAULT_DURATION);
  storyboard.tracks = sbDefaultTracks(trackKeys.filter((key) => SB_TRACK_PRESETS.some((preset) => preset.key === key)));
  const castIds = new Map();
  storyboard.cast = (Array.isArray(template.cast) ? template.cast : []).slice(0, 60).map((cast, index) => {
    const entry = sbMakeCast({ label: cast.label || cast.name, role: cast.role, organization: cast.organization, description: cast.description });
    castIds.set(String(cast.key || cast.id || cast.label || index), entry.id);
    castIds.set(String(cast.label || ''), entry.id);
    return entry;
  });
  const objectives = sbTextList(template.objectives, 20, 600);
  storyboard.blocks = (Array.isArray(template.blocks) ? template.blocks : []).slice(0, SB_MAX_BLOCKS).map((block) => {
    const type = SB_BLOCK_TYPES[block.type] ? block.type : sbGuessType(`${block.type || ''} ${block.title || ''}`);
    const track = sbTrackByKey(storyboard, block.track) || sbTrackByKey(storyboard, SB_BLOCK_TYPES[type].track) || sbMainTrack(storyboard);
    const blockObjectives = (Array.isArray(block.objectives) ? block.objectives : [])
      .map((item) => (Number.isInteger(item) ? objectives[item] : item)).filter((item) => typeof item === 'string');
    const beats = (Array.isArray(block.beats) ? block.beats : []).map((beat) => ({
      offset_minutes: beat.at ?? beat.offset_minutes,
      channel: beat.channel,
      template_id: beat.template_id,
      cast_id: castIds.get(String(beat.cast ?? beat.cast_id ?? '')) || '',
      cell_id: beat.cell_id || '',
      title: beat.title,
      intent: beat.intent,
      main: beat.main === true
    }));
    return sbMakeBlock(type, {
      title: block.title,
      track_id: track.id,
      start_minutes: block.start ?? block.start_minutes,
      duration_minutes: block.duration ?? block.duration_minutes,
      stimuli_target: block.stimuli ?? block.stimuli_target ?? beats.length,
      stress: block.stress,
      brief: block.brief,
      narrative: block.narrative,
      objectives: blockObjectives,
      key_cast: [...new Set(beats.map((beat) => beat.cast_id).filter(Boolean))],
      beats,
      ai_rev: options.aiRev ?? null
    }, storyboard);
  });
  storyboard.duration_minutes = Math.max(storyboard.duration_minutes, sbStoryboardEnd(storyboard));
  storyboard.meta.synopsis = sbText(template.summary || template.synopsis, 8000);
  storyboard.meta.threat = sbText(template.threat, 2000);
  storyboard.meta.template_id = sbText(options.templateId || template.id, 120);
  return { storyboard, objectives, title: sbText(template.name || template.title, 300) };
}

/* Checks a library entry or AI skeleton before it replaces the user's storyboard. */
function sbValidateTemplate(template) {
  const errors = [];
  if (!template || typeof template !== 'object') return ['Template is not an object.'];
  if (!Array.isArray(template.blocks) || !template.blocks.length) errors.push('Template has no blocks.');
  const duration = Number(template.duration_minutes);
  if (!Number.isFinite(duration) || duration < 30) errors.push('Invalid duration_minutes.');
  const castKeys = new Set((template.cast || []).map((cast) => String(cast.key ?? cast.id ?? cast.label)));
  const blockKeys = new Set();
  let mainEnd = 0;
  (template.blocks || []).filter((block) => (block.track || 'main') === 'main').sort((a, b) => a.start - b.start).forEach((block) => {
    if (block.start !== mainEnd) errors.push(`Main track is not contiguous at "${block.title}".`);
    mainEnd = block.start + block.duration;
  });
  if (mainEnd && mainEnd !== duration) errors.push('Main track does not end at duration_minutes.');
  (template.blocks || []).forEach((block) => {
    if (block.key !== undefined) {
      if (blockKeys.has(block.key)) errors.push(`Duplicate block key ${block.key}.`);
      blockKeys.add(block.key);
    }
    if (!SB_BLOCK_TYPES[block.type]) errors.push(`Unknown block type ${block.type}.`);
    if (template.tracks && !template.tracks.includes(block.track || 'main')) errors.push(`Block "${block.title}" uses undeclared track ${block.track}.`);
    if (!(block.start >= 0) || !(block.duration > 0) || block.start + block.duration > duration) errors.push(`Block "${block.title}" is outside the exercise duration.`);
    (block.beats || []).forEach((beat) => {
      if (!(beat.at >= 0 && beat.at < block.duration)) errors.push(`Beat "${beat.title}" is outside block "${block.title}".`);
      if (!sbChannelKeys().includes(beat.channel)) errors.push(`Beat "${beat.title}" has unknown channel ${beat.channel}.`);
      if (beat.cast !== undefined && !castKeys.has(String(beat.cast))) errors.push(`Beat "${beat.title}" references unknown cast ${beat.cast}.`);
    });
    if (Array.isArray(block.beats) && block.stimuli !== undefined && block.beats.length !== block.stimuli) errors.push(`Block "${block.title}" plans ${block.stimuli} injects but has ${block.beats.length} beats.`);
  });
  return errors;
}

/* Converts the current storyboard back into the library/template shape. */
function sbStoryboardToTemplate(storyboard, project, name = '') {
  const castKey = new Map(storyboard.cast.map((cast, index) => [cast.id, `c${index + 1}`]));
  const objectives = sbTextList(project?.scenario?.objectives || '', 20, 600);
  const trackKey = (trackId) => {
    const track = sbTrack(storyboard, trackId);
    return track?.kind === 'main' ? 'main' : (track?.key || 'technical');
  };
  return {
    id: uid('tpl'),
    name: name || project?.name || 'My scenario',
    category: 'Custom',
    icon: 'square',
    duration_minutes: storyboard.duration_minutes,
    summary: storyboard.meta.synopsis || project?.scenario?.summary || '',
    threat: storyboard.meta.threat || '',
    tags: [project?.scenario?.type].filter(Boolean),
    objectives,
    cast: storyboard.cast.map((cast) => ({ key: castKey.get(cast.id), label: cast.label, role: cast.role, organization: cast.organization, description: cast.description })),
    tracks: [...new Set(['main', ...storyboard.tracks.filter((track) => track.kind !== 'main').map((track) => track.key).filter((key) => SB_TRACK_PRESETS.some((preset) => preset.key === key))])],
    blocks: sbSortedBlocks(storyboard).map((block, index) => ({
      key: `b${index + 1}`,
      type: block.type,
      title: block.title,
      track: trackKey(block.track_id),
      start: block.start_minutes,
      duration: block.duration_minutes,
      stimuli: block.stimuli_target,
      brief: block.brief,
      narrative: block.narrative,
      objectives: block.objectives.map((objective) => objectives.indexOf(objective)).filter((index) => index >= 0),
      ...(block.stress ? { stress: block.stress } : {}),
      beats: block.beats.map((beat) => ({ at: beat.offset_minutes, channel: beat.channel, ...(beat.template_id ? { template_id: beat.template_id } : {}), cast: castKey.get(beat.cast_id), title: beat.title, intent: beat.intent, ...(beat.main ? { main: true, ...(sbIsAllCells(beat.cell_id) ? { cell_id: SB_ALL_CELLS } : {}) } : {}) }))
    })),
    created_at: new Date().toISOString()
  };
}

// ── Diff between two storyboard snapshots ────────────────────────────────────
const SB_DIFF_FIELDS = ['title', 'type', 'track_id', 'start_minutes', 'duration_minutes', 'stimuli_target', 'brief', 'narrative', 'objectives', 'beats', 'status', 'locked', 'notes'];
function storyboardDiff(before, after) {
  const result = { added: [], removed: [], changed: [], meta: [], cast: { added: [], removed: [], changed: [] } };
  if (!before || !after) return result;
  const oldBlocks = new Map(before.blocks.map((block) => [block.id, block]));
  const newBlocks = new Map(after.blocks.map((block) => [block.id, block]));
  for (const block of after.blocks) if (!oldBlocks.has(block.id)) result.added.push({ id: block.id, title: block.title });
  for (const block of before.blocks) if (!newBlocks.has(block.id)) result.removed.push({ id: block.id, title: block.title });
  for (const block of after.blocks) {
    const old = oldBlocks.get(block.id);
    if (!old) continue;
    const fields = SB_DIFF_FIELDS.filter((field) => sbStableStringify(old[field]) !== sbStableStringify(block[field]));
    if (fields.length) result.changed.push({ id: block.id, title: block.title, fields });
  }
  for (const key of ['synopsis', 'threat', 'brief']) if ((before.meta?.[key] || '') !== (after.meta?.[key] || '')) result.meta.push(key);
  if (before.duration_minutes !== after.duration_minutes) result.meta.push('duration_minutes');
  if (sbStableStringify(before.tracks) !== sbStableStringify(after.tracks)) result.meta.push('tracks');
  const oldCast = new Map((before.cast || []).map((cast) => [cast.id, cast]));
  const newCast = new Map((after.cast || []).map((cast) => [cast.id, cast]));
  for (const cast of after.cast || []) {
    if (!oldCast.has(cast.id)) result.cast.added.push(cast.label);
    else if (sbStableStringify(oldCast.get(cast.id)) !== sbStableStringify(cast)) result.cast.changed.push(cast.label);
  }
  for (const cast of before.cast || []) if (!newCast.has(cast.id)) result.cast.removed.push(cast.label);
  result.count = result.added.length + result.removed.length + result.changed.length + result.meta.length
    + result.cast.added.length + result.cast.removed.length + result.cast.changed.length;
  return result;
}

// ── Deterministic coherence checks ───────────────────────────────────────────
function sbObjectivesList(project) {
  return sbTextList(project?.scenario?.objectives || '', 20, 600);
}

function sbStructuralChecks(storyboard, project = null) {
  const issues = [];
  const add = (severity, code, message, blockIds = []) => issues.push({ severity, code, message, block_ids: blockIds, fix: null, source: 'rules' });
  if (!storyboard.blocks.length) {
    add('info', 'empty', 'The storyboard is empty. Start from the library, generate a skeleton with AI or drag blocks onto the timeline.');
    return issues;
  }
  const main = sbMainBlocks(storyboard);
  if (!main.length) add('warning', 'no_main', 'No block on the main storyline.');
  if (main.length && !main.some((block) => block.type === 'trigger')) add('warning', 'no_trigger', 'The main storyline has no trigger & detection block.');
  if (main.length && !storyboard.blocks.some((block) => block.type === 'exit')) add('info', 'no_exit', 'No crisis exit block: plan how the exercise ends.');
  if (main.length && main[0].start_minutes > 0) add('warning', 'late_start', `The main storyline starts at ${sbFormatOffset(main[0].start_minutes)}; nothing happens before.`, [main[0].id]);
  main.forEach((block, index) => {
    const next = main[index + 1];
    if (!next) return;
    const gap = next.start_minutes - sbBlockEnd(block);
    if (gap > 20) add('warning', 'gap', `${sbFormatDuration(gap)} gap on the main storyline between "${block.title}" and "${next.title}".`, [block.id, next.id]);
    if (gap < 0) add('warning', 'overlap', `"${block.title}" overlaps "${next.title}" on the main storyline by ${sbFormatDuration(-gap)}.`, [block.id, next.id]);
  });
  for (const block of storyboard.blocks) {
    if (sbBlockEnd(block) > storyboard.duration_minutes) add('error', 'beyond_end', `"${block.title}" ends after the exercise end (${sbFormatOffset(storyboard.duration_minutes)}).`, [block.id]);
    if (!block.brief.trim() && !block.narrative.trim()) add('warning', 'no_brief', `"${block.title}" has no brief: describe what should happen.`, [block.id]);
    if (block.beats.some((beat) => beat.offset_minutes >= block.duration_minutes)) add('error', 'beat_outside', `"${block.title}" has planned injects outside its time window.`, [block.id]);
    if (block.beats.length && block.beats.length !== block.stimuli_target) add('warning', 'beat_count', `"${block.title}" plans ${block.stimuli_target} injects but its inject plan has ${block.beats.length}.`, [block.id]);
    if (block.stimuli_target === 0 && block.type !== 'custom') add('info', 'no_stimuli', `"${block.title}" plans no inject.`, [block.id]);
    const density = block.stimuli_target / Math.max(1, block.duration_minutes);
    if (density > 0.25) add('warning', 'too_dense', `"${block.title}" plans ${block.stimuli_target} injects in ${sbFormatDuration(block.duration_minutes)}: players may be flooded.`, [block.id]);
    const missingCast = block.beats.filter((beat) => !beat.cast_id || !storyboard.cast.some((cast) => cast.id === beat.cast_id));
    if (missingCast.length) add('info', 'beat_no_sender', `"${block.title}": ${missingCast.length} planned inject(s) without a sender role.`, [block.id]);
  }
  const objectives = sbObjectivesList(project);
  const covered = new Set(storyboard.blocks.flatMap((block) => block.objectives));
  objectives.filter((objective) => !covered.has(objective)).forEach((objective) => add('warning', 'objective_uncovered', `Objective not covered by any block: "${objective}".`));
  if (!objectives.length) add('info', 'no_objectives', 'No exercise objectives: add them in the scenario panel to check coverage.');
  const usedCast = new Set(storyboard.blocks.flatMap((block) => block.beats.map((beat) => beat.cast_id)));
  storyboard.cast.filter((cast) => !usedCast.has(cast.id)).forEach((cast) => add('info', 'cast_unused', `Role "${cast.label}" never sends an inject.`));
  const planned = storyboard.blocks.reduce((sum, block) => sum + block.stimuli_target, 0);
  if (planned && storyboard.duration_minutes / planned > 30) add('info', 'low_pressure', `${planned} injects over ${sbFormatDuration(storyboard.duration_minutes)}: pressure may be low.`);
  return issues;
}

function sbScore(issues) {
  const weights = { error: 15, warning: 6, info: 1 };
  return Math.max(0, Math.min(100, 100 - issues.reduce((sum, issue) => sum + (weights[issue.severity] || 0), 0)));
}

/* Example storyboard for the bundled StonaWave exercise, linked to its injects. */
function sbBuildExampleStoryboard(project) {
  const storyboard = sbEmptyStoryboard(180);
  const actors = project.actors;
  storyboard.cast = actors.map((actor) => sbMakeCast({ label: actor.title ? `${actor.title}` : actor.name, role: actor.role, organization: actor.organization, description: actor.name, actor_id: actor.id }));
  const castFor = (actorId) => storyboard.cast.find((cast) => cast.actor_id === actorId)?.id || '';
  const track = (key) => sbTrackByKey(storyboard, key)?.id || sbMainTrack(storyboard).id;
  const media = ['article_press', 'breaking_news_tv', 'post_twitter', 'post_linkedin', 'post_reddit', 'press_release'];
  const specs = [
    { type: 'trigger', title: 'Encryption hits on Sunday morning', track: 'main', start: 0, duration: 25, brief: 'Ransomware detonates across MES, ERP and identity systems while staffing is minimal.', narrative: 'The CISO is alerted by the SOC as manufacturing screens freeze. Players only know that several sites report outages; the scale and the attacker are unknown.' },
    { type: 'investigation', title: 'Scoping and extortion', track: 'main', start: 25, duration: 35, brief: 'Partners feel the impact, the attacker claims the attack and demands $25M.', narrative: 'Supply-chain partners report broken flows and PharmLeaks sends its ransom note. The crisis cell must qualify the attack without full visibility.' },
    { type: 'containment', title: 'Containment decisions', track: 'main', start: 60, duration: 45, brief: 'IT asks to cut interconnections between sites while the scope is still unclear.', narrative: 'IT proposes isolating the manufacturing sites and identity services. Every isolation choice has a production cost and the executive committee must arbitrate.' },
    { type: 'continuity', title: 'Degraded mode', track: 'main', start: 105, duration: 45, brief: 'The CEO addresses staff and IT reports on backups: StonaWave must show control.', narrative: 'Production runs in degraded mode. The CEO memo sets priorities while IT confirms which backups can be trusted.' },
    { type: 'recovery', title: 'Recovery path and new threats', track: 'main', start: 150, duration: 20, brief: 'Clean backups offer a path to recovery while the attacker keeps pressure.', narrative: 'IT confirms a clean immutable backup and the attacker threatens publication by SMS.' },
    { type: 'exit', title: 'Handover and next steps', track: 'main', start: 170, duration: 10, brief: 'Close the visible exercise with a status and next-day priorities.', narrative: 'The CISO summarises the situation and priorities for the next operational period.' },
    { type: 'communication', title: 'Media and social pressure', track: 'communication', start: 55, duration: 110, channels: media, brief: 'The story leaks online, reaches the international press and TV, and forces a public stance.', narrative: 'Analysts spot the attack on Reddit and X, Le Monde and the NYT publish, TV runs breaking news and StonaWave issues its first press release while the German press amplifies the story.' },
    { type: 'legal', title: 'Authority alert and notifications', track: 'legal', start: 75, duration: 30, channels: ['email_authority'], brief: 'CERT-FR issues an alert: regulatory notifications and cooperation with authorities start.', narrative: 'The national agency asks for indicators and a status. Players must organise notifications (GDPR, health authorities) without slowing the technical response.' }
  ];
  storyboard.tracks = sbDefaultTracks(['main', 'communication', 'legal']);
  storyboard.blocks = specs.map((spec) => sbMakeBlock(spec.type, { title: spec.title, track_id: track(spec.track), start_minutes: spec.start, duration_minutes: spec.duration, brief: spec.brief, narrative: spec.narrative, status: 'refined' }, storyboard));
  const blocksByTime = sbMainBlocks(storyboard);
  for (const stimulus of project.stimuli) {
    const owner = specs.findIndex((spec) => spec.channels?.includes(stimulus.channel) && stimulus.timestamp_offset_minutes >= spec.start && stimulus.timestamp_offset_minutes < spec.start + spec.duration);
    const block = owner >= 0 ? storyboard.blocks[owner] : blocksByTime.find((item) => stimulus.timestamp_offset_minutes >= item.start_minutes && stimulus.timestamp_offset_minutes < sbBlockEnd(item)) || blocksByTime[blocksByTime.length - 1];
    const fields = stimulus.fields || {};
    const beat = sbMakeBeat({
      offset_minutes: stimulus.timestamp_offset_minutes - block.start_minutes,
      channel: stimulus.channel,
      template_id: stimulus.template_id,
      cast_id: castFor(stimulus.actor_id),
      title: sbText(fields.subject || fields.headline || fields.title || fields.thread_title || fields.text || channelLabel(stimulus.channel), 140),
      intent: ''
    });
    block.beats.push(beat);
    stimulus.scenario_link = sbNormalizeLink({ block_id: block.id, beat_id: beat.id, offset: beat.offset_minutes, at: stimulus.timestamp_offset_minutes, source_hash: '', content_hash: '', rev: 0 });
  }
  storyboard.blocks.forEach((block) => { block.stimuli_target = block.beats.length; block.key_cast = [...new Set(block.beats.map((beat) => beat.cast_id).filter(Boolean))]; });
  storyboard.meta.synopsis = project.scenario.summary;
  storyboard.meta.threat = 'PharmLeaks ransomware group: contractor VPN credential, AD compromise, backup sabotage, 2.4 TB exfiltrated, double extortion.';
  return storyboard;
}


// ── Cells: groups of players who receive injects ─────────────────────────────
const SB_CELL_PRESETS = [
  { key: 'decision', name: 'Decision cell', description: 'Executive committee: arbitration, strategy and external commitments.', color: '#211248' },
  { key: 'operational', name: 'Operational crisis cell', description: 'Coordinates the response, business impacts and logistics.', color: '#451dc7' },
  { key: 'communication', name: 'Communication cell', description: 'Internal and external communication, media and social networks.', color: '#7c3aed' },
  { key: 'it', name: 'IT & technical cell', description: 'Investigation, containment and recovery of information systems.', color: '#2563eb' },
  { key: 'legal', name: 'Legal & compliance cell', description: 'Regulatory notifications, legal exposure and insurers.', color: '#0f766e' },
  { key: 'business', name: 'Business continuity cell', description: 'Degraded mode, customers, suppliers and continuity plans.', color: '#d48c00' },
  { key: 'hr', name: 'HR & people cell', description: 'Staff, social partners, wellbeing and internal organisation.', color: '#e11d48' }
];
const SB_TRACK_TO_CELL = { technical: 'it', governance: 'decision', communication: 'communication', legal: 'legal', business: 'business', people: 'hr' };
const SB_CHANNEL_TO_CELL = {
  article_press: 'communication', breaking_news_tv: 'communication', post_twitter: 'communication', post_linkedin: 'communication', post_reddit: 'communication', press_release: 'communication',
  email_authority: 'legal', dark_web_forum: 'decision', audio_message: 'decision',
  email_internal: 'operational', internal_memo: 'operational', sms_notification: 'operational', email_external: 'business'
};

function sbNormalizePlayer(input = {}) {
  return { id: sbSafeId(input.id, 'player'), name: sbText(input.name, 200), role: sbText(input.role, 200), email: sbText(input.email, 200) };
}

function sbNormalizeCell(input = {}) {
  const preset = SB_CELL_PRESETS.find((item) => item.key === input.key);
  return {
    id: sbSafeId(input.id, 'cell'),
    key: sbSafeId(input.key) || 'custom',
    name: sbText(input.name, 160) || preset?.name || 'New cell',
    description: sbText(input.description, 1000),
    // Legacy: learning objectives are now one text in scenario (sbFoldCellObjectives).
    objectives: sbText(input.objectives, 2000),
    color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : (preset?.color || '#6d687e'),
    players: (Array.isArray(input.players) ? input.players : []).slice(0, 200).map(sbNormalizePlayer)
  };
}

/* Pedagogical and technical design inputs from the Context tab, as prompt lines for every
   AI operation: the learning objectives (one free text) and the incident timeline.
   With cellId (an inject addressed to that cell), the AI keeps the objectives that concern it. */
function sbDesignContextLines(project, options = {}) {
  const scenario = project?.scenario || {};
  const cells = Array.isArray(project?.cells) ? project.cells : [];
  const objectives = sbText(scenario.learning_objectives, 6000);
  const timeline = sbText(scenario.attack_path, 6000);
  const names = options.cellId && !sbIsAllCells(options.cellId) ? sbRecipientIds(options.cellId).map((id) => cells.find((cell) => cell.id === id)?.name).filter(Boolean) : [];
  const lines = [];
  if (objectives) lines.push(`- Learning objectives (the designer's own words; work out which apply to ${names.length ? `the recipient${names.length > 1 ? 's' : ''}, the ${names.join(' and the ')}` : 'each cell'}): ${objectives}`);
  if (timeline) lines.push(`- Incident timeline (what really happened, in order: attack, detection, response): ${timeline}`);
  return lines;
}

/* Learning objectives are one free text for the whole exercise. Older projects kept them per
   cell: fold those into the text, one line per cell, so nothing is lost. */
function sbFoldCellObjectives(project) {
  const cells = (Array.isArray(project?.cells) ? project.cells : []).filter((cell) => cell.objectives);
  if (!cells.length || !project.scenario) return;
  const lines = cells.map((cell) => `${cell.name}: ${cell.objectives}`);
  project.scenario.learning_objectives = sbText([project.scenario.learning_objectives, ...lines].filter(Boolean).join('\n'), 6000);
  cells.forEach((cell) => { cell.objectives = ''; });
}

function sbNormalizeCells(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).slice(0, 30).map(sbNormalizeCell).filter((cell) => !seen.has(cell.id) && seen.add(cell.id));
}

function sbNormalizeExercise(value = {}) {
  const count = (input) => (input === '' || input === null || input === undefined ? '' : sbInt(input, '', 0, 10000));
  return { players_count: count(value?.players_count), cells_count: count(value?.cells_count) };
}

function sbMakeCell(key = 'custom', values = {}) {
  const preset = SB_CELL_PRESETS.find((item) => item.key === key);
  return sbNormalizeCell({ id: uid('cell'), key, name: preset?.name, description: preset?.description, color: preset?.color, ...values });
}

/* The recipient of an inject, in its cell_id: one cell's id, several ids joined by "+"
   (sent to each of them), or SB_ALL_CELLS for every cell (a key stimulus such as the
   ransom note or a TV flash). Read it only through these helpers. */
const SB_ALL_CELLS = 'all';
const SB_CELL_SEPARATOR = '+';
function sbIsAllCells(cellId) {
  return cellId === SB_ALL_CELLS;
}
function sbRecipientIds(cellId) {
  return typeof cellId === 'string' && cellId && !sbIsAllCells(cellId) ? cellId.split(SB_CELL_SEPARATOR).filter(Boolean) : [];
}
/* One recipient value from a list of cell ids (in the project's cell order). */
function sbJoinRecipients(project, ids) {
  const wanted = new Set(ids);
  return (project.cells || []).filter((cell) => wanted.has(cell.id)).map((cell) => cell.id).join(SB_CELL_SEPARATOR);
}
function sbSafeRecipient(value) {
  if (sbIsAllCells(value)) return SB_ALL_CELLS;
  return [...new Set(sbRecipientIds(value).map((id) => sbSafeId(id)).filter(Boolean))].slice(0, 30).join(SB_CELL_SEPARATOR);
}
/* Does an inject addressed to cellId reach the cell targetId? */
function sbReaches(cellId, targetId) {
  if (cellId === targetId) return true;
  if (!targetId || targetId === 'none') return false;
  return sbIsAllCells(cellId) || sbRecipientIds(cellId).includes(targetId);
}
/* Every cell, or at least one known cell. */
function sbHasRecipient(project, cellId) {
  return sbIsAllCells(cellId) || sbRecipientIds(cellId).some((id) => sbCell(project, id));
}
function sbRecipientName(project, cellId) {
  if (sbIsAllCells(cellId)) return 'All cells';
  return sbRecipientIds(cellId).map((id) => sbCell(project, id)?.name).filter(Boolean).join(' + ');
}

function sbCell(project, id) {
  return (project.cells || []).find((cell) => cell.id === id) || null;
}

/* Finds the cell of a preset, creating it when needed. */
function sbEnsureCell(project, key) {
  if (!Array.isArray(project.cells)) project.cells = [];
  let cell = project.cells.find((item) => item.key === key);
  if (!cell) {
    cell = sbMakeCell(SB_CELL_PRESETS.some((item) => item.key === key) ? key : 'operational');
    project.cells.push(cell);
  }
  return cell;
}

function sbCellKeyForChannel(channel) {
  return SB_CHANNEL_TO_CELL[channel] || 'operational';
}

/* Default recipient for an inject: matching cell, else the first cell (created if none). */
function sbDefaultCellId(project, channel, create = true) {
  const key = sbCellKeyForChannel(channel);
  const existing = (project.cells || []).find((cell) => cell.key === key) || (project.cells || [])[0];
  if (existing) return existing.id;
  return create ? sbEnsureCell(project, key).id : '';
}

/* Adds preset cells until the requested count is reached; never removes cells. */
function sbSetCellsCount(project, count) {
  if (!Array.isArray(project.cells)) project.cells = [];
  const target = Math.min(SB_CELL_PRESETS.length + 20, Math.max(0, Number(count) || 0));
  for (const preset of SB_CELL_PRESETS) {
    if (project.cells.length >= target) break;
    if (!project.cells.some((cell) => cell.key === preset.key)) project.cells.push(sbMakeCell(preset.key));
  }
  while (project.cells.length < target) project.cells.push(sbMakeCell('custom', { name: `Cell ${project.cells.length + 1}` }));
  // Lowering the count only removes empty cells: never one with players or injects.
  const used = new Set([...(project.storyboard?.blocks || []).flatMap((block) => block.beats.map((beat) => beat.cell_id)), ...(project.stimuli || []).map((stimulus) => stimulus.cell_id)]);
  for (let index = project.cells.length - 1; index >= 0 && project.cells.length > target; index--) {
    const cell = project.cells[index];
    if (!cell.players.length && !used.has(cell.id)) project.cells.splice(index, 1);
  }
  return project.cells;
}

function sbMainBlockAt(storyboard, minute) {
  const main = sbMainBlocks(storyboard);
  return main.find((block) => minute >= block.start_minutes && minute < sbBlockEnd(block))
    || [...main].reverse().find((block) => block.start_minutes <= minute)
    || main[0] || null;
}

/* Cells replace parallel workstreams: their injects move into the main phase covering
   their time, addressed to the matching cell; the workstream blocks are removed. */
function sbFlattenWorkstreams(project) {
  const storyboard = project.storyboard;
  if (!storyboard) return project;
  if (!Array.isArray(project.cells)) project.cells = [];
  const cellsBefore = project.cells.length;
  const main = sbMainTrack(storyboard);
  const workstreams = storyboard.blocks.filter((block) => block.track_id !== main.id);
  if (workstreams.length && !sbMainBlocks(storyboard).length) {
    // No main storyline: promote the workstream blocks themselves.
    workstreams.forEach((block) => { block.track_id = main.id; });
  } else {
    for (const block of workstreams) {
      const track = sbTrack(storyboard, block.track_id);
      const cellKey = SB_TRACK_TO_CELL[track?.key] || null;
      const targets = new Set();
      for (const beat of block.beats) {
        const at = sbBeatAbsolute(block, beat);
        const target = sbMainBlockAt(storyboard, at);
        if (!target) continue;
        const moved = { ...beat, offset_minutes: Math.max(0, Math.min(at - target.start_minutes, target.duration_minutes - 1)) };
        if (!moved.cell_id && cellKey) moved.cell_id = sbEnsureCell(project, cellKey).id;
        target.beats.push(moved);
        target.beats.sort((a, b) => a.offset_minutes - b.offset_minutes);
        target.stimuli_target = Math.max(target.stimuli_target, target.beats.length);
        targets.add(target);
        for (const stimulus of project.stimuli || []) {
          const link = stimulus.scenario_link;
          if (link?.beat_id === beat.id) { link.block_id = target.id; link.offset = moved.offset_minutes; }
        }
      }
      const covering = targets.size ? [...targets] : [sbMainBlockAt(storyboard, block.start_minutes)].filter(Boolean);
      const note = `Parallel workstream "${block.title}" (${sbFormatOffset(block.start_minutes)} to ${sbFormatOffset(sbBlockEnd(block))}): ${block.brief || block.narrative}`.slice(0, 900);
      covering.forEach((target) => {
        target.notes = sbText([target.notes, note].filter(Boolean).join('\n'), 4000);
        // Objectives tested by the workstream stay covered by the phases that absorb it.
        (block.objectives || []).forEach((objective) => { if (!target.objectives.includes(objective)) target.objectives.push(objective); });
      });
      for (const stimulus of project.stimuli || []) {
        const link = stimulus.scenario_link;
        if (link?.block_id === block.id && !link.beat_id && covering[0]) link.block_id = covering[0].id;
      }
    }
    storyboard.blocks = storyboard.blocks.filter((block) => block.track_id === main.id);
  }
  storyboard.tracks = [main];
  sbAssignMissingCells(project);
  if (project.cells.length !== cellsBefore) sbSortCells(project);
  return project;
}

/* Every beat and stimulus gets a recipient cell: the preset cell matching its channel,
   created when missing (new cells are kept in the preset order). */
function sbAssignMissingCells(project) {
  if (!Array.isArray(project.cells)) project.cells = [];
  const storyboard = project.storyboard;
  const before = project.cells.length;
  const cellFor = (channel) => sbEnsureCell(project, sbCellKeyForChannel(channel)).id;
  const beatCells = new Map();
  for (const block of storyboard?.blocks || []) {
    for (const beat of block.beats) {
      if (!sbHasRecipient(project, beat.cell_id)) beat.cell_id = cellFor(beat.channel);
      beatCells.set(beat.id, beat.cell_id);
    }
  }
  for (const stimulus of project.stimuli || []) {
    const fromBeat = beatCells.get(stimulus.scenario_link?.beat_id);
    if (fromBeat) stimulus.cell_id = fromBeat;
    else if (!sbHasRecipient(project, stimulus.cell_id)) stimulus.cell_id = cellFor(stimulus.channel);
  }
  if (project.cells.length !== before) sbSortCells(project);
  return project;
}

function sbSortCells(project) {
  const rank = (cell) => { const index = SB_CELL_PRESETS.findIndex((preset) => preset.key === cell.key); return index < 0 ? 99 : index; };
  project.cells = project.cells.map((cell, index) => ({ cell, index })).sort((a, b) => rank(a.cell) - rank(b.cell) || a.index - b.index).map((entry) => entry.cell);
}

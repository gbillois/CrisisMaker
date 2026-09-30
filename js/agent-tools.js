/* Controlled operations only: no DOM or credentials are exposed to the model. */
class AgentValidationError extends Error {}
const AgentSchema = {
  text: (maxLength = 8000) => ({ type: 'string', maxLength }),
  id: { type: 'string', minLength: 1, maxLength: 120 },
  minutes: { type: 'integer', minimum: 0, maximum: 525600 },
  object: (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false }),
  array: (items, maxItems = 40) => ({ type: 'array', items, maxItems })
};
const ToolValidator = {
  validate(value, schema, path = 'arguments') {
    // The reason tells the model what to correct on its next call.
    const fail = (reason = '') => { throw new AgentValidationError(`Invalid ${path}${reason ? `: ${reason}` : ''}`); };
    if (schema.type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail(Array.isArray(value) ? 'expected one object, not an array' : 'expected an object');
      for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail(`missing required field "${key}"`);
      for (const [key, item] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) fail();
        const child = schema.properties?.[key] || schema.additionalProperties;
        if (!child || child === false) fail(`unknown field "${String(key).slice(0, 60)}"`);
        this.validate(item, child, `${path}.${key}`);
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(value)) fail('expected an array');
      if (value.length > schema.maxItems || value.length < (schema.minItems || 0)) fail(`expected ${schema.minItems || 0} to ${schema.maxItems} items`);
      value.forEach((item, i) => this.validate(item, schema.items, `${path}[${i}]`));
    } else if (schema.type === 'string') {
      if (typeof value !== 'string') fail('expected a string');
      if (value.length > schema.maxLength || value.length < (schema.minLength || 0)) fail(`expected ${schema.minLength || 0} to ${schema.maxLength} characters`);
    } else if (schema.type === 'integer' || schema.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value)) || value < schema.minimum || value > schema.maximum) fail();
    } else if (schema.type === 'boolean') {
      if (typeof value !== 'boolean') fail();
    } else if (schema.type === 'json') {
      // Bounded JSON used only for template field values, never configuration or code.
      if (JSON.stringify(value).length > 16000) fail();
      if (value && typeof value === 'object') {
        if (path.split('.').length > 12) fail();
        for (const [key, item] of Object.entries(value)) {
          if (['__proto__', 'constructor', 'prototype'].includes(key)) fail();
          this.validate(item, schema, `${path}.${key}`);
        }
      }
    }
    if (schema.enum && !schema.enum.includes(value)) fail(`expected one of ${schema.enum.slice(0, 20).join(', ')}`);
    return value;
  }
};

function agentPick(source, keys) {
  return Object.fromEntries(keys.filter(key => source?.[key] !== undefined).map(key => [key, deepClone(source[key])]));
}
function agentRedact(value) {
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const key of ['ai_api_key', 'azure_api_key', 'azure_speech_key']) {
    const secret = appState.scenario.settings?.[key];
    if (secret) text = text.split(secret).join('[REDACTED]');
  }
  return text;
}
function agentExcerpt(value, limit = 1200) {
  const text = agentRedact(value ?? '');
  return text.length > limit ? text.slice(0, limit) + '… [truncated; use detail tools]' : text;
}
function agentActor(actor) {
  return agentPick(actor, ['id', 'name', 'role', 'organization', 'title', 'language']);
}
function agentStimulus(stimulus, full = false) {
  const result = agentPick(stimulus, ['id', 'name', 'channel', 'template_id', 'actor_id', 'timestamp_offset_minutes', 'status', 'generation_mode', 'generation_prompt', 'cell_id']);
  // Its number in Play and the Injects library (#07) and its time, to cite it to the user.
  if (typeof ExerciseModel !== 'undefined') { const numbers = ExerciseModel.numbers(appState.scenario); if (numbers.has(stimulus.id)) result.number = ExerciseModel.numberLabel(numbers.get(stimulus.id), ExerciseModel.numberTop(numbers)); }
  result.time = sbFormatOffset(stimulus.timestamp_offset_minutes);
  result.fields = Object.fromEntries(Object.entries(stimulus.fields || {}).filter(([key]) => !/photo|avatar_url|audio|video|_data/.test(key)).map(([key, value]) => [key, full ? value : agentExcerpt(value, 180)]));
  if (full) result.editableFields = (getTemplateDefinition(stimulus).fields || []).filter(f => !/upload/.test(f.type)).map(f => agentPick(f, ['key', 'type', 'options']));
  return result;
}
function agentScenario() {
  const s = appState.scenario;
  return { id: s.id, name: s.name, client: agentPick(s.client, ['name', 'sector', 'language']), scenario: agentPick(s.scenario, ['type', 'summary', 'detailed_context', 'start_date', 'end_date', 'timezone', 'objectives', 'narrative_arc', 'phases']), actorCount: s.actors.length, stimulusCount: s.stimuli.length };
}
function agentExerciseFrame() {
  const project = appState.scenario, storyboard = project.storyboard;
  return {
    client: agentPick(project.client, ['name', 'sector', 'language']),
    play_duration_minutes: storyboard?.duration_minutes || null,
    simulated_start: project.scenario.start_date || '', simulated_end: project.scenario.end_date || '', timezone: project.scenario.timezone || '',
    primary_language: project.client.language || '', inject_language: project.settings.inject_language || '',
    cells_count: project.exercise?.cells_count ?? '', players_count: project.exercise?.players_count ?? '',
    designer_context: agentExcerpt(storyboard?.meta?.brief || '', 6000),
    learning_objectives: agentExcerpt(project.scenario.learning_objectives || '', 6000),
    attack_path: agentExcerpt(project.scenario.attack_path || '', 6000),
    // The incident timeline events that happen during play, already at their exercise minute:
    // phases are laid out around them and they become the main events of their phase.
    incident_timeline_in_play: String(project.scenario.attack_path || '').split(/\n+/).map(line => line.trim()).filter(Boolean)
      .map(line => ({ minute: sbTextClockMinute(line, project.scenario.start_date, storyboard?.duration_minutes), text: agentExcerpt(line, 300) }))
      .filter(item => item.minute !== null).map(item => ({ exercise_minute: item.minute, time: sbFormatOffset(item.minute), text: item.text })),
    library_scenario: storyboard?.meta?.template_id && storyboard.meta.template_id !== 'agent' ? storyboard.meta.template_id : null,
    reference_file: agentReferenceFileSummary()
  };
}
/* The file loaded in the Context tab (a deck, a proposal, a brief or a chronogram), in short:
   getReferenceFile reads it in full. */
function agentReferenceFileSummary() {
  const cs = typeof appState !== 'undefined' ? appState.checkerState : null;
  const pd = cs?.parsedData;
  if (!pd) return null;
  return { name: cs.file?.name || 'file', kind: pd.doc?.kind || 'spreadsheet', units: pd.doc ? `${pd.doc.slides.length} ${pd.analysis.unit.toLowerCase()}s` : `${pd.rows.length} rows`, sections_found: pd.analysis?.sections || undefined, injects: pd.analysis ? pd.analysis.chronogramRows : pd.rows.length, note: 'Read it with getReferenceFile before building.' };
}
function agentReferenceFile({ part = 'outline', offset = 0 } = {}) {
  const cs = appState.checkerState || {};
  const pd = cs.parsedData;
  if (!pd) return { loaded: false, note: 'No file is loaded in the Context tab.' };
  const text = part === 'injects' || !pd.doc
    ? String(checkerSerializeChronogram({ withDocument: false })?.serialized || '')
    : CrisisDocReader.outline(pd.doc, pd.analysis, { limit: 400000 });
  const page = 12000;
  const start = Math.min(Math.max(0, offset || 0), text.length);
  return { loaded: true, ...agentReferenceFileSummary(), note: undefined, part, total: text.length, offset: start, nextOffset: start + page < text.length ? start + page : null, text: agentRedact(text.slice(start, start + page)) };
}
const AgentContext = {
  build() {
    const s = agentScenario();
    s.scenario = Object.fromEntries(Object.entries(s.scenario).map(([k, v]) => [k, typeof v === 'string' ? agentExcerpt(v, 2500) : v]));
    return { ...s, language: appState.scenario.settings.inject_language, frame: agentExerciseFrame(), storyboard: agentStoryboardSummary(), actors: appState.scenario.actors.slice(0, 12).map(agentActor), timeline: (() => {
      // Every inject in compact form (up to 60): the agent sees the whole exercise without paging.
      const numbers = typeof ExerciseModel !== 'undefined' ? ExerciseModel.numbers(appState.scenario) : new Map();
      const top = numbers.size ? ExerciseModel.numberTop(numbers) : 0;
      return getSortedStimuli().slice(0, 60).map(s => ({ id: s.id, number: numbers.has(s.id) ? ExerciseModel.numberLabel(numbers.get(s.id), top) : undefined, at: s.timestamp_offset_minutes, cell: typeof sbRecipientName === 'function' ? sbRecipientName(appState.scenario, s.cell_id) || undefined : undefined, channel: s.channel, name: agentExcerpt(s.name || s.fields.subject || s.fields.headline || s.fields.text, 90) }));
    })(), note: 'Actor and storyboard previews are limited; the timeline lists up to 60 injects. Use getStimulus for the content of one inject and getStoryboard or getPhase for the plan.' };
  }
};
/* Scenario Builder storyboard, compact: the designer's plan the injects should follow. */
function agentStoryboardSummary() {
  const storyboard = appState.scenario.storyboard;
  const cells = (appState.scenario.cells || []).map(cell => ({ id: cell.id, name: cell.name, players: cell.players.length }));
  const cast = (storyboard?.cast || []).slice(0, 30).map(item => ({ id: item.id, label: item.label, role: item.role, actor_id: item.actor_id || null }));
  if (!storyboard?.blocks?.length) return { blocks: [], cells, cast, note: 'No main storyline yet. Build it with buildMainStoryline.' };
  return {
    duration_minutes: storyboard.duration_minutes,
    blocks: sbSortedBlocks(storyboard).slice(0, 24).map(block => ({ id: block.id, type: block.type, title: agentExcerpt(block.title, 120), start: block.start_minutes, end: sbBlockEnd(block), injects: block.stimuli_target, planned: block.beats.length, planned_per_cell: Object.fromEntries(cells.map(cell => [cell.id, block.beats.filter(beat => beat.cell_id === cell.id).length])) })),
    cells, cast,
    note: 'Phases of the main storyline, the player cells that receive injects and the cast who sends them. Use getStoryboard for briefs and the planned injects of each phase.'
  };
}
function agentConsistencyCheck() {
  const s = appState.scenario, issues = [];
  // Scenario first: storyline and phases, cells, learning objectives, incident timeline; then injects.
  const storyboard = s.storyboard;
  if (storyboard) sbStructuralChecks(storyboard, s).forEach(issue => issues.push(`Storyline: ${issue.message}${issue.code === 'no_exit' ? ' Unless the designer context says otherwise, make the last phase a closing phase: set its type to recovery or exit (updateStoryboardBlock), or rebuild the storyline with one (buildMainStoryline).' : ''}`));
  if (storyboard) sbExerciseChecks(s).filter(issue => issue.code === 'event_time').forEach(issue => issues.push(`Storyline: ${issue.message}`));
  if (!s.scenario.summary?.trim()) issues.push('Missing scenario summary.');
  if (!s.scenario.objectives?.trim()) issues.push('No explicit exercise objectives recorded.');
  if (!s.scenario.learning_objectives?.trim()) issues.push('No learning objectives: nothing says what the players must practise.');
  if (!s.scenario.attack_path?.trim()) issues.push('No incident timeline: technical phases and injects have no reference sequence.');
  // The audience set in the Context tab: the number of cells and of players listed in them.
  const expectedPlayers = Number(s.exercise?.players_count) || 0, expectedCells = Number(s.exercise?.cells_count) || 0;
  const listedPlayers = (s.cells || []).reduce((sum, cell) => sum + cell.players.length, 0);
  if (expectedPlayers && listedPlayers && listedPlayers !== expectedPlayers) issues.push(`Cells: ${listedPlayers} players are listed but the exercise expects ${expectedPlayers}; adjust the players of the cells (upsertCells).`);
  if (expectedCells && (s.cells || []).length !== expectedCells) issues.push(`Cells: ${(s.cells || []).length} cells exist but the exercise expects ${expectedCells}.`);
  const cellNames = (s.cells || []).map(cell => cell.name.trim().toLowerCase());
  const twins = [...new Set(cellNames.filter((name, index) => cellNames.indexOf(name) !== index))];
  if (twins.length) issues.push(`Cells: several cells share the same name (${twins.map(name => `"${name}"`).join(', ')}): give each cell its own name (upsertCells).`);
  // The incident timeline events that happen during play are main events of their phase.
  if (storyboard) {
    const placed = sbMainBlocks(storyboard).flatMap(block => (block.events || []).map(event => block.start_minutes + event.offset_minutes));
    for (const item of agentExerciseFrame().incident_timeline_in_play || []) {
      if (!placed.some(minute => Math.abs(minute - item.exercise_minute) <= 5)) issues.push(`Storyline: the incident timeline event at ${item.time} ("${agentExcerpt(item.text, 90)}") is not a main event yet: set it on its phase (setMainEvents), its text starting with its clock time.`);
    }
  }
  // One actor playing roles of different kinds (the SOC analyst also signing the ransom note).
  const byActor = new Map();
  for (const cast of storyboard?.cast || []) if (cast.actor_id) byActor.set(cast.actor_id, [...(byActor.get(cast.actor_id) || []), cast]);
  for (const [actorId, casts] of byActor) if (new Set(casts.map(cast => sbRoleValue(cast.role))).size > 1) issues.push(`Cast: ${getActor(actorId)?.name || actorId} plays roles of different kinds (${casts.map(cast => `"${cast.label}" ${cast.role}`).join(', ')}): give each its own actor (upsertCast).`);
  const generic = (s.cells || []).filter(cell => /^(Decision|Operational crisis|Communication|IT & technical|Legal & compliance|Business continuity|HR & people) cell$/.test(cell.name));
  if (generic.length && /cell/i.test(s.scenario.learning_objectives || '') && generic.some(cell => !(s.scenario.learning_objectives || '').toLowerCase().includes(cell.name.toLowerCase()))) issues.push(`Cells: ${generic.map(cell => `"${cell.name}"`).join(', ')} still have their default names while the learning objectives name the cells: rename them after the learning objectives (upsertCells).`);
  // A framing run (stage 1 of the Build flow) leaves the injects to stage 2.
  const framing = typeof getCrisisAgent === 'function' && getCrisisAgent().active && getCrisisAgent().scope === 'framing';
  const beats = storyboard ? storyboard.blocks.flatMap(block => block.beats) : [];
  if (!framing) for (const cell of s.cells || []) {
    const count = beats.filter(beat => sbReaches(beat.cell_id, cell.id)).length + s.stimuli.filter(item => sbReaches(item.cell_id, cell.id) && !item.scenario_link?.beat_id).length;
    if (!count) issues.push(`Cell "${cell.name}" receives no inject, so its learning objectives are never tested.`);
    // Only once injects are planned for the cell: a framing-only exercise is not pushed to plan injects.
    const planned = beats.filter(beat => sbReaches(beat.cell_id, cell.id));
    if (planned.length && !planned.some(beat => beat.kind === 'nudge')) issues.push(`Cell "${cell.name}" has no nudge inject: plan one (planPhaseInjects with nudge=true, or updatePlannedInject with patch.nudge=true on a fitting one) to relaunch or redirect it if it stalls or goes off track (a follow-up asking for a decision, a call back, a deadline reminder).`);
  }
  const unwritten = beats.filter(beat => !sbStimulusForBeat(s, beat.id)).length;
  if (unwritten && !framing) issues.push(`${unwritten} planned inject(s) of the storyline are not written yet.`);
  if (!s.actors.length) issues.push('No actors.');
  if (!s.stimuli.length && !beats.length && !framing) issues.push('No inject planned or written yet.');
  // Same rule as every tab (exercise model): a strict window, so injects outside every phase are caught.
  if (storyboard && sbMainBlocks(storyboard).length) getSortedStimuli().filter(item => !ExerciseModel.phaseAt(s, item.timestamp_offset_minutes, { strict: true })).forEach(item => issues.push(`${item.id}: outside every phase of the main storyline.`));
  const phases = storyboard && sbMainBlocks(storyboard).length ? [] : (s.scenario.phases || []);
  const seen = new Map();
  getSortedStimuli().forEach((item, i, list) => {
    if (!getActor(item.actor_id)) issues.push(`${item.id}: missing actor.`);
    if (!Number.isFinite(item.timestamp_offset_minutes) || item.timestamp_offset_minutes < 0) issues.push(`${item.id}: invalid timing.`);
    if (i && item.timestamp_offset_minutes - list[i - 1].timestamp_offset_minutes > 60) issues.push(`${item.id}: gap over 60 minutes; review pacing.`);
    if (phases.length && !phases.some(p => item.timestamp_offset_minutes >= p.start_minutes && item.timestamp_offset_minutes <= p.end_minutes)) issues.push(`${item.id}: outside planned phases.`);
    if (item.status === 'draft') issues.push(`${item.id}: still draft; review content.`);
    const body = JSON.stringify(item.fields);
    if (seen.has(body)) issues.push(`${item.id}: identical content to ${seen.get(body)}.`);
    seen.set(body, item.id);
  });
  return { issues: issues.slice(0, 60), totalIssues: issues.length, note: 'Structural checks only, scenario first. Review full content for objective coverage, decisions, disclosure, pressure, ambiguity, escalation and consequences.' };
}
function agentValidatePhases(phases) {
  const ordered = [...phases].sort((a, b) => a.start_minutes - b.start_minutes);
  ordered.forEach((p, i) => {
    if (p.end_minutes <= p.start_minutes || (i && p.start_minutes < ordered[i - 1].end_minutes)) throw new AgentValidationError('Phases must have positive durations and must not overlap.');
  });
  return ordered;
}
function agentCleanFields(stimulus, fields) {
  const defs = getTemplateDefinition(stimulus).fields || [];
  const clean = {};
  for (let [key, value] of Object.entries(fields)) {
    const def = defs.find(f => f.key === key);
    // Models often return numbers as text ("47"): accept them when they are clean numbers.
    if (def?.type === 'number' && typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) value = Number(value);
    // A model that sends every field back (GLM does) repeats the protected ones unchanged: skip them.
    if (def && (/upload/.test(def.type) || /url|_data|audio|video/.test(key)) && JSON.stringify(value) === JSON.stringify(stimulus.fields?.[key] ?? '')) continue;
    if (!def || /upload/.test(def.type) || /url|_data|audio|video/.test(key)) throw new AgentValidationError(`Field not editable by agents: ${key}`);
    if (def.type === 'checkbox' && typeof value !== 'boolean') throw new AgentValidationError(`Expected boolean field: ${key}`);
    if (def.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) throw new AgentValidationError(`Expected number field: ${key}`);
    if (['text', 'select'].includes(def.type) && typeof value !== 'string') throw new AgentValidationError(`Expected text field: ${key}`);
    if (def.type === 'textarea') {
      if (['reaction_types', 'awards'].includes(key)) {
        if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) throw new AgentValidationError(`Expected text array: ${key}`);
      } else if (Array.isArray(value)) {
        // List fields (e.g. the files of a dark web post): short lists of texts or flat records.
        if (value.length > 50 || !value.every(item => typeof item === 'string' || (item && typeof item === 'object' && !Array.isArray(item) && Object.values(item).every(v => ['string', 'number', 'boolean'].includes(typeof v))))) throw new AgentValidationError(`Expected a short list: ${key}`);
      } else if (key === 'top_comment') {
        ToolValidator.validate(value, AgentSchema.object({ author: AgentSchema.text(), flair: AgentSchema.text(), text: AgentSchema.text(), upvotes: { type: 'number', minimum: 0, maximum: 1000000000 }, date: AgentSchema.text() }));
      } else if (typeof value !== 'string') throw new AgentValidationError(`Expected text field: ${key}`);
    }
    if (def.options && !def.options.includes(value)) throw new AgentValidationError(`Invalid field option: ${key}`);
    const scrub = v => typeof v === 'string' ? sanitizeFieldValue(v) : Array.isArray(v) ? v.map(scrub) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrub(x)])) : v;
    clean[key] = scrub(value);
  }
  return clean;
}

function agentResolveStimulusTemplate(channel, templateId, fields = {}) {
  let resolved = templateId;
  let contentFields = fields;
  const legacyPublication = fields.publication;
  if (legacyPublication !== undefined) {
    if (channel !== 'article_press' || typeof legacyPublication !== 'string') throw new AgentValidationError('publication is a press template selector; use top-level template_id.');
    const wanted = legacyPublication.trim().toLowerCase();
    const match = Object.entries(ARTICLE_TEMPLATE_LIBRARY).find(([id, template]) => id.toLowerCase() === wanted || template.label?.toLowerCase() === wanted);
    if (!match) throw new AgentValidationError(`Unknown press publication. Use template_id: ${Object.keys(ARTICLE_TEMPLATE_LIBRARY).join(', ')}.`);
    if (resolved && resolved !== match[0]) throw new AgentValidationError('Conflicting template_id and fields.publication.');
    resolved = match[0];
    contentFields = Object.fromEntries(Object.entries(fields).filter(([key]) => key !== 'publication'));
  }
  if (resolved) {
    const library = channel === 'article_press' ? ARTICLE_TEMPLATE_LIBRARY : channel === 'breaking_news_tv' ? TV_TEMPLATE_LIBRARY : null;
    if (!library?.[resolved]) throw new AgentValidationError(`template_id is not valid for channel ${channel}.`);
  }
  return { templateId: resolved, fields: contentFields };
}

function createAgentToolRegistry() {
  const S = AgentSchema, registry = new Map();
  const add = (name, description, properties, required, execute, risk = 'read') => registry.set(name, { name, description, inputSchema: S.object(properties, required), execute, risk });
  const id = { id: S.id }, text = S.text(), fields = { type: 'object', additionalProperties: { type: 'json' } };
  const actorProps = { name: S.text(300), role: { ...S.text(), enum: ROLES.map(r => r.value) }, organization: S.text(300), title: S.text(300), language: { ...S.text(), enum: LANGUAGES.map(l => l.value) } };
  const requireItem = (getter, id) => { const item = getter(id); if (!item) throw new AgentValidationError('Unknown item ID.'); return item; };
  const page = { offset: { type: 'integer', minimum: 0, maximum: 100000 }, limit: { type: 'integer', minimum: 1, maximum: 40 } };
  const paginate = (items, args, mapper) => { const offset = args.offset || 0, limit = args.limit || 20; return { total: items.length, nextOffset: offset + limit < items.length ? offset + limit : null, items: items.slice(offset, offset + limit).map(mapper) }; };
  add('getScenario', 'Read scenario and planning metadata; no settings or credentials.', {}, [], agentScenario);
  add('updateScenario', 'Patch only supplied scenario/client values. Broad change requires approval in Agent mode.', { name: S.text(500), client: S.object({ name: S.text(300), sector: S.text(300), language: actorProps.language }), scenario: S.object({ type: S.text(300), summary: text, detailed_context: S.text(16000), start_date: S.text(30), end_date: S.text(30), timezone: { ...S.text(), enum: TIMEZONES }, narrative_arc: text }) }, [], args => {
    for (const key of ['start_date', 'end_date']) if (args.scenario?.[key] && !Number.isFinite(Date.parse(args.scenario[key]))) throw new AgentValidationError(`Invalid ${key}.`);
    if (args.name !== undefined) appState.scenario.name = args.name;
    Object.assign(appState.scenario.client, args.client || {}); Object.assign(appState.scenario.scenario, args.scenario || {});
    return agentScenario();
  }, 'broad');
  add('getExerciseObjectives', 'Read objectives and narrative arc.', {}, [], () => agentPick(appState.scenario.scenario, ['objectives', 'narrative_arc']));
  add('updateExerciseObjectives', 'Set explicit objectives, including participant decisions to test.', { objectives: text }, ['objectives'], args => { appState.scenario.scenario.objectives = args.objectives; return args; }, 'write');
  add('getTimeline', 'Read timed phases and a paginated timeline.', page, [], args => ({ phases: appState.scenario.scenario.phases || [], ...paginate(getSortedStimuli(), args, s => agentPick(s, ['id', 'name', 'actor_id', 'channel', 'timestamp_offset_minutes'])) }));
  const phase = S.object({ name: S.text(200), start_minutes: S.minutes, end_minutes: S.minutes, purpose: S.text(1500) }, ['name', 'start_minutes', 'end_minutes', 'purpose']);
  add('setPhases', 'Create or replace the timed exercise phases (not debrief phases). Phases are the main storyline blocks of the Scenario Builder.', { phases: S.array(phase, 20) }, ['phases'], args => {
    const phases = agentValidatePhases(args.phases);
    StoryboardHistory.ensure(); StoryboardHistory.flush();
    sbApplyPhases(appState.scenario.storyboard, phases);
    StoryboardHistory.commit('Agent: set phases');
    appState.scenario.scenario.phases = sbDerivePhases(appState.scenario.storyboard);
    return args;
  }, 'broad');
  add('getStoryboard', 'Read the main storyline: phases with briefs, narratives and planned injects, each addressed to a player cell.', {}, [], () => {
    const storyboard = appState.scenario.storyboard;
    return {
      duration_minutes: storyboard.duration_minutes,
      synopsis: agentExcerpt(storyboard.meta.synopsis, 2000),
      cells: (appState.scenario.cells || []).map(cell => ({ id: cell.id, name: cell.name, description: agentExcerpt(cell.description, 300), players: cell.players.map(player => agentPick(player, ['name', 'role'])) })),
      cast: storyboard.cast.map(cast => ({ ...agentPick(cast, ['id', 'label', 'role', 'organization']), actor_id: cast.actor_id || null })),
      blocks: sbSortedBlocks(storyboard).slice(0, 40).map(block => ({ id: block.id, type: block.type, title: block.title, start_minutes: block.start_minutes, duration_minutes: block.duration_minutes, stimuli_target: block.stimuli_target, locked: block.locked, brief: agentExcerpt(block.brief, 700), narrative: agentExcerpt(block.narrative, 900), objectives: block.objectives, beats: block.beats.map(beat => ({ id: beat.id, at: beat.offset_minutes, exercise_minute: sbBeatAbsolute(block, beat), cell_id: beat.cell_id || null, channel: beat.channel, cast_id: beat.cast_id, title: agentExcerpt(beat.title, 160), intent: agentExcerpt(beat.intent, 300), nudge: beat.kind === 'nudge' || undefined, stimulus_id: sbStimulusForBeat(appState.scenario, beat.id)?.id || null })), key_events: (block.events || []).map(event => ({ at: event.offset_minutes, exercise_minute: block.start_minutes + event.offset_minutes, text: agentExcerpt(event.text, 400) })) }))
    };
  });
  add('updateStoryboardBlock', 'Patch one Scenario Builder block (type, title, brief, narrative, timing, inject count, notes). Locked blocks are refused.', { ...id, patch: S.object({ type: { ...S.text(), enum: Object.keys(SB_BLOCK_TYPES) }, title: S.text(200), brief: S.text(4000), narrative: S.text(8000), notes: S.text(4000), start_minutes: S.minutes, duration_minutes: { type: 'integer', minimum: 5, maximum: 525600 }, stimuli_target: { type: 'integer', minimum: 0, maximum: 24 } }) }, ['id', 'patch'], args => {
    StoryboardHistory.ensure(); StoryboardHistory.flush();
    const block = sbBlock(appState.scenario.storyboard, args.id);
    if (!block) throw new AgentValidationError('Unknown item ID.');
    if (block.locked) throw new AgentValidationError('This storyboard block is locked by the designer.');
    Object.assign(block, sbPickBlockPatch(args.patch));
    if (args.patch.type) block.type = args.patch.type;
    StoryboardHistory.commit('Agent: edit block');
    return { id: block.id, title: block.title, start_minutes: block.start_minutes, duration_minutes: block.duration_minutes, stimuli_target: block.stimuli_target };
  }, 'write');
  // ── Exercise frame, storyline, cells, cast and per-cell inject plan ──────────
  add('getExerciseFrame', 'Read the exercise frame set in the Context tab: play duration, simulated start/end dates, timezone, languages, number of cells and players, and the designer context (objectives and ideas).', {}, [], agentExerciseFrame);
  add('getReferenceFile', 'Read the file the designer loaded in the Context tab: an exercise deck, a proposal, an exercise brief or a chronogram. part "outline" (default) gives everything it says, slide by slide or section by section, each tagged with what it is about (context, objectives, players, phases, incident, chronogram, facilitation, rules, debrief): titles, bullets, tables, charts, SmartArt and speaker notes. part "injects" gives its chronogram as rows. Pages of 12000 characters: pass nextOffset as offset to read on.', { part: { ...S.text(), enum: ['outline', 'injects'] }, offset: { type: 'integer', minimum: 0, maximum: 1000000 } }, [], agentReferenceFile);
  add('setExerciseFrame', 'Patch the exercise frame. duration_minutes is the real play time; start_date/end_date are the simulated in-story clock (ISO local date-time). learning_objectives is one free text on what the players must practise (it may name cells); attack_path is the incident timeline: what really happened, in order, from the attack to its detection and the response.', {
    duration_minutes: { type: 'integer', minimum: 30, maximum: SB_MAX_DURATION }, start_date: S.text(30), end_date: S.text(30), timezone: { ...S.text(), enum: TIMEZONES }, players_count: { type: 'integer', minimum: 0, maximum: 10000 }, cells_count: { type: 'integer', minimum: 0, maximum: 30 }, learning_objectives: S.text(6000), attack_path: S.text(6000)
  }, [], args => {
    const project = appState.scenario;
    if (args.learning_objectives !== undefined) project.scenario.learning_objectives = sbText(args.learning_objectives, 6000);
    if (args.attack_path !== undefined) project.scenario.attack_path = sbText(args.attack_path, 6000);
    for (const key of ['start_date', 'end_date']) {
      if (args[key] === undefined) continue;
      if (args[key] && !Number.isFinite(Date.parse(args[key]))) throw new AgentValidationError(`Invalid ${key}.`);
      project.scenario[key] = args[key];
    }
    if (args.timezone) project.scenario.timezone = args.timezone;
    if (args.duration_minutes) { StoryboardHistory.ensure(); StoryboardHistory.flush(); project.storyboard.duration_minutes = Math.max(args.duration_minutes, sbStoryboardEnd(project.storyboard)); StoryboardHistory.commit('Agent: exercise duration'); }
    project.exercise = project.exercise || { players_count: '', cells_count: '' };
    if (args.players_count !== undefined) project.exercise.players_count = args.players_count;
    if (args.cells_count !== undefined) { project.exercise.cells_count = args.cells_count; sbSetCellsCount(project, args.cells_count); }
    sbAfterStoryboardChange(project, { save: false });
    return agentExerciseFrame();
  }, 'write');
  add('updateStorylineMeta', 'Set the hidden synopsis (what really happens) and the threat description of the main storyline.', { synopsis: S.text(8000), threat: S.text(2000) }, [], args => {
    StoryboardHistory.ensure(); StoryboardHistory.flush();
    const meta = appState.scenario.storyboard.meta;
    if (args.synopsis !== undefined) meta.synopsis = sbText(args.synopsis, 8000);
    if (args.threat !== undefined) meta.threat = sbText(args.threat, 2000);
    StoryboardHistory.commit('Agent: storyline synopsis');
    return { synopsis: agentExcerpt(meta.synopsis, 600), threat: agentExcerpt(meta.threat, 400) };
  }, 'write');
  const blockTypes = Object.keys(SB_BLOCK_TYPES), channels = sbChannelKeys();
  /* Planned inject times are minutes from the phase start. A time given from the exercise start
     (it falls inside the phase that way only) is converted; any other time outside the phase is
     refused with the phase range, rather than moved silently to the phase end. */
  const agentBeatsInPhase = (phase, beats) => (beats || []).map(beat => {
    const at = Number(beat.at), start = Number(phase.start_minutes) || 0, duration = Number(phase.duration_minutes) || 0;
    if (at < duration) return beat;
    if (at >= start && at < start + duration) return { ...beat, at: at - start };
    throw new AgentValidationError(`Planned inject "${beat.title}": at=${at} is outside phase "${phase.title}". Use minutes from the phase start, 0 to ${Math.max(0, duration - 1)} (exercise minutes ${start} to ${start + Math.max(0, duration - 1)}).`);
  });
  const beatSchema = S.object({ at: S.minutes, channel: { ...S.text(), enum: channels }, cell: S.text(160), cast: S.text(200), title: S.text(300), intent: S.text(2000), nudge: { type: 'boolean' } }, ['at', 'channel', 'title']);
  add('buildMainStoryline', 'Create or replace the whole main storyline: ordered phases fitted to the play duration, the cast of simulated senders and objectives. Phases use minutes from exercise start. Optional beats plan injects per phase (at = minutes from phase start, cell = cell id or name, cast = cast key, nudge = true for a nudge). Unless the designer asks otherwise, the last phase is a closing phase (recovery or exit: return to normal operations, end of exercise, hot wash). Replaces the current storyline; a version is saved first.', {
    title: S.text(300), summary: S.text(8000), threat: S.text(2000), objectives: S.array(S.text(600), 12),
    cast: S.array(S.object({ key: S.text(80), label: S.text(200), role: { ...S.text(), enum: ROLES.map(r => r.value) }, organization: S.text(200), description: S.text(1000) }, ['key', 'label', 'role']), 30),
    phases: S.array(S.object({ type: { ...S.text(), enum: blockTypes }, title: S.text(200), start_minutes: S.minutes, duration_minutes: { type: 'integer', minimum: 5, maximum: SB_MAX_DURATION }, injects: { type: 'integer', minimum: 0, maximum: SB_MAX_BEATS }, brief: S.text(4000), narrative: S.text(8000), objectives: S.array({ type: 'integer', minimum: 0, maximum: 11 }, 12), beats: S.array(beatSchema, SB_MAX_BEATS) }, ['type', 'title', 'start_minutes', 'duration_minutes', 'brief']), 24)
  }, ['phases'], args => {
    const project = appState.scenario;
    if (!args.phases.length) throw new AgentValidationError('Provide at least one phase.');
    // A framing on a library scenario: replacing the storyline would drop its planned injects.
    const planned = project.storyboard.blocks.reduce((sum, block) => sum + block.beats.length, 0);
    if (planned && typeof getCrisisAgent === 'function' && getCrisisAgent().active && getCrisisAgent().scope === 'framing') throw new AgentValidationError(`The storyline already has ${planned} planned injects (from the library scenario): do not replace it. Change phases with updateStoryboardBlock and main events with setMainEvents.`);
    // Checked before anything is replaced.
    args.phases.forEach(phase => { phase.beats = agentBeatsInPhase(phase, phase.beats); });
    StoryboardHistory.ensure(project); StoryboardHistory.snapshot('Before the agent storyline', 'ai');
    const cells = project.cells || [];
    const template = {
      id: 'agent', name: args.title || project.name, summary: args.summary || project.storyboard.meta.synopsis, threat: args.threat || project.storyboard.meta.threat,
      duration_minutes: project.storyboard.duration_minutes, objectives: args.objectives?.length ? args.objectives : sbObjectivesList(project), cast: args.cast || [],
      blocks: args.phases.map((phase, index) => ({ key: `p${index + 1}`, type: phase.type, track: 'main', title: phase.title, start: phase.start_minutes, duration: phase.duration_minutes, stimuli: phase.injects ?? phase.beats?.length ?? SB_BLOCK_TYPES[phase.type].stimuli, brief: phase.brief, narrative: phase.narrative || '', objectives: phase.objectives || [], beats: [] }))
    };
    sbApplyTemplate(template, 'replace');
    // Beats are mapped after the storyline exists, so cells and cast resolve to real ids.
    const castMap = new Map(project.storyboard.cast.map(cast => [cast.label, cast.id]));
    (args.cast || []).forEach(item => { const cast = project.storyboard.cast.find(entry => entry.label === item.label); if (cast) castMap.set(item.key, cast.id); });
    sbMainBlocks(project.storyboard).forEach((block, index) => {
      const beats = args.phases[index]?.beats || [];
      if (beats.length) { block.beats = sbBeatsFromAI(project.storyboard, beats, castMap, project).map(beat => ({ ...beat, offset_minutes: Math.min(beat.offset_minutes, block.duration_minutes - 1) })); block.stimuli_target = Math.max(block.stimuli_target, block.beats.length); sbMarkPlanned(block); }
    });
    if (!cells.length) sbAssignMissingCells(project);
    StoryboardHistory.ensure(project, 'Agent: main storyline');
    sbAfterStoryboardChange(project, { save: false });
    return agentStoryboardSummary();
  }, 'broad');
  add('upsertCells', 'Create or update player cells (groups of participants who receive injects) and, when known, their players. Supply id to update an existing cell; players replaces that cell\'s player list. A player name is a person\'s name (empty when unknown, never a job title such as CEO).', {
    cells: S.array(S.object({ id: S.id, name: S.text(160), description: S.text(1000), players: S.array(S.object({ name: S.text(200), role: S.text(200) }, ['role']), 200) }, ['name']), 20)
  }, ['cells'], args => {
    const project = appState.scenario;
    if (!Array.isArray(project.cells)) project.cells = [];
    const result = args.cells.map(input => {
      let cell = input.id ? sbCell(project, input.id) : project.cells.find(item => item.name.toLowerCase() === input.name.toLowerCase());
      if (input.id && !cell) throw new AgentValidationError('Unknown cell ID.');
      if (!cell) {
        const preset = SB_CELL_PRESETS.find(item => item.name.toLowerCase() === input.name.toLowerCase());
        cell = sbMakeCell(preset?.key || 'custom', { name: input.name });
        project.cells.push(cell);
      }
      cell.name = sbText(input.name, 160) || cell.name;
      if (input.description !== undefined) cell.description = sbText(input.description, 1000);
      // A job title given as the name ("CEO", or the role repeated) is not a person: the name stays
      // empty, so a real name typed later does not replace the title everywhere in the injects.
      if (input.players) cell.players = input.players.map(player => sbNormalizePlayer({ id: uid('player'), ...player, name: ceIsTitleLike(player.name, player.role) ? '' : player.name }));
      return { id: cell.id, name: cell.name, players: cell.players.length };
    });
    project.exercise = { ...(project.exercise || {}), cells_count: project.cells.length };
    return { cells: result };
  }, 'write');
  add('upsertCast', 'Create or update the cast: simulated roles who send injects (attacker, journalist, regulator, customer, staff). With actor, the role is played by a named actor listed in Cells & actors (created or linked).', {
    cast: S.array(S.object({ id: S.id, label: S.text(200), role: { ...S.text(), enum: ROLES.map(r => r.value) }, organization: S.text(200), description: S.text(1000), actor: S.object({ name: S.text(300), title: S.text(300), organization: S.text(300), language: { ...S.text(), enum: LANGUAGES.map(l => l.value) } }, ['name']) }, ['label']), 30)
  }, ['cast'], args => {
    const project = appState.scenario;
    StoryboardHistory.ensure(project); StoryboardHistory.flush();
    const storyboard = project.storyboard;
    const result = args.cast.map(input => {
      let cast = input.id ? storyboard.cast.find(item => item.id === input.id) : storyboard.cast.find(item => item.label.toLowerCase() === input.label.toLowerCase());
      if (input.id && !cast) throw new AgentValidationError('Unknown cast ID.');
      if (!cast) { cast = sbMakeCast({ label: input.label, role: input.role }); storyboard.cast.push(cast); }
      Object.assign(cast, sbNormalizeCast({ ...cast, ...agentPick(input, ['label', 'role', 'organization', 'description']), id: cast.id }));
      if (input.actor) {
        // One named actor per kind of sender: an actor who is staff, or who already plays another
        // role of another kind, cannot also be the attacker, the bank or the journalist.
        // A clash no longer fails the whole call (models such as DeepSeek give one "facilitator"
        // several roles and then retry the same call): the role gets its own actor, named after
        // it, and the note tells the model.
        const fits = (actor) => {
          const other = storyboard.cast.find(item => item.id !== cast.id && item.actor_id === actor.id);
          return sbRoleValue(actor.role) === sbRoleValue(cast.role) && !(other && sbRoleValue(other.role) !== sbRoleValue(cast.role));
        };
        let existing = sbFindActorForCast(project, { ...cast, actor_id: '', label: input.actor.name });
        let note = '';
        if (existing && !fits(existing)) {
          const clash = existing;
          const own = sbFindActorForCast(project, { ...cast, actor_id: '' });
          existing = own && fits(own) ? own : null;
          note = `"${clash.name}" already plays another kind of role: role "${cast.label}" (${cast.role}) got its own actor instead; rename it with updateActor if needed.`;
        }
        const actor = existing || sbCreateActorForCast(project, cast, { ...input.actor, ...(note ? { name: cast.label } : {}), role: cast.role });
        Object.assign(actor, agentPick(input.actor, ['title', 'organization', 'language']));
        cast.actor_id = actor.id;
        if (note) return { id: cast.id, label: cast.label, actor_id: actor.id, actor_name: actor.name, note };
      }
      return { id: cast.id, label: cast.label, actor_id: cast.actor_id || null };
    });
    StoryboardHistory.commit('Agent: cast');
    return { cast: result };
  }, 'write');
  add('planPhaseInjects', 'Plan the injects of one main-storyline phase, each addressed to a player cell and sent by a cast role, on a channel that fits the sender (internal emails and memos only from staff; authorities use email_authority; outside organisations email_external, phone or SMS; press and public use press, TV and social channels; vary the channels). nudge=true marks a nudge: an inject that relaunches or redirects players who stall or go off track (a follow-up from the CEO asking for a decision, a journalist calling back, a regulator deadline reminder); every cell gets at least one over the exercise. at = minutes from phase start (0 to duration-1), as in getStoryboard beats; exercise_minute is only informative. replace=true swaps the planned injects that are not yet written; written ones are kept. The Detailed storyline tab turns planned injects into written stimuli.', {
    ...id, replace: { type: 'boolean' }, injects: S.array(beatSchema, SB_MAX_BEATS)
  }, ['id', 'injects'], args => {
    const project = appState.scenario;
    StoryboardHistory.ensure(project); StoryboardHistory.flush();
    const block = sbBlock(project.storyboard, args.id);
    if (!block) throw new AgentValidationError('Unknown item ID.');
    if (block.locked) throw new AgentValidationError('This storyboard block is locked by the designer.');
    const castMap = new Map(project.storyboard.cast.flatMap(cast => [[cast.id, cast.id], [cast.label, cast.id]]));
    const planned = sbBeatsFromAI(project.storyboard, agentBeatsInPhase(block, args.injects), castMap, project).map(beat => ({ ...beat, offset_minutes: Math.min(beat.offset_minutes, block.duration_minutes - 1) }));
    const kept = args.replace ? block.beats.filter(beat => sbStimulusForBeat(project, beat.id)) : block.beats;
    block.beats = [...kept, ...planned].slice(0, SB_MAX_BEATS).sort((a, b) => a.offset_minutes - b.offset_minutes);
    sbMarkPlanned(block);
    block.stimuli_target = Math.max(block.stimuli_target, block.beats.length);
    block.key_cast = [...new Set(block.beats.map(beat => beat.cast_id).filter(Boolean))];
    StoryboardHistory.commit('Agent: plan injects');
    return { id: block.id, title: block.title, start_minutes: block.start_minutes, duration_minutes: block.duration_minutes, planned: block.beats.map(beat => ({ at: beat.offset_minutes, exercise_minute: sbBeatAbsolute(block, beat), cell_id: beat.cell_id, cast_id: beat.cast_id, channel: beat.channel, title: beat.title, nudge: beat.kind === 'nudge' || undefined })) };
  }, 'write');
  add('getPhase', 'Read one main-storyline phase in full: brief, narrative, main events and every planned inject (at = minutes from the phase start). Smaller than getStoryboard; use it before editing one phase.', id, ['id'], args => {
    const project = appState.scenario;
    const block = sbBlock(project.storyboard, args.id);
    if (!block) throw new AgentValidationError('Unknown item ID.');
    return { id: block.id, type: block.type, title: block.title, start_minutes: block.start_minutes, duration_minutes: block.duration_minutes, stimuli_target: block.stimuli_target, locked: block.locked, brief: agentExcerpt(block.brief, 4000), narrative: agentExcerpt(block.narrative, 8000), objectives: block.objectives,
      key_events: (block.events || []).map(event => ({ at: event.offset_minutes, exercise_minute: block.start_minutes + event.offset_minutes, text: agentExcerpt(event.text, 1000) })),
      planned_injects: block.beats.map(beat => ({ id: beat.id, at: beat.offset_minutes, exercise_minute: sbBeatAbsolute(block, beat), cell_id: beat.cell_id || null, channel: beat.channel, cast_id: beat.cast_id, title: beat.title, intent: beat.intent, nudge: beat.kind === 'nudge' || undefined, stimulus_id: sbStimulusForBeat(project, beat.id)?.id || null })) };
  });
  add('updatePlannedInject', 'Edit one planned inject of a phase: its time, recipient cell, sender (cast), channel, title, intent or nudge flag. at = minutes from the phase start; exercise_minute = minutes from the exercise start, and moves it to the phase covering that time. Its written inject, if any, follows the new time and cell.', {
    ...id, inject_id: S.id, patch: S.object({ at: S.minutes, exercise_minute: S.minutes, cell: S.text(160), cast: S.text(200), channel: { ...S.text(), enum: channels }, title: S.text(300), intent: S.text(2000), nudge: { type: 'boolean' } })
  }, ['id', 'inject_id', 'patch'], args => {
    const project = appState.scenario;
    StoryboardHistory.ensure(project); StoryboardHistory.flush();
    const block = sbBlock(project.storyboard, args.id);
    if (!block) throw new AgentValidationError('Unknown item ID.');
    if (block.locked) throw new AgentValidationError('This storyboard block is locked by the designer.');
    const beat = block.beats.find(item => item.id === args.inject_id);
    if (!beat) throw new AgentValidationError(`Unknown planned inject in phase "${block.title}". Read it with getPhase.`);
    const patch = args.patch || {};
    let cell;
    if (patch.cell !== undefined) {
      cell = sbCell(project, patch.cell) ? patch.cell : (project.cells || []).find(item => item.name.toLowerCase() === String(patch.cell).toLowerCase())?.id;
      if (!cell) throw new AgentValidationError(`Unknown cell "${patch.cell}". Use a cell id or name from getStoryboard.`);
    }
    if (patch.exercise_minute !== undefined && patch.exercise_minute >= project.storyboard.duration_minutes) throw new AgentValidationError(`exercise_minute must be below the play duration (${project.storyboard.duration_minutes}).`);
    const at = patch.exercise_minute !== undefined ? patch.exercise_minute
      : patch.at !== undefined ? block.start_minutes + agentBeatsInPhase(block, [{ at: patch.at, title: beat.title }])[0].at : undefined;
    if (patch.cast !== undefined) {
      const cast = project.storyboard.cast.find(item => item.id === patch.cast || item.label.toLowerCase() === String(patch.cast).toLowerCase());
      if (!cast) throw new AgentValidationError(`Unknown cast "${patch.cast}". Use a cast id or label from getStoryboard.`);
      beat.cast_id = cast.id;
    }
    if (patch.channel !== undefined) { beat.channel = sbValidChannel(patch.channel); beat.template_id = ''; }
    if (patch.title !== undefined) beat.title = sbText(patch.title, 300);
    if (patch.intent !== undefined) beat.intent = sbText(patch.intent, 2000);
    if (patch.nudge === true) beat.kind = 'nudge';
    else if (patch.nudge === false) delete beat.kind;
    if (at !== undefined || cell !== undefined) dsMoveItem(project, { kind: 'beat', beat, block, stimulus: sbStimulusForBeat(project, beat.id) }, at !== undefined ? at : sbBeatAbsolute(block, beat), cell);
    else StoryboardHistory.commit('Agent: edit planned inject');
    const target = project.storyboard.blocks.find(item => item.beats.includes(beat)) || block;
    target.key_cast = [...new Set(target.beats.map(item => item.cast_id).filter(Boolean))];
    return { phase_id: target.id, phase: target.title, id: beat.id, at: beat.offset_minutes, exercise_minute: sbBeatAbsolute(target, beat), cell_id: beat.cell_id || null, cast_id: beat.cast_id, channel: beat.channel, title: beat.title, nudge: beat.kind === 'nudge' || undefined };
  }, 'write');
  add('setMainEvents', 'Set the main events of one main-storyline phase: the key moments of the incident timeline that happen during play (the ransom note, the leak going public, a regulator call). They are not injects: injects are planned and written around them, and never reveal one before it happens. at = minutes from the phase start. replace=true replaces the phase\'s events, otherwise they are added.', {
    ...id, replace: { type: 'boolean' }, events: S.array(S.object({ at: S.minutes, exercise_minute: S.minutes, text: S.text(600) }, ['text']), 12)
  }, ['id', 'events'], args => {
    const project = appState.scenario;
    StoryboardHistory.ensure(project); StoryboardHistory.flush();
    const block = sbBlock(project.storyboard, args.id);
    if (!block) throw new AgentValidationError('Unknown item ID.');
    if (block.locked) throw new AgentValidationError('This storyboard block is locked by the designer.');
    // An event whose text starts with a clock time ("09:30 – …") is placed at that simulated time;
    // otherwise at, or the informative exercise_minute when at is missing.
    const duration = project.storyboard.duration_minutes;
    const outside = (event, minute) => {
      const owner = sbMainBlockAt(project.storyboard, minute);
      return new AgentValidationError(`Main event "${agentExcerpt(event.text, 80)}" happens at ${sbFormatOffset(minute)} (exercise minute ${minute}), inside phase "${owner?.title || '?'}"${owner ? ` (id ${owner.id}, minutes ${owner.start_minutes} to ${sbBlockEnd(owner) - 1})` : ''}, not in "${block.title}" (${block.start_minutes} to ${sbBlockEnd(block) - 1}). Set it on ${owner ? `phase ${owner.id}` : 'the phase of that time'} with at = ${owner ? minute - owner.start_minutes : 'minutes from its start'}, or move the phase boundaries first (updateStoryboardBlock).`);
    };
    // An event whose time falls in another phase goes to that phase (models often set a whole
    // timeline on one phase); the result says where it went.
    const placed = new Map();
    const moved = [];
    const place = (target, event, offset) => {
      if (!placed.has(target)) placed.set(target, []);
      placed.get(target).push({ ...event, at: offset });
      if (target !== block) moved.push(`"${agentExcerpt(event.text, 60)}" -> "${target.title}" (${target.id})`);
    };
    for (const event of args.events) {
      const { exercise_minute: absolute, ...rest } = event;
      const clock = sbTextClockMinute(event.text, project.scenario.start_date, duration);
      const minute = clock !== null ? clock : rest.at !== undefined ? null : absolute;
      if (minute === null) { place(block, rest, rest.at); continue; }
      if (minute === undefined) throw new AgentValidationError(`Main event "${agentExcerpt(event.text, 80)}" has no time: give at, minutes from the phase start (0 to ${block.duration_minutes - 1}).`);
      if (minute >= block.start_minutes && minute < sbBlockEnd(block)) { place(block, rest, minute - block.start_minutes); continue; }
      const owner = sbMainBlockAt(project.storyboard, minute);
      if (!owner || owner.locked) throw outside(event, minute);
      place(owner, rest, minute - owner.start_minutes);
    }
    const setEvents = (target, events, replace) => {
      const added = agentBeatsInPhase(target, events.map(event => ({ ...event, title: event.text }))).map(event => sbMakeEvent({ offset_minutes: event.at, text: event.text }));
      // An event already there (same text, as the agent may set a phase twice) is not added again.
      const kept = replace ? [] : target.events || [];
      const known = new Set(kept.map(event => String(event.text).trim().toLowerCase()));
      target.events = [...kept, ...added.filter(event => !known.has(String(event.text).trim().toLowerCase()) && known.add(String(event.text).trim().toLowerCase()))].sort((x, y) => x.offset_minutes - y.offset_minutes).slice(0, 12);
    };
    if (args.replace && !placed.has(block)) block.events = [];
    for (const [target, events] of placed) setEvents(target, events, args.replace && target === block);
    StoryboardHistory.commit('Agent: main events');
    return { id: block.id, title: block.title, key_events: block.events.map(event => ({ at: event.offset_minutes, exercise_minute: block.start_minutes + event.offset_minutes, text: event.text })), ...(moved.length ? { moved_to_their_phase: moved } : {}) };
  }, 'write');
  add('listActors', 'Read actors with pagination.', page, [], args => paginate(appState.scenario.actors, args, agentActor));
  add('getActor', 'Read a single actor.', id, ['id'], args => agentActor(requireItem(getActor, args.id)));
  add('createActor', 'Create an actor using the same defaults as the UI.', actorProps, ['name', 'role'], args => agentActor(addActor(args, false)), 'write');
  add('updateActor', 'Patch an existing actor.', { ...id, patch: S.object(actorProps) }, ['id', 'patch'], args => { const actor = requireItem(getActor, args.id); Object.assign(actor, args.patch); actor.avatar_initials = initialsFromName(actor.name); return agentActor(actor); }, 'write');
  add('listStimuli', 'Read paginated content excerpts; getStimulus returns complete editable content.', page, [], args => paginate(getSortedStimuli(), args, s => agentStimulus(s)));
  add('getStimulus', 'Read complete content plus editable template fields and types.', id, ['id'], args => agentStimulus(requireItem(getStimulus, args.id), true));
  const stimulusProps = { name: S.text(500), actor_id: S.id, timestamp_offset_minutes: S.minutes, generation_prompt: text, status: { ...S.text(), enum: ['draft', 'ready'] }, fields };
  const specializedTemplateIds = [...new Set([...Object.keys(ARTICLE_TEMPLATE_LIBRARY), ...Object.keys(TV_TEMPLATE_LIBRARY)])];
  add('createStimulus', 'Create a scheduled inject. For article_press or breaking_news_tv, select the publication/station with top-level template_id. fields accepts only actual fields of that template; publication is not a content field. Omit fields and generate content afterwards when field names are unknown.', { ...stimulusProps, channel: { ...S.text(), enum: Object.keys(TEMPLATE_LIBRARY) }, template_id: { ...S.text(), enum: specializedTemplateIds } }, ['name', 'actor_id', 'timestamp_offset_minutes', 'channel'], args => {
    requireItem(getActor, args.actor_id);
    const selection = agentResolveStimulusTemplate(args.channel, args.template_id, args.fields || {});
    const stimulus = makeStimulus(args.channel, args.actor_id, args.timestamp_offset_minutes, selection.templateId);
    // No demo content of the template: the agent writes it, or generates it next.
    sbBlankForGeneration(stimulus);
    const clean = agentCleanFields(stimulus, selection.fields);
    Object.assign(stimulus, agentPick(args, ['name', 'generation_prompt', 'status']));
    saveStimulus(stimulus, { ...stimulus.fields, ...clean }, 'Agent: created content');
    appState.scenario.stimuli.push(stimulus); setDefaultVideoForStimulus(stimulus); sortStimuli();
    return agentStimulus(stimulus);
  }, 'write');
  add('updateStimulus', 'Patch an inject, preserving its channel/template and versioning changed content.', { ...id, patch: S.object(stimulusProps) }, ['id', 'patch'], args => {
    const stimulus = requireItem(getStimulus, args.id), patch = args.patch;
    if (patch.actor_id) requireItem(getActor, patch.actor_id);
    const clean = agentCleanFields(stimulus, patch.fields || {});
    if (patch.fields) saveStimulus(stimulus, { ...stimulus.fields, ...clean }, 'Agent: edited content');
    Object.assign(stimulus, agentPick(patch, Object.keys(stimulusProps).filter(k => k !== 'fields'))); stimulus.updated_at = new Date().toISOString(); sortStimuli(); return agentStimulus(stimulus);
  }, 'write');
  add('deleteStimulus', 'Delete one inject. Always requires explicit approval.', id, ['id'], args => { requireItem(getStimulus, args.id); deleteStimulus(args.id); return { deleted: args.id }; }, 'destructive');
  add('moveStimulus', 'Move an inject to a minute offset.', { ...id, timestamp_offset_minutes: S.minutes }, ['id', 'timestamp_offset_minutes'], args => { const item = requireItem(getStimulus, args.id); item.timestamp_offset_minutes = args.timestamp_offset_minutes; item.updated_at = new Date().toISOString(); sortStimuli(); return args; }, 'write');
  add('reorderStimuli', 'Atomically reschedule up to 40 injects; no other content changes.', { positions: S.array(S.object({ ...id, timestamp_offset_minutes: S.minutes }, ['id', 'timestamp_offset_minutes'])) }, ['positions'], args => {
    const items = args.positions.map(p => requireItem(getStimulus, p.id));
    if (new Set(args.positions.map(p => p.id)).size !== items.length) throw new AgentValidationError('Duplicate stimulus ID.');
    args.positions.forEach((p, i) => { items[i].timestamp_offset_minutes = p.timestamp_offset_minutes; }); sortStimuli(); return args;
  }, 'broad');
  for (const name of ['generateStimulusContent', 'improveStimulusContent']) {
    add(name, 'Generate/improve content through the existing provider and template prompts. Supply precise instructions. Preserves manual-mode injects.', { ...id, instructions: text }, ['id', 'instructions'], async (args, run) => {
      const stimulus = requireItem(getStimulus, args.id);
      if (stimulus.generation_mode === 'manual') throw new AgentValidationError('Manual-mode content is protected; propose explicit field edits instead.');
      const before = JSON.stringify(stimulus);
      // Photos, logos and media stay out of the prompt (they can weigh megabytes).
      const textFields = Object.fromEntries(Object.entries(stimulus.fields || {}).filter(([key]) => !SB_MEDIA_FIELD.test(key) && !/url|_data|audio|video|image/.test(key)));
      const result = await AITextGenerator.generateForStimulus(stimulus, null, agentRedact(`${args.instructions}\nCurrent content: ${JSON.stringify(textFields)}`), { signal: run.controller.signal, quiet: true, strictJSON: true, promptFilter: agentRedact, maxTokens: 8000 });
      run.assertActive();
      if (getStimulus(args.id) !== stimulus || JSON.stringify(stimulus) !== before) throw new AgentValidationError('Stimulus changed during generation; inspect it again.');
      ToolValidator.validate(result, fields);
      const clean = agentCleanFields(stimulus, result);
      if (!Object.keys(clean).length) throw new AgentValidationError('Generation returned no content.');
      saveStimulus(stimulus, { ...stimulus.fields, ...clean }, 'Agent: AI content generation');
      Object.assign(stimulus.generated_text, clean); stimulus.status = 'ready'; return agentStimulus(stimulus);
    }, 'write');
  }
  add('runConsistencyCheck', 'Run deterministic structural checks; findings need human/design judgment.', {}, [], agentConsistencyCheck);
  add('analyzeExerciseQuality', 'Return structural findings and critical review criteria. Read content and assess each criterion before deciding to improve or finish.', {}, [], () => ({ ...agentConsistencyCheck(), criteria: ['Objectives actually tested', 'Executive decisions and dilemmas', 'Realistic timing and escalation', 'Information disclosure and ambiguity', 'Stakeholder pressure', 'Consequences and narrative consistency'], instruction: 'Use getStimulus for evidence; prioritize issues, act, then re-analyze.' }));
  return registry;
}

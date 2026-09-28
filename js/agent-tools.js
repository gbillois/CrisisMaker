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
    const fail = () => { throw new AgentValidationError(`Invalid ${path}`); };
    if (schema.type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
      for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail();
      for (const [key, item] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) fail();
        const child = schema.properties?.[key] || schema.additionalProperties;
        if (!child || child === false) fail();
        this.validate(item, child, `${path}.${key}`);
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(value) || value.length > schema.maxItems || value.length < (schema.minItems || 0)) fail();
      value.forEach((item, i) => this.validate(item, schema.items, `${path}[${i}]`));
    } else if (schema.type === 'string') {
      if (typeof value !== 'string' || value.length > schema.maxLength || value.length < (schema.minLength || 0)) fail();
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
    if (schema.enum && !schema.enum.includes(value)) fail();
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
    learning_objectives: { all_players: agentExcerpt(project.scenario.learning_objectives || '', 3000), by_cell: (project.cells || []).filter(cell => cell.objectives).map(cell => ({ cell_id: cell.id, cell: cell.name, objectives: agentExcerpt(cell.objectives, 1500) })) },
    attack_path: agentExcerpt(project.scenario.attack_path || '', 6000),
    library_scenario: storyboard?.meta?.template_id && storyboard.meta.template_id !== 'agent' ? storyboard.meta.template_id : null
  };
}
const AgentContext = {
  build() {
    const s = agentScenario();
    s.scenario = Object.fromEntries(Object.entries(s.scenario).map(([k, v]) => [k, typeof v === 'string' ? agentExcerpt(v, 2500) : v]));
    return { ...s, language: appState.scenario.settings.inject_language, frame: agentExerciseFrame(), storyboard: agentStoryboardSummary(), actors: appState.scenario.actors.slice(0, 12).map(agentActor), timeline: getSortedStimuli().slice(0, 20).map(s => ({ id: s.id, at: s.timestamp_offset_minutes, name: agentExcerpt(s.name || s.fields.subject || s.fields.headline || s.fields.text, 100) })), note: 'Actor/timeline/storyboard previews are limited. Use paginated list tools and getStoryboard for details.' };
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
  if (!s.scenario.summary?.trim()) issues.push('Missing scenario summary.');
  if (!s.scenario.objectives?.trim()) issues.push('No explicit exercise objectives recorded.');
  if (!s.actors.length) issues.push('No actors.');
  if (!s.stimuli.length) issues.push('No stimuli.');
  const phases = s.scenario.phases || [];
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
  return { issues: issues.slice(0, 50), totalIssues: issues.length, note: 'Structural checks only. Review full content for objective coverage, decisions, disclosure, pressure, ambiguity, escalation and consequences.' };
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
  for (const [key, value] of Object.entries(fields)) {
    const def = defs.find(f => f.key === key);
    if (!def || /upload/.test(def.type) || /url|_data|audio|video/.test(key)) throw new AgentValidationError(`Field not editable by agents: ${key}`);
    if (def.type === 'checkbox' && typeof value !== 'boolean') throw new AgentValidationError(`Expected boolean field: ${key}`);
    if (def.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) throw new AgentValidationError(`Expected number field: ${key}`);
    if (['text', 'select'].includes(def.type) && typeof value !== 'string') throw new AgentValidationError(`Expected text field: ${key}`);
    if (def.type === 'textarea') {
      if (['reaction_types', 'awards'].includes(key)) {
        if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) throw new AgentValidationError(`Expected text array: ${key}`);
      } else if (key === 'top_comment') {
        ToolValidator.validate(value, AgentSchema.object({ author: AgentSchema.text(), flair: AgentSchema.text(), text: AgentSchema.text(), upvotes: { type: 'number', minimum: 0, maximum: 1000000000 }, date: AgentSchema.text() }));
      } else if (typeof value !== 'string') throw new AgentValidationError(`Expected text field: ${key}`);
    }
    if (def.options && !def.options.includes(value)) throw new AgentValidationError(`Invalid field option: ${key}`);
    const scrub = v => typeof v === 'string' ? sanitizeBody(v) : Array.isArray(v) ? v.map(scrub) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrub(x)])) : v;
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
      cells: (appState.scenario.cells || []).map(cell => ({ id: cell.id, name: cell.name, description: agentExcerpt(cell.description, 300), objectives: agentExcerpt(cell.objectives || '', 1500), players: cell.players.map(player => agentPick(player, ['name', 'role'])) })),
      cast: storyboard.cast.map(cast => ({ ...agentPick(cast, ['id', 'label', 'role', 'organization']), actor_id: cast.actor_id || null })),
      blocks: sbSortedBlocks(storyboard).slice(0, 40).map(block => ({ id: block.id, type: block.type, title: block.title, start_minutes: block.start_minutes, duration_minutes: block.duration_minutes, stimuli_target: block.stimuli_target, locked: block.locked, brief: agentExcerpt(block.brief, 700), narrative: agentExcerpt(block.narrative, 900), objectives: block.objectives, beats: block.beats.map(beat => ({ id: beat.id, at: sbBeatAbsolute(block, beat), cell_id: beat.cell_id || null, channel: beat.channel, cast_id: beat.cast_id, title: agentExcerpt(beat.title, 160), intent: agentExcerpt(beat.intent, 300), stimulus_id: sbStimulusForBeat(appState.scenario, beat.id)?.id || null })) }))
    };
  });
  add('updateStoryboardBlock', 'Patch one Scenario Builder block (title, brief, narrative, timing, inject count, notes). Locked blocks are refused.', { ...id, patch: S.object({ title: S.text(200), brief: S.text(4000), narrative: S.text(8000), notes: S.text(4000), start_minutes: S.minutes, duration_minutes: { type: 'integer', minimum: 5, maximum: 525600 }, stimuli_target: { type: 'integer', minimum: 0, maximum: 24 } }) }, ['id', 'patch'], args => {
    StoryboardHistory.ensure(); StoryboardHistory.flush();
    const block = sbBlock(appState.scenario.storyboard, args.id);
    if (!block) throw new AgentValidationError('Unknown item ID.');
    if (block.locked) throw new AgentValidationError('This storyboard block is locked by the designer.');
    Object.assign(block, sbPickBlockPatch(args.patch));
    StoryboardHistory.commit('Agent: edit block');
    return { id: block.id, title: block.title, start_minutes: block.start_minutes, duration_minutes: block.duration_minutes, stimuli_target: block.stimuli_target };
  }, 'write');
  // ── Exercise frame, storyline, cells, cast and per-cell inject plan ──────────
  add('getExerciseFrame', 'Read the exercise frame set in the Context tab: play duration, simulated start/end dates, timezone, languages, number of cells and players, and the designer context (objectives and ideas).', {}, [], agentExerciseFrame);
  add('setExerciseFrame', 'Patch the exercise frame. duration_minutes is the real play time; start_date/end_date are the simulated in-story clock (ISO local date-time). learning_objectives are for all players; attack_path lists the technical steps of the attack in order.', {
    duration_minutes: { type: 'integer', minimum: 30, maximum: SB_MAX_DURATION }, start_date: S.text(30), end_date: S.text(30), timezone: { ...S.text(), enum: TIMEZONES }, players_count: { type: 'integer', minimum: 0, maximum: 10000 }, cells_count: { type: 'integer', minimum: 0, maximum: 30 }, learning_objectives: S.text(3000), attack_path: S.text(6000)
  }, [], args => {
    const project = appState.scenario;
    if (args.learning_objectives !== undefined) project.scenario.learning_objectives = sbText(args.learning_objectives, 3000);
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
  const beatSchema = S.object({ at: S.minutes, channel: { ...S.text(), enum: channels }, cell: S.text(160), cast: S.text(200), title: S.text(300), intent: S.text(2000) }, ['at', 'channel', 'title']);
  add('buildMainStoryline', 'Create or replace the whole main storyline: ordered phases fitted to the play duration, the cast of simulated senders and objectives. Phases use minutes from exercise start. Optional beats plan injects per phase (at = minutes from phase start, cell = cell id or name, cast = cast key). Replaces the current storyline; a version is saved first.', {
    title: S.text(300), summary: S.text(8000), threat: S.text(2000), objectives: S.array(S.text(600), 12),
    cast: S.array(S.object({ key: S.text(80), label: S.text(200), role: { ...S.text(), enum: ROLES.map(r => r.value) }, organization: S.text(200), description: S.text(1000) }, ['key', 'label', 'role']), 30),
    phases: S.array(S.object({ type: { ...S.text(), enum: blockTypes }, title: S.text(200), start_minutes: S.minutes, duration_minutes: { type: 'integer', minimum: 5, maximum: SB_MAX_DURATION }, injects: { type: 'integer', minimum: 0, maximum: SB_MAX_BEATS }, brief: S.text(4000), narrative: S.text(8000), objectives: S.array({ type: 'integer', minimum: 0, maximum: 11 }, 12), beats: S.array(beatSchema, SB_MAX_BEATS) }, ['type', 'title', 'start_minutes', 'duration_minutes', 'brief']), 24)
  }, ['phases'], args => {
    const project = appState.scenario;
    if (!args.phases.length) throw new AgentValidationError('Provide at least one phase.');
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
      if (beats.length) { block.beats = sbBeatsFromAI(project.storyboard, beats, castMap, project).map(beat => ({ ...beat, offset_minutes: Math.min(beat.offset_minutes, block.duration_minutes - 1) })); block.stimuli_target = Math.max(block.stimuli_target, block.beats.length); }
    });
    if (!cells.length) sbAssignMissingCells(project);
    StoryboardHistory.ensure(project, 'Agent: main storyline');
    sbAfterStoryboardChange(project, { save: false });
    return agentStoryboardSummary();
  }, 'broad');
  add('upsertCells', 'Create or update player cells (groups of participants who receive injects), their learning objectives and, when known, their players. Supply id to update an existing cell; players replaces that cell\'s player list.', {
    cells: S.array(S.object({ id: S.id, name: S.text(160), description: S.text(1000), objectives: S.text(2000), players: S.array(S.object({ name: S.text(200), role: S.text(200) }, ['role']), 200) }, ['name']), 20)
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
      if (input.objectives !== undefined) cell.objectives = sbText(input.objectives, 2000);
      if (input.players) cell.players = input.players.map(player => sbNormalizePlayer({ id: uid('player'), ...player }));
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
        const actor = sbFindActorForCast(project, { ...cast, label: input.actor.name }) || sbCreateActorForCast(project, cast, { ...input.actor, role: cast.role });
        Object.assign(actor, agentPick(input.actor, ['title', 'organization', 'language']));
        cast.actor_id = actor.id;
      }
      return { id: cast.id, label: cast.label, actor_id: cast.actor_id || null };
    });
    StoryboardHistory.commit('Agent: cast');
    return { cast: result };
  }, 'write');
  add('planPhaseInjects', 'Plan the injects of one main-storyline phase, each addressed to a player cell and sent by a cast role. at = minutes from phase start. replace=true swaps the planned injects that are not yet written; written ones are kept. The Detailed storyline tab turns planned injects into written stimuli.', {
    ...id, replace: { type: 'boolean' }, injects: S.array(beatSchema, SB_MAX_BEATS)
  }, ['id', 'injects'], args => {
    const project = appState.scenario;
    StoryboardHistory.ensure(project); StoryboardHistory.flush();
    const block = sbBlock(project.storyboard, args.id);
    if (!block) throw new AgentValidationError('Unknown item ID.');
    if (block.locked) throw new AgentValidationError('This storyboard block is locked by the designer.');
    const castMap = new Map(project.storyboard.cast.flatMap(cast => [[cast.id, cast.id], [cast.label, cast.id]]));
    const planned = sbBeatsFromAI(project.storyboard, args.injects, castMap, project).map(beat => ({ ...beat, offset_minutes: Math.min(beat.offset_minutes, block.duration_minutes - 1) }));
    const kept = args.replace ? block.beats.filter(beat => sbStimulusForBeat(project, beat.id)) : block.beats;
    block.beats = [...kept, ...planned].slice(0, SB_MAX_BEATS).sort((a, b) => a.offset_minutes - b.offset_minutes);
    block.stimuli_target = Math.max(block.stimuli_target, block.beats.length);
    block.key_cast = [...new Set(block.beats.map(beat => beat.cast_id).filter(Boolean))];
    StoryboardHistory.commit('Agent: plan injects');
    return { id: block.id, title: block.title, planned: block.beats.map(beat => ({ at: sbBeatAbsolute(block, beat), cell_id: beat.cell_id, cast_id: beat.cast_id, channel: beat.channel, title: beat.title })) };
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
      const result = await AITextGenerator.generateForStimulus(stimulus, null, agentRedact(`${args.instructions}\nCurrent content: ${JSON.stringify(stimulus.fields)}`), { signal: run.controller.signal, quiet: true, strictJSON: true, promptFilter: agentRedact });
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

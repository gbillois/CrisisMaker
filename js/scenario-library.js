/* Scenario library: built-in storyboards (scenario-library-data.js) and the
   user's own templates, stored in this browser and exchangeable as files. */
const SB_USER_TEMPLATES_KEY = 'crisismaker_scenario_templates_v1';
const SB_TEMPLATE_FILE_SUFFIX = '.crisisscenario.json';
const SB_SCENARIO_TYPES = { ransomware: 'Ransomware', 'personal-data-breach': 'Data Breach', 'software-supply-chain': 'Supply Chain', 'ddos-hacktivism': 'DDoS', 'insider-threat-sabotage': 'Insider Threat' };

function sbBuiltinTemplates() {
  return typeof SCENARIO_LIBRARY !== 'undefined' && Array.isArray(SCENARIO_LIBRARY) ? SCENARIO_LIBRARY : [];
}

function sbUserTemplates() {
  try {
    const saved = JSON.parse(localStorage.getItem(SB_USER_TEMPLATES_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((item) => item && typeof item === 'object' && Array.isArray(item.blocks)) : [];
  } catch (_) {
    return [];
  }
}

function sbSaveUserTemplates(list) {
  localStorage.setItem(SB_USER_TEMPLATES_KEY, JSON.stringify(list.slice(0, 60)));
}

function sbLibraryEntries() {
  return [
    ...sbBuiltinTemplates().map((template) => ({ ...template, builtin: true })),
    ...sbUserTemplates().map((template) => ({ ...template, builtin: false, category: template.category || 'Custom' }))
  ];
}

function sbFindTemplate(id) {
  return sbLibraryEntries().find((template) => template.id === id) || null;
}

function sbTemplateStats(template) {
  const blocks = Array.isArray(template.blocks) ? template.blocks : [];
  return {
    blocks: blocks.length,
    injects: blocks.reduce((sum, block) => sum + (Number(block.stimuli) || (block.beats || []).length || 0), 0),
    workstreams: new Set(blocks.map((block) => block.track || 'main').filter((track) => track !== 'main')).size,
    duration: Number(template.duration_minutes) || SB_DEFAULT_DURATION
  };
}

/* Replaces the storyboard, or inserts the template blocks after the current main storyline. */
function sbApplyTemplate(template, mode = 'replace') {
  const project = appState.scenario;
  StoryboardHistory.ensure(project);
  const repaired = sbRepairTemplate(deepClone(template), template.duration_minutes);
  const { storyboard: incoming, objectives, title } = sbTemplateToStoryboard(repaired, { templateId: template.id });
  const current = project.storyboard;
  if (mode === 'insert' && current.blocks.length) {
    const offset = sbNextMainStart(current);
    for (const track of incoming.tracks) {
      if (!current.tracks.some((item) => item.key && item.key === track.key)) current.tracks.push({ ...track, id: uid('track') });
    }
    const castMap = sbMergeCastFromAI(current, incoming.cast);
    const idMap = new Map(incoming.cast.map((cast) => [cast.id, castMap.get(cast.label) || '']));
    for (const block of incoming.blocks) {
      const sourceTrack = sbTrack(incoming, block.track_id);
      const target = sourceTrack.kind === 'main' ? sbMainTrack(current) : current.tracks.find((item) => item.key === sourceTrack.key) || sbMainTrack(current);
      current.blocks.push(sbNormalizeBlock({
        ...block,
        track_id: target.id,
        start_minutes: block.start_minutes + offset,
        key_cast: block.key_cast.map((id) => idMap.get(id)).filter(Boolean),
        beats: block.beats.map((beat) => ({ ...beat, cast_id: idMap.get(beat.cast_id) || '' }))
      }, current));
    }
    current.duration_minutes = Math.max(current.duration_minutes, sbStoryboardEnd(current));
  } else {
    incoming.rev = (current?.rev || 0) + 1;
    incoming.meta.brief = current?.meta?.brief || '';
    for (const cast of incoming.cast) {
      const actor = sbFindActorForCast(project, cast);
      if (actor) cast.actor_id = actor.id;
    }
    project.storyboard = incoming;
  }
  // Block objectives reference the template objectives: bring them along.
  if (objectives.length) {
    const existing = sbObjectivesList(project);
    project.scenario.objectives = (mode === 'insert' ? [...existing, ...objectives.filter((item) => !existing.includes(item))] : objectives).join('\n');
  }
  if (!project.scenario.summary?.trim() && template.summary) project.scenario.summary = template.summary;
  if (!project.name?.trim() && title) project.name = title;
  const type = Object.entries(SB_SCENARIO_TYPES).find(([key]) => String(template.id || '').startsWith(key))?.[1];
  if (type && !project.stimuli.length) project.scenario.type = type;
  return project.storyboard;
}

function sbSaveCurrentAsTemplate(name) {
  const project = appState.scenario;
  const template = sbStoryboardToTemplate(project.storyboard, project, sbText(name, 160));
  if (!template.blocks.length) throw new AgentValidationError('The storyboard is empty.');
  sbSaveUserTemplates([template, ...sbUserTemplates()]);
  return template;
}

function sbDeleteUserTemplate(id) {
  sbSaveUserTemplates(sbUserTemplates().filter((template) => template.id !== id));
}

function sbExportTemplate(template) {
  const { builtin, ...clean } = template;
  const data = { schema: 'crisismaker-scenario-template', version: 1, template: clean };
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${slugify(template.name || 'scenario')}${SB_TEMPLATE_FILE_SUFFIX}`);
}

function sbParseTemplateFile(text) {
  const data = JSON.parse(text);
  const template = data?.schema === 'crisismaker-scenario-template' ? data.template : data;
  if (!template || typeof template !== 'object' || !Array.isArray(template.blocks)) throw new AgentValidationError('This file is not a CrisisMaker scenario template.');
  const repaired = sbRepairTemplate(template, template.duration_minutes);
  if (!repaired.blocks.length) throw new AgentValidationError('The template has no block.');
  return {
    ...repaired,
    id: uid('tpl'),
    name: sbText(template.name, 160) || 'Imported scenario',
    category: sbText(template.category, 60) || 'Custom',
    icon: SB_ICON_PATHS[template.icon] ? template.icon : 'square',
    summary: sbText(template.summary, 4000),
    threat: sbText(template.threat, 1000),
    objectives: sbTextList(template.objectives, 20, 600),
    cast: (Array.isArray(template.cast) ? template.cast : []).slice(0, 60),
    created_at: new Date().toISOString()
  };
}

function sbImportTemplateFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${SB_TEMPLATE_FILE_SUFFIX},.json`;
    input.style.display = 'none';
    document.body.appendChild(input);
    const cleanup = () => input.remove();
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) return resolve(null);
      try {
        if (file.size > 2 * 1024 * 1024) throw new AgentValidationError('Template file too large (max 2 MB).');
        const template = sbParseTemplateFile(await file.text());
        sbSaveUserTemplates([template, ...sbUserTemplates()]);
        resolve(template);
      } catch (error) {
        pushToast(error instanceof SyntaxError ? 'Invalid JSON file.' : sbErrorMessage(error), 'error');
        resolve(null);
      }
    }, { once: true });
    input.addEventListener('cancel', () => { cleanup(); resolve(null); }, { once: true });
    input.click();
  });
}

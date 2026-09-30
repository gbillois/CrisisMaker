/* The Context tab's scenario generation: from what the designer already has (an existing
   exercise, a proposal or an exercise brief, a library scenario, a few lines on what they
   want), the AI fills the Context fields, then the builder agent builds the framing (main
   storyline, cells, cast). The designer then amends any field; Update carries those changes
   into the storyline, the cells and the cast, then down to the injects (the cascade of the
   Update button of the other tabs). */

/* The Context fields the generation fills and Update carries into the exercise. [key, label, read]. */
const CG_FIELDS = [
  ['name', ['Exercise name', 'Nom de l’exercice', 'Name der Übung'], (p) => p.name || ''],
  ['client', ['Client', 'Client', 'Auftraggeber'], (p) => p.client?.name || ''],
  ['sector', ['Sector', 'Secteur', 'Branche'], (p) => p.client?.sector || ''],
  ['duration', ['Duration', 'Durée', 'Dauer'], (p) => String(p.storyboard?.duration_minutes || '')],
  ['start', ['Simulated start', 'Début simulé', 'Simulierter Beginn'], (p) => p.scenario?.start_date || ''],
  ['end', ['Simulated end', 'Fin simulée', 'Simuliertes Ende'], (p) => p.scenario?.end_date || ''],
  ['timezone', ['Timezone', 'Fuseau horaire', 'Zeitzone'], (p) => p.scenario?.timezone || ''],
  ['cells', ['Number of cells', 'Nombre de cellules', 'Anzahl der Zellen'], (p) => String(p.exercise?.cells_count ?? '')],
  ['players', ['Number of players', 'Nombre de joueurs', 'Anzahl der Spieler'], (p) => String(p.exercise?.players_count ?? '')],
  ['language', ['Languages', 'Langues', 'Sprachen'], (p) => `${p.client?.language || ''}/${p.settings?.inject_language || ''}`],
  ['brief', ['What you want', 'Ce que vous voulez', 'Was Sie wollen'], (p) => p.storyboard?.meta?.brief || ''],
  ['learning_objectives', ['Learning objectives', 'Objectifs pédagogiques', 'Lernziele'], (p) => p.scenario?.learning_objectives || ''],
  ['attack_path', ['Incident timeline', 'Chronologie de l’incident', 'Ablauf des Vorfalls'], (p) => p.scenario?.attack_path || '']
];

function cgSnapshot(project = appState.scenario) {
  return Object.fromEntries(CG_FIELDS.map(([key, , read]) => [key, read(project)]));
}

/* The fields changed since the last generation or update: [{ key, label, before, after }].
   null when the exercise was never generated from this tab. */
function cgChanges(project = appState.scenario) {
  const saved = project.context_generation?.snapshot;
  if (!saved || typeof saved !== 'object') return null;
  const now = cgSnapshot(project);
  return CG_FIELDS.filter(([key]) => (saved[key] ?? '') !== now[key]).map(([key, label]) => ({ key, label: tt(...label), before: saved[key] ?? '', after: now[key] }));
}

function cgRemember(project = appState.scenario) {
  project.context_generation = { at: new Date().toISOString(), snapshot: cgSnapshot(project) };
  saveLocal(false);
}

/* The loaded file as text for the AI: the whole document for a deck or a brief, the
   chronogram rows for a spreadsheet. */
function cgSourceText(limit = 30000) {
  const cs = appState.checkerState || {};
  const pd = cs.parsedData;
  if (!pd) return '';
  if (pd.doc) return CrisisDocReader.outline(pd.doc, pd.analysis, { limit });
  const text = String(checkerSerializeChronogram({ withDocument: false })?.serialized || '');
  return text.length > limit ? `${text.slice(0, limit)}\n[… truncated]` : text;
}

/* The essential points a source should hold for a complete generation, the duration first.
   [key, label, what to write] in [English, French, German]. */
const CG_ESSENTIALS = [
  ['duration', ['Exercise duration', 'Durée de l’exercice', 'Übungsdauer'], ['The play time, e.g. "Duration: 3 h" or "exercise from 9:00 to 12:00"', 'Le temps de jeu, ex. « Durée : 3 h » ou « exercice de 9h00 à 12h00 »', 'Die Spielzeit, z. B. „Dauer: 3 Std.“ oder „Übung von 9:00 bis 12:00“']],
  ['context', ['Context', 'Contexte', 'Kontext'], ['The organisation, its activity, critical systems and stakes', 'L’organisation, son activité, ses systèmes critiques et ses enjeux', 'Die Organisation, ihre Tätigkeit, kritische Systeme und was auf dem Spiel steht']],
  ['objectives', ['Objectives', 'Objectifs', 'Ziele'], ['What the players must practise, by cell when it differs', 'Ce que les joueurs doivent pratiquer, par cellule si besoin', 'Was die Spieler üben sollen, bei Bedarf je Zelle']],
  ['players', ['Players and cells', 'Joueurs et cellules', 'Spieler und Zellen'], ['The crisis cells and who plays in each', 'Les cellules de crise et qui joue dans chacune', 'Die Krisenzellen und wer in jeder spielt']],
  ['phases', ['Phases and timing', 'Phases et timing', 'Phasen und Zeitplan'], ['The phases of the scenario with their times (H+0:00 → H+0:45)', 'Les phases du scénario avec leurs horaires (H+0:00 → H+0:45)', 'Die Phasen des Szenarios mit ihren Zeiten (H+0:00 → H+0:45)']],
  ['incident', ['Incident timeline', 'Chronologie de l’incident', 'Ablauf des Vorfalls'], ['What really happens: attack, detection, impacts, with dates or times', 'Ce qui se passe réellement : attaque, détection, impacts, avec dates ou heures', 'Was wirklich passiert: Angriff, Erkennung, Auswirkungen, mit Datum oder Uhrzeit']],
  ['injects', ['Injects', 'Injects', 'Injects'], ['For each inject: time, sender, recipient cell, channel and content', 'Pour chaque inject : horaire, émetteur, cellule destinataire, canal et contenu', 'Für jeden Inject: Zeit, Absender, Empfängerzelle, Kanal und Inhalt']]
];

/* The duration the loaded file states, or the latest time it mentions (estimated). */
function cgSourceDuration() {
  const cs = appState.checkerState || {};
  const pd = cs.parsedData;
  if (!pd) return null;
  if (pd.doc) return CrisisDocReader.findDuration(pd.doc);
  // A chronogram: the latest time of its time column.
  const column = cs.columnMapping?.timestamp;
  if (column === null || column === undefined) return null;
  return CrisisDocReader.findDuration({ slides: [{ number: 1, title: '', notes: '', blocks: [{ kind: 'table', rows: pd.rows.map((row) => [String(row[column] ?? '')]) }] }] });
}

/* The essential points, and for a loaded file whether it holds each one:
   status found, missing or unknown (not checked in a spreadsheet). */
function cgSourceChecklist() {
  const pd = appState.checkerState?.parsedData;
  const sections = pd?.analysis?.sections || {};
  const unit = pd?.analysis?.unit === 'Slide' ? tt('slide', 'slide', 'Folie') : tt('section', 'section', 'Abschnitt');
  const units = pd?.analysis?.unit === 'Slide' ? tt('slides', 'slides', 'Folien') : tt('sections', 'sections', 'Abschnitte');
  return CG_ESSENTIALS.map(([key, label, hint]) => {
    const item = { key, label: tt(...label), hint: tt(...hint), status: pd ? 'missing' : '' };
    if (!pd) return item;
    if (key === 'duration') {
      const found = cgSourceDuration();
      if (found) Object.assign(item, { status: found.estimated ? 'estimated' : 'found', minutes: found.minutes, where: `${pd.doc ? unit : tt('row', 'ligne', 'Zeile')} ${found.where}`, text: found.text });
    } else if (key === 'injects') {
      const rows = pd.analysis ? pd.analysis.chronogramRows : pd.rows.length;
      if (rows) Object.assign(item, { status: 'found', where: tt(`${rows} found`, `${rows} trouvé(s)`, `${rows} gefunden`) });
      else if (sections.chronogram?.length) Object.assign(item, { status: 'found', where: `${sections.chronogram.length > 1 ? units : unit} ${sections.chronogram.join(', ')}` });
    } else if (!pd.doc) item.status = 'unknown';
    else if (sections[key]?.length) Object.assign(item, { status: 'found', where: `${sections[key].length > 1 ? units : unit} ${sections[key].join(', ')}` });
    return item;
  });
}

/* Minutes from a number or a text ("45", "45 min", "0h45", "0:45", "1,5 h"); null otherwise. */
function cgMinutes(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return +text;
  return sbParseDuration(text) ?? CrisisDocReader.durationIn(text);
}

/* What the AI generation creates, as the designer ticks it. [key, label] */
const CG_CREATE = [
  ['context', ['The context', 'Le contexte', 'Den Kontext']],
  ['cells', ['Cells and actors', 'Les cellules et les acteurs', 'Zellen und Akteure']],
  ['phases', ['Phases and key points', 'Les phases et les points clés', 'Phasen und Kernpunkte']],
  ['stimuli', ['Stimuli (injects)', 'Les stimuli (injects)', 'Stimuli (Injects)']],
  ['evaluation', ['Evaluation sheets', 'Les grilles d’évaluation', 'Bewertungsbögen']]
];
function cgCreateOptions() {
  const state = tabUI('context');
  state.create = { ...Object.fromEntries(CG_CREATE.map(([key]) => [key, true])), ...(state.create || {}) };
  return state.create;
}

/* What really exists after a creation, item by item: { key, label, ok, detail }. */
function cgCreationReport(project, want) {
  const main = sbMainBlocks(project.storyboard);
  const players = project.cells.reduce((sum, cell) => sum + cell.players.length, 0);
  const items = sbExerciseItems(project);
  const created = items.filter((item) => item.stimulus);
  // Written: the AI wrote it (its generated text), or its content was written by hand.
  const written = created.filter(({ stimulus }) => Object.values(stimulus.generated_text || {}).some((value) => typeof value === 'string' && value.trim())
    || Object.entries(stimulus.fields || {}).some(([key, value]) => !SB_MEDIA_FIELD.test(key) && typeof value === 'string' && value.replace(/<[^>]+>/g, '').trim().length > 80));
  const events = main.reduce((sum, block) => sum + (block.events || []).length, 0);
  const sheets = project.cells.filter((cell) => evState(project).sheets[cell.id]?.adapted_at);
  const check = {
    context: () => {
      const parts = [project.scenario.learning_objectives?.trim() && tt('learning objectives', 'objectifs pédagogiques', 'Lernziele'), project.scenario.attack_path?.trim() && tt('incident timeline', 'chronologie de l’incident', 'Ablauf des Vorfalls'), String(project.storyboard.meta.brief || '').trim() && tt('context', 'contexte', 'Kontext')].filter(Boolean);
      return { ok: parts.length >= 2, detail: `${tt('Duration', 'Durée', 'Dauer')} ${sbFormatDuration(project.storyboard.duration_minutes)}${parts.length ? ` · ${parts.join(', ')}` : ''}` };
    },
    cells: () => ({ ok: project.cells.length > 0 && players > 0 && project.storyboard.cast.length > 0, detail: tt(`${project.cells.length} cell(s), ${players} player(s), ${project.storyboard.cast.length} role(s), ${project.actors.length} actor(s)`, `${project.cells.length} cellule(s), ${players} joueur(s), ${project.storyboard.cast.length} rôle(s), ${project.actors.length} acteur(s)`, `${project.cells.length} Zelle(n), ${players} Spieler, ${project.storyboard.cast.length} Rolle(n), ${project.actors.length} Akteur(e)`) }),
    phases: () => ({ ok: main.length > 0 && main.every((block) => (block.events || []).length || block.beats.length), detail: tt(`${main.length} phase(s), ${events} key point(s)`, `${main.length} phase(s), ${events} point(s) clé(s)`, `${main.length} Phase(n), ${events} Kernpunkt(e)`) }),
    stimuli: () => ({ ok: created.length > 0 && created.length === items.length && written.length === created.length, detail: tt(`${created.length} / ${items.length} planned injects created, ${written.length} written`, `${created.length} / ${items.length} injects prévus créés, ${written.length} rédigés`, `${created.length} / ${items.length} geplante Injects erstellt, ${written.length} geschrieben`) }),
    evaluation: () => ({ ok: project.cells.length > 0 && sheets.length === project.cells.length, detail: tt(`${sheets.length} / ${project.cells.length} sheet(s) adapted to the scenario`, `${sheets.length} / ${project.cells.length} grille(s) adaptée(s) au scénario`, `${sheets.length} / ${project.cells.length} Bogen/Bögen an das Szenario angepasst`) })
  };
  return CG_CREATE.filter(([key]) => want[key]).map(([key, label]) => ({ key, label: tt(...label), ...check[key]() }));
}

const CG_SECTORS = ['Banking', 'Insurance', 'Energy', 'Healthcare', 'Transport', 'Industry', 'Telecom', 'Retail', 'Public sector', 'Pharmaceutical', 'Technology', 'Other'];

const CG_EXTRACT_SYSTEM = `You are a senior crisis exercise designer. You read what the designer has for a new crisis exercise: their own notes, a library scenario they chose, and a source document (an existing exercise deck or chronogram, a commercial proposal or an exercise brief), then you fill the frame of the exercise.
Read the whole document: the context (organisation, activity, stakes), the objectives, the players and cells, the phases and their timing, the incident or attack timeline, the injects and the facilitator notes. The designer's notes win over the document when they differ.
Reply ONLY with a JSON object:
{
  "exercise_name": "short name of the exercise, '' if none",
  "client_name": "organisation the exercise is for, '' if none",
  "sector": "one of ${CG_SECTORS.join(', ')}, or '' if unknown",
  "language": "ISO code of the document language (en, fr, de, es, it, nl, pt)",
  "duration_minutes": integer, the play time of the exercise itself in minutes (45 for "45 minutes", "45 min", "0h45" or "0:45"; 90 for "1h30" or "1,5 h"; 180 for "3 h"), not the length of the whole day, workshop or programme; null if the sources do not say,
  "simulated_start": "YYYY-MM-DDTHH:MM in-story start, or ''",
  "cells": [{"name": "player cell as the document names it", "players": [{"name": "person's name or ''", "role": "job title"}]}],
  "players_count": integer or null,
  "learning_objectives": "what the players must practise, one per line, starting with the cell or category concerned when the document says so ('Executives: …')",
  "incident_timeline": "what really happens in the story, one event per line, in order, starting with its date or time when known (e.g. 'D-3: …', 'H+0:30: …')",
  "context": "the context the exercise builder needs, in plain lines: organisation and activity, stakes and constraints, what to test, the phases foreseen with their timing and the key injects or twists the document plans, facilitator notes. Up to 2500 characters.",
  "understanding": ["what you understood of the exercise, 4 to 8 short factual lines the designer can check: organisation and scenario, who plays, duration and date, phases, key events"],
  "missing": ["what the document does not say and the designer should decide"]
}
Use only what the sources say; leave a field empty ('' or [] or null) rather than inventing it.`;

const ContextGeneration = {
  stage: '',

  busy() {
    return !!this.stage || !!this.step || (typeof BuildFlow !== 'undefined' && BuildFlow.busy());
  },

  /* Reads the sources with AI and fills the Context fields that are still empty. Returns the
     labels of the fields filled. */
  async readSources(project) {
    const source = cgSourceText();
    const template = contextLibraryTemplate(project);
    const brief = String(project.storyboard.meta.brief || '').trim();
    if (!source && !brief) return [];
    const payload = [
      `DESIGNER NOTES:\n${brief || '(none)'}`,
      template ? `LIBRARY SCENARIO CHOSEN: "${template.name}"${template.summary ? `: ${String(template.summary).slice(0, 600)}` : ''}` : '',
      `CURRENT FRAME (already set by the designer, keep it): ${JSON.stringify(cgSnapshot(project)).slice(0, 3000)}`,
      (() => { const found = cgSourceDuration(); return found ? `DURATION ${found.estimated ? 'ESTIMATED FROM THE LATEST TIME IN' : 'STATED IN'} THE DOCUMENT: ${found.minutes} minutes ("${found.text}")` : ''; })(),
      source ? `SOURCE DOCUMENT "${appState.checkerState.file?.name || 'file'}":\n${source}` : 'No source document.'
    ].filter(Boolean).join('\n\n');
    const result = await AITextGenerator.generate('context_generation', CG_EXTRACT_SYSTEM, payload, true, 5000);
    return this.apply(project, result && typeof result === 'object' ? result : {});
  },

  /* Without AI: the sections found in the document go into the empty fields as they are. */
  fillFromDocument(project = appState.scenario) {
    const pd = appState.checkerState?.parsedData;
    if (!pd?.doc) return [];
    const draft = CrisisDocReader.contextDraft(pd.doc, pd.analysis);
    return this.apply(project, { exercise_name: draft.name, context: draft.brief, learning_objectives: draft.learning_objectives, incident_timeline: draft.attack_path, duration_minutes: draft.duration_minutes });
  },

  /* Only empty fields are filled: what the designer typed stays. */
  apply(project, data) {
    const filled = [];
    const text = (value, max) => typeof value === 'string' ? sbText(value.trim(), max) : '';
    const set = (label, current, value, write) => { if (!String(current ?? '').trim() && value) { write(value); filled.push(tt(...label)); } };
    const label = (key) => CG_FIELDS.find(([k]) => k === key)[1];
    StoryboardHistory.ensure(project);
    StoryboardHistory.flush();
    set(label('name'), project.name, text(data.exercise_name, 200), (v) => { project.name = v; });
    set(label('client'), project.client.name, text(data.client_name, 300), (v) => { project.client.name = v; });
    const sector = CG_SECTORS.find((item) => item.toLowerCase() === String(data.sector || '').trim().toLowerCase());
    set(label('sector'), project.client.sector, sector || '', (v) => { project.client.sector = v; });
    set(label('learning_objectives'), project.scenario.learning_objectives, text(data.learning_objectives, 6000), (v) => { project.scenario.learning_objectives = v; });
    set(label('attack_path'), project.scenario.attack_path, text(data.incident_timeline, 6000), (v) => { project.scenario.attack_path = v; });
    // The designer's notes stay first; the context read from the document follows them.
    const context = text(data.context, 6000);
    if (context && !String(project.storyboard.meta.brief || '').includes(context.slice(0, 60))) {
      const brief = String(project.storyboard.meta.brief || '').trim();
      project.storyboard.meta.brief = sbText(brief ? `${brief}\n\n${tt('From the document:', 'D’après le document :', 'Aus dem Dokument:')}\n${context}` : context, 8000);
      filled.push(tt('context', 'contexte', 'Kontext'));
    }
    const start = text(data.simulated_start, 30);
    set(label('start'), project.scenario.start_date, start && Number.isFinite(Date.parse(start)) ? start.slice(0, 16) : '', (v) => { project.scenario.start_date = v; });
    const blank = !sbMainBlocks(project.storyboard).length && !(project.stimuli || []).length;
    // The duration: the one the AI read, else the one the document states. It replaces the
    // default duration only (a duration the designer set stays), and is shown in the check.
    const stated = cgSourceDuration();
    const fromAI = cgMinutes(data.duration_minutes);
    const minutes = fromAI || (stated && !stated.estimated ? stated.minutes : null);
    this.duration = minutes ? { minutes, source: fromAI ? 'ai' : 'document', stated: stated || null } : { minutes: null, source: '', stated: stated || null };
    if (minutes && minutes <= SB_MAX_DURATION && project.storyboard.duration_minutes === SB_DEFAULT_DURATION && Math.max(30, minutes) !== SB_DEFAULT_DURATION) {
      // Phases already there (a library scenario, an earlier generation) are fitted to it.
      if (!sbFitStoryboardToDuration(project.storyboard, Math.max(30, minutes))) project.storyboard.duration_minutes = Math.max(30, minutes);
      filled.push(tt(...label('duration')));
    }
    const language = LANGUAGES.find((item) => item.value === String(data.language || '').toLowerCase())?.value;
    if (blank && language && language !== (project.client.language || 'en')) {
      project.client.language = language;
      project.settings.inject_language = language;
      filled.push(tt(...label('language')));
    }
    // Cells as the document names them, with their players, on an exercise without any yet.
    const cells = Array.isArray(data.cells) ? data.cells.filter((cell) => cell && typeof cell.name === 'string' && cell.name.trim()).slice(0, 12) : [];
    if (blank && cells.length && !project.cells.some((cell) => cell.players.length)) {
      project.cells = [];
      cells.forEach((input) => {
        const preset = SB_CELL_PRESETS.find((item) => item.name.toLowerCase() === input.name.trim().toLowerCase());
        const cell = sbMakeCell(preset?.key || 'custom', { name: sbText(input.name.trim(), 160) });
        (Array.isArray(input.players) ? input.players : []).slice(0, 60).forEach((player) => {
          const role = sbText(typeof player === 'string' ? player : player?.role || '', 200);
          const name = typeof player === 'object' && player ? sbText(player.name || '', 200) : '';
          // A job title given as the name is not a person (as upsertCells does).
          if (role || name) cell.players.push(sbNormalizePlayer({ id: uid('player'), role, name: ceIsTitleLike(name, role) ? '' : name }));
        });
        project.cells.push(cell);
      });
      project.exercise.cells_count = project.cells.length;
      filled.push(tt(`${project.cells.length} cells`, `${project.cells.length} cellules`, `${project.cells.length} Zellen`));
    } else if (blank && cells.length && !project.exercise.cells_count) {
      project.exercise.cells_count = cells.length;
      sbSetCellsCount(project, cells.length);
      filled.push(tt(...label('cells')));
    }
    const players = Number(data.players_count) || project.cells.reduce((sum, cell) => sum + cell.players.length, 0);
    set(label('players'), project.exercise.players_count, Number.isInteger(players) && players > 0 && players <= 10000 ? players : '', (v) => { project.exercise.players_count = v; });
    StoryboardHistory.commit('Context from the sources');
    sbAfterStoryboardChange(project, { save: true });
    this.understanding = Array.isArray(data.understanding) ? data.understanding.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 10) : [];
    this.filled = filled.slice();
    this.missing = Array.isArray(data.missing) ? data.missing.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 8) : [];
    return filled;
  },

  /* AI generation: sources → Context fields → framing (and, with all, the stimuli). */
  async generate({ all = false, want: asked = null } = {}) {
    const project = appState.scenario;
    if (this.busy()) return false;
    this.pending = null;
    const hasSource = !!appState.checkerState?.parsedData;
    if (!hasSource && !String(project.storyboard.meta.brief || '').trim() && !contextLibraryTemplate(project) && !project.scenario.learning_objectives?.trim()) {
      pushToast(tt('Load a file, choose a generic scenario or describe what you want first.', 'Chargez un fichier, choisissez un scénario générique ou décrivez ce que vous voulez d’abord.', 'Laden Sie zuerst eine Datei, wählen Sie ein generisches Szenario oder beschreiben Sie, was Sie wollen.'), 'info');
      return false;
    }
    const want = asked || (all ? Object.fromEntries(CG_CREATE.map(([key]) => [key, true])) : { ...cgCreateOptions() });
    if (!Object.values(want).some(Boolean)) {
      pushToast(tt('Tick at least one thing to create.', 'Cochez au moins un élément à créer.', 'Kreuzen Sie mindestens ein Element an.'), 'info');
      return false;
    }
    this.want = want;
    this.report = null;
    if ((want.cells || want.phases) && sbMainBlocks(project.storyboard).length && !window.confirm(tt('Generate the exercise again? The agent rebuilds the framing from the context, adapting the current phases. To carry only your changes, use Update below.', 'Générer à nouveau l’exercice ? L’agent reconstruit le cadrage à partir du contexte en adaptant les phases actuelles. Pour ne reporter que vos modifications, utilisez Mettre à jour plus bas.', 'Die Übung erneut erstellen? Der Agent baut den Rahmen aus dem Kontext neu auf und passt die aktuellen Phasen an. Um nur Ihre Änderungen zu übernehmen, nutzen Sie unten Aktualisieren.'))) return false;
    tabUI('context').panel = 'generate';
    if (!want.context) return this.create(project, { all });
    this.stage = 'reading';
    App.render();
    let read = false;
    try {
      const filled = await this.readSources(project);
      if (appState.scenario !== project) return false;
      read = !!(this.understanding?.length || this.missing?.length);
      if (filled.length) pushToast(tt(`Filled from your sources: ${filled.join(', ')}.`, `Rempli à partir de vos sources : ${filled.join(', ')}.`, `Aus Ihren Quellen ausgefüllt: ${filled.join(', ')}.`), 'success');
    } catch (error) {
      // The agent still reads the file itself: the generation goes on.
      const filled = this.fillFromDocument(project);
      pushToast(tt(`The sources could not be read with AI (${sbErrorMessage(error)}).${filled.length ? ` Filled as found in the document: ${filled.join(', ')}.` : ''}`, `Les sources n’ont pas pu être lues par l’IA (${sbErrorMessage(error)}).${filled.length ? ` Rempli tel que trouvé dans le document : ${filled.join(', ')}.` : ''}`, `Die Quellen konnten nicht mit KI gelesen werden (${sbErrorMessage(error)}).${filled.length ? ` Wie im Dokument gefunden ausgefüllt: ${filled.join(', ')}.` : ''}`), 'warning');
    } finally {
      this.stage = '';
    }
    // Before anything is created, the designer checks what the AI understood, corrects it and
    // answers the points the sources leave open. Built automatically: only when points are open.
    if (read && (this.missing?.length || tabUI('context').mode !== 'auto')) {
      this.pending = { projectId: project.id, all, missing: this.missing || [], answers: (this.missing || []).map(() => ''), understanding: this.understanding || [], filled: this.filled || [], corrections: '', duration: sbFormatHoursMinutes(project.storyboard.duration_minutes), durationInfo: this.duration || null };
      this.missing = [];
      App.render();
      return false;
    }
    App.render();
    return this.create(project, { all });
  },

  /* The creation itself, in the order of the boxes ticked: cells and actors with phases and
     key points (the builder agent), then the stimuli (plan, cast, write), then the evaluation
     sheets. Each step is checked on what really exists; what is missing gets one targeted
     retry; the report says what was created. */
  async create(project, { all = false } = {}) {
    const want = this.want || Object.fromEntries(CG_CREATE.map(([key]) => [key, true]));
    const ai = isLLMAvailable();
    const alive = () => appState.scenario === project;
    try {
      if (want.cells || want.phases) {
        this.step = 'framing';
        const done = await BuildFlow.framing({ openStoryline: false, only: want.cells && want.phases ? null : { cells: want.cells, phases: want.phases } });
        if (!alive()) return false;
        if (done) cgRemember(project);
        const missing = cgCreationReport(project, want).filter((item) => ['cells', 'phases'].includes(item.key) && !item.ok);
        if (missing.length && ai && getCrisisAgent().status !== 'stopped') {
          this.step = 'repair';
          App.render();
          BuildFlow.only = want.cells && want.phases ? null : { cells: want.cells, phases: want.phases };
          try {
            await startCrisisAgent({ kind: 'builder', mode: tabUI('context').mode || 'agent', origin: 'context', scope: 'framing', objective: [
              'VERIFICATION AFTER THE FRAMING. These parts are still missing or incomplete; build them now with the tools, keeping everything that exists:',
              ...missing.map((item) => `- ${item.label}: ${item.detail}`),
              'Cells and actors: every cell has its players (upsertCells) and every cast role its actor (upsertCast). Phases and key points: every phase has its main events (setMainEvents) or its planned injects.',
              contextAgentObjective(project)
            ].join('\n').slice(0, 7900) });
          } finally {
            BuildFlow.only = null;
          }
          if (!alive()) return false;
          cgRemember(project);
        }
      }
      if (want.stimuli && sbMainBlocks(project.storyboard).length && ai) {
        this.step = 'stimuli';
        App.render();
        await BuildFlow.stimuli({ confirmUnvalidated: false, challenge: false });
        if (!alive()) return false;
        const stimuli = cgCreationReport(project, { stimuli: true })[0];
        if (!stimuli.ok && SbPipeline.status !== 'stopped') {
          this.step = 'stimuli';
          try { await SbPipeline.run({ plan: true, cast: true, write: true }); } catch (error) { pushToast(sbErrorMessage(error), 'error'); }
        }
      }
      if (want.evaluation && project.cells.length && ai) {
        this.step = 'evaluation';
        App.render();
        const controller = new AbortController();
        EvAI.controller = controller;
        for (let pass = 0; pass < 2; pass++) {
          const todo = project.cells.filter((cell) => !evState(project).sheets[cell.id]?.adapted_at);
          for (const cell of todo) {
            if (controller.signal.aborted || !alive()) break;
            EvAI.progress = tt(`Evaluation sheet: ${cell.name}…`, `Grille d’évaluation : ${cell.name}…`, `Bewertungsbogen: ${cell.name}…`);
            App.render();
            try { await EvAI.updateCell(project, cell, controller.signal); saveLocal(false); } catch (error) { if (error?.name === 'AbortError') break; }
          }
        }
        EvAI.progress = '';
        EvAI.controller = null;
      }
    } finally {
      this.step = '';
    }
    if (!alive()) return false;
    this.report = cgCreationReport(project, want);
    const failed = this.report.filter((item) => !item.ok);
    // A framing alone opens the Main storyline for the client review; a full creation comes
    // back to the Context, on its report.
    appState.route = !want.stimuli && !want.evaluation && sbMainBlocks(project.storyboard).length ? 'storyline' : 'scenario';
    pushToast(failed.length
      ? tt(`Created, except: ${failed.map((item) => item.label).join(', ')}. See the report in the Context.`, `Créé, sauf : ${failed.map((item) => item.label).join(', ')}. Voir le bilan dans le Contexte.`, `Erstellt, außer: ${failed.map((item) => item.label).join(', ')}. Siehe Bilanz im Kontext.`)
      : tt('Everything ticked was created. See the report in the Context.', 'Tout ce qui était coché a été créé. Voir le bilan dans le Contexte.', 'Alles Angekreuzte wurde erstellt. Siehe Bilanz im Kontext.'), failed.length ? 'warning' : 'success');
    saveLocal(false);
    App.render();
    return !failed.length;
  },

  /* Retry one item of the report. */
  async retry(key) {
    const project = appState.scenario;
    if (this.busy() || !CG_CREATE.some(([k]) => k === key)) return false;
    this.want = Object.fromEntries(CG_CREATE.map(([k]) => [k, k === key]));
    return key === 'context' ? this.generate({ want: this.want }) : this.create(project);
  },

  /* The answers to the open points go into "What you want" (answered ones as decisions, the
     others left to the AI as disclosed assumptions), then the creation starts. */
  async resume({ skip = false } = {}) {
    const project = appState.scenario;
    const pending = this.pending;
    if (!pending || pending.projectId !== project.id || this.busy()) return false;
    this.pending = null;
    const answered = skip ? [] : pending.missing.map((point, i) => [point, String(pending.answers[i] || '').trim()]).filter(([, answer]) => answer);
    const open = pending.missing.filter((point) => !answered.some(([p]) => p === point));
    const corrections = skip ? '' : String(pending.corrections || '').trim();
    // The duration checked by the designer frames everything that follows.
    const minutes = sbParseDuration(pending.duration);
    if (minutes && minutes <= SB_MAX_DURATION && Math.max(30, minutes) !== project.storyboard.duration_minutes) {
      StoryboardHistory.ensure(project);
      if (!sbFitStoryboardToDuration(project.storyboard, Math.max(30, minutes))) project.storyboard.duration_minutes = Math.max(30, minutes);
      StoryboardHistory.commit('Exercise duration checked');
    }
    const lines = [
      corrections ? `${tt('Corrections by the designer (they override the sources):', 'Corrections du concepteur (elles priment sur les sources) :', 'Korrekturen des Designers (sie haben Vorrang vor den Quellen):')}\n${corrections}` : '',
      answered.length ? `${tt('Decisions on the points missing from the sources:', 'Décisions sur les points absents des sources :', 'Entscheidungen zu den in den Quellen fehlenden Punkten:')}\n${answered.map(([point, answer]) => `- ${point} → ${answer}`).join('\n')}` : '',
      open.length ? `${tt('Left to the AI (make a reasonable assumption and say it):', 'Laissé à l’IA (faire une hypothèse raisonnable et l’indiquer) :', 'Der KI überlassen (eine vernünftige Annahme treffen und nennen):')}\n${open.map((point) => `- ${point}`).join('\n')}` : ''
    ].filter(Boolean).join('\n\n');
    if (lines) {
      StoryboardHistory.ensure(project);
      const brief = String(project.storyboard.meta.brief || '').trim();
      project.storyboard.meta.brief = sbText(brief ? `${brief}\n\n${lines}` : lines, 8000);
      StoryboardHistory.commit('Answers to the open points');
      saveLocal(false);
    }
    App.render();
    return this.create(project, { all: pending.all });
  },

  /* Update: the Context changes flow into the framing (agent), then down to the injects. */
  async update() {
    const project = appState.scenario;
    if (this.busy()) return false;
    if (!sbMainBlocks(project.storyboard).length) return false;
    const changes = cgChanges(project) || [];
    if (!changes.length && !window.confirm(tt('Nothing changed in the Context since the last generation. Check the whole exercise against it anyway?', 'Rien n’a changé dans le Contexte depuis la dernière génération. Vérifier quand même tout l’exercice par rapport à lui ?', 'Seit der letzten Erstellung hat sich im Kontext nichts geändert. Trotzdem die ganze Übung damit abgleichen?'))) return false;
    tabUI('context').panel = 'update';
    this.stage = 'update';
    App.render();
    const clip = (value) => { const text = String(value || '').replace(/\s+/g, ' ').trim(); return text.length > 700 ? `${text.slice(0, 700)}…` : text || '(empty)'; };
    const objective = [
      'UPDATE AFTER CONTEXT CHANGES. The exercise was already generated; the designer then amended the Context tab. Carry these changes into the exercise:',
      ...(changes.length ? changes.map((change) => `- ${change.label}: "${clip(change.before)}" → "${clip(change.after)}"`) : ['- (no field changed: check that the scenario, phases, cells and cast still match the whole Context and fix what does not)']),
      'Change only what these changes affect: scenario name and summary (updateScenario), objectives (updateExerciseObjectives), synopsis and threat, the phases and their main events (updateStoryboardBlock, setMainEvents), the play duration, the cells and their players (upsertCells), the cast and its actors (upsertCast). Keep every phase, main event, cell and planned inject that still fits, with its id. Do not rebuild the main storyline from scratch and do not write inject content: the injects follow in cascade once you are done.',
      contextAgentObjective(project)
    ].join('\n').slice(0, 7900);
    let done = false;
    try {
      await startCrisisAgent({ kind: 'builder', mode: tabUI('context').mode || 'agent', objective, origin: 'context', scope: 'framing' });
      done = appState.scenario === project && getCrisisAgent().status === 'complete';
    } finally {
      this.stage = '';
    }
    if (!done) { App.render(); return false; }
    tabUI('context').forcedDuration = null;
    cgRemember(project);
    // The cascade: phases → inject plans → actors → injects, as the Update button of the other tabs.
    const impacts = sbComputeImpacts(project);
    const pending = sbPendingSyncCount(project);
    if (pending && sbExerciseItems(project).length) {
      const destructive = impacts.filter((impact) => impact.action === 'delete').length;
      if (!destructive || window.confirm(tt(`${destructive} inject(s) no longer fit the updated storyline and will be deleted. Continue?`, `${destructive} inject(s) ne correspondent plus à la storyline mise à jour et seront supprimés. Continuer ?`, `${destructive} Inject(s) passen nicht mehr zur aktualisierten Storyline und werden gelöscht. Fortfahren?`))) {
        this.stage = 'cascade';
        App.render();
        try {
          await SbPipeline.applyImpacts(impacts);
        } catch (error) {
          pushToast(sbErrorMessage(error), 'error');
        } finally {
          this.stage = '';
        }
      }
    }
    pushToast(tt('Context changes carried into the exercise.', 'Modifications du contexte reportées dans l’exercice.', 'Kontextänderungen in die Übung übernommen.'), 'success');
    App.render();
    return true;
  }
};

// ── Rendering ────────────────────────────────────────────────────────────────
/* 1. Scenario generation: sources (file, library scenario, notes), then AI generation. */
function renderContextGeneration(project) {
  const ai = isLLMAvailable();
  const busy = ContextGeneration.busy();
  const state = tabUI('context');
  state.mode = state.mode || 'agent';
  const template = contextLibraryTemplate(project);
  const entries = typeof sbLibraryEntries === 'function' ? sbLibraryEntries() : [];
  const current = ContextGeneration.step;
  const running = ContextGeneration.stage === 'reading' || !!current || (BuildFlow.stage && state.panel !== 'update');
  const runningLabel = ContextGeneration.stage === 'reading'
    ? tt('Reading your sources…', 'Lecture de vos sources…', 'Ihre Quellen werden gelesen…')
    : BuildFlow.stage === 'adapting' ? tt('Adapting the library scenario…', 'Adaptation du scénario de bibliothèque…', 'Bibliotheksszenario wird angepasst…')
      : current === 'repair' ? tt('Completing what is missing…', 'Complément de ce qui manque…', 'Fehlendes wird ergänzt…')
        : current === 'stimuli' ? tt('Creating the stimuli…', 'Création des stimuli…', 'Stimuli werden erstellt…')
          : current === 'evaluation' ? (EvAI.progress || tt('Evaluation sheets…', 'Grilles d’évaluation…', 'Bewertungsbögen…'))
            : tt('Building the framing…', 'Construction du cadrage…', 'Rahmen wird erstellt…');
  const step = (n, title, helper, body) => `<div class="cx-step"><span class="cx-step-num">${n}</span><div class="cx-step-body"><div class="cx-design-head"><strong>${escapeHtml(title)}</strong>${helper ? `<span class="helper">${escapeHtml(helper)}</span>` : ''}</div>${body}</div></div>`;
  const pd = appState.checkerState?.parsedData;
  const pendingHere = ContextGeneration.pending?.projectId === project.id;
  return `<article class="card cx-brief cx-generation" data-sb-scope>
    <div class="section-header"><div><h3>${sbUiIcon('sparkles', 18)} ${escapeHtml(tt('Scenario generation', 'Génération du scénario', 'Szenario-Erstellung'))}</h3><p class="subtle">${escapeHtml(tt('Start from what you already have. The AI reads it, fills the context below, then builds the main storyline, the cells and the actors.', 'Partez de ce que vous avez déjà. L’IA le lit, remplit le contexte ci-dessous, puis construit la storyline principale, les cellules et les acteurs.', 'Gehen Sie von dem aus, was Sie schon haben. Die KI liest es, füllt den Kontext unten aus und baut dann die Haupt-Storyline, die Zellen und die Akteure.'))}</p></div></div>
    ${step(1, tt('Existing exercise, proposal or exercise brief', 'Exercice existant, proposition ou cahier des charges', 'Bestehende Übung, Angebot oder Übungsbriefing'),
      pd ? tt('The AI reads all of it: context, objectives, players, phases, incident timeline and injects.', 'L’IA le lit en entier : contexte, objectifs, joueurs, phases, chronologie de l’incident et injects.', 'Die KI liest alles: Kontext, Ziele, Spieler, Phasen, Ablauf des Vorfalls und Injects.') : tt('Optional. A deck or chronogram of a previous exercise, a commercial proposal or a brief (.pptx, .docx, .xlsx, .txt).', 'Facultatif. Le support ou le chronogramme d’un exercice précédent, une proposition commerciale ou un cahier des charges (.pptx, .docx, .xlsx, .txt).', 'Optional. Foliensatz oder Chronogramm einer früheren Übung, ein Angebot oder ein Briefing (.pptx, .docx, .xlsx, .txt).'),
      `${renderContextExerciseFile()}${renderSourceEssentials(project)}`)}
    ${step(2, tt('Generic scenario', 'Scénario générique', 'Generisches Szenario'),
      tt('Optional. A library scenario the AI adapts to your client, or loads as it is.', 'Facultatif. Un scénario de la bibliothèque que l’IA adapte à votre client, ou charge tel quel.', 'Optional. Ein Bibliotheksszenario, das die KI an Ihren Kunden anpasst oder unverändert lädt.'),
      `<div class="cx-library">
        <select data-cx-library ${busy ? 'disabled' : ''} aria-label="${escapeAttribute(tt('Generic scenario', 'Scénario générique', 'Generisches Szenario'))}">
          <option value="" ${template ? '' : 'selected'}>${escapeHtml(tt('None: the AI builds the scenario from your sources', 'Aucun : l’IA construit le scénario à partir de vos sources', 'Keines: Die KI baut das Szenario aus Ihren Quellen'))}</option>
          ${entries.map((entry) => `<option value="${escapeAttribute(entry.id)}" ${template?.id === entry.id ? 'selected' : ''}>${escapeHtml(entry.name)}${entry.builtin ? '' : ` (${escapeHtml(tt('mine', 'le mien', 'eigenes'))})`}</option>`).join('')}
        </select>
        <button class="btn btn-secondary btn-sm" data-cx-load-basic ${template && !busy ? '' : 'disabled'} title="${escapeAttribute(template ? tt(`Replace the main storyline with "${template.name}" as it is in the library`, `Remplacer la storyline principale par « ${template.name} » tel qu’il est dans la bibliothèque`, `Die Haupt-Storyline durch „${template.name}“ ersetzen, so wie es in der Bibliothek steht`) : tt('Choose a generic scenario first', 'Choisissez d’abord un scénario générique', 'Wählen Sie zuerst ein generisches Szenario'))}">${sbUiIcon('book', 14)} ${escapeHtml(tt('Load as it is', 'Charger tel quel', 'Unverändert laden'))}</button>
        <button class="btn btn-ghost btn-sm" data-route="project">${escapeHtml(tt('Browse the library', 'Parcourir la bibliothèque', 'Bibliothek durchsuchen'))}</button>
      </div>`)}
    ${step(3, tt('What you want in this exercise', 'Ce que vous voulez dans cet exercice', 'Was Sie in dieser Übung wollen'),
      tt('Audience, what to test, constraints, twists you have in mind. It wins over the file when they differ.', 'Public, ce qu’il faut tester, contraintes, rebondissements que vous avez en tête. Il prime sur le fichier en cas de différence.', 'Publikum, was getestet werden soll, Rahmenbedingungen, geplante Wendungen. Bei Abweichungen hat es Vorrang vor der Datei.'),
      `<textarea class="cx-brief-text" data-sb-meta="brief" rows="5" placeholder="${escapeAttribute(tt('e.g. Executive crisis cell of a regional hospital group. Test the isolation decision under uncertainty, patient safety, regulatory notifications and media pressure. Players are experienced; include a twist in the second hour. Avoid naming real suppliers.', 'Ex. : cellule de crise de direction d’un groupe hospitalier régional. Tester la décision d’isolement dans l’incertitude, la sécurité des patients, les notifications réglementaires et la pression médiatique. Joueurs expérimentés ; prévoir un rebondissement dans la deuxième heure. Ne pas citer de fournisseurs réels.', 'Z. B. Krisenstab der Geschäftsleitung einer regionalen Klinikgruppe. Die Isolationsentscheidung unter Unsicherheit, die Patientensicherheit, behördliche Meldungen und den Mediendruck testen. Erfahrene Spieler; in der zweiten Stunde eine Wendung einbauen. Keine echten Lieferanten nennen.'))}">${escapeHtml(project.storyboard.meta.brief)}</textarea>`)}
    ${renderCreateOptions(busy)}
    <div class="cx-generate">
      <label class="cx-mode">${escapeHtml(tt('AI autonomy', 'Autonomie de l’IA', 'KI-Autonomie'))}<select data-cx-mode ${busy ? 'disabled' : ''}>
        <option value="agent" ${state.mode === 'agent' ? 'selected' : ''}>${escapeHtml(tt('Ask me before big changes', 'Me demander avant les gros changements', 'Vor größeren Änderungen fragen'))}</option>
        <option value="auto" ${state.mode === 'auto' ? 'selected' : ''}>${escapeHtml(tt('Build automatically', 'Construire automatiquement', 'Automatisch aufbauen'))}</option>
      </select></label>
      <button class="btn btn-primary" data-cx-generate ${ai && !busy && !pendingHere ? '' : 'disabled'}>${running ? '<span class="ai-spinner"></span>' : sbUiIcon('sparkles', 15)} ${escapeHtml(running ? runningLabel : tt('AI generation', 'Génération IA', 'KI-Erstellung'))}</button>
      ${!ai && pd?.doc ? `<button class="btn btn-secondary" data-cx-fill-file ${busy ? 'disabled' : ''} title="${escapeAttribute(tt('Copy the context, objectives and incident timeline found in the document into the empty fields below, without AI', 'Copier le contexte, les objectifs et la chronologie de l’incident trouvés dans le document dans les champs vides ci-dessous, sans IA', 'Kontext, Ziele und Vorfallsablauf aus dem Dokument ohne KI in die leeren Felder unten übernehmen'))}">${sbUiIcon('filePlus', 15)} ${escapeHtml(tt('Fill the fields from the file', 'Remplir les champs depuis le fichier', 'Felder aus der Datei füllen'))}</button>` : ''}
    </div>
    ${ai ? '' : `<p class="agent-warning">${escapeHtml(tt('Configure an AI connection in Settings to generate with AI.', 'Configurez une connexion IA dans les Paramètres pour générer avec l’IA.', 'Richten Sie in den Einstellungen eine KI-Verbindung ein, um mit KI zu generieren.'))}</p>`}
    ${renderOpenPoints(project)}
    ${renderCreationReport(project)}
    ${state.panel !== 'update' ? renderAgentPanel({ origin: 'context' }) : ''}
  </article>`;
}

/* What the AI generation creates: one box per part of the exercise. */
function renderCreateOptions(busy) {
  const want = cgCreateOptions();
  return `<fieldset class="cx-create" ${busy ? 'disabled' : ''}>
    <legend>${escapeHtml(tt('Create', 'Créer', 'Erstellen'))}</legend>
    ${CG_CREATE.map(([key, label], index) => `<label class="cx-create-item ${want[key] ? 'is-on' : ''}"><input type="checkbox" data-cx-create="${key}" ${want[key] ? 'checked' : ''}><span>${index + 1}. ${escapeHtml(tt(...label))}</span></label>`).join('')}
  </fieldset>`;
}

/* After a creation: what really exists, item by item, with a retry for what is missing. */
function renderCreationReport(project) {
  const report = ContextGeneration.report;
  if (!report?.length || ContextGeneration.busy()) return '';
  const failed = report.filter((item) => !item.ok).length;
  return `<div class="cx-report ${failed ? 'has-failed' : ''}">
    <strong>${escapeHtml(failed ? tt(`Creation report: ${failed} part(s) incomplete`, `Bilan de la création : ${failed} élément(s) incomplet(s)`, `Bilanz der Erstellung: ${failed} Teil(e) unvollständig`) : tt('Creation report: everything was created', 'Bilan de la création : tout a été créé', 'Bilanz der Erstellung: alles wurde erstellt'))}</strong>
    <ul>${report.map((item) => `<li class="${item.ok ? 'is-ok' : 'is-ko'}">${sbUiIcon(item.ok ? 'checkCircle' : 'xCircle', 15)}<span><b>${escapeHtml(item.label)}</b> <span class="subtle">${escapeHtml(item.detail)}</span></span>${item.ok ? '' : `<button class="btn btn-secondary btn-xs" data-cx-retry="${item.key}" ${isLLMAvailable() ? '' : 'disabled'}>${sbUiIcon('refresh', 12)} ${escapeHtml(tt('Retry', 'Réessayer', 'Erneut versuchen'))}</button>`}</li>`).join('')}</ul>
  </div>`;
}

/* The points the sources leave open, found when they were read: one answer field under each,
   before the creation starts. */
function renderOpenPoints(project) {
  const pending = ContextGeneration.pending;
  if (!pending || pending.projectId !== project.id) return '';
  const count = pending.missing.length;
  return `<div class="cx-open-points" role="group" aria-label="${escapeAttribute(tt('Check before the creation', 'Vérification avant la création', 'Prüfung vor der Erstellung'))}">
    <div class="cx-open-head">${sbUiIcon('alert', 16)}<div><strong>${escapeHtml(tt('Check before the creation', 'Vérifiez avant la création', 'Vor der Erstellung prüfen'))}</strong><span>${escapeHtml(tt('Correct what the AI misunderstood and answer the open points: your answers win over the sources.', 'Corrigez ce que l’IA a mal compris et répondez aux points ouverts : vos réponses priment sur les sources.', 'Korrigieren Sie, was die KI missverstanden hat, und beantworten Sie die offenen Punkte: Ihre Antworten haben Vorrang vor den Quellen.'))}</span></div></div>
    ${renderOpenDuration(project, pending)}
    ${pending.understanding.length ? `<div class="cx-open-section"><strong>${escapeHtml(tt('What the AI understood', 'Ce que l’IA a compris', 'Was die KI verstanden hat'))}</strong><ul class="cx-understood">${pending.understanding.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>${pending.filled.length ? `<span class="helper">${escapeHtml(tt(`Filled in the Context below: ${pending.filled.join(', ')}. You can also edit these fields directly.`, `Rempli dans le Contexte ci-dessous : ${pending.filled.join(', ')}. Vous pouvez aussi modifier ces champs directement.`, `Im Kontext unten ausgefüllt: ${pending.filled.join(', ')}. Sie können diese Felder auch direkt bearbeiten.`))}</span>` : ''}</div>` : ''}
    ${count ? `<div class="cx-open-section"><strong>${escapeHtml(tt(`${count} point(s) missing from your sources`, `${count} point(s) absent(s) de vos sources`, `${count} Punkt(e) fehlen in Ihren Quellen`))}</strong><span class="helper">${escapeHtml(tt('One answer per point. Leave a field empty to let the AI decide with a stated assumption.', 'Une réponse par point. Laissez un champ vide pour que l’IA décide en indiquant son hypothèse.', 'Eine Antwort pro Punkt. Lassen Sie ein Feld leer, damit die KI mit einer genannten Annahme entscheidet.'))}</span>
      <ol>${pending.missing.map((point, i) => `<li><label class="cx-open-point"><span>${escapeHtml(point)}</span><textarea rows="2" data-cx-open-answer="${i}" placeholder="${escapeAttribute(tt('Your answer (optional)', 'Votre réponse (facultatif)', 'Ihre Antwort (optional)'))}">${escapeHtml(pending.answers[i] || '')}</textarea></label></li>`).join('')}</ol></div>` : ''}
    <label class="cx-open-section"><strong>${escapeHtml(tt('Corrections and details', 'Corrections et précisions', 'Korrekturen und Präzisierungen'))}</strong><span class="helper">${escapeHtml(tt('Anything the AI got wrong or should know, in your own words.', 'Tout ce que l’IA a mal compris ou devrait savoir, avec vos mots.', 'Alles, was die KI falsch verstanden hat oder wissen sollte, in Ihren Worten.'))}</span><textarea rows="3" data-cx-open-corrections placeholder="${escapeAttribute(tt('e.g. There are 3 cells, not 4. The competitor is the target, not a partner. The exercise takes place on 15/10 at 10:00.', 'Ex. : il y a 3 cellules et non 4. Le concurrent est la cible, pas un partenaire. L’exercice a lieu le 15/10 à 10h00.', 'Z. B.: Es gibt 3 Zellen, nicht 4. Der Wettbewerber ist das Ziel, kein Partner. Die Übung findet am 15.10. um 10:00 statt.'))}">${escapeHtml(pending.corrections || '')}</textarea></label>
    <div class="cx-open-actions">
      <button class="btn btn-ghost btn-sm" data-cx-open-cancel>${escapeHtml(tt('Cancel', 'Annuler', 'Abbrechen'))}</button>
      ${count ? `<button class="btn btn-secondary btn-sm" data-cx-open-skip>${escapeHtml(tt('Let the AI decide everything', 'Laisser l’IA tout décider', 'Alles der KI überlassen'))}</button>` : ''}
      <button class="btn btn-primary btn-sm" data-cx-open-continue>${sbUiIcon('sparkles', 14)} ${escapeHtml(tt('Continue the creation', 'Continuer la création', 'Erstellung fortsetzen'))}</button>
    </div>
  </div>`;
}

/* The duration in the check: editable, with where it comes from. */
function renderOpenDuration(project, pending) {
  const info = pending.durationInfo || {};
  const stated = info.stated;
  const where = stated ? `${appState.checkerState?.parsedData?.analysis?.unit === 'Slide' ? tt('slide', 'slide', 'Folie') : tt('section', 'section', 'Abschnitt')} ${stated.where}` : '';
  let note;
  if (stated && !stated.estimated) note = tt(`Read in the document (${where}: "${stated.text}").`, `Lue dans le support (${where} : « ${stated.text} »).`, `Im Dokument gelesen (${where}: „${stated.text}“).`);
  else if (info.source === 'ai') note = tt('Worked out by the AI from your sources: check it.', 'Déduite par l’IA de vos sources : vérifiez-la.', 'Von der KI aus Ihren Quellen abgeleitet: bitte prüfen.');
  else if (stated?.estimated) note = tt(`Not stated in your sources; the latest time they mention is ${sbFormatDuration(stated.minutes)} (${where}).`, `Non indiquée dans vos sources ; le dernier horaire mentionné est ${sbFormatDuration(stated.minutes)} (${where}).`, `In Ihren Quellen nicht angegeben; die späteste erwähnte Zeit ist ${sbFormatDuration(stated.minutes)} (${where}).`);
  else note = tt('Not found in your sources: this is the duration set in the Context. Change it if needed.', 'Non trouvée dans vos sources : c’est la durée réglée dans le Contexte. Modifiez-la si besoin.', 'In Ihren Quellen nicht gefunden: Das ist die im Kontext eingestellte Dauer. Bei Bedarf ändern.');
  const warn = !(stated && !stated.estimated) && info.source !== 'ai';
  return `<label class="cx-open-section cx-open-duration ${warn ? 'is-warn' : ''}"><strong>${escapeHtml(tt('Exercise duration (h:min)', 'Durée de l’exercice (h:min)', 'Übungsdauer (h:min)'))}</strong>
    <span class="cx-open-duration-row"><input type="text" inputmode="numeric" data-cx-open-duration value="${escapeAttribute(pending.duration || '')}" placeholder="${escapeAttribute(tt('e.g. 0:45 or 3:00', 'ex. : 0:45 ou 3:00', 'z. B. 0:45 oder 3:00'))}"><span class="helper">${escapeHtml(note)}</span></span></label>`;
}

/* The essential points of a source: before loading, what to put in it; once loaded, what it
   holds, the duration first (with a button to use it when it differs from the Context). */
function renderSourceEssentials(project) {
  const items = cgSourceChecklist();
  const loaded = !!appState.checkerState?.parsedData;
  const duration = project.storyboard?.duration_minutes || SB_DEFAULT_DURATION;
  const icon = { found: sbUiIcon('checkCircle', 14), estimated: sbUiIcon('alert', 14), missing: sbUiIcon('alert', 14), unknown: sbUiIcon('info', 14) };
  const row = (item) => {
    let detail = '';
    if (item.key === 'duration' && item.minutes) {
      const value = sbFormatDuration(item.minutes);
      detail = item.status === 'estimated'
        ? tt(`About ${value}, from the latest time it mentions (${item.where}: "${item.text}"). State it to be sure.`, `Environ ${value}, d’après le dernier horaire mentionné (${item.where} : « ${item.text} »). Précisez-la pour en être sûr.`, `Etwa ${value}, nach der spätesten erwähnten Zeit (${item.where}: „${item.text}“). Geben Sie sie zur Sicherheit an.`)
        : tt(`${value} (${item.where}: "${item.text}").`, `${value} (${item.where} : « ${item.text} »).`, `${value} (${item.where}: „${item.text}“).`);
      detail = escapeHtml(detail);
      if (item.minutes !== duration && item.minutes >= 30 && item.minutes <= SB_MAX_DURATION) detail += ` <button class="btn btn-secondary btn-xs" data-cx-use-duration="${item.minutes}">${escapeHtml(tt(`Use ${value} (now ${sbFormatDuration(duration)})`, `Utiliser ${value} (actuellement ${sbFormatDuration(duration)})`, `${value} übernehmen (jetzt ${sbFormatDuration(duration)})`))}</button>`;
    } else if (item.status === 'found') detail = escapeHtml(item.where);
    else if (item.status === 'missing') detail = escapeHtml(item.key === 'duration'
      ? tt('Not found: write it in the document, or set the duration in the Context below.', 'Non trouvée : indiquez-la dans le support, ou réglez la durée dans le Contexte ci-dessous.', 'Nicht gefunden: im Dokument angeben oder die Dauer im Kontext unten einstellen.')
      : tt(`Not found. ${item.hint}.`, `Non trouvé. ${item.hint}.`, `Nicht gefunden. ${item.hint}.`));
    else if (item.status === 'unknown') detail = escapeHtml(tt('Not checked in a spreadsheet: complete it in the Context below.', 'Non vérifié dans un tableur : complétez-le dans le Contexte ci-dessous.', 'In einer Tabelle nicht geprüft: im Kontext unten ergänzen.'));
    else detail = escapeHtml(item.hint);
    return `<li class="cx-essential is-${item.status || 'todo'}${item.key === 'duration' ? ' is-key' : ''}">${item.status ? icon[item.status] : sbUiIcon('chevronRight', 14)}<span><strong>${escapeHtml(item.label)}</strong>${item.key === 'duration' && !loaded ? ` <em>${escapeHtml(tt('essential', 'essentielle', 'wesentlich'))}</em>` : ''} <span class="cx-essential-detail">${detail}</span></span></li>`;
  };
  const found = items.filter((item) => item.status === 'found').length;
  return `<div class="cx-essentials ${loaded ? 'is-loaded' : ''}">
    <p class="cx-essentials-head">${escapeHtml(loaded
      ? tt(`What the file holds: ${found} of the ${items.length} essential points. The AI proposes what is missing; you can complete it below.`, `Ce que contient le fichier : ${found} des ${items.length} points essentiels. L’IA propose ce qui manque ; vous pouvez le compléter ci-dessous.`, `Was die Datei enthält: ${found} von ${items.length} wesentlichen Punkten. Die KI schlägt Fehlendes vor; Sie können es unten ergänzen.`)
      : tt('For a complete generation, the document should state:', 'Pour une génération complète, le support doit indiquer :', 'Für eine vollständige Erstellung sollte das Dokument Folgendes enthalten:'))}</p>
    <ul>${items.map(row).join('')}</ul>
  </div>`;
}

/* A new exercise duration. Shorter than the phases: nothing changes yet, the Context asks to
   force it (the phases are fitted) or to cancel. Returns 'set', 'conflict' or 'invalid'. */
function cgSetDuration(minutes, project = appState.scenario) {
  const value = Math.round(Number(minutes));
  if (!Number.isFinite(value) || value <= 0 || value > SB_MAX_DURATION) return 'invalid';
  const target = Math.max(30, value);
  const end = sbStoryboardEnd(project.storyboard);
  const state = tabUI('context');
  if (target < end) {
    state.durationConflict = { minutes: target, end };
    return 'conflict';
  }
  state.durationConflict = null;
  StoryboardHistory.ensure(project);
  project.storyboard.duration_minutes = target;
  StoryboardHistory.commit('Change duration');
  return 'set';
}

/* Force duration: every phase is fitted to it, then Update carries it into the injects. */
function cgForceDuration(project = appState.scenario) {
  const state = tabUI('context');
  const conflict = state.durationConflict;
  if (!conflict) return false;
  StoryboardHistory.ensure(project);
  StoryboardHistory.flush();
  if (!sbFitStoryboardToDuration(project.storyboard, conflict.minutes)) {
    pushToast(tt(`${sbMainBlocks(project.storyboard).length} phases cannot fit in ${sbFormatDuration(conflict.minutes)} (5 minutes each at least): remove some in the Main storyline first.`, `${sbMainBlocks(project.storyboard).length} phases ne tiennent pas en ${sbFormatDuration(conflict.minutes)} (5 minutes chacune au moins) : supprimez-en d’abord dans la Storyline principale.`, `${sbMainBlocks(project.storyboard).length} Phasen passen nicht in ${sbFormatDuration(conflict.minutes)} (mindestens 5 Minuten je Phase): Entfernen Sie zuerst welche in der Haupt-Storyline.`), 'warning');
    return false;
  }
  StoryboardHistory.commit('Force duration');
  sbAfterStoryboardChange(project, { save: true });
  state.durationConflict = null;
  state.forcedDuration = conflict.minutes;
  pushToast(tt(`Duration forced to ${sbFormatDuration(conflict.minutes)}: the phases were fitted to it. Select Update at the bottom of the page to carry it into the injects.`, `Durée forcée à ${sbFormatDuration(conflict.minutes)} : les phases ont été ajustées. Cliquez sur Mettre à jour en bas de page pour la répercuter sur les injects.`, `Dauer auf ${sbFormatDuration(conflict.minutes)} erzwungen: Die Phasen wurden angepasst. Wählen Sie unten auf der Seite Aktualisieren, um sie in die Injects zu übernehmen.`), 'warning');
  return true;
}

/* Under the duration field, when the new duration is shorter than the phases. */
function renderDurationConflict(project) {
  const conflict = tabUI('context').durationConflict;
  if (!conflict) return '';
  const value = sbFormatDuration(conflict.minutes);
  return `<div class="cx-duration-conflict" role="alert">
    ${sbUiIcon('alert', 16)}
    <div><strong>${escapeHtml(tt(`The phases end at ${sbFormatDuration(conflict.end)}, after the new duration of ${value}.`, `Les phases se terminent à ${sbFormatDuration(conflict.end)}, après la nouvelle durée de ${value}.`, `Die Phasen enden bei ${sbFormatDuration(conflict.end)}, nach der neuen Dauer von ${value}.`))}</strong>
      <span>${escapeHtml(tt(`Force duration fits every phase, its planned injects and main events into ${value}, keeping their proportions. Then select Update at the bottom of the page.`, `Forcer la durée ajuste toutes les phases, leurs injects prévus et leurs événements principaux à ${value}, en gardant leurs proportions. Cliquez ensuite sur Mettre à jour en bas de page.`, `Dauer erzwingen passt alle Phasen, ihre geplanten Injects und Hauptereignisse an ${value} an und behält ihre Anteile. Wählen Sie danach unten auf der Seite Aktualisieren.`))}</span></div>
    <div class="cx-duration-actions">
      <button class="btn btn-ghost btn-sm" data-cx-duration-cancel>${escapeHtml(tt('Cancel', 'Annuler', 'Abbrechen'))}</button>
      <button class="btn btn-primary btn-sm" data-cx-duration-force>${sbUiIcon('clock', 14)} ${escapeHtml(tt('Force duration', 'Forcer la durée', 'Dauer erzwingen'))}</button>
    </div>
  </div>`;
}

/* Where the exercise stands against the Context: the line above the Update button. */
function cgUpdateStatus(project = appState.scenario) {
  const phases = sbMainBlocks(project.storyboard).length;
  const changes = cgChanges(project);
  let text;
  if (!phases) text = tt('Generate the exercise first: Update then carries the changes you make to these fields into it.', 'Générez d’abord l’exercice : Mettre à jour y reportera ensuite les modifications que vous faites dans ces champs.', 'Erstellen Sie zuerst die Übung: Aktualisieren übernimmt danach Ihre Änderungen an diesen Feldern.');
  else if (changes?.length) text = tt(`Changed since the last generation: ${changes.map((change) => change.label).join(', ')}.`, `Modifié depuis la dernière génération : ${changes.map((change) => change.label).join(', ')}.`, `Seit der letzten Erstellung geändert: ${changes.map((change) => change.label).join(', ')}.`);
  else if (changes) text = tt('The exercise follows the context above.', 'L’exercice suit le contexte ci-dessus.', 'Die Übung folgt dem Kontext oben.');
  else text = tt('Amend the fields above as you need, then Update: the changes flow into the storyline, the cells and actors, then the injects.', 'Modifiez les champs ci-dessus si besoin, puis Mettre à jour : les changements se répercutent sur la storyline, les cellules et acteurs, puis les injects.', 'Passen Sie die Felder oben nach Bedarf an, dann Aktualisieren: Die Änderungen fließen in die Storyline, die Zellen und Akteure, dann in die Injects.');
  const forced = tabUI('context').forcedDuration;
  if (phases && forced) text = `${tt(`Duration forced to ${sbFormatDuration(forced)}: Update to carry it into the injects.`, `Durée forcée à ${sbFormatDuration(forced)} : mettez à jour pour la répercuter sur les injects.`, `Dauer auf ${sbFormatDuration(forced)} erzwungen: Aktualisieren, um sie in die Injects zu übernehmen.`)} ${changes?.length ? text : ''}`.trim();
  return { phases, changed: !!(phases && (changes?.length || forced)), text };
}

/* 3. Update and build: the amended Context flows into the exercise, then the build stages. */
function renderContextUpdate(project) {
  const ai = isLLMAvailable();
  const busy = ContextGeneration.busy();
  const state = tabUI('context');
  const status = cgUpdateStatus(project);
  const running = ContextGeneration.stage === 'update' || ContextGeneration.stage === 'cascade' || (BuildFlow.stage === 'framing' && state.panel === 'update');
  const label = ContextGeneration.stage === 'cascade' ? tt('Updating the injects…', 'Mise à jour des injects…', 'Injects werden aktualisiert…') : running ? tt('Updating…', 'Mise à jour…', 'Wird aktualisiert…') : tt('Update', 'Mettre à jour', 'Aktualisieren');
  return `<article class="card cx-update" data-sb-scope>
    <div class="cx-update-row ${status.changed ? 'has-changes' : ''}">
      <span class="cx-update-text">${sbUiIcon(status.changed ? 'alert' : 'sync', 15)} <span>${escapeHtml(status.text)}</span></span>
      <button class="btn ${status.changed ? 'btn-primary' : 'btn-secondary'}" data-cx-update ${status.phases && ai && !busy ? '' : 'disabled'} title="${escapeAttribute(tt('The agent carries the context changes into the phases, cells and cast, then the injects follow in cascade', 'L’agent reporte les modifications du contexte sur les phases, les cellules et la distribution, puis les injects suivent en cascade', 'Der Agent übernimmt die Kontextänderungen in Phasen, Zellen und Besetzung, dann folgen die Injects kaskadenartig'))}">${running ? '<span class="ai-spinner"></span>' : sbUiIcon('sync', 15)} ${escapeHtml(label)}</button>
    </div>
    ${state.panel === 'update' ? renderAgentPanel({ origin: 'context' }) : ''}
    ${renderBuildFlow(project, { framingButton: false })}
  </article>`;
}

/* The Context fields save without a re-render (a click that blurs them must still land):
   the Update line is refreshed in place, its button kept. */
function cgRefreshUpdateStatus() {
  const row = typeof document !== 'undefined' && document.querySelector?.('.cx-update-row');
  if (!row || appState.route !== 'scenario') return;
  const status = cgUpdateStatus();
  row.classList.toggle('has-changes', status.changed);
  const text = row.querySelector('.cx-update-text');
  if (text) text.innerHTML = `${sbUiIcon(status.changed ? 'alert' : 'sync', 15)} <span>${escapeHtml(status.text)}</span>`;
  const button = row.querySelector('[data-cx-update]');
  if (button && !ContextGeneration.stage) { button.classList.toggle('btn-primary', status.changed); button.classList.toggle('btn-secondary', !status.changed); }
}
if (typeof document !== 'undefined' && document.addEventListener) ['input', 'change'].forEach((type) => document.addEventListener(type, (event) => {
  // The answers to the open points are kept as they are typed (no re-render).
  const field = event.target?.closest?.('[data-cx-open-answer]');
  if (field && ContextGeneration.pending) ContextGeneration.pending.answers[Number(field.dataset.cxOpenAnswer)] = field.value;
  if (event.target?.matches?.('[data-cx-open-corrections]') && ContextGeneration.pending) ContextGeneration.pending.corrections = event.target.value;
  if (event.target?.matches?.('[data-cx-open-duration]') && ContextGeneration.pending) ContextGeneration.pending.duration = event.target.value;
  setTimeout(cgRefreshUpdateStatus, 0);
}));

/* The example deck (js/example-deck.js, a fictitious company) as a file. */
function cgExampleDeckFile() {
  const binary = atob(CM_EXAMPLE_DECK.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  return typeof File === 'function' ? new File([bytes], CM_EXAMPLE_DECK.name, { type }) : Object.assign(new Blob([bytes], { type }), { name: CM_EXAMPLE_DECK.name });
}

/* Events of the generation and update cards (the page is re-rendered, so one listener). */
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', async (event) => {
  const example = event.target?.closest?.('[data-cx-example-download], [data-cx-example-load]');
  if (example) {
    const file = cgExampleDeckFile();
    if (example.hasAttribute('data-cx-example-download')) (typeof evSave === 'function' ? evSave : downloadBlob)(file, CM_EXAMPLE_DECK.name);
    else await checkerHandleFile(file);
    return;
  }
  const box = event.target?.closest?.('[data-cx-create]');
  if (box) { cgCreateOptions()[box.dataset.cxCreate] = box.checked; box.closest('.cx-create-item')?.classList.toggle('is-on', box.checked); return; }
  const retry = event.target?.closest?.('[data-cx-retry]');
  if (retry && !retry.disabled) { try { await ContextGeneration.retry(retry.dataset.cxRetry); } catch (error) { ContextGeneration.step = ''; pushToast(sbErrorMessage(error), 'error'); App.render(); } return; }
  const button = event.target?.closest?.('[data-cx-generate], [data-cx-update], [data-cx-fill-file], [data-cx-use-duration], [data-cx-open-continue], [data-cx-open-skip], [data-cx-open-cancel], [data-cx-duration-force], [data-cx-duration-cancel]');
  if (!button || button.disabled) return;
  try {
    if ((button.hasAttribute('data-cx-open-continue') || button.hasAttribute('data-cx-open-skip')) && ContextGeneration.pending && !sbParseDuration(ContextGeneration.pending.duration)) {
      pushToast(tt('Type the duration as hours:minutes, e.g. 0:45, 1:30 or 3:00.', 'Saisissez la durée en heures:minutes, ex. : 0:45, 1:30 ou 3:00.', 'Geben Sie die Dauer als Stunden:Minuten ein, z. B. 0:45, 1:30 oder 3:00.'), 'warning');
    } else if (button.hasAttribute('data-cx-open-continue') || button.hasAttribute('data-cx-open-skip')) await ContextGeneration.resume({ skip: button.hasAttribute('data-cx-open-skip') });
    else if (button.hasAttribute('data-cx-open-cancel')) { ContextGeneration.pending = null; App.render(); }
    else if (button.hasAttribute('data-cx-use-duration')) {
      const minutes = Number(button.dataset.cxUseDuration);
      if (cgSetDuration(minutes) === 'set') pushToast(tt(`Exercise duration set to ${sbFormatDuration(minutes)}.`, `Durée de l’exercice réglée sur ${sbFormatDuration(minutes)}.`, `Übungsdauer auf ${sbFormatDuration(minutes)} gesetzt.`), 'success');
      saveLocal(false);
      App.render();
    } else if (button.hasAttribute('data-cx-duration-force')) {
      cgForceDuration();
      App.render();
    } else if (button.hasAttribute('data-cx-duration-cancel')) {
      tabUI('context').durationConflict = null;
      App.render();
    } else if (button.hasAttribute('data-cx-generate')) await ContextGeneration.generate();
    else if (button.hasAttribute('data-cx-update')) await ContextGeneration.update();
    else {
      const filled = ContextGeneration.fillFromDocument();
      pushToast(filled.length ? tt(`Filled from the file: ${filled.join(', ')}.`, `Rempli depuis le fichier : ${filled.join(', ')}.`, `Aus der Datei ausgefüllt: ${filled.join(', ')}.`) : tt('Nothing to fill: the fields are already set or the file has no such section.', 'Rien à remplir : les champs sont déjà renseignés ou le fichier n’a pas ces sections.', 'Nichts auszufüllen: Die Felder sind schon gesetzt oder die Datei hat diese Abschnitte nicht.'), filled.length ? 'success' : 'info');
      App.render();
    }
  } catch (error) {
    ContextGeneration.stage = '';
    pushToast(sbErrorMessage(error), 'error');
    App.render();
  }
});

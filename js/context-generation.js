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

const CG_SECTORS = ['Banking', 'Insurance', 'Energy', 'Healthcare', 'Transport', 'Industry', 'Telecom', 'Retail', 'Public sector', 'Pharmaceutical', 'Technology', 'Other'];

const CG_EXTRACT_SYSTEM = `You are a senior crisis exercise designer. You read what the designer has for a new crisis exercise: their own notes, a library scenario they chose, and a source document (an existing exercise deck or chronogram, a commercial proposal or an exercise brief), then you fill the frame of the exercise.
Read the whole document: the context (organisation, activity, stakes), the objectives, the players and cells, the phases and their timing, the incident or attack timeline, the injects and the facilitator notes. The designer's notes win over the document when they differ.
Reply ONLY with a JSON object:
{
  "exercise_name": "short name of the exercise, '' if none",
  "client_name": "organisation the exercise is for, '' if none",
  "sector": "one of ${CG_SECTORS.join(', ')}, or '' if unknown",
  "language": "ISO code of the document language (en, fr, de, es, it, nl, pt)",
  "duration_minutes": integer play time of the exercise, or null,
  "simulated_start": "YYYY-MM-DDTHH:MM in-story start, or ''",
  "cells": [{"name": "player cell as the document names it", "players": [{"name": "person's name or ''", "role": "job title"}]}],
  "players_count": integer or null,
  "learning_objectives": "what the players must practise, one per line, starting with the cell or category concerned when the document says so ('Executives: …')",
  "incident_timeline": "what really happens in the story, one event per line, in order, starting with its date or time when known (e.g. 'D-3: …', 'H+0:30: …')",
  "context": "the context the exercise builder needs, in plain lines: organisation and activity, stakes and constraints, what to test, the phases foreseen with their timing and the key injects or twists the document plans, facilitator notes. Up to 2500 characters.",
  "missing": ["what the document does not say and the designer should decide"]
}
Use only what the sources say; leave a field empty ('' or [] or null) rather than inventing it.`;

const ContextGeneration = {
  stage: '',

  busy() {
    return !!this.stage || (typeof BuildFlow !== 'undefined' && BuildFlow.busy());
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
    return this.apply(project, { exercise_name: draft.name, context: draft.brief, learning_objectives: draft.learning_objectives, incident_timeline: draft.attack_path });
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
    // The duration and the languages have defaults: the document sets them only on a new exercise.
    const duration = Number(data.duration_minutes);
    if (blank && Number.isInteger(duration) && duration >= 30 && duration <= SB_MAX_DURATION && project.storyboard.duration_minutes === SB_DEFAULT_DURATION && duration !== SB_DEFAULT_DURATION) {
      project.storyboard.duration_minutes = duration;
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
    this.missing = Array.isArray(data.missing) ? data.missing.filter((item) => typeof item === 'string').slice(0, 6) : [];
    return filled;
  },

  /* AI generation: sources → Context fields → framing (and, with all, the stimuli). */
  async generate({ all = false } = {}) {
    const project = appState.scenario;
    if (this.busy()) return false;
    const hasSource = !!appState.checkerState?.parsedData;
    if (!hasSource && !String(project.storyboard.meta.brief || '').trim() && !contextLibraryTemplate(project) && !project.scenario.learning_objectives?.trim()) {
      pushToast(tt('Load a file, choose a generic scenario or describe what you want first.', 'Chargez un fichier, choisissez un scénario générique ou décrivez ce que vous voulez d’abord.', 'Laden Sie zuerst eine Datei, wählen Sie ein generisches Szenario oder beschreiben Sie, was Sie wollen.'), 'info');
      return false;
    }
    if (sbMainBlocks(project.storyboard).length && !window.confirm(tt('Generate the exercise again? The agent rebuilds the framing from the context, adapting the current phases. To carry only your changes, use Update below.', 'Générer à nouveau l’exercice ? L’agent reconstruit le cadrage à partir du contexte en adaptant les phases actuelles. Pour ne reporter que vos modifications, utilisez Mettre à jour plus bas.', 'Die Übung erneut erstellen? Der Agent baut den Rahmen aus dem Kontext neu auf und passt die aktuellen Phasen an. Um nur Ihre Änderungen zu übernehmen, nutzen Sie unten Aktualisieren.'))) return false;
    tabUI('context').panel = 'generate';
    this.stage = 'reading';
    App.render();
    try {
      const filled = await this.readSources(project);
      if (appState.scenario !== project) return false;
      if (filled.length) pushToast(tt(`Filled from your sources: ${filled.join(', ')}.`, `Rempli à partir de vos sources : ${filled.join(', ')}.`, `Aus Ihren Quellen ausgefüllt: ${filled.join(', ')}.`), 'success');
    } catch (error) {
      // The agent still reads the file itself: the generation goes on.
      const filled = this.fillFromDocument(project);
      pushToast(tt(`The sources could not be read with AI (${sbErrorMessage(error)}).${filled.length ? ` Filled as found in the document: ${filled.join(', ')}.` : ''}`, `Les sources n’ont pas pu être lues par l’IA (${sbErrorMessage(error)}).${filled.length ? ` Rempli tel que trouvé dans le document : ${filled.join(', ')}.` : ''}`, `Die Quellen konnten nicht mit KI gelesen werden (${sbErrorMessage(error)}).${filled.length ? ` Wie im Dokument gefunden ausgefüllt: ${filled.join(', ')}.` : ''}`), 'warning');
    } finally {
      this.stage = '';
    }
    App.render();
    const done = await BuildFlow.framing({ openStoryline: !all });
    if (appState.scenario !== project) return false;
    if (done) cgRemember(project);
    if (done && all) return BuildFlow.stimuli({ confirmUnvalidated: false });
    return done;
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
  const running = ContextGeneration.stage === 'reading' || (BuildFlow.stage && state.panel !== 'update');
  const runningLabel = ContextGeneration.stage === 'reading'
    ? tt('Reading your sources…', 'Lecture de vos sources…', 'Ihre Quellen werden gelesen…')
    : BuildFlow.stage === 'adapting' ? tt('Adapting the library scenario…', 'Adaptation du scénario de bibliothèque…', 'Bibliotheksszenario wird angepasst…')
      : tt('Building the framing…', 'Construction du cadrage…', 'Rahmen wird erstellt…');
  const step = (n, title, helper, body) => `<div class="cx-step"><span class="cx-step-num">${n}</span><div class="cx-step-body"><div class="cx-design-head"><strong>${escapeHtml(title)}</strong>${helper ? `<span class="helper">${escapeHtml(helper)}</span>` : ''}</div>${body}</div></div>`;
  const pd = appState.checkerState?.parsedData;
  return `<article class="card cx-brief cx-generation" data-sb-scope>
    <div class="section-header"><div><h3>${sbUiIcon('sparkles', 18)} ${escapeHtml(tt('Scenario generation', 'Génération du scénario', 'Szenario-Erstellung'))}</h3><p class="subtle">${escapeHtml(tt('Start from what you already have. The AI reads it, fills the context below, then builds the main storyline, the cells and the actors.', 'Partez de ce que vous avez déjà. L’IA le lit, remplit le contexte ci-dessous, puis construit la storyline principale, les cellules et les acteurs.', 'Gehen Sie von dem aus, was Sie schon haben. Die KI liest es, füllt den Kontext unten aus und baut dann die Haupt-Storyline, die Zellen und die Akteure.'))}</p></div></div>
    ${step(1, tt('Existing exercise, proposal or exercise brief', 'Exercice existant, proposition ou cahier des charges', 'Bestehende Übung, Angebot oder Übungsbriefing'),
      pd ? tt('The AI reads all of it: context, objectives, players, phases, incident timeline and injects.', 'L’IA le lit en entier : contexte, objectifs, joueurs, phases, chronologie de l’incident et injects.', 'Die KI liest alles: Kontext, Ziele, Spieler, Phasen, Ablauf des Vorfalls und Injects.') : tt('Optional. A deck or chronogram of a previous exercise, a commercial proposal or a brief (.pptx, .docx, .xlsx, .txt).', 'Facultatif. Le support ou le chronogramme d’un exercice précédent, une proposition commerciale ou un cahier des charges (.pptx, .docx, .xlsx, .txt).', 'Optional. Foliensatz oder Chronogramm einer früheren Übung, ein Angebot oder ein Briefing (.pptx, .docx, .xlsx, .txt).'),
      renderContextExerciseFile())}
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
    <div class="cx-generate">
      <label class="cx-mode">${escapeHtml(tt('AI autonomy', 'Autonomie de l’IA', 'KI-Autonomie'))}<select data-cx-mode ${busy ? 'disabled' : ''}>
        <option value="agent" ${state.mode === 'agent' ? 'selected' : ''}>${escapeHtml(tt('Ask me before big changes', 'Me demander avant les gros changements', 'Vor größeren Änderungen fragen'))}</option>
        <option value="auto" ${state.mode === 'auto' ? 'selected' : ''}>${escapeHtml(tt('Build automatically', 'Construire automatiquement', 'Automatisch aufbauen'))}</option>
      </select></label>
      <button class="btn btn-primary" data-cx-generate ${ai && !busy ? '' : 'disabled'}>${running ? '<span class="ai-spinner"></span>' : sbUiIcon('sparkles', 15)} ${escapeHtml(running ? runningLabel : tt('AI generation', 'Génération IA', 'KI-Erstellung'))}</button>
      ${!ai && pd?.doc ? `<button class="btn btn-secondary" data-cx-fill-file ${busy ? 'disabled' : ''} title="${escapeAttribute(tt('Copy the context, objectives and incident timeline found in the document into the empty fields below, without AI', 'Copier le contexte, les objectifs et la chronologie de l’incident trouvés dans le document dans les champs vides ci-dessous, sans IA', 'Kontext, Ziele und Vorfallsablauf aus dem Dokument ohne KI in die leeren Felder unten übernehmen'))}">${sbUiIcon('filePlus', 15)} ${escapeHtml(tt('Fill the fields from the file', 'Remplir les champs depuis le fichier', 'Felder aus der Datei füllen'))}</button>` : ''}
    </div>
    ${ai ? '' : `<p class="agent-warning">${escapeHtml(tt('Configure an AI connection in Settings to generate with AI.', 'Configurez une connexion IA dans les Paramètres pour générer avec l’IA.', 'Richten Sie in den Einstellungen eine KI-Verbindung ein, um mit KI zu generieren.'))}</p>`}
    ${ContextGeneration.missing?.length && state.panel !== 'update' ? `<p class="cx-missing">${sbUiIcon('info', 14)} ${escapeHtml(tt('Not in your sources, to decide:', 'Absent de vos sources, à décider :', 'Nicht in Ihren Quellen, zu entscheiden:'))} ${escapeHtml(ContextGeneration.missing.join(' · '))}</p>` : ''}
    ${state.panel !== 'update' ? renderAgentPanel({ origin: 'context' }) : ''}
  </article>`;
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
  return { phases, changed: !!(phases && changes?.length), text };
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
if (typeof document !== 'undefined' && document.addEventListener) ['input', 'change'].forEach((type) => document.addEventListener(type, () => setTimeout(cgRefreshUpdateStatus, 0)));

/* Events of the generation and update cards (the page is re-rendered, so one listener). */
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', async (event) => {
  const button = event.target?.closest?.('[data-cx-generate], [data-cx-update], [data-cx-fill-file]');
  if (!button || button.disabled) return;
  try {
    if (button.hasAttribute('data-cx-generate')) await ContextGeneration.generate();
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

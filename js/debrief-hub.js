/* Debrief tab: one place, three ways to debrief the exercise.
   - Slide debrief: a slide deck (PowerPoint) showing the timeline and debriefing the exercise:
     context, phases and main events, the injects, the evaluation marks, the key messages.
   - Animated debrief: the interactive HTML page that reveals what really happened (CrisisDebrifier).
   - Video debrief: the documentary video studio.
   The slide deck is described once (sdSlides) and drawn twice: as an on-screen preview and
   as a .pptx file (PptxGenJS). */

/* The part names stay as they are in every language (like the tab names); the hints are translated. */
const DEBRIEF_PARTS = [
  { id: 'slides', label: 'Slide debrief', hint: ['A slide deck with the timeline and the debrief of the exercise', 'Un deck de slides avec la timeline et le debrief de l’exercice', 'Ein Foliensatz mit dem Zeitablauf und der Nachbesprechung der Übung'] },
  { id: 'story', label: 'Animated debrief', hint: ['An interactive HTML page revealing what really happened', 'Une page HTML interactive qui révèle ce qui s’est réellement passé', 'Eine interaktive HTML-Seite, die zeigt, was wirklich geschah'] },
  { id: 'video', label: 'Video debrief', hint: ['A documentary video of the crisis, produced in your browser', 'Une vidéo documentaire de la crise, produite dans votre navigateur', 'Ein Dokumentarvideo der Krise, in Ihrem Browser erstellt'] }
];

function debriefPart() {
  const part = appState.ui?.debriefPart;
  return DEBRIEF_PARTS.some((entry) => entry.id === part) ? part : 'slides';
}

function debriefPartIcon(id) {
  if (id === 'slides') return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="1"></rect><path d="M12 16v4"></path><path d="M8 20h8"></path><path d="M7 12l3-3 2 2 4-4"></path></svg>';
  if (id === 'story') return svgDebrief();
  return svgVideo();
}

function renderDebriefView() {
  const part = debriefPart();
  const body = part === 'story' ? renderStoryDebriefView() : part === 'video' ? renderVideoDebriefView() : renderSlideDebriefView();
  return `<div class="db-shell is-${part}">
    <nav class="db-parts" aria-label="Debrief">${DEBRIEF_PARTS.map((entry, index) => `<button class="${entry.id === part ? 'active' : ''}" data-db-part="${entry.id}" aria-pressed="${entry.id === part}">
      <span class="db-part-icon">${debriefPartIcon(entry.id)}</span>
      <span><strong>${index + 1}. ${escapeHtml(entry.label)}</strong><small>${escapeHtml(tt(...entry.hint))}</small></span>
    </button>`).join('')}</nav>
    ${body}
  </div>`;
}

function bindDebriefHubEvents() {
  if (appState.route !== 'debrief') return;
  document.querySelectorAll('[data-db-part]').forEach((button) => button.addEventListener('click', () => {
    appState.ui.debriefPart = button.dataset.dbPart;
    App.render();
  }));
  if (debriefPart() === 'slides') bindSlideDebriefEvents();
}

// ── Slide debrief: data ─────────────────────────────────────────────────────
/* Languages: the panel follows the application language; the slides (preview and .pptx) follow
   the language of the exercise's injects when it is English, French or German, since the AI
   writes the debrief messages in that language, else the application language. */
function sdDeckLanguage(project = appState.scenario) {
  const lang = project?.settings?.inject_language;
  return ['en', 'fr', 'de'].includes(lang) ? lang : currentLanguage();
}
function sdPick(lang, en, fr, de) {
  if (lang === 'fr') return fr;
  if (lang === 'de') return de !== undefined ? de : en;
  return en;
}
/* The texts fields and the slide sections: English in the constants, French and German here. */
const SD_TEXT_I18N = {
  key_messages: [['Messages clés', 'Les 3 à 5 messages que les participants doivent retenir'], ['Kernbotschaften', 'Die 3 bis 5 Botschaften, die sich die Teilnehmenden merken sollen']],
  went_well: [['Ce qui a bien fonctionné', 'Points forts observés, un par ligne'], ['Was gut lief', 'Beobachtete Stärken, eine pro Zeile']],
  to_improve: [['Axes d’amélioration', 'Faiblesses observées, une par ligne'], ['Verbesserungsbereiche', 'Beobachtete Schwächen, eine pro Zeile']],
  recommendations: [['Recommandations', 'Actions concrètes, une par ligne (responsable, échéance)'], ['Empfehlungen', 'Konkrete Maßnahmen, eine pro Zeile (verantwortlich, Frist)']],
  next_steps: [['Prochaines étapes', 'Après l’exercice : rapport, plan d’action, prochain exercice…'], ['Nächste Schritte', 'Nach der Übung: Bericht, Maßnahmenplan, nächste Übung…']]
};
function sdFieldText(key, lang) {
  const field = SD_TEXT_FIELDS.find(([name]) => name === key) || [key, key, ''];
  const [fr, de] = SD_TEXT_I18N[key] || [];
  return { label: sdPick(lang, field[1], fr?.[0] || field[1], de?.[0] || field[1]), hint: sdPick(lang, field[2], fr?.[1] || field[2], de?.[1] || field[2]) };
}
const SD_SECTION_I18N = {
  overview: ['L’exercice en un coup d’œil', 'Die Übung auf einen Blick'], timeline: ['Chronologie', 'Zeitablauf'], phases: ['Une slide par phase', 'Eine Folie pro Phase'],
  story: ['Ce qui s’est réellement passé', 'Was wirklich geschah'], evaluation: ['Évaluation par cellule', 'Bewertung nach Zelle'], messages: ['Messages du debrief', 'Debrief-Botschaften']
};
/* The fixed words of the slides, in the deck language. */
function sdDeckLabels(project = appState.scenario) {
  const lang = sdDeckLanguage(project);
  const t = (en, fr, de) => sdPick(lang, en, fr, de);
  return {
    lang,
    crisisExercise: t('Crisis exercise', 'Exercice de crise', 'Krisenübung'),
    exerciseDebrief: t('Exercise debrief', 'Debrief de l’exercice', 'Nachbesprechung der Übung'),
    scenario: t('Scenario', 'Scénario', 'Szenario'),
    noScenario: t('No scenario summary yet.', 'Pas encore de résumé du scénario.', 'Noch keine Zusammenfassung des Szenarios.'),
    objectives: t('Learning objectives', 'Objectifs pédagogiques', 'Lernziele'),
    noneYet: t('None written yet.', 'Aucun pour l’instant.', 'Noch keine erfasst.'),
    injects: t('Injects', 'Injects', 'Injects'),
    injectsLower: t('injects', 'injects', 'Injects'),
    mainEvents: t('Main events', 'Événements principaux', 'Hauptereignisse'),
    cell: t('Cell', 'Cellule', 'Zelle'),
    rated: t('Rated', 'Évalués', 'Bewertet'),
    legend: t('P performed without challenges · S with some challenges · M with major challenges · U unable to be performed', 'P réalisé sans difficulté · S avec quelques difficultés · M avec des difficultés majeures · U impossible à réaliser', 'P ohne Schwierigkeiten ausgeführt · S mit einigen Schwierigkeiten · M mit erheblichen Schwierigkeiten · U nicht ausführbar')
  };
}
const SD_TEXT_FIELDS = [
  ['key_messages', 'Key messages', 'The 3 to 5 messages the participants should remember'],
  ['went_well', 'What went well', 'Strengths observed, one per line'],
  ['to_improve', 'Areas for improvement', 'Weaknesses observed, one per line'],
  ['recommendations', 'Recommendations', 'Concrete actions, one per line (owner, deadline)'],
  ['next_steps', 'Next steps', 'After the exercise: report, action plan, next exercise…']
];
const SD_SECTIONS = [
  ['overview', 'Exercise at a glance'], ['timeline', 'Timeline'], ['phases', 'One slide per phase'],
  ['story', 'What really happened'], ['evaluation', 'Evaluation by cell'], ['messages', 'Debrief messages']
];

function normalizeSlideDebrief(input) {
  const source = input && typeof input === 'object' ? input : {};
  const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
  const out = { title: text(source.title, 200), subtitle: text(source.subtitle, 300), generated_at: text(source.generated_at, 40), sections: {} };
  SD_TEXT_FIELDS.forEach(([key]) => { out[key] = text(source[key], 4000); });
  SD_SECTIONS.forEach(([key]) => { out.sections[key] = source.sections?.[key] !== false; });
  return out;
}

/* Normalized once: every render and every handler then work on the same object. */
const SD_NORMALIZED = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
function sdState(project = appState.scenario) {
  if (SD_NORMALIZED?.has(project.slide_debrief)) return project.slide_debrief;
  project.slide_debrief = normalizeSlideDebrief(project.slide_debrief);
  SD_NORMALIZED?.add(project.slide_debrief);
  return project.slide_debrief;
}

const sdLines = (value) => String(value || '').split('\n').map((line) => line.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
/* Shortens a text at a word boundary, with an ellipsis: the preview and the .pptx show the same words. */
const sdClip = (value, max) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, '')}…`;
};

/* How much one slide holds. Both the preview and the .pptx draw these pages, and the texts are
   clipped to the lengths below, so nothing relies on PowerPoint shrinking text (it only does so
   once a box is edited): a longer list continues on a "(continued)" slide. */
const SD_FIT = {
  phaseItems: 4, phaseWhat: 140, eventText: 64, injectTitle: 56, injectCell: 22,
  storyItems: 4, storyTitle: 60, storyText: 90,
  scenario: 440, objectives: 4, objectiveText: 100,
  timelineEvents: 12, timelineText: 48,
  evaluationRows: 8, cells: 3, cellItems: 2, cellText: 56,
  bulletItems: 5, bulletText: 160, columnItems: 4, columnText: 130
};

/* Splits a list into pages of at most `size` items; an empty list gives one empty page. */
function sdPages(items, size) {
  const list = Array.isArray(items) ? items : [];
  const step = Math.max(1, Math.floor(Number(size)) || 1);
  const pages = [];
  for (let index = 0; index < list.length; index += step) pages.push(list.slice(index, index + step));
  return pages.length ? pages : [[]];
}
const sdContinued = (title, page, lang = 'en') => (page > 0 ? `${title} ${sdPick(lang, '(continued)', '(suite)', '(Fortsetzung)')}` : title);

/* The deck, as data: every slide the preview and the .pptx draw. */
function sdSlides(project = appState.scenario) {
  const state = sdState(project);
  const storyboard = project.storyboard;
  const phases = storyboard ? sbMainBlocks(storyboard) : [];
  const model = ExerciseModel.of(project);
  const duration = Math.max(storyboard?.duration_minutes || 0, ...phases.map((block) => sbBlockEnd(block)), 1);
  const cells = project.cells || [];
  const labels = sdDeckLabels(project);
  const lang = labels.lang;
  const t = (en, fr, de) => sdPick(lang, en, fr, de);
  const title = state.title || project.name || labels.crisisExercise;
  const date = project.scenario?.start_date ? String(project.scenario.start_date).slice(0, 10) : '';
  const chips = [project.client?.name, date, phases.length ? sbFormatDuration(duration) : '', model.injects.length ? `${model.injects.length} ${labels.injectsLower}` : ''].filter(Boolean).map((chip) => sdClip(chip, 40));
  const slides = [{ kind: 'title', eyebrow: labels.crisisExercise, title, subtitle: state.subtitle || labels.exerciseDebrief, meta: [project.client?.name, date].filter(Boolean).join(' · '), chips }];
  const on = state.sections;
  const eyebrows = { exercise: t('The exercise', 'L’exercice', 'Die Übung'), evaluation: t('Evaluation', 'Évaluation', 'Bewertung'), debrief: t('Debrief', 'Debrief', 'Nachbesprechung') };
  if (on.overview) {
    const players = cells.reduce((sum, cell) => sum + (cell.players || []).length, 0) || Number(project.exercise?.players_count) || 0;
    slides.push({
      kind: 'overview', eyebrow: eyebrows.exercise, title: t('The exercise at a glance', 'L’exercice en un coup d’œil', 'Die Übung auf einen Blick'),
      kpis: [[sbFormatDuration(duration), t('Duration', 'Durée', 'Dauer')], [phases.length, t('Phases', 'Phases', 'Phasen')], [model.injects.length, labels.injects], [cells.length, t('Cells', 'Cellules', 'Zellen')], [players, t('Players', 'Joueurs', 'Spieler')]],
      scenario: sdClip(project.scenario?.summary || storyboard?.meta?.brief || '', SD_FIT.scenario),
      objectives: sdLines(project.scenario?.learning_objectives).slice(0, SD_FIT.objectives).map((line) => sdClip(line, SD_FIT.objectiveText))
    });
  }
  if (on.timeline && phases.length) {
    slides.push({
      kind: 'timeline', eyebrow: eyebrows.exercise, title: t('Timeline of the exercise', 'Chronologie de l’exercice', 'Zeitlicher Ablauf der Übung'), duration,
      phases: phases.map((block) => ({ title: block.title, start: block.start_minutes, end: sbBlockEnd(block), color: sdPhaseColor(block), injects: model.injects.filter((inject) => inject.phase_id === block.id).length })),
      events: phases.flatMap((block) => (block.events || []).map((event) => ({ at: block.start_minutes + (event.offset_minutes || 0), text: sdClip(event.text, SD_FIT.timelineText) }))).sort((a, b) => a.at - b.at).slice(0, SD_FIT.timelineEvents)
    });
  }
  if (on.phases) {
    phases.forEach((block, index) => {
      const events = (block.events || []).map((event) => ({ at: sbFormatOffset(block.start_minutes + (event.offset_minutes || 0)), text: sdClip(event.text, SD_FIT.eventText) }));
      const injects = model.injects.filter((inject) => inject.phase_id === block.id)
        .map((inject) => ({ at: sbFormatOffset(inject.time), title: sdClip(inject.title, SD_FIT.injectTitle), to: sdClip(inject.cell?.name || '', SD_FIT.injectCell) }));
      const eventPages = sdPages(events, SD_FIT.phaseItems), injectPages = sdPages(injects, SD_FIT.phaseItems);
      const title = t(`Phase ${index + 1}: ${block.title}`, `Phase ${index + 1} : ${block.title}`, `Phase ${index + 1}: ${block.title}`);
      const stress = sbStressLevel(sbBlockStress(block));
      for (let page = 0; page < Math.max(eventPages.length, injectPages.length); page++) {
        slides.push({
          kind: 'phase', title: sdContinued(title, page, lang), continued: page > 0, color: sdPhaseColor(block),
          span: `${sbFormatOffset(block.start_minutes)} ${t('to', 'à', 'bis')} ${sbFormatOffset(sbBlockEnd(block))}`,
          eyebrow: `Phase ${index + 1} · ${sbFormatOffset(block.start_minutes)} ${t('to', 'à', 'bis')} ${sbFormatOffset(sbBlockEnd(block))}`, stressLabel: t('Stress', 'Stress', 'Stress'),
          stress: typeof SB_STRESS_TEXT === 'object' ? t(stress.label, SB_STRESS_TEXT[stress.level]?.[0] || stress.label, SB_STRESS_TEXT[stress.level]?.[1] || stress.label) : stress.label,
          what: page ? '' : sdClip(block.brief || block.narrative || '', SD_FIT.phaseWhat),
          events: eventPages[page] || [], injects: injectPages[page] || []
        });
      }
    });
  }
  const story = (project.debrief?.events || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  if (on.story && story.length) {
    const items = story.map((event) => ({ when: sdClip(event.dateLabel, 30), title: sdClip(event.title, SD_FIT.storyTitle), text: sdClip(event.headline || event.body, SD_FIT.storyText) }));
    sdPages(items, SD_FIT.storyItems).forEach((page, index) => slides.push({ kind: 'story', eyebrow: 'Story debrief', title: sdContinued(t('What really happened', 'Ce qui s’est réellement passé', 'Was wirklich geschah'), index, lang), continued: index > 0, items: page }));
  }
  if (on.evaluation && cells.length && typeof evTally === 'function') {
    const rows = cells.map((cell) => ({ name: cell.name, color: cell.color, tally: evTally(project, cell), injects: evReceivedInjects(project, cell).length }));
    sdPages(rows, SD_FIT.evaluationRows).forEach((page, index) => slides.push({ kind: 'evaluation', eyebrow: eyebrows.evaluation, title: sdContinued(t('Evaluation by cell', 'Évaluation par cellule', 'Bewertung nach Zelle'), index, lang), continued: index > 0, rows: page }));
    // Per cell, what the evaluators wrote: criteria rated M or U, strengths, improvements.
    const notes = cells.map((cell) => {
      const sheet = evSheet(project, cell);
      const weak = sheet.criteria.filter((criterion) => ['M', 'U'].includes(criterion.rating)).map((criterion) => `${criterion.rating} · ${criterion.text}`);
      const clip = (lines) => lines.slice(0, SD_FIT.cellItems).map((line) => sdClip(line, SD_FIT.cellText));
      return { name: cell.name, color: cell.color, strengths: clip(sdLines(sheet.strengths)), improvements: clip([...sdLines(sheet.improvements), ...weak]) };
    }).filter((entry) => entry.strengths.length || entry.improvements.length);
    if (notes.length) sdPages(notes, SD_FIT.cells).forEach((page, index) => slides.push({ kind: 'cells', eyebrow: eyebrows.evaluation, strengthsLabel: sdFieldText('went_well', lang).label, improvementsLabel: sdFieldText('to_improve', lang).label, title: sdContinued(t('What the evaluators observed', 'Ce que les évaluateurs ont observé', 'Was die Bewerter beobachtet haben'), index, lang), continued: index > 0, cells: page }));
  }
  if (on.messages) {
    const lists = SD_TEXT_FIELDS.map(([key]) => ({ key, label: sdFieldText(key, lang).label, items: sdLines(state[key]).slice(0, 12).map((line) => sdClip(line, key === 'key_messages' ? SD_FIT.bulletText : SD_FIT.columnText)) }));
    const byKey = Object.fromEntries(lists.map((list) => [list.key, list]));
    if (byKey.key_messages.items.length) sdPages(byKey.key_messages.items, SD_FIT.bulletItems).forEach((items, index) => slides.push({ kind: 'bullets', eyebrow: eyebrows.debrief, title: sdContinued(sdFieldText('key_messages', lang).label, index, lang), continued: index > 0, items }));
    const columns = (title, left, right) => {
      if (!left.items.length && !right.items.length) return;
      const lefts = sdPages(left.items, SD_FIT.columnItems), rights = sdPages(right.items, SD_FIT.columnItems);
      for (let page = 0; page < Math.max(lefts.length, rights.length); page++) {
        slides.push({ kind: 'columns', eyebrow: eyebrows.debrief, title: sdContinued(title, page, lang), continued: page > 0, left: { ...left, items: lefts[page] || [] }, right: { ...right, items: rights[page] || [] } });
      }
    };
    columns(t('Strengths and areas for improvement', 'Points forts et axes d’amélioration', 'Stärken und Verbesserungsbereiche'), byKey.went_well, byKey.to_improve);
    columns(t('Recommendations and next steps', 'Recommandations et prochaines étapes', 'Empfehlungen und nächste Schritte'), byKey.recommendations, byKey.next_steps);
  }
  slides.push({ kind: 'end', eyebrow: labels.exerciseDebrief, title: t('Thank you', 'Merci', 'Vielen Dank'), subtitle: t('Questions and discussion', 'Questions et échanges', 'Fragen und Diskussion'), chips: [] });
  return slides;
}

// ── Slide debrief: view ─────────────────────────────────────────────────────
function renderSlideDebriefView() {
  const project = appState.scenario;
  const state = sdState(project);
  const slides = sdSlides(project);
  const busy = SdAI.busy;
  const aiReady = typeof isLLMAvailable === 'function' && isLLMAvailable();
  const downloading = !!appState.ui?.actionLoading?.['sd-download'];
  const locked = busy ? 'disabled' : '';
  const labels = sdDeckLabels(project);
  const ui = currentLanguage();
  return `<section class="tab-page sd-page">
    <article class="card sd-head">
      <div class="sd-head-fields">
        <label class="field">${escapeHtml(tt('Deck title', 'Titre du deck', 'Titel des Foliensatzes'))}<input type="text" data-sd-field="title" value="${escapeAttribute(state.title)}" placeholder="${escapeAttribute(project.name || labels.crisisExercise)}" ${locked}></label>
        <label class="field">${escapeHtml(tt('Subtitle', 'Sous-titre', 'Untertitel'))}<input type="text" data-sd-field="subtitle" value="${escapeAttribute(state.subtitle)}" placeholder="${escapeAttribute(labels.exerciseDebrief)}" ${locked}></label>
      </div>
      <div class="sd-head-actions">
        <button class="btn btn-secondary" data-sd-action="ai" ${aiReady && !busy ? '' : 'disabled'} title="${escapeAttribute(aiReady ? tt('Write the key messages, strengths, improvements and recommendations from the exercise and the evaluation', 'Rédiger les messages clés, points forts, axes d’amélioration et recommandations à partir de l’exercice et de l’évaluation', 'Kernbotschaften, Stärken, Verbesserungen und Empfehlungen aus der Übung und der Bewertung schreiben') : tt('Configure an AI connection in Settings first', 'Configurez d’abord une connexion IA dans les Paramètres', 'Richten Sie zuerst in den Einstellungen eine KI-Verbindung ein'))}">${sbUiIcon(busy ? 'clock' : 'sparkles', 16)} ${escapeHtml(busy ? tt('Writing…', 'Rédaction…', 'Wird geschrieben…') : tt('Write the debrief with AI', 'Rédiger le debrief avec l’IA', 'Debrief mit KI schreiben'))}</button>
        ${busy ? `<button class="btn btn-ghost btn-sm" data-sd-action="ai-stop">${escapeHtml(tt('Stop', 'Arrêter', 'Stoppen'))}</button>` : ''}
        <button class="btn btn-primary" data-sd-action="download" ${downloading ? 'disabled' : ''}>${sbUiIcon(downloading ? 'clock' : 'download', 16)} ${escapeHtml(tt('Download PowerPoint (.pptx)', 'Télécharger le PowerPoint (.pptx)', 'PowerPoint herunterladen (.pptx)'))}</button>
      </div>
      ${SdAI.error ? `<p class="agent-warning sd-error">${escapeHtml(SdAI.error)}</p>` : ''}
      <div class="sd-sections" role="group" aria-label="${escapeAttribute(tt('Slides to include', 'Slides à inclure', 'Einzubeziehende Folien'))}">${SD_SECTIONS.map(([key, label]) => `<label><input type="checkbox" data-sd-section="${key}" ${state.sections[key] ? 'checked' : ''}> ${escapeHtml(tt(label, SD_SECTION_I18N[key]?.[0] || label, SD_SECTION_I18N[key]?.[1] || label))}</label>`).join('')}</div>
    </article>
    <article class="card sd-messages">
      <div class="section-header"><div><h3>${escapeHtml(tt('Debrief messages', 'Messages du debrief', 'Debrief-Botschaften'))}</h3><p class="subtle">${escapeHtml(tt('One point per line. Written by you or by the AI from the exercise, the evaluation sheets and the story debrief, then shown on the last slides.', 'Un point par ligne. Rédigés par vous ou par l’IA à partir de l’exercice, des grilles d’évaluation et du Animated debrief, puis affichés sur les dernières slides.', 'Ein Punkt pro Zeile. Von Ihnen oder der KI aus der Übung, den Bewertungsbögen und dem Animated debrief geschrieben, dann auf den letzten Folien gezeigt.'))}</p></div></div>
      <div class="sd-fields">${SD_TEXT_FIELDS.map(([key]) => { const field = sdFieldText(key, ui); return `<label class="field">${escapeHtml(field.label)}<textarea rows="5" data-sd-field="${key}" placeholder="${escapeAttribute(field.hint)}" ${locked}>${escapeHtml(state[key])}</textarea></label>`; }).join('')}</div>
    </article>
    <article class="card sd-preview-card">
      <div class="section-header"><div><h3>${escapeHtml(tt('Slides', 'Slides', 'Folien'))} <small>${slides.length}</small></h3><p class="subtle">${escapeHtml(tt('Preview of the deck, updated with the exercise. The PowerPoint file has the same slides, ready to edit.', 'Aperçu du deck, mis à jour avec l’exercice. Le fichier PowerPoint contient les mêmes slides, prêtes à modifier.', 'Vorschau des Foliensatzes, mit der Übung aktualisiert. Die PowerPoint-Datei enthält dieselben Folien, bereit zum Bearbeiten.'))}${labels.lang !== ui ? ` ${escapeHtml(tt('The slides are in the language of the injects (Context).', 'Les slides sont dans la langue des injects (Contexte).', 'Die Folien sind in der Sprache der Injects (Kontext).'))}` : ''}</p></div></div>
      <div class="sd-grid">${slides.map((slide, index) => sdSlideFigure(slide, index, slides.length, labels, sdKicker(project))).join('')}</div>
    </article>
  </section>`;
}

// ── Slide debrief: Wavestone slide format ───────────────────────────────────
/* The slides follow the Wavestone slide format (HowToWavestone: wavestonedesign.css and its
   1280 x 720 slide decks): cover and end slides on the brand gradient, white content slides
   with the brandmark, an eyebrow, an indigo head title, a short green accent bar, cards with a
   green left border, dark highlight blocks, a mono kicker and a page number. The preview and
   the .pptx share one grid, in pixels of a 1280 x 720 slide: the preview scales it with
   container units (--u), the .pptx maps 96 px to an inch. */
const SD_COLORS = {
  indigo: '451DC7', indigo400: '866CDB', indigo700: '36169B', indigo800: '2D1380', indigo950: '150939',
  green: '04F06A', green300: '5CF59E', green50: 'E1FDED', teal: '228D95',
  // White at 55%, 82% and 90% over the brand gradient, as solid colors (text transparency renders unevenly).
  onDarkFaint: 'A99DDB', onDarkSoft: 'DCD6F5', onDarkText: 'EEEBFB',
  ink: '16121F', muted: '6B6580', subtle: '817C95', faint: 'A8A4B8', line: 'E6E4EE', panel: 'F5F4F9', white: 'FFFFFF',
  success: '088A42', warning: 'C8861A', danger: 'D8412F',
  // The evaluation marks, from the status colors: P success, S info (teal), M warning, U danger.
  P: '088A42', S: '228D95', M: 'C8861A', U: 'D8412F'
};
const SD_FONTS = { display: 'Poppins', body: 'Inter', mono: 'IBM Plex Mono' };
/* The phases take the brand colors by stress level, from teal (calm) to deep indigo (peak). */
const SD_STRESS_COLORS = { 1: SD_COLORS.teal, 2: SD_COLORS.indigo400, 3: SD_COLORS.indigo, 4: SD_COLORS.indigo800, 5: SD_COLORS.indigo950 };
function sdPhaseColor(block) {
  return `#${SD_STRESS_COLORS[sbStressLevel(sbBlockStress(block)).level] || SD_COLORS.indigo}`;
}
/* The grid, in px of a 1280 x 720 slide. */
const SD_GRID = { W: 1280, H: 720, X: 54, CW: 1172, top: 206, bottom: 648, col: 571, col2: 655, gap: 30 };
const SD_TL = { label: 60, bar: 366, barH: 76, scale: 448, rows: [208, 480, 276, 552] };
const SD_HEAD_MAX = 140, SD_COVER_MAX = 110;
/* The head title and the cover title get smaller as they get longer, so they stay in their box. */
const sdHeadSize = (title) => { const n = String(title || '').length; return n <= 50 ? 34 : n <= 64 ? 28 : 23; };
const sdCoverSize = (title) => { const n = String(title || '').length; return n <= 26 ? 58 : n <= 44 ? 48 : n <= 72 ? 40 : 32; };
/* The key word of a cover title, in green: its last word. */
function sdAccentSplit(title) {
  const text = String(title || '').trim();
  const at = text.lastIndexOf(' ');
  return at > 0 ? [text.slice(0, at + 1), text.slice(at + 1)] : ['', text];
}
const sdPageNumber = (index, total) => `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
const sdKicker = (project) => sdClip(sdState(project).title || project.name || '', 70);
const sdIsDark = (slide) => slide.kind === 'title' || slide.kind === 'end';
/* The markers of the debrief lists, by field. */
const SD_LIST_STYLE = {
  went_well: { marker: '+', color: SD_COLORS.success }, to_improve: { marker: '→', color: SD_COLORS.warning },
  recommendations: { numbered: true, color: SD_COLORS.indigo }, next_steps: { marker: '→', color: SD_COLORS.green300, dark: true }
};
/* The brand waves of the cover, from the Wavestone slide decks. */
const SD_WAVES = [
  ['M-50,560 Q360,420 700,520 T1330,460', 'rgba(255,255,255,.16)'],
  ['M-50,610 Q380,470 720,560 T1330,510', 'rgba(4,240,106,.5)'],
  ['M-50,500 Q340,380 680,470 T1330,410', 'rgba(255,255,255,.10)']
];

function sdSlideFigure(slide, index, total, labels, kicker) {
  return `<figure class="sd-slide-wrap"><div class="sd-slide sd-${slide.kind}${sdIsDark(slide) ? ' is-dark' : ''}">${sdSlideHtml(slide, labels, { index, total, kicker })}</div><figcaption>${index + 1}. ${escapeHtml(slide.title)}</figcaption></figure>`;
}

function sdList(items, cls = '') {
  return `<ul class="${cls}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

/* An event label on the timeline is 18% wide and centred on its time, but kept inside the
   slide; its dashed tick (--tick, within the label) still points at the exact time. */
const SD_TL_LABEL = 18;
function sdTimelineTick(at, duration) {
  const x = Math.min(100, Math.max(0, 100 * (Number(at) || 0) / (duration || 1)));
  const half = SD_TL_LABEL / 2;
  const left = Math.min(100 - half, Math.max(half, x));
  return { left, tick: 50 + (100 * (x - left)) / SD_TL_LABEL };
}
/* Where an event label sits: rows 0 and 2 above the bar, 1 and 3 below; the tick joins it to the bar. */
function sdTimelineRow(index) {
  const row = index % 4, y = SD_TL.rows[row], up = row % 2 === 0;
  return { row, y, up, tick: up ? SD_TL.bar - (y + SD_TL.label) : y - (SD_TL.bar + SD_TL.barH) };
}

function sdSlideHtml(slide, labels = sdDeckLabels(), frame = {}) {
  const e = escapeHtml;
  const chrome = `<div class="sd-brand"><i></i>Wavestone</div>${frame.kicker ? `<div class="sd-kicker">${e(frame.kicker)}</div>` : ''}${frame.total ? `<div class="sd-pagenum">${sdPageNumber(frame.index, frame.total)}</div>` : ''}`;
  if (sdIsDark(slide)) {
    const [lead, word] = sdAccentSplit(sdClip(slide.title, SD_COVER_MAX));
    return `<svg class="sd-waves" viewBox="0 0 1280 720" preserveAspectRatio="none" aria-hidden="true">${SD_WAVES.map(([d, color]) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5"/>`).join('')}</svg>${chrome}
      <div class="sd-cover">${slide.eyebrow ? `<span class="sd-eyebrow">${e(slide.eyebrow)}</span>` : ''}<h3 style="--size:${sdCoverSize(slide.title)}">${e(lead)}<span class="sd-ac">${e(word)}</span></h3>${slide.subtitle ? `<p>${e(sdClip(slide.subtitle, 160))}</p>` : ''}${(slide.chips || []).length ? `<div class="sd-chips">${slide.chips.map((chip) => `<span>${e(chip)}</span>`).join('')}</div>` : ''}</div>`;
  }
  const tag = slide.kind === 'phase' ? `<span class="sd-tag" style="--tag:${e(slide.color)}">${e(slide.stressLabel || 'Stress')} · ${e(slide.stress)}</span>` : '';
  const head = `<span class="sd-eyebrow">${e(slide.eyebrow || '')}</span>${tag}<h4 class="sd-headline" style="--size:${sdHeadSize(slide.title)}">${e(sdClip(slide.title, SD_HEAD_MAX))}</h4><div class="sd-accentbar"></div>`;
  const label = (text, cls = '') => `<span class="sd-label ${cls}">${e(text)}</span>`;
  const num = (index) => String(index + 1).padStart(2, '0');
  const rows = (items) => (items.length ? `<ul class="sd-rows">${items.join('')}</ul>` : '<p class="sd-none">-</p>');
  let body = '';
  switch (slide.kind) {
    case 'overview':
      body = `<div class="sd-stats">${slide.kpis.map(([value, name]) => `<div class="sd-stat"><b>${e(String(value))}</b><span>${e(name)}</span></div>`).join('')}</div>
        <div class="sd-split sd-overview-split"><div class="sd-dark">${label(labels.scenario)}<p>${e(slide.scenario || labels.noScenario)}</p></div>
        <div class="sd-objectives">${label(labels.objectives, 'is-indigo')}${slide.objectives.length ? `<div class="sd-obj-grid">${slide.objectives.map((line, index) => `<div class="sd-card"><span class="sd-num">${num(index)}</span><p>${e(line)}</p></div>`).join('')}</div>` : `<p class="sd-none">${e(labels.noneYet)}</p>`}</div></div>`;
      break;
    case 'timeline':
      body = `<div class="sd-tl">
        <div class="sd-tl-bar">${slide.phases.map((phase) => `<span style="left:${(100 * phase.start / slide.duration).toFixed(2)}%;width:${(100 * (phase.end - phase.start) / slide.duration).toFixed(2)}%;--phase:${e(phase.color)}"><b>${e(phase.title)}</b><i>${phase.injects} ${e(labels.injectsLower)}</i></span>`).join('')}</div>
        <div class="sd-tl-scale">${slide.phases.map((phase) => `<span style="left:${(100 * phase.start / slide.duration).toFixed(2)}%">${e(sbFormatOffset(phase.start))}</span>`).join('')}<span class="is-end">${e(sbFormatOffset(slide.duration))}</span></div>
        <div class="sd-tl-events">${slide.events.map((event, index) => { const tick = sdTimelineTick(event.at, slide.duration), row = sdTimelineRow(index); return `<span class="row-${row.row} ${row.up ? 'is-up' : 'is-down'}" style="left:${tick.left.toFixed(2)}%;--tick:${tick.tick.toFixed(2)}%;--y:${row.y};--tick-h:${row.tick}"><b>${e(sbFormatOffset(event.at))}</b>${e(event.text)}</span>`; }).join('')}</div>
      </div>`;
      break;
    case 'phase':
      body = `${slide.what ? `<p class="sd-lede">${e(slide.what)}</p>` : ''}<div class="sd-split">
        <div class="sd-card sd-col">${label(labels.mainEvents, 'is-indigo')}${rows(slide.events.map((event) => `<li><b>${e(event.at)}</b><span>${e(event.text)}</span></li>`))}</div>
        <div class="sd-card sd-col">${label(labels.injects, 'is-indigo')}${rows(slide.injects.map((inject) => `<li><b>${e(inject.at)}</b><span>${e(inject.title)}${inject.to ? ` <i>→ ${e(inject.to)}</i>` : ''}</span></li>`))}</div></div>`;
      break;
    case 'story':
      body = `<div class="sd-quad">${slide.items.map((item) => `<div class="sd-card sd-story-card">${label(item.when || '', 'is-indigo')}<strong>${e(item.title)}</strong><p>${e(item.text)}</p></div>`).join('')}</div>`;
      break;
    case 'evaluation':
      body = `<table class="sd-eval"><thead><tr><th>${e(labels.cell)}</th><th>${e(labels.injects)}</th>${['P', 'S', 'M', 'U'].map((code) => `<th class="is-${code}">${code}</th>`).join('')}<th>${e(labels.rated)}</th></tr></thead><tbody>${slide.rows.map((row) => `<tr><td><span class="cell-dot" style="background:${e(row.color)}"></span>${e(row.name)}</td><td>${row.injects}</td>${['P', 'S', 'M', 'U'].map((code) => `<td class="is-${code}${row.tally.counts[code] > 0 ? ' is-on' : ''}">${row.tally.counts[code]}</td>`).join('')}<td>${row.tally.rated}/${row.tally.total}</td></tr>`).join('')}</tbody></table><p class="sd-legend">${e(labels.legend)}</p>`;
      break;
    case 'cells':
      body = `<div class="sd-cell-grid" style="--cols:${Math.max(1, slide.cells.length)}">${slide.cells.map((cell) => `<div class="sd-card"><strong><i style="background:${e(cell.color)}"></i>${e(cell.name)}</strong>
        ${cell.strengths.length ? `${label(slide.strengthsLabel || '+', 'is-good')}<ul class="sd-marks is-good">${cell.strengths.map((item) => `<li>${e(item)}</li>`).join('')}</ul>` : ''}
        ${cell.improvements.length ? `${label(slide.improvementsLabel || '-', 'is-warn')}<ul class="sd-marks is-warn">${cell.improvements.map((item) => `<li>${e(item)}</li>`).join('')}</ul>` : ''}</div>`).join('')}</div>`;
      break;
    case 'bullets':
      body = `<ol class="sd-keymsgs">${slide.items.map((item, index) => `<li class="sd-card"><b>${num(index)}</b><span>${e(item)}</span></li>`).join('')}</ol>`;
      break;
    case 'columns':
      body = `<div class="sd-split">${[slide.left, slide.right].map((list) => {
        const style = SD_LIST_STYLE[list.key] || { marker: '•', color: SD_COLORS.indigo };
        return `<div class="sd-col ${style.dark ? 'sd-dark' : 'sd-card'}" style="--mark:#${style.color}">${label(list.label, style.dark ? '' : 'is-mark')}${rows(list.items.map((item, index) => `<li><b>${style.numbered ? num(index) : style.marker}</b><span>${e(item)}</span></li>`))}</div>`;
      }).join('')}</div>`;
      break;
    default: break;
  }
  return `${chrome}<div class="sd-body">${head}<div class="sd-content">${body}</div></div>`;
}

function bindSlideDebriefEvents() {
  const root = document.querySelector('.sd-page');
  if (!root) return;
  const project = appState.scenario;
  let timer = null;
  root.querySelectorAll('[data-sd-field]').forEach((input) => input.addEventListener('input', () => {
    const state = sdState(project);
    const key = input.dataset.sdField;
    if (!['title', 'subtitle', ...SD_TEXT_FIELDS.map(([name]) => name)].includes(key)) return;
    state[key] = input.value.slice(0, ['title', 'subtitle'].includes(key) ? 300 : 4000);
    clearTimeout(timer);
    timer = setTimeout(() => { saveLocal(false); sdRefreshPreview(); }, 500);
  }));
  root.querySelectorAll('[data-sd-section]').forEach((input) => input.addEventListener('change', () => {
    sdState(project).sections[input.dataset.sdSection] = input.checked;
    saveLocal(false);
    App.render();
  }));
  root.querySelectorAll('[data-sd-action]').forEach((button) => button.addEventListener('click', async () => {
    const action = button.dataset.sdAction;
    if (action === 'download') await sdDownload(project);
    if (action === 'ai') await SdAI.write(project);
    if (action === 'ai-stop') SdAI.stop();
  }));
}

/* Typing refreshes the preview only, so the field keeps its focus. */
function sdRefreshPreview() {
  const grid = document.querySelector('.sd-grid');
  if (!grid) return;
  const slides = sdSlides(appState.scenario);
  const labels = sdDeckLabels(appState.scenario);
  grid.innerHTML = slides.map((slide, index) => sdSlideFigure(slide, index, slides.length, labels, sdKicker(appState.scenario))).join('');
  const count = document.querySelector('.sd-preview-card h3 small');
  if (count) count.textContent = String(slides.length);
}

// ── Slide debrief: AI ───────────────────────────────────────────────────────
const SdAI = {
  busy: false, error: '', controller: null,
  stop() { this.controller?.abort(); },

  context(project) {
    const storyboard = project.storyboard;
    const phases = storyboard ? sbMainBlocks(storyboard) : [];
    const language = project.settings?.inject_language || project.settings?.language || 'en';
    return {
      exercise: project.name || '', organisation: { name: project.client?.name || '', sector: project.client?.sector || '' },
      scenario: sdClip(project.scenario?.summary || storyboard?.meta?.brief || '', 2000),
      learning_objectives: sdClip(project.scenario?.learning_objectives || '', 2000),
      phases: phases.slice(0, 15).map((block) => ({
        title: block.title, start: sbFormatOffset(block.start_minutes), what_happens: sdClip(block.brief, 400),
        main_events: (block.events || []).slice(0, 8).map((event) => `${sbFormatOffset(block.start_minutes + (event.offset_minutes || 0))} ${sdClip(event.text, 200)}`)
      })),
      what_really_happened: (project.debrief?.events || []).slice(0, 15).map((event) => sdClip(`${event.dateLabel || ''} ${event.title}: ${event.headline || ''}`, 220)),
      evaluation: (project.cells || []).map((cell) => {
        const sheet = typeof evSheet === 'function' ? evSheet(project, cell) : { criteria: [] };
        const tally = typeof evTally === 'function' ? evTally(project, cell) : null;
        return {
          cell: cell.name, marks: tally ? tally.counts : {},
          criteria: sheet.criteria.filter((criterion) => criterion.rating || criterion.notes).slice(0, 20).map((criterion) => sdClip(`${criterion.rating || '-'} · ${criterion.text}${criterion.notes ? ` (${criterion.notes})` : ''}`, 260)),
          strengths: sdClip(sheet.strengths, 800), improvements: sdClip(sheet.improvements, 800)
        };
      }),
      current_text: Object.fromEntries(SD_TEXT_FIELDS.map(([key]) => [key, sdClip(project.slide_debrief?.[key], 1500)])),
      language: { en: 'English', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian', pt: 'Portuguese', nl: 'Dutch', ja: 'Japanese', zh: 'Chinese' }[language] || 'English'
    };
  },

  async write(project) {
    if (this.busy) return;
    if (!isLLMAvailable()) { pushToast(tt('Configure an AI connection in Settings first.', 'Configurez d’abord une connexion IA dans les Paramètres.', 'Richten Sie zuerst in den Einstellungen eine KI-Verbindung ein.'), 'error'); return; }
    const state = sdState(project);
    if (SD_TEXT_FIELDS.some(([key]) => state[key].trim()) && !window.confirm(tt('Replace the debrief messages with a version written by the AI?', 'Remplacer les messages du debrief par une version rédigée par l’IA ?', 'Die Debrief-Botschaften durch eine von der KI geschriebene Fassung ersetzen?'))) return;
    this.busy = true; this.error = ''; this.controller = new AbortController();
    const signal = this.controller.signal;
    App.render();
    try {
      const system = `You are a senior crisis exercise facilitator writing the debrief (hot wash and after-action review) of a crisis management exercise for the participants and their management.
Use the exercise design, the phases and main events, what really happened, and above all the evaluators' marks and notes (P = performed without challenges, S = some challenges, M = major challenges, U = unable to be performed). Be specific to this exercise and this organisation, factual, constructive, never generic. Link findings to the learning objectives. When the evaluation is empty, base the findings on the design and say what to confirm with the participants.
Write in the language requested. Each item is one short sentence (max 25 words). Reply only with a JSON object:
{"key_messages":["3 to 5 items"],"went_well":["3 to 6 items"],"to_improve":["3 to 6 items"],"recommendations":["3 to 6 items, each with an owner and a horizon"],"next_steps":["2 to 4 items"]}`;
      const result = await agentCall((callSignal) => AITextGenerator.generate('slide_debrief', system, JSON.stringify(this.context(project)), true, 4000, { signal: callSignal, strictJSON: true, promptFilter: agentRedact, timeoutMs: SB_AI_TIMEOUT }), signal, SB_AI_TIMEOUT);
      if (appState.scenario !== project) return;
      // Read again: a render during the call normalizes project.slide_debrief into a new object.
      const state = sdState(project);
      let filled = 0;
      SD_TEXT_FIELDS.forEach(([key]) => {
        const items = Array.isArray(result?.[key]) ? result[key].filter((item) => typeof item === 'string' && item.trim()).slice(0, 8) : [];
        if (items.length) { state[key] = items.map((item) => item.trim()).join('\n').slice(0, 4000); filled++; }
      });
      if (!filled) throw new Error(tt('The AI returned no debrief message.', 'L’IA n’a renvoyé aucun message de debrief.', 'Die KI hat keine Debrief-Botschaft zurückgegeben.'));
      state.generated_at = new Date().toISOString();
      saveLocal(false);
      pushToast(tt('Debrief messages written. Review them before downloading the deck.', 'Messages du debrief rédigés. Relisez-les avant de télécharger le deck.', 'Debrief-Botschaften geschrieben. Prüfen Sie sie, bevor Sie den Foliensatz herunterladen.'), 'success');
    } catch (error) {
      if (error?.name === 'AbortError' || signal.aborted) pushToast(tt('Stopped.', 'Arrêté.', 'Gestoppt.'), 'info');
      else { this.error = typeof sbErrorMessage === 'function' ? sbErrorMessage(error) : error.message; pushToast(this.error, 'error'); }
    } finally {
      this.busy = false; this.controller = null;
      App.render();
    }
  }
};

// ── Slide debrief: PowerPoint ───────────────────────────────────────────────
const sdHex = (color, fallback = SD_COLORS.indigo) => { const value = String(color || '').replace('#', ''); return /^[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : /^[0-9a-f]{3}$/i.test(value) ? value.split('').map((c) => c + c).join('').toUpperCase() : fallback; };

/* Text widths for the .pptx layout (cover lines, eyebrow underline, chips), measured with the
   webfonts of the page; an estimate when no canvas is at hand. */
const SdMeasure = {
  ctx: null,
  width(text, font, spacing = 0) {
    const value = String(text || '');
    try {
      this.ctx = this.ctx || document.createElement('canvas').getContext('2d');
      this.ctx.font = font;
      return this.ctx.measureText(value).width + spacing * value.length;
    } catch (_) {
      const size = parseFloat((String(font).match(/([\d.]+)px/) || [])[1]) || 14;
      return value.length * (size * 0.6 + spacing);
    }
  },
  /* How many lines a text takes in a box of this width, wrapped at the words. */
  lines(text, font, width) {
    let lines = 1, line = '';
    String(text || '').split(/\s+/).filter(Boolean).forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (line && this.width(next, font) > width) { lines++; line = word; } else line = next;
    });
    return lines;
  }
};

/* The brand gradient of the cover and end slides, with its waves, as an image: PowerPoint
   slide backgrounds have no radial gradient. */
function sdCoverBackground() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1920; canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    const k = canvas.width / SD_GRID.W;
    ctx.save();
    ctx.translate(0.25 * canvas.width, 0.15 * canvas.height);
    ctx.scale(1.2 * canvas.width, 1.2 * canvas.height);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, '#5226E0'); glow.addColorStop(0.38, '#451DC7'); glow.addColorStop(1, '#2D1380');
    ctx.fillStyle = glow;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    // The inner shadow of the slide edges.
    const edge = 220 * k;
    [[0, 0, canvas.width, edge, 0, 0, 0, edge], [0, canvas.height - edge, canvas.width, edge, 0, canvas.height, 0, canvas.height - edge],
      [0, 0, edge, canvas.height, 0, 0, edge, 0], [canvas.width - edge, 0, edge, canvas.height, canvas.width, 0, canvas.width - edge, 0]].forEach(([x, y, w, h, x0, y0, x1, y1]) => {
      const shade = ctx.createLinearGradient(x0, y0, x1, y1);
      shade.addColorStop(0, 'rgba(8,4,26,0.32)'); shade.addColorStop(1, 'rgba(8,4,26,0)');
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, w, h);
    });
    ctx.save();
    ctx.scale(k, k);
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.5;
    SD_WAVES.forEach(([d, color]) => { ctx.strokeStyle = color; ctx.stroke(new Path2D(d)); });
    ctx.restore();
    return canvas.toDataURL('image/jpeg', 0.92).replace(/^data:/, '');
  } catch (_) {
    return '';
  }
}

async function sdLibraries() {
  if (typeof evLibraries === 'function') await evLibraries(true);
  if (typeof PptxGenJS === 'undefined' && typeof evLoadScript === 'function') await evLoadScript('PptxGenJS', 'js/lib/pptxgen.min.js');
  if (typeof PptxGenJS === 'undefined') throw new Error(tt('The PowerPoint library is not loaded. Reload the page and try again.', 'La bibliothèque PowerPoint n’est pas chargée. Rechargez la page et réessayez.', 'Die PowerPoint-Bibliothek ist nicht geladen. Laden Sie die Seite neu und versuchen Sie es erneut.'));
  // The layout measures its texts with the fonts of the slides.
  if (document.fonts?.load) await Promise.all(['700 20px Poppins', '800 20px Poppins', '700 12px Inter', '400 16px Inter', '600 11px "IBM Plex Mono"'].map((font) => document.fonts.load(font).catch(() => null)));
}

function sdBuildDeck(project) {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
  const labels = sdDeckLabels(project);
  pres.title = sdState(project).title || project.name || labels.exerciseDebrief;
  pres.company = project.client?.name || '';
  const C = SD_COLORS, F = SD_FONTS, G = SD_GRID;
  // The grid is in px of a 1280 x 720 slide: 96 px to an inch, 0.75 pt to a px.
  const inch = (value) => value / 96;
  const pt = (value) => Math.round(value * 0.75 * 10) / 10;
  const run = (value, options = {}) => { const { size, ...rest } = options; return { text: String(value ?? ''), options: size ? { ...rest, fontSize: pt(size) } : rest }; };
  const text = (slide, value, x, y, w, h, options = {}) => {
    const { size = 14, ...rest } = options;
    const runs = Array.isArray(value) ? value.map((part) => (part && typeof part === 'object' ? part : run(part))) : String(value ?? '');
    slide.addText(runs, { x: inch(x), y: inch(y), w: inch(w), h: inch(h), margin: 0, valign: 'top', fontFace: F.body, color: C.ink, fontSize: pt(size), lineSpacingMultiple: 1.1, ...rest });
  };
  const rect = (slide, x, y, w, h, fill, line) => slide.addShape(pres.ShapeType.rect, {
    x: inch(x), y: inch(y), w: inch(w), h: inch(h),
    fill: typeof fill === 'object' ? fill : { color: fill },
    line: line ? (typeof line === 'object' ? line : { color: line, width: 1 }) : { type: 'none' }
  });
  const hline = (slide, x, y, w, color = C.line) => slide.addShape(pres.ShapeType.line, { x: inch(x), y: inch(y), w: inch(w), h: 0, line: { color, width: 0.75 } });
  const card = (slide, x, y, w, h) => { rect(slide, x, y, w, h, C.white, { color: C.line, width: 1 }); rect(slide, x, y, 4, h, C.green); };
  const dark = (slide, x, y, w, h) => { rect(slide, x, y, w, h, C.indigo950); rect(slide, x, y, 5, h, C.green); };
  const label = (slide, value, x, y, w, color = C.indigo) => text(slide, String(value || '').toUpperCase(), x, y, w, 16, { size: 11, fontFace: F.mono, bold: true, color, charSpacing: 1, fit: 'shrink' });
  const eyebrow = (slide, value, y, color) => {
    const caps = String(value || '').toUpperCase();
    const width = Math.min(900, SdMeasure.width(caps, `700 12px ${F.body}`, 12 * 0.14) + 4);
    text(slide, caps, G.X, y, 900, 18, { size: 12, bold: true, color, charSpacing: 1.3 });
    rect(slide, G.X, y + 21, width, 2, C.green);
  };
  const chrome = (slide, index, total, onDark) => {
    rect(slide, G.X - 3, 35.5, 15, 15, onDark ? { color: C.green, transparency: 78 } : C.green50);
    rect(slide, G.X, 38.5, 9, 9, C.green);
    text(slide, 'Wavestone', G.X + 18, 30, 300, 22, { size: 15, fontFace: F.display, bold: true, color: onDark ? C.white : C.indigo700, valign: 'middle' });
    const kicker = sdKicker(project).toUpperCase();
    if (kicker) text(slide, kicker, G.X, 672, 880, 18, { size: 11, fontFace: F.mono, color: onDark ? C.onDarkFaint : C.faint, charSpacing: 1.2, valign: 'middle', fit: 'shrink' });
    text(slide, sdPageNumber(index, total), 1026, 672, 200, 18, { size: 12, fontFace: F.mono, color: onDark ? C.onDarkFaint : C.subtle, align: 'right', valign: 'middle' });
  };
  const listRows = (slide, items, x, y, w, h, style) => {
    // Four rows per column, as in the preview: a marker (time, number or sign) and its text.
    if (!items.length) { text(slide, '-', x + 22, y, w - 40, 24, { size: 15, color: style.textColor || C.muted }); return; }
    const rowH = h / 4;
    items.forEach((item, index) => {
      const top = y + index * rowH;
      if (index) hline(slide, x + 22, top, w - 40, style.lineColor || C.line);
      text(slide, item.marker, x + 22, top + 10, style.markerW, 20, { size: style.markerSize || 12, fontFace: F.mono, bold: true, color: style.markerColor || C.indigo });
      text(slide, item.text, x + 22 + style.markerW, top + 10, w - 40 - style.markerW, rowH - 16, { size: style.size || 14, color: style.textColor || C.ink, lineSpacingMultiple: 1.15, fit: 'shrink' });
    });
  };

  const slides = sdSlides(project);
  const background = slides.some(sdIsDark) ? sdCoverBackground() : '';
  slides.forEach((data, index) => {
    const slide = pres.addSlide();
    if (sdIsDark(data)) {
      slide.background = background ? { data: background } : { color: C.indigo800 };
      chrome(slide, index, slides.length, true);
      // The cover block is centred on the slide; its height comes from the measured lines.
      const title = sdClip(data.title, SD_COVER_MAX), size = sdCoverSize(data.title), width = 1000;
      const titleH = SdMeasure.lines(title, `700 ${size}px ${F.display}`, width - 20) * size * 1.12;
      const subtitle = sdClip(data.subtitle || '', 160);
      const subH = subtitle ? SdMeasure.lines(subtitle, `400 19px ${F.body}`, 760 - 10) * 19 * 1.5 : 0;
      const chips = data.chips || [];
      const total = 23 + 18 + titleH + (subH ? 22 + subH : 0) + (chips.length ? 34 + 26 : 0);
      let y = Math.max(96, (G.H - total) / 2);
      if (data.eyebrow) eyebrow(slide, data.eyebrow, y, C.white);
      y += 23 + 18;
      const [lead, word] = sdAccentSplit(title);
      text(slide, [run(lead), run(word, { color: C.green })], G.X, y, width, titleH + 4, { size, fontFace: F.display, bold: true, color: C.white, lineSpacingMultiple: 0.98, charSpacing: -0.6, fit: 'shrink' });
      y += titleH + 22;
      if (subH) { text(slide, subtitle, G.X, y, 760, subH + 4, { size: 19, color: C.onDarkSoft, lineSpacingMultiple: 1.25, fit: 'shrink' }); y += subH + 34; }
      let x = G.X;
      chips.forEach((chip) => {
        const w = SdMeasure.width(chip, `600 11px ${F.mono}`, 11 * 0.03) + 24;
        if (x + w > G.X + width) return;
        rect(slide, x, y, w, 26, { color: C.white, transparency: 92 }, { color: C.white, transparency: 84, width: 0.75 });
        text(slide, chip, x, y, w, 26, { size: 11, fontFace: F.mono, bold: true, color: C.onDarkText, align: 'center', valign: 'middle' });
        x += w + 10;
      });
      return;
    }
    slide.background = { color: C.white };
    chrome(slide, index, slides.length, false);
    eyebrow(slide, data.eyebrow || '', 90, C.indigo700);
    text(slide, sdClip(data.title, SD_HEAD_MAX), G.X, 122, G.CW, 52, { size: sdHeadSize(data.title), fontFace: F.display, bold: true, color: C.indigo700, lineSpacingMultiple: 0.95, charSpacing: -0.4, fit: 'shrink' });
    rect(slide, G.X, 182, 54, 4, C.green);
    const top = G.top, bottom = G.bottom, left = G.X, right = G.col2, col = G.col;

    if (data.kind === 'overview') {
      const kw = (G.CW - 4 * 14) / 5;
      data.kpis.forEach(([value, name], i) => {
        const x = left + i * (kw + 14);
        rect(slide, x, top, kw, 92, C.white, { color: C.line, width: 1 });
        text(slide, String(value), x + 18, top + 16, kw - 36, 34, { size: 30, fontFace: F.display, bold: true, color: C.indigo, fit: 'shrink' });
        text(slide, name, x + 18, top + 58, kw - 36, 20, { size: 13, color: C.muted, fit: 'shrink' });
      });
      const y = top + 92 + 20, h = bottom - y;
      dark(slide, left, y, col, h);
      label(slide, labels.scenario, left + 29, y + 22, col - 53, C.green300);
      text(slide, data.scenario || labels.noScenario, left + 29, y + 48, col - 53, h - 66, { size: 16, color: C.onDarkText, lineSpacingMultiple: 1.3, fit: 'shrink' });
      label(slide, labels.objectives, right, y, col);
      if (!data.objectives.length) text(slide, labels.noneYet, right, y + 26, col, 24, { size: 15, color: C.muted });
      const ow = (col - 12) / 2, oh = (h - 24 - 12) / 2;
      data.objectives.forEach((line, i) => {
        const x = right + (i % 2) * (ow + 12), oy = y + 24 + Math.floor(i / 2) * (oh + 12);
        card(slide, x, oy, ow, oh);
        text(slide, String(i + 1).padStart(2, '0'), x + 20, oy + 16, 60, 16, { size: 11, fontFace: F.mono, bold: true, color: C.indigo });
        text(slide, line, x + 20, oy + 38, ow - 36, oh - 50, { size: 14, lineSpacingMultiple: 1.2, fit: 'shrink' });
      });
    } else if (data.kind === 'timeline') {
      const px = (minute) => left + G.CW * minute / data.duration;
      const y = SD_TL.bar, h = SD_TL.barH;
      data.phases.forEach((phase) => {
        const x = px(phase.start), w = Math.max(4, px(phase.end) - x - 2);
        rect(slide, x, y, w, h, sdHex(phase.color));
        if (w > 30) text(slide, [run(phase.title, { bold: true, fontFace: F.display, size: 13, breakLine: true }), run(`${phase.injects} ${labels.injectsLower}`, { size: 11 })], x + 10, y + 12, w - 20, h - 22, { color: C.white, valign: 'middle', fit: 'shrink' });
        if (w > 64 || phase.start === 0) text(slide, sbFormatOffset(phase.start), x, SD_TL.scale, 70, 16, { size: 11, fontFace: F.mono, color: C.subtle });
      });
      text(slide, sbFormatOffset(data.duration), left + G.CW - 70, SD_TL.scale, 70, 16, { size: 11, fontFace: F.mono, color: C.subtle, align: 'right' });
      const lw = G.CW * SD_TL_LABEL / 100;
      data.events.forEach((event, i) => {
        const tick = sdTimelineTick(event.at, data.duration), row = sdTimelineRow(i);
        const bx = left + G.CW * tick.left / 100 - lw / 2, tx = bx + lw * tick.tick / 100;
        slide.addShape(pres.ShapeType.line, { x: inch(tx), y: inch(row.up ? row.y + SD_TL.label : y + h), w: 0, h: inch(row.tick), line: { color: C.faint, width: 1, dashType: 'dash' } });
        text(slide, [run(sbFormatOffset(event.at), { bold: true, fontFace: F.mono, size: 11, color: C.indigo, breakLine: true }), run(event.text, { size: 11.5 })], bx, row.y, lw, SD_TL.label, { align: 'center', valign: row.up ? 'bottom' : 'top', lineSpacingMultiple: 1.05, fit: 'shrink' });
      });
    } else if (data.kind === 'phase') {
      const tagText = `${data.stressLabel || 'Stress'} · ${data.stress}`.toUpperCase();
      const tagW = SdMeasure.width(tagText, `600 10px ${F.mono}`, 10 * 0.06) + 20;
      rect(slide, G.X + G.CW - tagW, 88, tagW, 22, sdHex(data.color));
      text(slide, tagText, G.X + G.CW - tagW, 88, tagW, 22, { size: 10, fontFace: F.mono, bold: true, color: C.white, align: 'center', valign: 'middle', charSpacing: 0.5 });
      let y = top;
      if (data.what) { text(slide, data.what, left, y, G.CW, 48, { size: 16, color: C.muted, lineSpacingMultiple: 1.25, fit: 'shrink' }); y += 58; }
      const h = bottom - y;
      [[labels.mainEvents, data.events.map((event) => ({ marker: event.at, text: event.text }))],
        [labels.injects, data.injects.map((inject) => ({ marker: inject.at, text: [run(inject.title), ...(inject.to ? [run(`  → ${inject.to}`, { color: C.muted })] : [])] }))]].forEach(([name, items], i) => {
        const x = i ? right : left;
        card(slide, x, y, col, h);
        label(slide, name, x + 22, y + 18, col - 40);
        listRows(slide, items, x, y + 46, col, h - 58, { markerW: 64, size: 13.5 });
      });
    } else if (data.kind === 'story') {
      const h = (bottom - top - 14) / 2;
      data.items.forEach((item, i) => {
        // Two columns, read row by row as in the preview.
        const x = i % 2 ? right : left, y = top + Math.floor(i / 2) * (h + 14);
        card(slide, x, y, col, h);
        label(slide, item.when || '', x + 22, y + 18, col - 40);
        text(slide, item.title, x + 22, y + 42, col - 40, 46, { size: 17, fontFace: F.display, bold: true, lineSpacingMultiple: 1.05, fit: 'shrink' });
        text(slide, item.text, x + 22, y + 94, col - 40, h - 108, { size: 14, color: C.muted, lineSpacingMultiple: 1.25, fit: 'shrink' });
      });
    } else if (data.kind === 'evaluation') {
      const border = [{ type: 'none' }, { type: 'none' }, { type: 'solid', color: C.line, pt: 1 }, { type: 'none' }];
      const head = [labels.cell, labels.injects, 'P', 'S', 'M', 'U', labels.rated].map((value, i) => ({ text: value.toUpperCase(), options: { bold: true, fontFace: F.mono, fontSize: pt(11), color: i >= 2 && i <= 5 ? C[value] : C.muted, fill: { color: C.panel }, align: i ? 'center' : 'left', border } }));
      const rows = data.rows.map((row) => [
        { text: [run('■  ', { color: sdHex(row.color, C.indigo) }), run(row.name, { bold: true })], options: { border } },
        { text: String(row.injects), options: { align: 'center', border } },
        ...['P', 'S', 'M', 'U'].map((code) => ({ text: String(row.tally.counts[code]), options: { align: 'center', bold: row.tally.counts[code] > 0, color: row.tally.counts[code] > 0 ? C[code] : C.faint, border } })),
        { text: `${row.tally.rated}/${row.tally.total}`, options: { align: 'center', fontFace: F.mono, color: C.muted, border } }
      ]);
      slide.addTable([head, ...rows], { x: inch(left), y: inch(top), w: inch(G.CW), colW: [444, 125, 105, 105, 105, 105, 183].map(inch), rowH: [inch(38), ...rows.map(() => inch(42))], fontFace: F.body, fontSize: pt(14), color: C.ink, valign: 'middle', margin: [2, 8, 2, 12] });
      text(slide, labels.legend, left, top + 38 + rows.length * 42 + 16, G.CW, 36, { size: 12, color: C.muted, fit: 'shrink' });
    } else if (data.kind === 'cells') {
      const cols = Math.max(1, data.cells.length), cw = (G.CW - (cols - 1) * 20) / cols, h = bottom - top;
      data.cells.forEach((cell, i) => {
        const x = left + i * (cw + 20);
        card(slide, x, top, cw, h);
        rect(slide, x + 24, top + 26, 10, 10, sdHex(cell.color, C.indigo));
        text(slide, cell.name, x + 42, top + 18, cw - 62, 26, { size: 16, fontFace: F.display, bold: true, valign: 'middle', fit: 'shrink' });
        const lines = [];
        const block = (name, items, color, marker) => {
          if (!items.length) return;
          lines.push(run(String(name).toUpperCase(), { size: 10.5, fontFace: F.mono, bold: true, color, charSpacing: 0.8, breakLine: true, paraSpaceBefore: lines.length ? 10 : 0, paraSpaceAfter: 4 }));
          items.forEach((item) => { lines.push(run(`${marker}  `, { bold: true, color, size: 13.5 })); lines.push(run(item, { size: 13.5, breakLine: true, paraSpaceAfter: 4 })); });
        };
        block(data.strengthsLabel || '+', cell.strengths, C.success, '+');
        block(data.improvementsLabel || '-', cell.improvements, C.warning, '→');
        text(slide, lines, x + 24, top + 58, cw - 44, h - 74, { lineSpacingMultiple: 1.15, fit: 'shrink' });
      });
    } else if (data.kind === 'bullets') {
      data.items.forEach((item, i) => {
        const y = top + i * (76 + 12);
        card(slide, left, y, G.CW, 76);
        text(slide, String(i + 1).padStart(2, '0'), left + 24, y, 56, 76, { size: 24, fontFace: F.display, bold: true, color: C.indigo, valign: 'middle' });
        text(slide, item, left + 84, y + 6, G.CW - 108, 64, { size: 17, bold: true, valign: 'middle', lineSpacingMultiple: 1.15, fit: 'shrink' });
      });
    } else if (data.kind === 'columns') {
      const h = bottom - top;
      [data.left, data.right].forEach((list, i) => {
        const x = i ? right : left, style = SD_LIST_STYLE[list.key] || { marker: '•', color: C.indigo };
        if (style.dark) dark(slide, x, top, col, h); else card(slide, x, top, col, h);
        label(slide, list.label, x + 22, top + 18, col - 40, style.dark ? C.green300 : style.color);
        listRows(slide, list.items.map((item, n) => ({ marker: style.numbered ? String(n + 1).padStart(2, '0') : style.marker, text: item })), x, top + 48, col, h - 60,
          { markerW: 36, markerSize: 14, size: 15, markerColor: style.color, textColor: style.dark ? C.onDarkText : C.ink, lineColor: style.dark ? '3A3550' : C.line });
      });
    }
  });
  return pres;
}

async function sdDownload(project) {
  appState.ui.actionLoading = { ...(appState.ui.actionLoading || {}), 'sd-download': true };
  App.render();
  try {
    await sdLibraries();
    const blob = await sdBuildDeck(project).write({ outputType: 'blob' });
    const name = typeof evFileName === 'function' ? evFileName(sdState(project).title || project.name || 'exercise') : 'exercise';
    (typeof evSave === 'function' ? evSave : downloadBlob)(blob, `debrief-${name}.pptx`);
    pushToast(tt('Debrief deck downloaded.', 'Deck de debrief téléchargé.', 'Debrief-Foliensatz heruntergeladen.'), 'success');
  } catch (error) {
    if (typeof CrisisError !== 'undefined') CrisisError.toast(error, { operation: 'Build the debrief deck' });
    else pushToast(error.message || String(error), 'error');
  } finally {
    appState.ui.actionLoading = { ...(appState.ui.actionLoading || {}), 'sd-download': false };
    App.render();
  }
}

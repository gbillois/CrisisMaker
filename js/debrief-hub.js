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
  scenario: 280, objectives: 4, objectiveText: 64,
  timelineEvents: 12, timelineText: 48,
  evaluationRows: 8, cells: 3, cellItems: 2, cellText: 56,
  bulletItems: 5, bulletText: 120, columnItems: 4, columnText: 90
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
  const slides = [{ kind: 'title', title, subtitle: state.subtitle || labels.exerciseDebrief, meta: [project.client?.name, date].filter(Boolean).join(' · ') }];
  const on = state.sections;
  if (on.overview) {
    const players = cells.reduce((sum, cell) => sum + (cell.players || []).length, 0) || Number(project.exercise?.players_count) || 0;
    slides.push({
      kind: 'overview', title: t('The exercise at a glance', 'L’exercice en un coup d’œil', 'Die Übung auf einen Blick'),
      kpis: [[sbFormatDuration(duration), t('Duration', 'Durée', 'Dauer')], [phases.length, t('Phases', 'Phases', 'Phasen')], [model.injects.length, labels.injects], [cells.length, t('Cells', 'Cellules', 'Zellen')], [players, t('Players', 'Joueurs', 'Spieler')]],
      scenario: sdClip(project.scenario?.summary || storyboard?.meta?.brief || '', SD_FIT.scenario),
      objectives: sdLines(project.scenario?.learning_objectives).slice(0, SD_FIT.objectives).map((line) => sdClip(line, SD_FIT.objectiveText))
    });
  }
  if (on.timeline && phases.length) {
    slides.push({
      kind: 'timeline', title: t('Timeline of the exercise', 'Chronologie de l’exercice', 'Zeitlicher Ablauf der Übung'), duration,
      phases: phases.map((block) => ({ title: block.title, start: block.start_minutes, end: sbBlockEnd(block), color: sbBlockColor(block), injects: model.injects.filter((inject) => inject.phase_id === block.id).length })),
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
          kind: 'phase', title: sdContinued(title, page, lang), continued: page > 0, color: sbBlockColor(block),
          span: `${sbFormatOffset(block.start_minutes)} ${t('to', 'à', 'bis')} ${sbFormatOffset(sbBlockEnd(block))}`,
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
    sdPages(items, SD_FIT.storyItems).forEach((page, index) => slides.push({ kind: 'story', title: sdContinued(t('What really happened', 'Ce qui s’est réellement passé', 'Was wirklich geschah'), index, lang), continued: index > 0, items: page }));
  }
  if (on.evaluation && cells.length && typeof evTally === 'function') {
    const rows = cells.map((cell) => ({ name: cell.name, color: cell.color, tally: evTally(project, cell), injects: evReceivedInjects(project, cell).length }));
    sdPages(rows, SD_FIT.evaluationRows).forEach((page, index) => slides.push({ kind: 'evaluation', title: sdContinued(t('Evaluation by cell', 'Évaluation par cellule', 'Bewertung nach Zelle'), index, lang), continued: index > 0, rows: page }));
    // Per cell, what the evaluators wrote: criteria rated M or U, strengths, improvements.
    const notes = cells.map((cell) => {
      const sheet = evSheet(project, cell);
      const weak = sheet.criteria.filter((criterion) => ['M', 'U'].includes(criterion.rating)).map((criterion) => `${criterion.rating} · ${criterion.text}`);
      const clip = (lines) => lines.slice(0, SD_FIT.cellItems).map((line) => sdClip(line, SD_FIT.cellText));
      return { name: cell.name, color: cell.color, strengths: clip(sdLines(sheet.strengths)), improvements: clip([...sdLines(sheet.improvements), ...weak]) };
    }).filter((entry) => entry.strengths.length || entry.improvements.length);
    if (notes.length) sdPages(notes, SD_FIT.cells).forEach((page, index) => slides.push({ kind: 'cells', title: sdContinued(t('What the evaluators observed', 'Ce que les évaluateurs ont observé', 'Was die Bewerter beobachtet haben'), index, lang), continued: index > 0, cells: page }));
  }
  if (on.messages) {
    const lists = SD_TEXT_FIELDS.map(([key]) => ({ key, label: sdFieldText(key, lang).label, items: sdLines(state[key]).slice(0, 12).map((line) => sdClip(line, key === 'key_messages' ? SD_FIT.bulletText : SD_FIT.columnText)) }));
    const byKey = Object.fromEntries(lists.map((list) => [list.key, list]));
    if (byKey.key_messages.items.length) sdPages(byKey.key_messages.items, SD_FIT.bulletItems).forEach((items, index) => slides.push({ kind: 'bullets', title: sdContinued(sdFieldText('key_messages', lang).label, index, lang), continued: index > 0, items }));
    const columns = (title, left, right) => {
      if (!left.items.length && !right.items.length) return;
      const lefts = sdPages(left.items, SD_FIT.columnItems), rights = sdPages(right.items, SD_FIT.columnItems);
      for (let page = 0; page < Math.max(lefts.length, rights.length); page++) {
        slides.push({ kind: 'columns', title: sdContinued(title, page, lang), continued: page > 0, left: { ...left, items: lefts[page] || [] }, right: { ...right, items: rights[page] || [] } });
      }
    };
    columns(t('Strengths and areas for improvement', 'Points forts et axes d’amélioration', 'Stärken und Verbesserungsbereiche'), byKey.went_well, byKey.to_improve);
    columns(t('Recommendations and next steps', 'Recommandations et prochaines étapes', 'Empfehlungen und nächste Schritte'), byKey.recommendations, byKey.next_steps);
  }
  slides.push({ kind: 'end', title: t('Thank you', 'Merci', 'Vielen Dank'), subtitle: t('Questions and discussion', 'Questions et échanges', 'Fragen und Diskussion') });
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
      <div class="sd-grid">${slides.map((slide, index) => `<figure class="sd-slide-wrap"><div class="sd-slide sd-${slide.kind}">${sdSlideHtml(slide, labels)}</div><figcaption>${index + 1}. ${escapeHtml(slide.title)}</figcaption></figure>`).join('')}</div>
    </article>
  </section>`;
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

function sdSlideHtml(slide, labels = sdDeckLabels()) {
  const h = (text) => `<h4>${escapeHtml(text)}</h4>`;
  switch (slide.kind) {
    case 'title': return `<div class="sd-title-block"><span class="sd-eyebrow">${escapeHtml(labels.crisisExercise)}</span><h3>${escapeHtml(slide.title)}</h3><p>${escapeHtml(slide.subtitle)}</p><small>${escapeHtml(slide.meta)}</small></div>`;
    case 'end': return `<div class="sd-title-block"><h3>${escapeHtml(slide.title)}</h3><p>${escapeHtml(slide.subtitle)}</p></div>`;
    case 'overview': return `${h(slide.title)}<div class="sd-kpis">${slide.kpis.map(([value, label]) => `<span><b>${escapeHtml(String(value))}</b>${escapeHtml(label)}</span>`).join('')}</div>
      <div class="sd-two"><div><em>${escapeHtml(labels.scenario)}</em><p>${escapeHtml(slide.scenario || labels.noScenario)}</p></div><div><em>${escapeHtml(labels.objectives)}</em>${slide.objectives.length ? sdList(slide.objectives) : `<p>${escapeHtml(labels.noneYet)}</p>`}</div></div>`;
    case 'timeline': return `${h(slide.title)}<div class="sd-tl">
      <div class="sd-tl-bar">${slide.phases.map((phase) => `<span style="left:${(100 * phase.start / slide.duration).toFixed(2)}%;width:${(100 * (phase.end - phase.start) / slide.duration).toFixed(2)}%;--phase:${escapeAttribute(phase.color)}"><b>${escapeHtml(phase.title)}</b><i>${phase.injects} ${escapeHtml(labels.injectsLower)}</i></span>`).join('')}</div>
      <div class="sd-tl-scale"><span>${escapeHtml(sbFormatOffset(0))}</span><span>${escapeHtml(sbFormatOffset(slide.duration))}</span></div>
      <div class="sd-tl-events">${slide.events.map((event, index) => { const tick = sdTimelineTick(event.at, slide.duration); return `<span class="row-${index % 4}" style="left:${tick.left.toFixed(2)}%;--tick:${tick.tick.toFixed(2)}%"><b>${escapeHtml(sbFormatOffset(event.at))}</b>${escapeHtml(event.text)}</span>`; }).join('')}</div>
    </div>`;
    case 'phase': return `<div class="sd-phase-band" style="--phase:${escapeAttribute(slide.color)}"><span>${escapeHtml(slide.span)} · ${escapeHtml(slide.stress)}</span></div>${h(slide.title)}
      ${slide.what ? `<p class="sd-what">${escapeHtml(slide.what)}</p>` : ''}
      <div class="sd-two"><div><em>${escapeHtml(labels.mainEvents)}</em>${slide.events.length ? `<ul>${slide.events.map((event) => `<li><b>${escapeHtml(event.at)}</b> ${escapeHtml(event.text)}</li>`).join('')}</ul>` : '<p>-</p>'}</div>
      <div><em>${escapeHtml(labels.injects)}</em>${slide.injects.length ? `<ul>${slide.injects.map((inject) => `<li><b>${escapeHtml(inject.at)}</b> ${escapeHtml(inject.title)}${inject.to ? ` <i>→ ${escapeHtml(inject.to)}</i>` : ''}</li>`).join('')}</ul>` : '<p>-</p>'}</div></div>`;
    case 'story': return `${h(slide.title)}<ol class="sd-story">${slide.items.map((item) => `<li><b>${escapeHtml(item.when || '')}</b><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.text)}</span></li>`).join('')}</ol>`;
    case 'evaluation': return `${h(slide.title)}<table class="sd-eval"><thead><tr><th>${escapeHtml(labels.cell)}</th><th>${escapeHtml(labels.injects)}</th>${['P', 'S', 'M', 'U'].map((code) => `<th class="is-${code}">${code}</th>`).join('')}<th>${escapeHtml(labels.rated)}</th></tr></thead><tbody>${slide.rows.map((row) => `<tr><td><span class="cell-dot" style="background:${escapeAttribute(row.color)}"></span>${escapeHtml(row.name)}</td><td>${row.injects}</td>${['P', 'S', 'M', 'U'].map((code) => `<td class="is-${code}">${row.tally.counts[code]}</td>`).join('')}<td>${row.tally.rated}/${row.tally.total}</td></tr>`).join('')}</tbody></table>`;
    case 'cells': return `${h(slide.title)}<div class="sd-cells">${slide.cells.map((cell) => `<div style="--cell:${escapeAttribute(cell.color)}"><strong>${escapeHtml(cell.name)}</strong>${cell.strengths.length ? `<em>+</em>${sdList(cell.strengths)}` : ''}${cell.improvements.length ? `<em>-</em>${sdList(cell.improvements)}` : ''}</div>`).join('')}</div>`;
    case 'bullets': return `${h(slide.title)}${sdList(slide.items, 'sd-big')}`;
    case 'columns': return `${h(slide.title)}<div class="sd-two">${[slide.left, slide.right].map((list) => `<div><em>${escapeHtml(list.label)}</em>${list.items.length ? sdList(list.items) : '<p>-</p>'}</div>`).join('')}</div>`;
    default: return h(slide.title);
  }
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
  grid.innerHTML = slides.map((slide, index) => `<figure class="sd-slide-wrap"><div class="sd-slide sd-${slide.kind}">${sdSlideHtml(slide, labels)}</div><figcaption>${index + 1}. ${escapeHtml(slide.title)}</figcaption></figure>`).join('');
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
const SD_COLORS = { ink: '1D1934', muted: '6B6580', primary: '451DC7', accent: '04F06A', line: 'E6E4EE', panel: 'F5F4F9', P: '146C2E', S: '4D6410', M: '8A4B08', U: '9B1C1C' };
const sdHex = (color, fallback = SD_COLORS.primary) => { const value = String(color || '').replace('#', ''); return /^[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : /^[0-9a-f]{3}$/i.test(value) ? value.split('').map((c) => c + c).join('').toUpperCase() : fallback; };

async function sdLibraries() {
  if (typeof evLibraries === 'function') await evLibraries(true);
  if (typeof PptxGenJS === 'undefined' && typeof evLoadScript === 'function') await evLoadScript('PptxGenJS', 'js/lib/pptxgen.min.js');
  if (typeof PptxGenJS === 'undefined') throw new Error(tt('The PowerPoint library is not loaded. Reload the page and try again.', 'La bibliothèque PowerPoint n’est pas chargée. Rechargez la page et réessayez.', 'Die PowerPoint-Bibliothek ist nicht geladen. Laden Sie die Seite neu und versuchen Sie es erneut.'));
}

function sdBuildDeck(project) {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
  const labels = sdDeckLabels(project);
  pres.title = sdState(project).title || project.name || labels.exerciseDebrief;
  pres.company = project.client?.name || '';
  const W = 13.33, M = 0.6, font = 'Arial';
  const text = (slide, value, options) => slide.addText(value, { fontFace: font, color: SD_COLORS.ink, valign: 'top', margin: 0, ...options });
  const heading = (slide, value) => {
    slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.12, fill: { color: SD_COLORS.primary }, line: { color: SD_COLORS.primary } });
    text(slide, value, { x: M, y: 0.4, w: W - 2 * M, h: 0.8, fontSize: 26, bold: true, valign: 'middle' });
  };
  const bullets = (items, size = 14) => items.map((item) => ({ text: item, options: { bullet: { indent: 14 }, paraSpaceAfter: 6, fontSize: size } }));
  const label = (slide, value, x, y, w) => text(slide, value.toUpperCase(), { x, y, w, h: 0.3, fontSize: 11, bold: true, color: SD_COLORS.primary, charSpacing: 1 });
  const footer = (slide, index) => text(slide, `${sdState(project).title || project.name || ''} · ${index}`, { x: M, y: 7.05, w: W - 2 * M, h: 0.3, fontSize: 9, color: SD_COLORS.muted, align: 'right' });

  sdSlides(project).forEach((data, index) => {
    const slide = pres.addSlide();
    slide.background = { color: 'FFFFFF' };
    if (data.kind === 'title' || data.kind === 'end') {
      slide.background = { color: SD_COLORS.ink };
      slide.addShape(pres.ShapeType.rect, { x: M, y: 2.3, w: 0.12, h: 2.4, fill: { color: SD_COLORS.accent }, line: { color: SD_COLORS.accent } });
      if (data.kind === 'title') text(slide, labels.crisisExercise.toUpperCase(), { x: M + 0.4, y: 2.2, w: 11, h: 0.4, fontSize: 13, bold: true, color: SD_COLORS.accent, charSpacing: 2 });
      text(slide, data.title, { x: M + 0.4, y: 2.65, w: 11.5, h: 1.4, fontSize: 38, bold: true, color: 'FFFFFF', valign: 'middle', fit: 'shrink' });
      text(slide, data.subtitle, { x: M + 0.4, y: 4.05, w: 11.5, h: 0.6, fontSize: 20, color: 'D9D6E6' });
      if (data.meta) text(slide, data.meta, { x: M + 0.4, y: 6.4, w: 11.5, h: 0.4, fontSize: 13, color: 'B4AFC8' });
      return;
    }
    heading(slide, data.title);
    footer(slide, index + 1);
    if (data.kind === 'overview') {
      const kw = (W - 2 * M - 4 * 0.2) / 5;
      data.kpis.forEach(([value, name], i) => {
        const x = M + i * (kw + 0.2);
        slide.addShape(pres.ShapeType.rect, { x, y: 1.4, w: kw, h: 1.1, fill: { color: SD_COLORS.ink }, line: { color: SD_COLORS.ink } });
        text(slide, String(value), { x: x + 0.2, y: 1.5, w: kw - 0.4, h: 0.55, fontSize: 24, bold: true, color: 'FFFFFF' });
        text(slide, name.toUpperCase(), { x: x + 0.2, y: 2.05, w: kw - 0.4, h: 0.3, fontSize: 10, bold: true, color: 'B4AFC8' });
      });
      label(slide, labels.scenario, M, 2.9, 5.8);
      text(slide, data.scenario || labels.noScenario, { x: M, y: 3.25, w: 5.8, h: 3.6, fontSize: 13, fit: 'shrink' });
      label(slide, labels.objectives, 7, 2.9, 5.7);
      text(slide, data.objectives.length ? bullets(data.objectives, 13) : labels.noneYet, { x: 7, y: 3.25, w: 5.7, h: 3.6, fit: 'shrink' });
    } else if (data.kind === 'timeline') {
      const x0 = M, width = W - 2 * M, y = 3.1, h = 0.9;
      const px = (minute) => x0 + width * minute / data.duration;
      data.phases.forEach((phase) => {
        const x = px(phase.start), w = Math.max(0.05, px(phase.end) - x - 0.03);
        slide.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color: sdHex(phase.color) }, line: { color: 'FFFFFF', width: 1 } });
        text(slide, [{ text: phase.title, options: { bold: true, fontSize: 11, color: 'FFFFFF', breakLine: true } }, { text: `${phase.injects} ${labels.injectsLower}`, options: { fontSize: 9, color: 'FFFFFF' } }], { x: x + 0.06, y: y + 0.08, w: Math.max(0.2, w - 0.12), h: h - 0.16, fit: 'shrink' });
        text(slide, sbFormatOffset(phase.start), { x: x, y: y + h + 0.05, w: 1, h: 0.25, fontSize: 9, color: SD_COLORS.muted });
      });
      text(slide, sbFormatOffset(data.duration), { x: x0 + width - 1, y: y + h + 0.05, w: 1, h: 0.25, fontSize: 9, color: SD_COLORS.muted, align: 'right' });
      data.events.forEach((event, i) => {
        const x = px(event.at), up = i % 2 === 0;
        const boxW = 2.1, bx = Math.min(W - M - boxW, Math.max(M, x - boxW / 2));
        slide.addShape(pres.ShapeType.line, { x, y: up ? 2.35 : y + h + 0.3, w: 0, h: up ? y - 2.35 : 0.55, line: { color: SD_COLORS.ink, width: 1, dashType: 'dash' } });
        text(slide, [{ text: sbFormatOffset(event.at), options: { bold: true, fontSize: 9, color: SD_COLORS.primary, breakLine: true } }, { text: event.text, options: { fontSize: 9 } }],
          { x: bx, y: up ? (i % 4 === 0 ? 1.35 : 1.75) : (i % 4 === 1 ? 4.75 : 5.55), w: boxW, h: 0.62, fit: 'shrink' });
      });
    } else if (data.kind === 'phase') {
      slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.12, fill: { color: sdHex(data.color) }, line: { color: sdHex(data.color) } });
      text(slide, `${data.span} · ${data.stress}`, { x: M, y: 1.15, w: 8, h: 0.3, fontSize: 12, bold: true, color: sdHex(data.color) });
      if (data.what) text(slide, data.what, { x: M, y: 1.55, w: W - 2 * M, h: 1.1, fontSize: 14, italic: true, color: SD_COLORS.muted, fit: 'shrink' });
      label(slide, labels.mainEvents, M, 2.85, 5.8);
      text(slide, data.events.length ? data.events.map((event) => ({ text: `${event.at}  ${event.text}`, options: { bullet: { indent: 14 }, paraSpaceAfter: 6, fontSize: 13 } })) : '-', { x: M, y: 3.2, w: 5.8, h: 3.7, fit: 'shrink' });
      label(slide, labels.injects, 7, 2.85, 5.7);
      const lines = data.injects.map((inject) => ({ text: `${inject.at}  ${inject.title}${inject.to ? ` → ${inject.to}` : ''}`, options: { bullet: { indent: 14 }, paraSpaceAfter: 4, fontSize: 12 } }));
      text(slide, lines.length ? lines : '-', { x: 7, y: 3.2, w: 5.7, h: 3.7, fit: 'shrink' });
    } else if (data.kind === 'story') {
      data.items.forEach((item, i) => {
        // Two columns, read row by row as in the preview.
        const col = i % 2, row = Math.floor(i / 2), x = M + col * 6.2, y = 1.5 + row * 2.6;
        slide.addShape(pres.ShapeType.rect, { x, y, w: 0.08, h: 2.2, fill: { color: SD_COLORS.primary }, line: { color: SD_COLORS.primary } });
        text(slide, [{ text: item.when || '', options: { bold: true, fontSize: 12, color: SD_COLORS.primary, breakLine: true } }, { text: item.title, options: { bold: true, fontSize: 16, breakLine: true, paraSpaceAfter: 4 } }, { text: item.text, options: { fontSize: 13, color: SD_COLORS.muted } }], { x: x + 0.25, y, w: 5.7, h: 2.2, fit: 'shrink' });
      });
    } else if (data.kind === 'evaluation') {
      const head = [labels.cell, labels.injects, 'P', 'S', 'M', 'U', labels.rated].map((value, i) => ({ text: value, options: { bold: true, color: i >= 2 && i <= 5 ? SD_COLORS[value] : SD_COLORS.muted, fill: { color: SD_COLORS.panel } } }));
      const rows = data.rows.map((row) => [
        { text: row.name, options: { bold: true } }, String(row.injects),
        ...['P', 'S', 'M', 'U'].map((code) => ({ text: String(row.tally.counts[code]), options: { bold: row.tally.counts[code] > 0, color: SD_COLORS[code] } })),
        `${row.tally.rated}/${row.tally.total}`
      ]);
      slide.addTable([head, ...rows], { x: M, y: 1.5, w: W - 2 * M, colW: [4.63, 1.3, 1.1, 1.1, 1.1, 1.1, 1.8], fontFace: font, fontSize: 13, color: SD_COLORS.ink, border: { type: 'solid', color: SD_COLORS.line, pt: 1 }, rowH: 0.45, valign: 'middle' });
      text(slide, labels.legend, { x: M, y: 6.6, w: W - 2 * M, h: 0.3, fontSize: 10, color: SD_COLORS.muted });
    } else if (data.kind === 'cells') {
      const cols = Math.max(1, data.cells.length), cw = (W - 2 * M - (cols - 1) * 0.25) / cols, ch = 5.3;
      data.cells.forEach((cell, i) => {
        const x = M + (i % cols) * (cw + 0.25), y = 1.4 + Math.floor(i / cols) * (ch + 0.2);
        slide.addShape(pres.ShapeType.rect, { x, y, w: cw, h: ch, fill: { color: SD_COLORS.panel }, line: { color: sdHex(cell.color), width: 2 } });
        const lines = [{ text: cell.name, options: { bold: true, fontSize: 13, breakLine: true, paraSpaceAfter: 6 } }];
        cell.strengths.forEach((item) => lines.push({ text: `+ ${item}`, options: { fontSize: 11, color: SD_COLORS.P, breakLine: true, paraSpaceAfter: 3 } }));
        cell.improvements.forEach((item) => lines.push({ text: `- ${item}`, options: { fontSize: 11, color: SD_COLORS.U, breakLine: true, paraSpaceAfter: 3 } }));
        text(slide, lines, { x: x + 0.15, y: y + 0.12, w: cw - 0.3, h: ch - 0.24, fit: 'shrink' });
      });
    } else if (data.kind === 'bullets') {
      text(slide, bullets(data.items, 20), { x: M, y: 1.5, w: W - 2 * M, h: 5.3, fit: 'shrink' });
    } else if (data.kind === 'columns') {
      [[data.left, M], [data.right, 7]].forEach(([list, x]) => {
        label(slide, list.label, x, 1.45, 5.7);
        text(slide, list.items.length ? bullets(list.items, 16) : '-', { x, y: 1.85, w: 5.7, h: 5, fit: 'shrink' });
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

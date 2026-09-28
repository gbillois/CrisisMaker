/* Evaluation: one sheet per player cell for the evaluators. Each sheet holds criteria rated
   on the HSEEP scale (P / S / M / U), editable in the Evaluation tab, and the injects the
   cell receives with the reaction expected. The default criteria follow the ANSSI guide
   "Organising a cyber crisis management exercise" and the HSEEP Exercise Evaluation Guides
   (operational coordination, public information and warning, situational assessment…). */

const EV_RATINGS = [
  ['P', 'Performed without challenges'],
  ['S', 'Performed with some challenges'],
  ['M', 'Performed with major challenges'],
  ['U', 'Unable to be performed'],
  ['N/A', 'Not observed']
];

// [category, criterion, what to observe]
const EV_COMMON_CRITERIA = [
  ['Mobilisation', 'The cell is activated and organised quickly', 'Time to gather; roles assigned (lead, scribe, liaison); crisis room and tools working'],
  ['Situational awareness', 'A shared picture of the situation is kept up to date', 'Situation board or dashboard; facts separated from hypotheses; updates after each new inject'],
  ['Traceability', 'Decisions and actions are logged', 'Timed logbook; who decided what, why and when; actions assigned and followed up'],
  ['Coordination', 'Information flows with the other cells', 'Regular situation points; liaison with the decision cell; no duplicate or contradictory actions'],
  ['Anticipation', 'The cell looks beyond the immediate reaction', 'Worst-case scenarios considered; next steps and deadlines prepared']
];

const EV_CELL_CRITERIA = {
  decision: [
    ['Qualification', 'The crisis is qualified and declared at the right time', 'Severity level decided; crisis mode triggered; stakeholders to inform identified'],
    ['Strategy', 'Strategic priorities are set', 'Protection of people, critical activities and data; objectives shared with every cell'],
    ['Decisions', 'Key decisions are taken under uncertainty and justified', 'Isolation or shutdown, ransom stance, disclosure; options, criteria and risks weighed'],
    ['Arbitration', 'Arbitrations between business, security and legal stakes are made', 'Trade-offs explicit; mandates given to the cells; decisions not left pending'],
    ['Governance', 'The crisis rhythm is managed', 'Situation meetings at a regular cadence, with agenda and minutes'],
    ['External commitments', 'Board, authorities and key partners are informed at the right level', 'Who informs whom, when; consistency with the communication cell'],
    ['Exit', 'Crisis exit criteria are defined', 'Conditions to return to normal; recovery priorities; lessons-learned plan']
  ],
  operational: [
    ['Alert', 'The internal alert is raised and escalated quickly', 'Time from first signal to escalation; right people alerted'],
    ['Impacts', 'Impacts are consolidated across systems, sites and activities', 'Impact map kept up to date; business owners consulted'],
    ['Action plan', 'Response actions are coordinated and tracked', 'Action tracker with owners and deadlines; follow-up at each situation point'],
    ['Inject handling', 'Every inject is acknowledged, assigned and followed up', 'No inject forgotten; answers sent within a reasonable time'],
    ['Reporting', 'The decision cell receives concise, decision-ready reports', 'Regular situation reports; options and recommendations proposed'],
    ['Resources', 'Logistics and degraded means are organised', 'Out-of-band communication, workspace, staff rotation over a long crisis']
  ],
  communication: [
    ['Internal', 'Staff are informed quickly with clear instructions', 'First internal message; what to do and not to do; regular updates'],
    ['External', 'Customers, partners and authorities receive consistent messages', 'One version of the facts across channels; timing of each audience'],
    ['Media', 'Media and social networks are monitored and answered', 'Monitoring in place; holding statement ready; press requests handled'],
    ['Validation', 'Messages go through a fast validation circuit', 'Legal and decision cell validation; time from draft to release'],
    ['Accuracy', 'No premature disclosure, facts separated from assumptions', 'Unconfirmed information not published; corrections handled'],
    ['Spokesperson', 'A spokesperson is designated and prepared', 'Key messages and Q&A ready; consistency with the decisions taken']
  ],
  it: [
    ['Detection', 'The nature and scope of the incident are identified', 'Type of attack, affected assets, indicators of compromise, initial vector'],
    ['Containment', 'Containment decisions are proportionate and fast', 'Isolation, access cuts, account resets; business impact weighed'],
    ['Evidence', 'Evidence is preserved for the investigation', 'Logs, images, timeline kept; chain of custody'],
    ['Recovery', 'Recovery is planned by business criticality', 'Trusted backups verified; restart order; clean rebuild'],
    ['External support', 'External experts and authorities are engaged', 'Incident response provider, CERT or CSIRT, national agency contacted'],
    ['Reporting', 'Technical findings are explained in business terms', 'Clear briefings to the decision cell; confidence level stated']
  ],
  legal: [
    ['Obligations', 'Regulatory obligations are identified', 'GDPR (72 h), NIS2 (24 h / 72 h), sector regulators; applicable deadlines tracked'],
    ['Notifications', 'Notifications are prepared and sent on time', 'Content, recipients and deadlines; validation by the decision cell'],
    ['Complaint', 'A complaint and cooperation with law enforcement are handled', 'Complaint filed; evidence shared through the right channel'],
    ['Insurance', 'The insurer is notified and the policy checked', 'Deadlines, covered costs, approved providers'],
    ['Contracts', 'Contractual exposure is assessed', 'Commitments to customers and suppliers; penalties and liability'],
    ['Review', 'External communications are legally reviewed', 'Wording checked for liability and admissions']
  ],
  business: [
    ['Impact assessment', 'Critical activities affected are identified', 'Processes, sites, customers impacted; financial and operational impact'],
    ['Continuity plan', 'Business continuity plans and degraded modes are activated', 'Workarounds in place; roles and responsibilities applied'],
    ['Priorities', 'Recovery is prioritised by criticality', 'Recovery time objectives respected; priorities shared with IT'],
    ['Customers and suppliers', 'Commitments to customers and suppliers are managed', 'Service levels, deliveries, alternative suppliers'],
    ['Resources', 'Staff, sites and alternatives are available', 'Back-up sites, key people, equipment']
  ],
  hr: [
    ['People', 'Staff safety and wellbeing are protected', 'Information to employees; workload and fatigue; psychological support'],
    ['Organisation', 'Working arrangements are adapted', 'Remote work, rotations, overtime rules over a long crisis'],
    ['Social dialogue', 'Staff representatives are informed', 'Works council or unions informed at the right time'],
    ['Internal threat', 'Insider aspects are handled lawfully', 'Access reviews, investigations within the legal framework']
  ]
};

function evUid() {
  return typeof uid === 'function' ? uid('crit') : `crit_${Math.random().toString(36).slice(2, 10)}`;
}

function evDefaultCriteria(cell) {
  return [...EV_COMMON_CRITERIA, ...(EV_CELL_CRITERIA[cell?.key] || [])]
    // Stable ids: the first mark given on a default sheet saves it with the same ids.
    .map(([category, text, observe], index) => ({ id: `crit_default_${index + 1}`, category, text, observe, rating: '', notes: '' }));
}

const EV_CODES = EV_RATINGS.map(([code]) => code);
const evText = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
const evRating = (value) => (EV_CODES.includes(value) ? value : '');

/* A criterion: what to rate, then the evaluator's mark (P/S/M/U/N/A) and observations. */
function evNormalizeCriterion(input = {}) {
  return {
    id: typeof input.id === 'string' && input.id ? input.id.slice(0, 60) : evUid(),
    category: evText(input.category, 120), text: evText(input.text, 600), observe: evText(input.observe, 1000),
    rating: evRating(input.rating), notes: evText(input.notes, 2000)
  };
}

/* The evaluator's marks on one inject received: reaction observed, when, and the rating. */
function evNormalizeMark(input = {}) {
  return { rating: evRating(input.rating), observed: evText(input.observed, 2000), time: evText(input.time, 40) };
}

function evNormalizeSheet(sheet) {
  const injects = {};
  if (sheet.injects && typeof sheet.injects === 'object') {
    for (const [key, mark] of Object.entries(sheet.injects).slice(0, 500)) if (mark && typeof mark === 'object') injects[key.slice(0, 120)] = evNormalizeMark(mark);
  }
  return {
    criteria: sheet.criteria.slice(0, 80).map(evNormalizeCriterion), injects,
    evaluator: evText(sheet.evaluator, 200), strengths: evText(sheet.strengths, 4000), improvements: evText(sheet.improvements, 4000),
    adapted_at: evText(sheet.adapted_at, 40)
  };
}

function normalizeEvaluation(input) {
  const sheets = {};
  const source = input && typeof input === 'object' && input.sheets && typeof input.sheets === 'object' ? input.sheets : {};
  for (const [cellId, sheet] of Object.entries(source)) {
    if (!sheet || typeof sheet !== 'object' || !Array.isArray(sheet.criteria)) continue;
    sheets[cellId] = evNormalizeSheet(sheet);
  }
  return { sheets };
}

function evState(project = appState.scenario) {
  if (!project.evaluation || typeof project.evaluation !== 'object') project.evaluation = normalizeEvaluation(null);
  return project.evaluation;
}

/* The sheet of a cell: saved once edited; until then, the defaults of its type. */
function evSheet(project, cell) {
  return evState(project).sheets[cell.id] || { ...evNormalizeSheet({ criteria: evDefaultCriteria(cell) }), isDefault: true };
}

function evEditableSheet(project, cell) {
  const state = evState(project);
  if (!state.sheets[cell.id]) state.sheets[cell.id] = evNormalizeSheet({ criteria: evDefaultCriteria(cell) });
  return state.sheets[cell.id];
}

/* The injects the cell receives (alone, with other cells or all cells), in play order. */
function evReceivedInjects(project, cell) {
  return ExerciseModel.of(project).injects.filter((inject) => sbReaches(inject.cell_id, cell.id));
}

/* Marks follow the planned inject once it is written: keyed by the plan, else the inject. */
function evInjectKey(inject) {
  return String(inject.beat?.id || inject.stimulus?.id || inject.key || '').slice(0, 120);
}

function evMark(sheet, inject) {
  return sheet.injects?.[evInjectKey(inject)] || evNormalizeMark();
}

/* Marks given on a sheet: counts per rating over the criteria and the injects. */
function evTally(project, cell) {
  const sheet = evSheet(project, cell);
  const injects = evReceivedInjects(project, cell);
  const ratings = [...sheet.criteria.map((criterion) => criterion.rating), ...injects.map((inject) => evMark(sheet, inject).rating)];
  const counts = Object.fromEntries(EV_CODES.map((code) => [code, 0]));
  ratings.forEach((rating) => { if (rating) counts[rating]++; });
  return { counts, rated: ratings.filter(Boolean).length, total: ratings.length };
}


// ── View ────────────────────────────────────────────────────────────────────
function evUI() {
  appState.ui.evaluation = appState.ui.evaluation || { cell: '' };
  return appState.ui.evaluation;
}

function evRatingSelect(field, value, disabled, label) {
  return `<select class="ev-rating is-${escapeAttribute((value || 'none').replace('/', ''))}" data-ev-field="${field}" aria-label="${escapeAttribute(label)}" ${disabled}>
    <option value="">-</option>${EV_RATINGS.map(([code, text]) => `<option value="${code}" ${code === value ? 'selected' : ''} title="${escapeAttribute(text)}">${code}</option>`).join('')}
  </select>`;
}

function renderEvaluationView() {
  const project = appState.scenario;
  const cells = project.cells || [];
  const editLocked = EvAI.busy ? 'disabled' : '';
  if (!cells.length) {
    return `<section class="tab-page ev-page"><div class="tab-empty"><p>No player cell yet: create the cells of the exercise first, each one gets its evaluation sheet.</p><button class="btn btn-primary btn-sm" data-route="cells">Cells &amp; actors</button></div></section>`;
  }
  const ui = evUI();
  const cell = cells.find((entry) => entry.id === ui.cell) || cells[0];
  ui.cell = cell.id;
  const busy = !!appState.ui?.actionLoading?.['ev-download-all'];
  const aiReady = typeof isLLMAvailable === 'function' && isLLMAvailable();
  return `<section class="tab-page ev-page">
    <article class="card ev-intro">
      <div class="ev-intro-text">
        <h3>${sbUiIcon('checkCircle', 18)} Evaluation sheets</h3>
        <p class="subtle">One sheet per cell for its evaluator: rate each criterion and each inject received, note what you observe, then sum up strengths and areas for improvement. Marks are saved with the project and included in the Excel files.</p>
        <div class="ev-scale">${EV_RATINGS.map(([code, label]) => `<span><b class="is-${code.replace('/', '')}">${code}</b> ${label}</span>`).join('')}</div>
      </div>
      <div class="ev-intro-actions">
        <button class="btn btn-secondary" data-ev-action="ai-update" ${aiReady && !EvAI.busy ? '' : 'disabled'} title="${escapeAttribute(aiReady ? 'Adapt the criteria of every sheet to this scenario' : 'Configure an AI connection in Settings first')}">${sbUiIcon(EvAI.busy ? 'clock' : 'sparkles', 16)} ${EvAI.busy ? escapeHtml(EvAI.progress || 'Updating…') : 'Update with AI'}</button>
        ${EvAI.busy ? '<button class="btn btn-ghost btn-sm" data-ev-action="ai-stop">Stop</button>' : ''}
        <button class="btn btn-primary" data-ev-action="download-all" ${busy ? 'disabled' : ''}>${sbUiIcon(busy ? 'clock' : 'download', 16)} Download all sheets (.zip)</button>
      </div>
      ${EvAI.error ? `<p class="agent-warning ev-ai-error">${escapeHtml(EvAI.error)}</p>` : ''}
    </article>
    <nav class="ev-cells" aria-label="Cells">${cells.map((entry) => {
      const tally = evTally(project, entry);
      return `<button class="${entry.id === cell.id ? 'active' : ''}" data-ev-action="select" data-ev-cell="${escapeAttribute(entry.id)}" style="--cell-color:${escapeAttribute(entry.color)}"><span class="cell-dot"></span>${escapeHtml(entry.name)}<small>${tally.rated}/${tally.total}</small></button>`;
    }).join('')}</nav>
    ${renderEvaluationSheet(project, cell, editLocked)}
  </section>`;
}

function renderEvaluationSheet(project, cell, readOnly) {
  const sheet = evSheet(project, cell);
  const injects = evReceivedInjects(project, cell);
  const tally = evTally(project, cell);
  const cellId = escapeAttribute(cell.id);
  const field = (...parts) => [cellId, ...parts.map((part) => escapeAttribute(part))].join('|');
  return `<article class="card ev-sheet" style="--cell-color:${escapeAttribute(cell.color)}">
    <header class="ev-sheet-head">
      <div><h3><span class="cell-dot"></span>${escapeHtml(cell.name)}</h3><p class="subtle">${escapeHtml(cell.description || '')}</p></div>
      <span class="ev-tally">${EV_CODES.filter((code) => code !== 'N/A').map((code) => `<b class="is-${code}" title="${escapeAttribute(EV_RATINGS.find(([c]) => c === code)[1])}">${code} ${tally.counts[code]}</b>`).join('')}<span>${tally.rated}/${tally.total} rated</span></span>
      <span class="ev-sheet-actions">
        <button class="btn btn-ghost btn-xs" data-ev-action="reset" data-ev-cell="${cellId}" ${readOnly || sheet.isDefault ? 'disabled' : ''} title="Back to the default criteria of this type of cell, marks cleared">Reset</button>
        <button class="btn btn-secondary btn-sm" data-ev-action="download" data-ev-cell="${cellId}">${sbUiIcon('download', 14)} Download (.xlsx)</button>
      </span>
    </header>
    <label class="field ev-evaluator">Evaluator<input type="text" data-ev-field="${field('sheet', 'evaluator')}" value="${escapeAttribute(sheet.evaluator || '')}" placeholder="Name of the evaluator" ${readOnly}></label>
    <h4 class="ev-section">Criteria${sheet.adapted_at ? ' <small>adapted to the scenario with AI</small>' : sheet.isDefault ? ' <small>default criteria for this type of cell</small>' : ''}</h4>
    <table class="ev-table ev-criteria">
      <thead><tr><th>Category</th><th>Criterion and what to observe</th><th>Rating</th><th>Observations and evidence</th><th></th></tr></thead>
      <tbody>${sheet.criteria.map((criterion) => `<tr>
        <td><input type="text" data-ev-field="${field('crit', criterion.id, 'category')}" value="${escapeAttribute(criterion.category)}" aria-label="Category" ${readOnly}></td>
        <td class="ev-criterion"><textarea rows="2" data-ev-field="${field('crit', criterion.id, 'text')}" aria-label="Criterion" ${readOnly}>${escapeHtml(criterion.text)}</textarea><textarea rows="2" class="ev-observe" data-ev-field="${field('crit', criterion.id, 'observe')}" aria-label="What to observe" placeholder="What to observe" ${readOnly}>${escapeHtml(criterion.observe)}</textarea></td>
        <td>${evRatingSelect(field('crit', criterion.id, 'rating'), criterion.rating, readOnly, 'Rating')}</td>
        <td><textarea rows="3" data-ev-field="${field('crit', criterion.id, 'notes')}" aria-label="Observations" placeholder="What the cell did, with times" ${readOnly}>${escapeHtml(criterion.notes || '')}</textarea></td>
        <td><button class="sb-icon-btn is-danger" data-ev-action="delete" data-ev-cell="${cellId}" data-ev-criterion="${escapeAttribute(criterion.id)}" title="Remove" ${readOnly}>${sbUiIcon('trash', 13)}</button></td>
      </tr>`).join('')}</tbody>
    </table>
    <button class="btn btn-ghost btn-xs ev-add" data-ev-action="add" data-ev-cell="${cellId}" ${readOnly}>${sbUiIcon('plus', 12)} Criterion</button>
    <h4 class="ev-section">Injects received <small>${injects.length}</small></h4>
    ${injects.length ? `<table class="ev-table ev-injects">
      <thead><tr><th>Time</th><th>Inject and reaction expected</th><th>Rating</th><th>Reaction observed</th><th>Time of reaction</th></tr></thead>
      <tbody>${injects.map((inject) => {
        const mark = evMark(sheet, inject);
        const key = evInjectKey(inject);
        return `<tr>
          <td class="ev-time"><b>${escapeHtml(sbFormatOffset(inject.time))}</b>${inject.numberLabel ? `<small>${escapeHtml(inject.numberLabel)}</small>` : ''}</td>
          <td class="ev-inject"><strong>${escapeHtml(inject.title || '')}</strong>${inject.intent ? `<span class="subtle">${escapeHtml(inject.intent)}</span>` : ''}</td>
          <td>${evRatingSelect(field('inject', key, 'rating'), mark.rating, readOnly, 'Rating')}</td>
          <td><textarea rows="2" data-ev-field="${field('inject', key, 'observed')}" aria-label="Reaction observed" ${readOnly}>${escapeHtml(mark.observed)}</textarea></td>
          <td><input type="text" data-ev-field="${field('inject', key, 'time')}" value="${escapeAttribute(mark.time)}" placeholder="H+0:20" aria-label="Time of reaction" ${readOnly}></td>
        </tr>`;
      }).join('')}</tbody>
    </table>` : '<p class="subtle">No inject reaches this cell yet.</p>'}
    <div class="ev-summary">
      <label class="field">Strengths<textarea rows="4" data-ev-field="${field('sheet', 'strengths')}" placeholder="What worked well" ${readOnly}>${escapeHtml(sheet.strengths || '')}</textarea></label>
      <label class="field">Areas for improvement<textarea rows="4" data-ev-field="${field('sheet', 'improvements')}" placeholder="What to improve, and how" ${readOnly}>${escapeHtml(sheet.improvements || '')}</textarea></label>
    </div>
  </article>`;
}

const EV_LIMITS = { category: 120, text: 600, observe: 1000, notes: 2000, observed: 2000, time: 40, evaluator: 200, strengths: 4000, improvements: 4000 };

/* One field of a sheet, from its data-ev-field "cellId|sheet|name", "cellId|crit|id|name"
   or "cellId|inject|key|name". Returns true when the tally changed (a rating). */
function evApplyField(project, path, value) {
  const [cellId, scope, id, name] = path.split('|');
  const cell = (project.cells || []).find((entry) => entry.id === cellId);
  if (!cell) return false;
  const sheet = evEditableSheet(project, cell);
  if (scope === 'sheet' && ['evaluator', 'strengths', 'improvements'].includes(id)) { sheet[id] = String(value).slice(0, EV_LIMITS[id]); return false; }
  if (scope === 'crit') {
    const criterion = sheet.criteria.find((item) => item.id === id);
    if (!criterion || !['category', 'text', 'observe', 'rating', 'notes'].includes(name)) return false;
    criterion[name] = name === 'rating' ? evRating(value) : String(value).slice(0, EV_LIMITS[name]);
    return name === 'rating';
  }
  if (scope === 'inject' && ['rating', 'observed', 'time'].includes(name)) {
    sheet.injects = sheet.injects || {};
    const mark = sheet.injects[id] || (sheet.injects[id] = evNormalizeMark());
    mark[name] = name === 'rating' ? evRating(value) : String(value).slice(0, EV_LIMITS[name]);
    return name === 'rating';
  }
  return false;
}

function bindEvaluationEvents() {
  if (appState.route !== 'evaluation') return;
  const project = appState.scenario;
  const root = document.querySelector('.ev-page');
  if (!root) return;
  const cellOf = (id) => (project.cells || []).find((cell) => cell.id === id);
  let saveTimer = null;
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveLocal(false), 400); };
  root.querySelectorAll('[data-ev-field]').forEach((input) => {
    const event = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(event, () => {
      const ratingChanged = evApplyField(project, input.dataset.evField, input.value);
      save();
      if (ratingChanged) App.render();
    });
  });
  root.querySelectorAll('[data-ev-action]').forEach((button) => button.addEventListener('click', async () => {
    const action = button.dataset.evAction;
    const cell = cellOf(button.dataset.evCell);
    if (action === 'download-all') { await evDownloadAll(project); return; }
    if (action === 'ai-update') { await EvAI.updateAll(project); return; }
    if (action === 'ai-stop') { EvAI.stop(); return; }
    if (!cell) return;
    if (action === 'select') { evUI().cell = cell.id; App.render(); return; }
    if (action === 'download') { await evDownloadCell(project, cell); return; }
    const state = evState(project);
    if (action === 'add') evEditableSheet(project, cell).criteria.push(evNormalizeCriterion({}));
    if (action === 'delete') {
      const sheet = evEditableSheet(project, cell);
      sheet.criteria = sheet.criteria.filter((item) => item.id !== button.dataset.evCriterion);
    }
    if (action === 'reset') {
      if (!window.confirm(`Reset the sheet of the ${cell.name} to the default criteria? Its marks and notes are cleared.`)) return;
      delete state.sheets[cell.id];
    }
    saveLocal(false);
    App.render();
  }));
}

// ── Update with AI ─────────────────────────────────────────────────────────
/* Adapts the criteria of each cell's sheet to the scenario: its learning objectives, phases,
   main events and the injects the cell receives. One request per cell keeps each answer short. */
const EvAI = {
  busy: false, progress: '', error: '', controller: null,

  stop() { this.controller?.abort(); },

  context(project, cell) {
    const storyboard = project.storyboard;
    const phases = storyboard ? sbMainBlocks(storyboard) : [];
    const language = project.settings?.inject_language || project.settings?.language || 'en';
    return {
      exercise: project.name || '',
      organisation: { name: project.client?.name || '', sector: project.client?.sector || '' },
      scenario: String(project.scenario?.summary || storyboard?.meta?.brief || '').slice(0, 2000),
      learning_objectives: String(project.scenario?.learning_objectives || '').slice(0, 2000),
      phases: phases.slice(0, 15).map((block) => ({
        title: block.title, start: sbFormatOffset(block.start_minutes), what_happens: String(block.brief || '').slice(0, 400),
        main_events: (block.events || []).slice(0, 8).map((event) => `${sbFormatOffset(block.start_minutes + (event.offset_minutes || 0))} ${String(event.text || '').slice(0, 200)}`)
      })),
      cell: { name: cell.name, type: cell.key || '', mission: cell.description || '', players: (cell.players || []).slice(0, 20).map((player) => [player.name, player.role || player.title].filter(Boolean).join(', ')) },
      injects_received: evReceivedInjects(project, cell).slice(0, 60).map((inject) => `${sbFormatOffset(inject.time)} ${String(inject.title || '').slice(0, 120)}${inject.intent ? `: ${String(inject.intent).slice(0, 200)}` : ''}`),
      current_criteria: evSheet(project, cell).criteria.map((criterion) => ({ category: criterion.category, text: criterion.text, observe: criterion.observe })),
      language: { en: 'English', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian', pt: 'Portuguese', nl: 'Dutch', ja: 'Japanese', zh: 'Chinese' }[language] || 'English'
    };
  },

  systemPrompt() {
    return `You are a senior crisis exercise evaluator (HSEEP, ANSSI cyber crisis exercise guide). You adapt the evaluation sheet of one player cell to a specific exercise.
Write 8 to 12 criteria the evaluator of this cell will rate on the P/S/M/U scale. Each criterion is an observable capability or decision, specific to THIS scenario: name the stakes, deadlines, main events and injects the cell faces (with their time when useful), and link them to the learning objectives. Keep the generic crisis management basics that still apply (mobilisation, situational awareness, logbook, coordination), rewritten for the scenario.
"observe" lists concrete evidence to look for (who, what, by when). Keep each field short: category 1-3 words, text one sentence, observe one or two sentences.
Write in the language requested. Reply only with a JSON object: {"criteria":[{"category":"","text":"","observe":""}]}`;
  },

  async updateCell(project, cell, signal) {
    const user = JSON.stringify(this.context(project, cell));
    const request = AITextGenerator.generate('evaluation', this.systemPrompt(), user, true, 4000, { signal, strictJSON: true, promptFilter: typeof agentRedact === 'function' ? agentRedact : undefined });
    const result = await (typeof agentAwait === 'function' ? agentAwait(request, signal, typeof SB_AI_TIMEOUT !== 'undefined' ? SB_AI_TIMEOUT : 180000) : request);
    const criteria = (Array.isArray(result?.criteria) ? result.criteria : [])
      .filter((item) => item && typeof item === 'object' && typeof item.text === 'string' && item.text.trim())
      .slice(0, 20)
      .map((item) => evNormalizeCriterion({ category: String(item.category || ''), text: item.text.trim(), observe: String(item.observe || '') }));
    if (!criteria.length) throw new Error(`The AI proposed no criterion for the ${cell.name}.`);
    const sheet = evEditableSheet(project, cell);
    // Marks given on a criterion kept by the AI (same text) stay.
    const previous = new Map(sheet.criteria.map((criterion) => [criterion.text.trim().toLowerCase(), criterion]));
    sheet.criteria = criteria.map((criterion) => {
      const kept = previous.get(criterion.text.toLowerCase());
      return kept ? { ...criterion, rating: kept.rating, notes: kept.notes } : criterion;
    });
    sheet.adapted_at = new Date().toISOString();
  },

  async updateAll(project) {
    if (this.busy) return;
    if (!isLLMAvailable()) { pushToast('Configure an AI connection in Settings first.', 'error'); return; }
    const cells = project.cells || [];
    const rated = cells.some((cell) => evSheet(project, cell).criteria.some((criterion) => criterion.rating || criterion.notes));
    if (rated && !window.confirm('Adapt every sheet to the scenario with AI? Criteria are rewritten: marks on a criterion that changes are cleared (marks on injects stay).')) return;
    this.busy = true; this.error = ''; this.controller = new AbortController();
    const signal = this.controller.signal;
    const failed = [];
    try {
      for (const [index, cell] of cells.entries()) {
        if (signal.aborted || appState.scenario !== project) break;
        this.progress = `Adapting ${index + 1}/${cells.length}: ${cell.name}…`;
        App.render();
        try { await this.updateCell(project, cell, signal); saveLocal(false); }
        catch (error) {
          if (error?.name === 'AbortError' || signal.aborted) break;
          failed.push(`${cell.name}: ${typeof sbErrorMessage === 'function' ? sbErrorMessage(error) : error.message}`);
        }
      }
      if (signal.aborted) pushToast('Update stopped. The sheets already adapted are kept.', 'info');
      else if (failed.length) { this.error = `Not adapted: ${failed.join(' | ')}`.slice(0, 900); pushToast(`${cells.length - failed.length}/${cells.length} sheet(s) adapted.`, failed.length === cells.length ? 'error' : 'info'); }
      else pushToast(`${cells.length} evaluation sheet(s) adapted to the scenario.`, 'success');
    } finally {
      this.busy = false; this.progress = ''; this.controller = null;
      App.render();
    }
  }
};

// ── Excel ───────────────────────────────────────────────────────────────────
const evRatingLabel = (code) => (code ? `${code}` : '');

function evSheetRows(project, cell) {
  const sheet = evSheet(project, cell);
  const injects = evReceivedInjects(project, cell);
  const tally = evTally(project, cell);
  const rows = [
    [`Evaluation sheet · ${cell.name}`],
    [`Exercise: ${project.name || ''}`, '', `Date: ${project.scenario?.start_date ? String(project.scenario.start_date).slice(0, 10) : ''}`, '', `Evaluator: ${sheet.evaluator || ''}`],
    [`Mission: ${cell.description || ''}`],
    project.scenario?.learning_objectives ? [`Learning objectives: ${project.scenario.learning_objectives}`] : null,
    [],
    [`Rating: ${EV_RATINGS.map(([code, label]) => `${code} = ${label}`).join(' · ')}`],
    [`Marks: ${EV_CODES.map((code) => `${code} ${tally.counts[code]}`).join(' · ')} (${tally.rated}/${tally.total} rated)`],
    [],
    ['Category', 'Criterion', 'What to observe', 'Rating (P/S/M/U/N/A)', 'Observations and evidence'],
    ...sheet.criteria.map((criterion) => [criterion.category, criterion.text, criterion.observe, evRatingLabel(criterion.rating), criterion.notes || '']),
    [],
    ['Injects received'],
    ['Time', 'No.', 'Inject', 'Reaction or decision expected', 'Observed reaction', 'Time of reaction', 'Rating (P/S/M/U/N/A)'],
    ...injects.map((inject) => {
      const mark = evMark(sheet, inject);
      return [sbFormatOffset(inject.time), inject.numberLabel || '', inject.title || '', inject.intent || '', mark.observed, mark.time, evRatingLabel(mark.rating)];
    }),
    [],
    ['Strengths'], ...(sheet.strengths ? sheet.strengths.split('\n').map((line) => [line]) : [[''], ['']]),
    [],
    ['Areas for improvement'], ...(sheet.improvements ? sheet.improvements.split('\n').map((line) => [line]) : [[''], ['']])
  ];
  return rows.filter(Boolean);
}

function evWorksheet(project, cell) {
  const ws = XLSX.utils.aoa_to_sheet(evSheetRows(project, cell));
  ws['!cols'] = [{ wch: 22 }, { wch: 46 }, { wch: 52 }, { wch: 22 }, { wch: 44 }, { wch: 16 }, { wch: 20 }];
  return ws;
}

function evFileName(text) {
  return String(text || 'sheet').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'sheet';
}

/* The overview of every cell's marks, first sheet of the all-cells workbook. */
function evOverviewSheet(project, cells) {
  const rows = [
    [`Evaluation overview · ${project.name || ''}`], [],
    ['Cell', 'Evaluator', ...EV_CODES, 'Rated', 'Total'],
    ...cells.map((cell) => { const tally = evTally(project, cell); return [cell.name, evSheet(project, cell).evaluator || '', ...EV_CODES.map((code) => tally.counts[code]), tally.rated, tally.total]; })
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 32 }, { wch: 24 }, ...EV_CODES.map(() => ({ wch: 7 })), { wch: 8 }, { wch: 8 }];
  return ws;
}

function evWorkbook(project, cells, { overview = false } = {}) {
  const wb = XLSX.utils.book_new();
  const used = new Set(['overview']);
  if (overview) XLSX.utils.book_append_sheet(wb, evOverviewSheet(project, cells), 'Overview');
  cells.forEach((cell, index) => {
    let name = String(cell.name || `Cell ${index + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 28).trim() || `Cell ${index + 1}`;
    if (used.has(name.toLowerCase())) name = `${name.slice(0, 24)} ${index + 1}`;
    used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, evWorksheet(project, cell), name);
  });
  return wb;
}

/* The Excel and ZIP libraries load after the page (deferred): wait for them, or load them. */
function evLoadScript(global, src) {
  if (typeof window !== 'undefined' && window[global]) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => (window[global] ? resolve() : reject(new Error(`${global} did not load.`)));
    script.onerror = () => reject(new Error(`Could not load ${src}. Check your connection and reload the page.`));
    document.head.appendChild(script);
  });
}

async function evLibraries(zip = false) {
  await evLoadScript('XLSX', 'js/lib/xlsx.full.min.js');
  if (zip) await evLoadScript('JSZip', 'js/lib/jszip.min.js');
}

function evSave(blob, fileName) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 10000);
}

const EV_XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function evDownloadCell(project, cell) {
  try {
    await evLibraries();
    const data = XLSX.write(evWorkbook(project, [cell]), { bookType: 'xlsx', type: 'array' });
    evSave(new Blob([data], { type: EV_XLSX_TYPE }), `evaluation-${evFileName(cell.name)}.xlsx`);
    pushToast(`Evaluation sheet of the ${cell.name} downloaded.`, 'success');
  } catch (error) {
    if (typeof CrisisError !== 'undefined') CrisisError.toast(error, { operation: 'Download an evaluation sheet' });
    else pushToast(error.message || String(error), 'error');
  }
}

/* One ZIP: a workbook per cell for its evaluator, plus one workbook with every sheet. */
async function evDownloadAll(project) {
  const cells = project.cells || [];
  if (!cells.length) return;
  appState.ui.actionLoading = { ...(appState.ui.actionLoading || {}), 'ev-download-all': true };
  App.render();
  try {
    await evLibraries(true);
    const zip = new JSZip();
    const write = (wb) => XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    cells.forEach((cell, index) => zip.file(`${String(index + 1).padStart(2, '0')}-evaluation-${evFileName(cell.name)}.xlsx`, write(evWorkbook(project, [cell]))));
    zip.file('00-evaluation-all-cells.xlsx', write(evWorkbook(project, cells, { overview: true })));
    const blob = await zip.generateAsync({ type: 'blob' });
    evSave(blob, `evaluation-sheets-${evFileName(project.name || 'exercise')}.zip`);
    pushToast(`${cells.length} evaluation sheet(s) downloaded.`, 'success');
  } catch (error) {
    if (typeof CrisisError !== 'undefined') CrisisError.toast(error, { operation: 'Download the evaluation sheets' });
    else pushToast(error.message || String(error), 'error');
  } finally {
    appState.ui.actionLoading = { ...(appState.ui.actionLoading || {}), 'ev-download-all': false };
    App.render();
  }
}

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
    .map(([category, text, observe]) => ({ id: evUid(), category, text, observe }));
}

function evNormalizeCriterion(input = {}) {
  const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
  return { id: typeof input.id === 'string' && input.id ? input.id.slice(0, 60) : evUid(), category: text(input.category, 120), text: text(input.text, 600), observe: text(input.observe, 1000) };
}

function normalizeEvaluation(input) {
  const sheets = {};
  const source = input && typeof input === 'object' && input.sheets && typeof input.sheets === 'object' ? input.sheets : {};
  for (const [cellId, sheet] of Object.entries(source)) {
    if (!sheet || typeof sheet !== 'object' || !Array.isArray(sheet.criteria)) continue;
    sheets[cellId] = { criteria: sheet.criteria.slice(0, 80).map(evNormalizeCriterion) };
  }
  return { sheets };
}

function evState(project = appState.scenario) {
  if (!project.evaluation || typeof project.evaluation !== 'object') project.evaluation = normalizeEvaluation(null);
  return project.evaluation;
}

/* The sheet of a cell: saved once edited; until then, the defaults of its type. */
function evSheet(project, cell) {
  return evState(project).sheets[cell.id] || { criteria: evDefaultCriteria(cell), isDefault: true };
}

function evEditableSheet(project, cell) {
  const state = evState(project);
  if (!state.sheets[cell.id]) state.sheets[cell.id] = { criteria: evDefaultCriteria(cell) };
  return state.sheets[cell.id];
}

/* The injects the cell receives (alone, with other cells or all cells), in play order. */
function evReceivedInjects(project, cell) {
  return ExerciseModel.of(project).injects.filter((inject) => sbReaches(inject.cell_id, cell.id));
}

// ── View ────────────────────────────────────────────────────────────────────
function renderEvaluationView() {
  const project = appState.scenario;
  const cells = project.cells || [];
  const readOnly = typeof sbReadOnly === 'function' && sbReadOnly() ? 'disabled' : '';
  if (!cells.length) {
    return `<section class="tab-page ev-page"><div class="tab-empty"><p>No player cell yet: create the cells of the exercise first, each one gets its evaluation sheet.</p><button class="btn btn-primary btn-sm" data-route="cells">Cells &amp; actors</button></div></section>`;
  }
  const busy = !!appState.ui?.actionLoading?.['ev-download-all'];
  return `<section class="tab-page ev-page">
    <article class="card ev-intro">
      <div class="ev-intro-text">
        <h3>${sbUiIcon('checkCircle', 18)} Evaluation sheets</h3>
        <p class="subtle">One sheet per cell for its evaluator: the criteria to rate and every inject the cell receives, with the reaction expected. Adjust the criteria below, then download the sheets as Excel files.</p>
        <div class="ev-scale">${EV_RATINGS.map(([code, label]) => `<span><b>${code}</b> ${label}</span>`).join('')}</div>
      </div>
      <button class="btn btn-primary" data-ev-action="download-all" ${busy ? 'disabled' : ''}>${sbUiIcon(busy ? 'clock' : 'download', 16)} Download all sheets (.zip)</button>
    </article>
    ${cells.map((cell) => renderEvaluationSheet(project, cell, readOnly)).join('')}
  </section>`;
}

function renderEvaluationSheet(project, cell, readOnly) {
  const sheet = evSheet(project, cell);
  const injects = evReceivedInjects(project, cell);
  const cellId = escapeAttribute(cell.id);
  return `<article class="card ev-sheet" style="--cell-color:${escapeAttribute(cell.color)}">
    <header class="ev-sheet-head">
      <div><h3><span class="cell-dot"></span>${escapeHtml(cell.name)}</h3><p class="subtle">${escapeHtml(cell.description || '')}</p></div>
      <span class="ev-sheet-meta">${sheet.criteria.length} criteria · ${injects.length} injects received${sheet.isDefault ? ' · default criteria' : ''}</span>
      <span class="ev-sheet-actions">
        <button class="btn btn-ghost btn-xs" data-ev-action="reset" data-ev-cell="${cellId}" ${readOnly || sheet.isDefault ? 'disabled' : ''} title="Back to the default criteria of this type of cell">Reset</button>
        <button class="btn btn-secondary btn-sm" data-ev-action="download" data-ev-cell="${cellId}">${sbUiIcon('download', 14)} Download (.xlsx)</button>
      </span>
    </header>
    <table class="ev-table">
      <thead><tr><th>Category</th><th>Criterion</th><th>What to observe</th><th></th></tr></thead>
      <tbody>${sheet.criteria.map((criterion) => `<tr>
        <td><input type="text" data-ev-field="${cellId}.${escapeAttribute(criterion.id)}.category" value="${escapeAttribute(criterion.category)}" aria-label="Category" ${readOnly}></td>
        <td><textarea rows="2" data-ev-field="${cellId}.${escapeAttribute(criterion.id)}.text" aria-label="Criterion" ${readOnly}>${escapeHtml(criterion.text)}</textarea></td>
        <td><textarea rows="2" data-ev-field="${cellId}.${escapeAttribute(criterion.id)}.observe" aria-label="What to observe" ${readOnly}>${escapeHtml(criterion.observe)}</textarea></td>
        <td><button class="sb-icon-btn is-danger" data-ev-action="delete" data-ev-cell="${cellId}" data-ev-criterion="${escapeAttribute(criterion.id)}" title="Remove" ${readOnly}>${sbUiIcon('trash', 13)}</button></td>
      </tr>`).join('')}</tbody>
    </table>
    <button class="btn btn-ghost btn-xs" data-ev-action="add" data-ev-cell="${cellId}" ${readOnly}>${sbUiIcon('plus', 12)} Criterion</button>
    <details class="ev-injects"><summary>Injects received (${injects.length}): added to the sheet with the reaction expected</summary>
      ${injects.length ? `<ol>${injects.map((inject) => `<li><b>${escapeHtml(sbFormatOffset(inject.time))}</b> ${escapeHtml(inject.title || '')}${inject.intent ? `<span class="subtle"> · ${escapeHtml(inject.intent)}</span>` : ''}</li>`).join('')}</ol>` : '<p class="subtle">No inject reaches this cell yet.</p>'}
    </details>
  </article>`;
}

function bindEvaluationEvents() {
  if (appState.route !== 'evaluation') return;
  const project = appState.scenario;
  const root = document.querySelector('.ev-page');
  if (!root) return;
  const cellOf = (id) => (project.cells || []).find((cell) => cell.id === id);
  let saveTimer = null;
  root.querySelectorAll('[data-ev-field]').forEach((input) => input.addEventListener('input', () => {
    const [cellId, criterionId, field] = input.dataset.evField.split('.');
    const cell = cellOf(cellId);
    if (!cell) return;
    const criterion = evEditableSheet(project, cell).criteria.find((item) => item.id === criterionId);
    if (!criterion || !['category', 'text', 'observe'].includes(field)) return;
    criterion[field] = input.value.slice(0, field === 'observe' ? 1000 : field === 'text' ? 600 : 120);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveLocal(false), 400);
  }));
  root.querySelectorAll('[data-ev-action]').forEach((button) => button.addEventListener('click', async () => {
    const cell = cellOf(button.dataset.evCell);
    const action = button.dataset.evAction;
    if (action === 'download-all') { await evDownloadAll(project); return; }
    if (!cell) return;
    if (action === 'download') { evDownloadCell(project, cell); return; }
    const state = evState(project);
    if (action === 'add') evEditableSheet(project, cell).criteria.push({ id: evUid(), category: '', text: '', observe: '' });
    if (action === 'delete') {
      const sheet = evEditableSheet(project, cell);
      sheet.criteria = sheet.criteria.filter((item) => item.id !== button.dataset.evCriterion);
    }
    if (action === 'reset') {
      if (!window.confirm(`Reset the sheet of the ${cell.name} to the default criteria?`)) return;
      delete state.sheets[cell.id];
    }
    saveLocal(false);
    App.render();
  }));
}

// ── Excel ───────────────────────────────────────────────────────────────────
function evSheetRows(project, cell) {
  const sheet = evSheet(project, cell);
  const injects = evReceivedInjects(project, cell);
  const rows = [
    [`Evaluation sheet · ${cell.name}`],
    [`Exercise: ${project.name || ''}`, '', `Date: ${project.scenario?.start_date ? String(project.scenario.start_date).slice(0, 10) : ''}`, '', 'Evaluator:'],
    [`Mission: ${cell.description || ''}`],
    project.scenario?.learning_objectives ? [`Learning objectives: ${project.scenario.learning_objectives}`] : null,
    [],
    [`Rating: ${EV_RATINGS.map(([code, label]) => `${code} = ${label}`).join(' · ')}`],
    [],
    ['Category', 'Criterion', 'What to observe', 'Rating (P/S/M/U/N/A)', 'Observations and evidence'],
    ...sheet.criteria.map((criterion) => [criterion.category, criterion.text, criterion.observe, '', '']),
    [],
    ['Injects received'],
    ['Time', 'No.', 'Inject', 'Reaction or decision expected', 'Observed reaction', 'Time of reaction', 'Rating (P/S/M/U/N/A)'],
    ...injects.map((inject) => [sbFormatOffset(inject.time), inject.numberLabel || '', inject.title || '', inject.intent || '', '', '', '']),
    [],
    ['Strengths'], [''], [''],
    ['Areas for improvement'], [''], ['']
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

function evWorkbook(project, cells) {
  const wb = XLSX.utils.book_new();
  const used = new Set();
  cells.forEach((cell, index) => {
    let name = String(cell.name || `Cell ${index + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 28).trim() || `Cell ${index + 1}`;
    while (used.has(name.toLowerCase())) name = `${name.slice(0, 25)} ${index + 1}`;
    used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, evWorksheet(project, cell), name);
  });
  return wb;
}

function evRequireXlsx() {
  if (typeof XLSX === 'undefined') throw new Error('The Excel library is not loaded yet. Try again in a moment.');
}

function evDownloadCell(project, cell) {
  try {
    evRequireXlsx();
    XLSX.writeFile(evWorkbook(project, [cell]), `evaluation-${evFileName(cell.name)}.xlsx`);
  } catch (error) { pushToast(error.message || String(error), 'error'); }
}

/* One ZIP: a workbook per cell for its evaluator, plus one workbook with every sheet. */
async function evDownloadAll(project) {
  const cells = project.cells || [];
  if (!cells.length) return;
  appState.ui.actionLoading = { ...(appState.ui.actionLoading || {}), 'ev-download-all': true };
  App.render();
  try {
    evRequireXlsx();
    if (typeof JSZip === 'undefined') throw new Error('The ZIP library is not loaded yet. Try again in a moment.');
    const zip = new JSZip();
    const write = (wb) => XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    cells.forEach((cell, index) => zip.file(`${String(index + 1).padStart(2, '0')}-evaluation-${evFileName(cell.name)}.xlsx`, write(evWorkbook(project, [cell]))));
    zip.file('00-evaluation-all-cells.xlsx', write(evWorkbook(project, cells)));
    const blob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `evaluation-sheets-${evFileName(project.name || 'exercise')}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    pushToast(`${cells.length} evaluation sheet(s) downloaded.`, 'success');
  } catch (error) {
    pushToast(error.message || String(error), 'error');
  } finally {
    appState.ui.actionLoading = { ...(appState.ui.actionLoading || {}), 'ev-download-all': false };
    App.render();
  }
}

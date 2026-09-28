/* Evaluation: one sheet per player cell for the evaluators. Each sheet holds criteria rated
   on the HSEEP scale (P / S / M / U), editable in the Evaluation tab, and the injects the
   cell receives with the reaction expected. The default criteria follow the ANSSI guide
   "Organising a cyber crisis management exercise" and the HSEEP Exercise Evaluation Guides
   (operational coordination, public information and warning, situational assessment…). */

// [code, English, French, German]
const EV_RATING_LABELS = [
  ['P', 'Performed without challenges', 'Réalisé sans difficulté', 'Ohne Schwierigkeiten ausgeführt'],
  ['S', 'Performed with some challenges', 'Réalisé avec quelques difficultés', 'Mit einigen Schwierigkeiten ausgeführt'],
  ['M', 'Performed with major challenges', 'Réalisé avec des difficultés majeures', 'Mit erheblichen Schwierigkeiten ausgeführt'],
  ['U', 'Unable to be performed', 'Impossible à réaliser', 'Nicht ausführbar'],
  ['N/A', 'Not observed', 'Non observé', 'Nicht beobachtet']
];

/* The scale in the app language: [code, label]. The codes are the stored values. */
function evRatings() {
  return EV_RATING_LABELS.map(([code, en, fr, de]) => [code, tt(en, fr, de)]);
}

/* Default criteria, one row per criterion in English, French and German; each language
   reads "category | criterion | what to observe". A sheet not edited yet shows them in the
   app language; a saved sheet keeps its own text. */
const EV_COMMON_CRITERIA = [
  ['Mobilisation | The cell is activated and organised quickly | Time to gather; roles assigned (lead, scribe, liaison); crisis room and tools working',
    'Mobilisation | La cellule est activée et organisée rapidement | Délai de réunion ; rôles attribués (pilote, scribe, liaison) ; salle de crise et outils opérationnels',
    'Mobilisierung | Die Zelle wird schnell aktiviert und organisiert | Zeit bis zur Zusammenkunft; Rollen verteilt (Leitung, Protokoll, Verbindung); Krisenraum und Werkzeuge einsatzbereit'],
  ['Situational awareness | A shared picture of the situation is kept up to date | Situation board or dashboard; facts separated from hypotheses; updates after each new inject',
    'Connaissance de la situation | Une vision partagée de la situation est tenue à jour | Tableau de situation ou tableau de bord ; faits distingués des hypothèses ; mise à jour après chaque nouvel inject',
    'Lagebewusstsein | Ein gemeinsames Lagebild wird aktuell gehalten | Lagetafel oder Dashboard; Fakten von Hypothesen getrennt; Aktualisierung nach jedem neuen Inject'],
  ['Traceability | Decisions and actions are logged | Timed logbook; who decided what, why and when; actions assigned and followed up',
    'Traçabilité | Les décisions et les actions sont consignées | Main courante horodatée ; qui a décidé quoi, pourquoi et quand ; actions attribuées et suivies',
    'Nachvollziehbarkeit | Entscheidungen und Maßnahmen werden protokolliert | Protokoll mit Uhrzeiten; wer was, warum und wann entschieden hat; Maßnahmen zugewiesen und nachverfolgt'],
  ['Coordination | Information flows with the other cells | Regular situation points; liaison with the decision cell; no duplicate or contradictory actions',
    'Coordination | L’information circule avec les autres cellules | Points de situation réguliers ; liaison avec la cellule décisionnelle ; pas d’actions en doublon ou contradictoires',
    'Koordination | Informationen fließen mit den anderen Zellen | Regelmäßige Lagebesprechungen; Verbindung zur Entscheidungszelle; keine doppelten oder widersprüchlichen Maßnahmen'],
  ['Anticipation | The cell looks beyond the immediate reaction | Worst-case scenarios considered; next steps and deadlines prepared',
    'Anticipation | La cellule voit au-delà de la réaction immédiate | Scénarios du pire envisagés ; prochaines étapes et échéances préparées',
    'Antizipation | Die Zelle denkt über die unmittelbare Reaktion hinaus | Worst-Case-Szenarien betrachtet; nächste Schritte und Fristen vorbereitet']
];

const EV_CELL_CRITERIA = {
  decision: [
    ['Qualification | The crisis is qualified and declared at the right time | Severity level decided; crisis mode triggered; stakeholders to inform identified',
      'Qualification | La crise est qualifiée et déclarée au bon moment | Niveau de gravité décidé ; mode crise déclenché ; parties prenantes à informer identifiées',
      'Einstufung | Die Krise wird zum richtigen Zeitpunkt eingestuft und ausgerufen | Schweregrad festgelegt; Krisenmodus ausgelöst; zu informierende Beteiligte identifiziert'],
    ['Strategy | Strategic priorities are set | Protection of people, critical activities and data; objectives shared with every cell',
      'Stratégie | Les priorités stratégiques sont fixées | Protection des personnes, des activités critiques et des données ; objectifs partagés avec chaque cellule',
      'Strategie | Strategische Prioritäten werden festgelegt | Schutz von Menschen, kritischen Tätigkeiten und Daten; Ziele mit jeder Zelle geteilt'],
    ['Decisions | Key decisions are taken under uncertainty and justified | Isolation or shutdown, ransom stance, disclosure; options, criteria and risks weighed',
      'Décisions | Les décisions clés sont prises dans l’incertitude et justifiées | Isolement ou arrêt, position face à la rançon, divulgation ; options, critères et risques évalués',
      'Entscheidungen | Schlüsselentscheidungen werden unter Unsicherheit getroffen und begründet | Isolierung oder Abschaltung, Haltung zum Lösegeld, Offenlegung; Optionen, Kriterien und Risiken abgewogen'],
    ['Arbitration | Arbitrations between business, security and legal stakes are made | Trade-offs explicit; mandates given to the cells; decisions not left pending',
      'Arbitrages | Les arbitrages entre enjeux métier, sécurité et juridiques sont rendus | Compromis explicites ; mandats donnés aux cellules ; décisions non laissées en suspens',
      'Abwägung | Zielkonflikte zwischen Geschäft, Sicherheit und Recht werden entschieden | Kompromisse offen benannt; Mandate an die Zellen erteilt; keine Entscheidung bleibt offen'],
    ['Governance | The crisis rhythm is managed | Situation meetings at a regular cadence, with agenda and minutes',
      'Gouvernance | Le rythme de la crise est piloté | Points de situation à intervalles réguliers, avec ordre du jour et compte rendu',
      'Steuerung | Der Krisenrhythmus wird gesteuert | Lagebesprechungen in regelmäßigem Takt, mit Tagesordnung und Protokoll'],
    ['External commitments | Board, authorities and key partners are informed at the right level | Who informs whom, when; consistency with the communication cell',
      'Engagements externes | Le conseil d’administration, les autorités et les partenaires clés sont informés au bon niveau | Qui informe qui, et quand ; cohérence avec la cellule communication',
      'Externe Verpflichtungen | Aufsichtsgremium, Behörden und wichtige Partner werden auf der richtigen Ebene informiert | Wer informiert wen und wann; Abstimmung mit der Kommunikationszelle'],
    ['Exit | Crisis exit criteria are defined | Conditions to return to normal; recovery priorities; lessons-learned plan',
      'Sortie de crise | Les critères de sortie de crise sont définis | Conditions de retour à la normale ; priorités de reprise ; plan de retour d’expérience',
      'Krisenende | Kriterien für das Ende der Krise sind festgelegt | Bedingungen für die Rückkehr zum Normalbetrieb; Prioritäten des Wiederanlaufs; Plan für Lessons Learned']
  ],
  operational: [
    ['Alert | The internal alert is raised and escalated quickly | Time from first signal to escalation; right people alerted',
      'Alerte | L’alerte interne est donnée et remontée rapidement | Délai entre le premier signal et l’escalade ; bonnes personnes alertées',
      'Alarmierung | Der interne Alarm wird schnell ausgelöst und eskaliert | Zeit vom ersten Signal bis zur Eskalation; die richtigen Personen alarmiert'],
    ['Impacts | Impacts are consolidated across systems, sites and activities | Impact map kept up to date; business owners consulted',
      'Impacts | Les impacts sont consolidés sur l’ensemble des systèmes, sites et activités | Cartographie des impacts tenue à jour ; responsables métier consultés',
      'Auswirkungen | Die Auswirkungen werden über Systeme, Standorte und Tätigkeiten hinweg konsolidiert | Auswirkungsübersicht aktuell gehalten; Fachverantwortliche einbezogen'],
    ['Action plan | Response actions are coordinated and tracked | Action tracker with owners and deadlines; follow-up at each situation point',
      'Plan d’action | Les actions de réponse sont coordonnées et suivies | Suivi des actions avec responsables et échéances ; revue à chaque point de situation',
      'Maßnahmenplan | Reaktionsmaßnahmen werden koordiniert und nachverfolgt | Maßnahmenliste mit Verantwortlichen und Fristen; Nachverfolgung in jeder Lagebesprechung'],
    ['Inject handling | Every inject is acknowledged, assigned and followed up | No inject forgotten; answers sent within a reasonable time',
      'Traitement des injects | Chaque inject est pris en compte, attribué et suivi | Aucun inject oublié ; réponses envoyées dans un délai raisonnable',
      'Inject-Bearbeitung | Jeder Inject wird bestätigt, zugewiesen und nachverfolgt | Kein Inject vergessen; Antworten in angemessener Zeit gesendet'],
    ['Reporting | The decision cell receives concise, decision-ready reports | Regular situation reports; options and recommendations proposed',
      'Remontée d’information | La cellule décisionnelle reçoit des synthèses concises, prêtes pour la décision | Points de situation réguliers ; options et recommandations proposées',
      'Berichterstattung | Die Entscheidungszelle erhält knappe, entscheidungsreife Berichte | Regelmäßige Lageberichte; Optionen und Empfehlungen vorgeschlagen'],
    ['Resources | Logistics and degraded means are organised | Out-of-band communication, workspace, staff rotation over a long crisis',
      'Moyens | La logistique et les moyens dégradés sont organisés | Communication hors bande, espace de travail, rotation des équipes sur une crise longue',
      'Ressourcen | Logistik und Notbetriebsmittel sind organisiert | Out-of-Band-Kommunikation, Arbeitsplätze, Schichtwechsel in einer langen Krise']
  ],
  communication: [
    ['Internal | Staff are informed quickly with clear instructions | First internal message; what to do and not to do; regular updates',
      'Interne | Le personnel est informé rapidement avec des consignes claires | Premier message interne ; ce qu’il faut faire et ne pas faire ; mises à jour régulières',
      'Intern | Die Mitarbeitenden werden schnell und mit klaren Anweisungen informiert | Erste interne Nachricht; was zu tun und zu lassen ist; regelmäßige Updates'],
    ['External | Customers, partners and authorities receive consistent messages | One version of the facts across channels; timing of each audience',
      'Externe | Clients, partenaires et autorités reçoivent des messages cohérents | Une seule version des faits sur tous les canaux ; calendrier adapté à chaque public',
      'Extern | Kunden, Partner und Behörden erhalten einheitliche Botschaften | Eine Version der Fakten über alle Kanäle; Timing je Zielgruppe'],
    ['Media | Media and social networks are monitored and answered | Monitoring in place; holding statement ready; press requests handled',
      'Médias | Les médias et les réseaux sociaux sont surveillés et traités | Veille en place ; déclaration d’attente prête ; demandes de la presse traitées',
      'Medien | Medien und soziale Netzwerke werden beobachtet und bedient | Monitoring eingerichtet; Holding Statement bereit; Presseanfragen bearbeitet'],
    ['Validation | Messages go through a fast validation circuit | Legal and decision cell validation; time from draft to release',
      'Validation | Les messages suivent un circuit de validation rapide | Validation par le juridique et la cellule décisionnelle ; délai entre le projet et la diffusion',
      'Freigabe | Botschaften durchlaufen einen schnellen Freigabeprozess | Freigabe durch Rechtsabteilung und Entscheidungszelle; Zeit vom Entwurf bis zur Veröffentlichung'],
    ['Accuracy | No premature disclosure, facts separated from assumptions | Unconfirmed information not published; corrections handled',
      'Exactitude | Pas de divulgation prématurée, faits distingués des hypothèses | Informations non confirmées non publiées ; rectifications gérées',
      'Genauigkeit | Keine vorzeitige Offenlegung, Fakten von Annahmen getrennt | Unbestätigte Informationen nicht veröffentlicht; Korrekturen gehandhabt'],
    ['Spokesperson | A spokesperson is designated and prepared | Key messages and Q&A ready; consistency with the decisions taken',
      'Porte-parole | Un porte-parole est désigné et préparé | Messages clés et questions-réponses prêts ; cohérence avec les décisions prises',
      'Sprecher | Ein Sprecher ist benannt und vorbereitet | Kernbotschaften und Fragen und Antworten bereit; Übereinstimmung mit den getroffenen Entscheidungen']
  ],
  it: [
    ['Detection | The nature and scope of the incident are identified | Type of attack, affected assets, indicators of compromise, initial vector',
      'Détection | La nature et le périmètre de l’incident sont identifiés | Type d’attaque, actifs touchés, indicateurs de compromission, vecteur initial',
      'Erkennung | Art und Umfang des Vorfalls werden ermittelt | Angriffsart, betroffene Systeme, Kompromittierungsindikatoren, initialer Vektor'],
    ['Containment | Containment decisions are proportionate and fast | Isolation, access cuts, account resets; business impact weighed',
      'Endiguement | Les décisions d’endiguement sont proportionnées et rapides | Isolement, coupures d’accès, réinitialisation de comptes ; impact métier pris en compte',
      'Eindämmung | Eindämmungsentscheidungen sind verhältnismäßig und schnell | Isolierung, Zugriffssperren, Kontorücksetzungen; geschäftliche Auswirkungen abgewogen'],
    ['Evidence | Evidence is preserved for the investigation | Logs, images, timeline kept; chain of custody',
      'Preuves | Les preuves sont préservées pour l’investigation | Journaux, images disque et chronologie conservés ; chaîne de conservation des preuves',
      'Beweissicherung | Beweise werden für die Untersuchung gesichert | Logs, Images und Zeitachse aufbewahrt; Beweiskette'],
    ['Recovery | Recovery is planned by business criticality | Trusted backups verified; restart order; clean rebuild',
      'Reprise | La reprise est planifiée selon la criticité métier | Sauvegardes saines vérifiées ; ordre de redémarrage ; reconstruction propre',
      'Wiederherstellung | Die Wiederherstellung wird nach geschäftlicher Kritikalität geplant | Vertrauenswürdige Backups geprüft; Reihenfolge des Wiederanlaufs; sauberer Neuaufbau'],
    ['External support | External experts and authorities are engaged | Incident response provider, CERT or CSIRT, national agency contacted',
      'Appui externe | Les experts externes et les autorités sont sollicités | Prestataire de réponse à incident, CERT ou CSIRT, agence nationale contactés',
      'Externe Unterstützung | Externe Fachleute und Behörden werden eingebunden | Incident-Response-Dienstleister, CERT oder CSIRT, nationale Behörde kontaktiert'],
    ['Reporting | Technical findings are explained in business terms | Clear briefings to the decision cell; confidence level stated',
      'Restitution | Les constats techniques sont expliqués en termes métier | Points clairs à la cellule décisionnelle ; niveau de confiance indiqué',
      'Berichterstattung | Technische Erkenntnisse werden in geschäftlichen Begriffen erklärt | Klare Briefings für die Entscheidungszelle; Vertrauensniveau angegeben']
  ],
  legal: [
    ['Obligations | Regulatory obligations are identified | GDPR (72 h), NIS2 (24 h / 72 h), sector regulators; applicable deadlines tracked',
      'Obligations | Les obligations réglementaires sont identifiées | RGPD (72 h), NIS2 (24 h / 72 h), régulateurs sectoriels ; délais applicables suivis',
      'Pflichten | Regulatorische Pflichten werden ermittelt | DSGVO (72 h), NIS2 (24 h / 72 h), Branchenaufsicht; geltende Fristen verfolgt'],
    ['Notifications | Notifications are prepared and sent on time | Content, recipients and deadlines; validation by the decision cell',
      'Notifications | Les notifications sont préparées et envoyées dans les délais | Contenu, destinataires et délais ; validation par la cellule décisionnelle',
      'Meldungen | Meldungen werden rechtzeitig vorbereitet und versendet | Inhalt, Empfänger und Fristen; Freigabe durch die Entscheidungszelle'],
    ['Complaint | A complaint and cooperation with law enforcement are handled | Complaint filed; evidence shared through the right channel',
      'Plainte | Le dépôt de plainte et la coopération avec les forces de l’ordre sont gérés | Plainte déposée ; preuves transmises par le bon canal',
      'Strafanzeige | Strafanzeige und Zusammenarbeit mit den Strafverfolgungsbehörden werden gehandhabt | Anzeige erstattet; Beweise über den richtigen Kanal übermittelt'],
    ['Insurance | The insurer is notified and the policy checked | Deadlines, covered costs, approved providers',
      'Assurance | L’assureur est notifié et le contrat vérifié | Délais, frais couverts, prestataires agréés',
      'Versicherung | Der Versicherer wird benachrichtigt und die Police geprüft | Fristen, gedeckte Kosten, zugelassene Dienstleister'],
    ['Contracts | Contractual exposure is assessed | Commitments to customers and suppliers; penalties and liability',
      'Contrats | L’exposition contractuelle est évaluée | Engagements envers les clients et les fournisseurs ; pénalités et responsabilité',
      'Verträge | Das vertragliche Risiko wird bewertet | Verpflichtungen gegenüber Kunden und Lieferanten; Vertragsstrafen und Haftung'],
    ['Review | External communications are legally reviewed | Wording checked for liability and admissions',
      'Relecture | Les communications externes sont relues sur le plan juridique | Formulations vérifiées au regard de la responsabilité et des aveux',
      'Prüfung | Externe Kommunikation wird rechtlich geprüft | Formulierungen auf Haftung und Eingeständnisse geprüft']
  ],
  business: [
    ['Impact assessment | Critical activities affected are identified | Processes, sites, customers impacted; financial and operational impact',
      'Analyse d’impact | Les activités critiques touchées sont identifiées | Processus, sites et clients impactés ; impact financier et opérationnel',
      'Auswirkungsanalyse | Betroffene kritische Tätigkeiten werden ermittelt | Prozesse, Standorte, betroffene Kunden; finanzielle und operative Auswirkungen'],
    ['Continuity plan | Business continuity plans and degraded modes are activated | Workarounds in place; roles and responsibilities applied',
      'Plan de continuité | Les plans de continuité d’activité et les modes dégradés sont activés | Solutions de contournement en place ; rôles et responsabilités appliqués',
      'Kontinuitätsplan | Business-Continuity-Pläne und Notbetrieb werden aktiviert | Umgehungslösungen eingerichtet; Rollen und Verantwortlichkeiten angewandt'],
    ['Priorities | Recovery is prioritised by criticality | Recovery time objectives respected; priorities shared with IT',
      'Priorités | La reprise est priorisée selon la criticité | Délais de reprise cibles respectés ; priorités partagées avec la DSI',
      'Prioritäten | Die Wiederherstellung wird nach Kritikalität priorisiert | Wiederanlaufziele eingehalten; Prioritäten mit der IT abgestimmt'],
    ['Customers and suppliers | Commitments to customers and suppliers are managed | Service levels, deliveries, alternative suppliers',
      'Clients et fournisseurs | Les engagements envers les clients et les fournisseurs sont tenus | Niveaux de service, livraisons, fournisseurs alternatifs',
      'Kunden und Lieferanten | Verpflichtungen gegenüber Kunden und Lieferanten werden gesteuert | Service-Levels, Lieferungen, alternative Lieferanten'],
    ['Resources | Staff, sites and alternatives are available | Back-up sites, key people, equipment',
      'Moyens | Personnel, sites et solutions de repli sont disponibles | Sites de repli, personnes clés, équipements',
      'Ressourcen | Personal, Standorte und Ausweichlösungen sind verfügbar | Ausweichstandorte, Schlüsselpersonen, Ausrüstung']
  ],
  hr: [
    ['People | Staff safety and wellbeing are protected | Information to employees; workload and fatigue; psychological support',
      'Personnes | La sécurité et le bien-être du personnel sont protégés | Information des salariés ; charge de travail et fatigue ; soutien psychologique',
      'Menschen | Sicherheit und Wohlbefinden der Mitarbeitenden werden geschützt | Information der Beschäftigten; Arbeitslast und Ermüdung; psychologische Unterstützung'],
    ['Organisation | Working arrangements are adapted | Remote work, rotations, overtime rules over a long crisis',
      'Organisation | L’organisation du travail est adaptée | Télétravail, rotations, règles d’heures supplémentaires sur une crise longue',
      'Organisation | Die Arbeitsorganisation wird angepasst | Homeoffice, Schichtwechsel, Überstundenregeln in einer langen Krise'],
    ['Social dialogue | Staff representatives are informed | Works council or unions informed at the right time',
      'Dialogue social | Les représentants du personnel sont informés | CSE ou syndicats informés au bon moment',
      'Sozialpartner | Die Arbeitnehmervertretung wird informiert | Betriebsrat oder Gewerkschaften rechtzeitig informiert'],
    ['Internal threat | Insider aspects are handled lawfully | Access reviews, investigations within the legal framework',
      'Menace interne | Les aspects de menace interne sont traités dans le respect du droit | Revues des accès, enquêtes dans le cadre légal',
      'Innentäter | Insider-Aspekte werden rechtmäßig behandelt | Zugriffsüberprüfungen, Untersuchungen im gesetzlichen Rahmen']
  ]
};

function evUid() {
  return typeof uid === 'function' ? uid('crit') : `crit_${Math.random().toString(36).slice(2, 10)}`;
}

function evDefaultCriteria(cell) {
  const column = { en: 0, fr: 1, de: 2 }[typeof currentLanguage === 'function' ? currentLanguage() : 'en'] || 0;
  return [...EV_COMMON_CRITERIA, ...(EV_CELL_CRITERIA[cell?.key] || [])]
    .map((row) => row[column].split(' | '))
    // Stable ids: the first mark given on a default sheet saves it with the same ids.
    .map(([category, text, observe], index) => ({ id: `crit_default_${index + 1}`, category, text, observe, rating: '', notes: '' }));
}

const EV_CODES = EV_RATING_LABELS.map(([code]) => code);
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
    <option value="">-</option>${evRatings().map(([code, text]) => `<option value="${code}" ${code === value ? 'selected' : ''} title="${escapeAttribute(text)}">${code}</option>`).join('')}
  </select>`;
}

function renderEvaluationView() {
  const project = appState.scenario;
  const cells = project.cells || [];
  const editLocked = EvAI.busy ? 'disabled' : '';
  if (!cells.length) {
    return `<section class="tab-page ev-page"><div class="tab-empty"><p>${tt('No player cell yet: create the cells of the exercise first, each one gets its evaluation sheet.', 'Aucune cellule de joueurs pour l’instant : créez d’abord les cellules de l’exercice, chacune reçoit sa grille d’évaluation.', 'Noch keine Spielerzelle: Legen Sie zuerst die Zellen der Übung an, jede erhält ihren Bewertungsbogen.')}</p><button class="btn btn-primary btn-sm" data-route="cells">${escapeHtml(tt('Cells & actors', 'Cellules et acteurs', 'Zellen und Akteure'))}</button></div></section>`;
  }
  const ui = evUI();
  const cell = cells.find((entry) => entry.id === ui.cell) || cells[0];
  ui.cell = cell.id;
  const busy = !!appState.ui?.actionLoading?.['ev-download-all'];
  const aiReady = typeof isLLMAvailable === 'function' && isLLMAvailable();
  return `<section class="tab-page ev-page">
    <article class="card ev-intro">
      <div class="ev-intro-text">
        <h3>${sbUiIcon('checkCircle', 18)} ${tt('Evaluation sheets', 'Grilles d’évaluation', 'Bewertungsbögen')}</h3>
        <p class="subtle">${tt('One sheet per cell for its evaluator: rate each criterion and each inject received, note what you observe, then sum up strengths and areas for improvement. Marks are saved with the project and included in the Excel files.', 'Une grille par cellule pour son évaluateur : notez chaque critère et chaque inject reçu, consignez vos observations, puis synthétisez les points forts et les axes d’amélioration. Les notes sont enregistrées avec le projet et reprises dans les fichiers Excel.', 'Ein Bogen pro Zelle für die bewertende Person: Jedes Kriterium und jeden erhaltenen Inject bewerten, Beobachtungen notieren, dann Stärken und Verbesserungsbereiche zusammenfassen. Die Bewertungen werden mit dem Projekt gespeichert und in die Excel-Dateien übernommen.')}</p>
        <div class="ev-scale">${evRatings().map(([code, label]) => `<span><b class="is-${code.replace('/', '')}">${code}</b> ${label}</span>`).join('')}</div>
      </div>
      <div class="ev-intro-actions">
        <button class="btn btn-secondary" data-ev-action="ai-update" ${aiReady && !EvAI.busy ? '' : 'disabled'} title="${escapeAttribute(aiReady ? tt('Adapt the criteria of every sheet to this scenario', 'Adapter les critères de chaque grille à ce scénario', 'Die Kriterien jedes Bogens an dieses Szenario anpassen') : tt('Configure an AI connection in Settings first', 'Configurez d’abord une connexion IA dans les Paramètres', 'Zuerst eine KI-Verbindung in den Einstellungen konfigurieren'))}">${sbUiIcon(EvAI.busy ? 'clock' : 'sparkles', 16)} ${EvAI.busy ? escapeHtml(EvAI.progress || tt('Updating…', 'Mise à jour…', 'Wird aktualisiert…')) : tt('Update with AI', 'Mettre à jour avec l’IA', 'Mit KI aktualisieren')}</button>
        ${EvAI.busy ? `<button class="btn btn-ghost btn-sm" data-ev-action="ai-stop">${tt('Stop', 'Arrêter', 'Stoppen')}</button>` : ''}
        <button class="btn btn-primary" data-ev-action="download-all" ${busy ? 'disabled' : ''}>${sbUiIcon(busy ? 'clock' : 'download', 16)} ${tt('Download all sheets (.zip)', 'Télécharger toutes les grilles (.zip)', 'Alle Bögen herunterladen (.zip)')}</button>
      </div>
      ${EvAI.error ? `<p class="agent-warning ev-ai-error">${escapeHtml(EvAI.error)}</p>` : ''}
    </article>
    <nav class="ev-cells" aria-label="${escapeAttribute(tt('Cells', 'Cellules', 'Zellen'))}">${cells.map((entry) => {
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
  const label = { rating: tt('Rating', 'Note', 'Bewertung'), observe: tt('What to observe', 'Points à observer', 'Beobachtungspunkte'), observed: tt('Reaction observed', 'Réaction observée', 'Beobachtete Reaktion'), reactionTime: tt('Time of reaction', 'Heure de la réaction', 'Zeitpunkt der Reaktion') };
  return `<article class="card ev-sheet" style="--cell-color:${escapeAttribute(cell.color)}">
    <header class="ev-sheet-head">
      <div><h3><span class="cell-dot"></span>${escapeHtml(cell.name)}</h3><p class="subtle">${escapeHtml(cell.description || '')}</p></div>
      <span class="ev-tally">${EV_CODES.filter((code) => code !== 'N/A').map((code) => `<b class="is-${code}" title="${escapeAttribute(evRatings().find(([c]) => c === code)[1])}">${code} ${tally.counts[code]}</b>`).join('')}<span>${tally.rated}/${tally.total} ${tt('rated', 'notés', 'bewertet')}</span></span>
      <span class="ev-sheet-actions">
        <button class="btn btn-ghost btn-xs" data-ev-action="reset" data-ev-cell="${cellId}" ${readOnly || sheet.isDefault ? 'disabled' : ''} title="${escapeAttribute(tt('Back to the default criteria of this type of cell, marks cleared', 'Revenir aux critères par défaut de ce type de cellule, notes effacées', 'Zurück zu den Standardkriterien dieses Zelltyps, Bewertungen gelöscht'))}">${tt('Reset', 'Réinitialiser', 'Zurücksetzen')}</button>
        <button class="btn btn-secondary btn-sm" data-ev-action="download" data-ev-cell="${cellId}">${sbUiIcon('download', 14)} ${tt('Download (.xlsx)', 'Télécharger (.xlsx)', 'Herunterladen (.xlsx)')}</button>
      </span>
    </header>
    <label class="field ev-evaluator">${tt('Evaluator', 'Évaluateur', 'Bewertende Person')}<input type="text" data-ev-field="${field('sheet', 'evaluator')}" value="${escapeAttribute(sheet.evaluator || '')}" placeholder="${escapeAttribute(tt('Name of the evaluator', 'Nom de l’évaluateur', 'Name der bewertenden Person'))}" ${readOnly}></label>
    <h4 class="ev-section">${tt('Criteria', 'Critères', 'Kriterien')}${sheet.adapted_at ? ` <small>${tt('adapted to the scenario with AI', 'adaptés au scénario avec l’IA', 'mit KI an das Szenario angepasst')}</small>` : sheet.isDefault ? ` <small>${tt('default criteria for this type of cell', 'critères par défaut pour ce type de cellule', 'Standardkriterien für diesen Zelltyp')}</small>` : ''}</h4>
    <table class="ev-table ev-criteria">
      <thead><tr><th>${tt('Category', 'Catégorie', 'Kategorie')}</th><th>${tt('Criterion and what to observe', 'Critère et points à observer', 'Kriterium und Beobachtungspunkte')}</th><th>${label.rating}</th><th>${tt('Observations and evidence', 'Observations et éléments de preuve', 'Beobachtungen und Nachweise')}</th><th></th></tr></thead>
      <tbody>${sheet.criteria.map((criterion) => `<tr>
        <td><input type="text" data-ev-field="${field('crit', criterion.id, 'category')}" value="${escapeAttribute(criterion.category)}" aria-label="${escapeAttribute(tt('Category', 'Catégorie', 'Kategorie'))}" ${readOnly}></td>
        <td class="ev-criterion"><textarea rows="2" data-ev-field="${field('crit', criterion.id, 'text')}" aria-label="${escapeAttribute(tt('Criterion', 'Critère', 'Kriterium'))}" ${readOnly}>${escapeHtml(criterion.text)}</textarea><textarea rows="2" class="ev-observe" data-ev-field="${field('crit', criterion.id, 'observe')}" aria-label="${escapeAttribute(label.observe)}" placeholder="${escapeAttribute(label.observe)}" ${readOnly}>${escapeHtml(criterion.observe)}</textarea></td>
        <td>${evRatingSelect(field('crit', criterion.id, 'rating'), criterion.rating, readOnly, label.rating)}</td>
        <td><textarea rows="3" data-ev-field="${field('crit', criterion.id, 'notes')}" aria-label="${escapeAttribute(tt('Observations', 'Observations', 'Beobachtungen'))}" placeholder="${escapeAttribute(tt('What the cell did, with times', 'Ce que la cellule a fait, avec les heures', 'Was die Zelle getan hat, mit Uhrzeiten'))}" ${readOnly}>${escapeHtml(criterion.notes || '')}</textarea></td>
        <td><button class="sb-icon-btn is-danger" data-ev-action="delete" data-ev-cell="${cellId}" data-ev-criterion="${escapeAttribute(criterion.id)}" title="${escapeAttribute(tt('Remove', 'Supprimer', 'Entfernen'))}" ${readOnly}>${sbUiIcon('trash', 13)}</button></td>
      </tr>`).join('')}</tbody>
    </table>
    <button class="btn btn-ghost btn-xs ev-add" data-ev-action="add" data-ev-cell="${cellId}" ${readOnly}>${sbUiIcon('plus', 12)} ${tt('Criterion', 'Critère', 'Kriterium')}</button>
    <h4 class="ev-section">${tt('Injects received', 'Injects reçus', 'Erhaltene Injects')} <small>${injects.length}</small></h4>
    ${injects.length ? `<table class="ev-table ev-injects">
      <thead><tr><th>${tt('Time', 'Heure', 'Zeit')}</th><th>${tt('Inject and reaction expected', 'Inject et réaction attendue', 'Inject und erwartete Reaktion')}</th><th>${label.rating}</th><th>${label.observed}</th><th>${label.reactionTime}</th></tr></thead>
      <tbody>${injects.map((inject) => {
        const mark = evMark(sheet, inject);
        const key = evInjectKey(inject);
        return `<tr>
          <td class="ev-time"><b>${escapeHtml(sbFormatOffset(inject.time))}</b>${inject.numberLabel ? `<small>${escapeHtml(inject.numberLabel)}</small>` : ''}</td>
          <td class="ev-inject"><strong>${escapeHtml(inject.title || '')}</strong>${inject.intent ? `<span class="subtle">${escapeHtml(inject.intent)}</span>` : ''}</td>
          <td>${evRatingSelect(field('inject', key, 'rating'), mark.rating, readOnly, label.rating)}</td>
          <td><textarea rows="2" data-ev-field="${field('inject', key, 'observed')}" aria-label="${escapeAttribute(label.observed)}" ${readOnly}>${escapeHtml(mark.observed)}</textarea></td>
          <td><input type="text" data-ev-field="${field('inject', key, 'time')}" value="${escapeAttribute(mark.time)}" placeholder="H+0:20" aria-label="${escapeAttribute(label.reactionTime)}" ${readOnly}></td>
        </tr>`;
      }).join('')}</tbody>
    </table>` : `<p class="subtle">${tt('No inject reaches this cell yet.', 'Aucun inject n’atteint encore cette cellule.', 'Noch erreicht kein Inject diese Zelle.')}</p>`}
    <div class="ev-summary">
      <label class="field">${tt('Strengths', 'Points forts', 'Stärken')}<textarea rows="4" data-ev-field="${field('sheet', 'strengths')}" placeholder="${escapeAttribute(tt('What worked well', 'Ce qui a bien fonctionné', 'Was gut funktioniert hat'))}" ${readOnly}>${escapeHtml(sheet.strengths || '')}</textarea></label>
      <label class="field">${tt('Areas for improvement', 'Axes d’amélioration', 'Verbesserungsbereiche')}<textarea rows="4" data-ev-field="${field('sheet', 'improvements')}" placeholder="${escapeAttribute(tt('What to improve, and how', 'Ce qu’il faut améliorer, et comment', 'Was zu verbessern ist, und wie'))}" ${readOnly}>${escapeHtml(sheet.improvements || '')}</textarea></label>
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
      if (!window.confirm(tt(`Reset the sheet of the ${cell.name} to the default criteria? Its marks and notes are cleared.`, `Réinitialiser la grille de la cellule ${cell.name} avec les critères par défaut ? Ses notes et observations seront effacées.`, `Den Bogen der Zelle ${cell.name} auf die Standardkriterien zurücksetzen? Ihre Bewertungen und Notizen werden gelöscht.`))) return;
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
    const result = await agentCall((callSignal) => AITextGenerator.generate('evaluation', this.systemPrompt(), user, true, 4000, { signal: callSignal, strictJSON: true, promptFilter: agentRedact, timeoutMs: SB_AI_TIMEOUT }), signal, SB_AI_TIMEOUT);
    const criteria = (Array.isArray(result?.criteria) ? result.criteria : [])
      .filter((item) => item && typeof item === 'object' && typeof item.text === 'string' && item.text.trim())
      .slice(0, 20)
      .map((item) => evNormalizeCriterion({ category: String(item.category || ''), text: item.text.trim(), observe: String(item.observe || '') }));
    if (!criteria.length) throw new Error(tt(`The AI proposed no criterion for the ${cell.name}.`, `L’IA n’a proposé aucun critère pour la cellule ${cell.name}.`, `Die KI hat für die Zelle ${cell.name} kein Kriterium vorgeschlagen.`));
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
    if (!isLLMAvailable()) { pushToast(tt('Configure an AI connection in Settings first.', 'Configurez d’abord une connexion IA dans les Paramètres.', 'Zuerst eine KI-Verbindung in den Einstellungen konfigurieren.'), 'error'); return; }
    const cells = project.cells || [];
    const rated = cells.some((cell) => evSheet(project, cell).criteria.some((criterion) => criterion.rating || criterion.notes));
    if (rated && !window.confirm(tt('Adapt every sheet to the scenario with AI? Criteria are rewritten: marks on a criterion that changes are cleared (marks on injects stay).', 'Adapter chaque grille au scénario avec l’IA ? Les critères sont réécrits : les notes d’un critère modifié sont effacées (les notes des injects sont conservées).', 'Jeden Bogen mit KI an das Szenario anpassen? Die Kriterien werden neu geschrieben: Bewertungen eines geänderten Kriteriums werden gelöscht (Bewertungen der Injects bleiben).'))) return;
    this.busy = true; this.error = ''; this.controller = new AbortController();
    const signal = this.controller.signal;
    const failed = [];
    try {
      for (const [index, cell] of cells.entries()) {
        if (signal.aborted || appState.scenario !== project) break;
        this.progress = tt(`Adapting ${index + 1}/${cells.length}: ${cell.name}…`, `Adaptation ${index + 1}/${cells.length} : ${cell.name}…`, `Anpassung ${index + 1}/${cells.length}: ${cell.name}…`);
        App.render();
        try { await this.updateCell(project, cell, signal); saveLocal(false); }
        catch (error) {
          if (error?.name === 'AbortError' || signal.aborted) break;
          failed.push(`${cell.name}: ${typeof sbErrorMessage === 'function' ? sbErrorMessage(error) : error.message}`);
        }
      }
      if (signal.aborted) pushToast(tt('Update stopped. The sheets already adapted are kept.', 'Mise à jour arrêtée. Les grilles déjà adaptées sont conservées.', 'Aktualisierung gestoppt. Die bereits angepassten Bögen bleiben erhalten.'), 'info');
      else if (failed.length) { this.error = `${tt('Not adapted:', 'Non adaptées :', 'Nicht angepasst:')} ${failed.join(' | ')}`.slice(0, 900); pushToast(tt(`${cells.length - failed.length}/${cells.length} sheet(s) adapted.`, `${cells.length - failed.length}/${cells.length} grille(s) adaptée(s).`, `${cells.length - failed.length} von ${cells.length} Bögen angepasst.`), failed.length === cells.length ? 'error' : 'info'); }
      else pushToast(tt(`${cells.length} evaluation sheet(s) adapted to the scenario.`, `${cells.length} grille(s) d’évaluation adaptée(s) au scénario.`, `Bewertungsbögen an das Szenario angepasst: ${cells.length}.`), 'success');
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
  // French puts a space before the colon.
  const colon = tt(':', ' :', ':');
  const ratingHead = `${tt('Rating', 'Note', 'Bewertung')} (P/S/M/U/N/A)`;
  const rows = [
    [`${tt('Evaluation sheet', 'Grille d’évaluation', 'Bewertungsbogen')} · ${cell.name}`],
    [`${tt('Exercise', 'Exercice', 'Übung')}${colon} ${project.name || ''}`, '', `${tt('Date', 'Date', 'Datum')}${colon} ${project.scenario?.start_date ? String(project.scenario.start_date).slice(0, 10) : ''}`, '', `${tt('Evaluator', 'Évaluateur', 'Bewertende Person')}${colon} ${sheet.evaluator || ''}`],
    [`${tt('Mission', 'Mission', 'Auftrag')}${colon} ${cell.description || ''}`],
    project.scenario?.learning_objectives ? [`${tt('Learning objectives', 'Objectifs pédagogiques', 'Lernziele')}${colon} ${project.scenario.learning_objectives}`] : null,
    [],
    [`${tt('Rating', 'Notation', 'Bewertung')}${colon} ${evRatings().map(([code, label]) => `${code} = ${label}`).join(' · ')}`],
    [`${tt('Marks', 'Notes', 'Bewertungen')}${colon} ${EV_CODES.map((code) => `${code} ${tally.counts[code]}`).join(' · ')} (${tally.rated}/${tally.total} ${tt('rated', 'notés', 'bewertet')})`],
    [],
    [tt('Category', 'Catégorie', 'Kategorie'), tt('Criterion', 'Critère', 'Kriterium'), tt('What to observe', 'Points à observer', 'Beobachtungspunkte'), ratingHead, tt('Observations and evidence', 'Observations et éléments de preuve', 'Beobachtungen und Nachweise')],
    ...sheet.criteria.map((criterion) => [criterion.category, criterion.text, criterion.observe, evRatingLabel(criterion.rating), criterion.notes || '']),
    [],
    [tt('Injects received', 'Injects reçus', 'Erhaltene Injects')],
    [tt('Time', 'Heure', 'Zeit'), tt('No.', 'N°', 'Nr.'), 'Inject', tt('Reaction or decision expected', 'Réaction ou décision attendue', 'Erwartete Reaktion oder Entscheidung'), tt('Observed reaction', 'Réaction observée', 'Beobachtete Reaktion'), tt('Time of reaction', 'Heure de la réaction', 'Zeitpunkt der Reaktion'), ratingHead],
    ...injects.map((inject) => {
      const mark = evMark(sheet, inject);
      return [sbFormatOffset(inject.time), inject.numberLabel || '', inject.title || '', inject.intent || '', mark.observed, mark.time, evRatingLabel(mark.rating)];
    }),
    [],
    [tt('Strengths', 'Points forts', 'Stärken')], ...(sheet.strengths ? sheet.strengths.split('\n').map((line) => [line]) : [[''], ['']]),
    [],
    [tt('Areas for improvement', 'Axes d’amélioration', 'Verbesserungsbereiche')], ...(sheet.improvements ? sheet.improvements.split('\n').map((line) => [line]) : [[''], ['']])
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
    [`${tt('Evaluation overview', 'Synthèse de l’évaluation', 'Bewertungsübersicht')} · ${project.name || ''}`], [],
    [tt('Cell', 'Cellule', 'Zelle'), tt('Evaluator', 'Évaluateur', 'Bewertende Person'), ...EV_CODES, tt('Rated', 'Notés', 'Bewertet'), tt('Total', 'Total', 'Gesamt')],
    ...cells.map((cell) => { const tally = evTally(project, cell); return [cell.name, evSheet(project, cell).evaluator || '', ...EV_CODES.map((code) => tally.counts[code]), tally.rated, tally.total]; })
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 32 }, { wch: 24 }, ...EV_CODES.map(() => ({ wch: 7 })), { wch: 8 }, { wch: 8 }];
  return ws;
}

function evWorkbook(project, cells, { overview = false } = {}) {
  const wb = XLSX.utils.book_new();
  const overviewName = tt('Overview', 'Synthèse', 'Übersicht');
  const used = new Set([overviewName.toLowerCase()]);
  if (overview) XLSX.utils.book_append_sheet(wb, evOverviewSheet(project, cells), overviewName);
  cells.forEach((cell, index) => {
    const fallback = `${tt('Cell', 'Cellule', 'Zelle')} ${index + 1}`;
    let name = String(cell.name || fallback).replace(/[\\/?*[\]:]/g, ' ').slice(0, 28).trim() || fallback;
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
    script.onload = () => (window[global] ? resolve() : reject(new Error(tt(`${global} did not load.`, `${global} ne s’est pas chargé.`, `${global} wurde nicht geladen.`))));
    script.onerror = () => reject(new Error(tt(`Could not load ${src}. Check your connection and reload the page.`, `Impossible de charger ${src}. Vérifiez votre connexion et rechargez la page.`, `${src} konnte nicht geladen werden. Prüfen Sie Ihre Verbindung und laden Sie die Seite neu.`)));
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
    pushToast(tt(`Evaluation sheet of the ${cell.name} downloaded.`, `Grille d’évaluation de la cellule ${cell.name} téléchargée.`, `Bewertungsbogen der Zelle ${cell.name} heruntergeladen.`), 'success');
  } catch (error) {
    if (typeof CrisisError !== 'undefined') CrisisError.toast(error, { operation: tt('Download an evaluation sheet', 'Télécharger une grille d’évaluation', 'Bewertungsbogen herunterladen') });
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
    pushToast(tt(`${cells.length} evaluation sheet(s) downloaded.`, `${cells.length} grille(s) d’évaluation téléchargée(s).`, `Bewertungsbögen heruntergeladen: ${cells.length}.`), 'success');
  } catch (error) {
    if (typeof CrisisError !== 'undefined') CrisisError.toast(error, { operation: tt('Download the evaluation sheets', 'Télécharger les grilles d’évaluation', 'Bewertungsbögen herunterladen') });
    else pushToast(error.message || String(error), 'error');
  } finally {
    appState.ui.actionLoading = { ...(appState.ui.actionLoading || {}), 'ev-download-all': false };
    App.render();
  }
}

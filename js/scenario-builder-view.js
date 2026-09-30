/* Scenario Builder tab: multi-track storyboard editor in the spirit of a video
   editing suite (bin, program monitor, timeline, inspector). */

/* Compact layout for laptop screens (13" and similar). */
function sbCompact() {
  return typeof window !== 'undefined' && Number(window.innerWidth) > 0 && window.innerWidth < 1440;
}
function sbHeaderWidth() {
  return sbCompact() ? 150 : 188;
}
function sbRowHeight(main) {
  if (main && appState.route === 'storyline') return sbCompact() ? 104 : 120;
  return sbCompact() ? (main ? 66 : 56) : (main ? 78 : 66);
}

/* Which side panels are open; remembered per browser. */
const SB_ZOOM_MIN = 0.6;
const SB_ZOOM_MAX = 24;
const SB_WORKSTREAM_DEFAULTS = ['technical', 'governance', 'communication', 'legal', 'business'];

function sbUI() {
  if (!appState.ui.builder) {
    appState.ui.builder = {
      selected: [],
      zoom: null,
      snap: 5,
      ripple: false,
      bin: 'blocks',
      inspector: 'brief',
      playhead: 0,
      scrollLeft: 0,
      scrollTop: 0,
      modal: null,
      libraryCategory: '',
      previewId: null,
      diffVersionId: null,
      impacts: null,
      generate: { scope: 'all', plan: true, cast: true, write: true },
      skeleton: { brief: '', duration: null, injects: '', tracks: [...SB_WORKSTREAM_DEFAULTS] },
      rewrite: '',
      versionLabel: '',
      templateName: '',
      focus: null
    };
  }
  return appState.ui.builder;
}

function sbStoryboard() {
  return StoryboardHistory.ensure(appState.scenario);
}

function sbSelectedBlock() {
  const ui = sbUI();
  const storyboard = sbStoryboard();
  ui.selected = ui.selected.filter((id) => sbBlock(storyboard, id));
  return ui.selected.length === 1 ? sbBlock(storyboard, ui.selected[0]) : null;
}

function sbBusy() {
  return !!(SbAI.busy || SbPipeline.active);
}

function sbReadOnly() {
  const agent = typeof crisisAgentRunner !== 'undefined' ? crisisAgentRunner : null;
  return sbBusy() || !!(agent?.active || agent?.busy);
}

/* Block types, stress levels and track presets keep their English values in the data
   (scenario-model.js); these give their names in the application language. */
const SB_BLOCK_TYPE_TEXT = {
  trigger: [['Déclenchement et détection', 'Signaux faibles, premières alertes et l’événement qui déclenche la crise.'], ['Auslöser und Erkennung', 'Schwache Signale, erste Alarme und das Ereignis, das die Krise auslöst.']],
  investigation: [['Investigation et qualification', 'Comprendre ce qui s’est passé : périmètre, attaquant, actifs touchés, premières hypothèses.'], ['Untersuchung und Einordnung', 'Verstehen, was passiert ist: Umfang, Angreifer, betroffene Systeme, erste Hypothesen.']],
  containment: [['Confinement et isolement', 'Isoler les systèmes, couper les accès, arbitrer entre impact métier et propagation.'], ['Eindämmung und Isolierung', 'Systeme isolieren, Zugänge sperren, geschäftliche Auswirkungen gegen Ausbreitung abwägen.']],
  eradication: [['Éradication de la menace', 'Chasser l’attaquant, réinitialiser les identifiants, supprimer les persistances.'], ['Beseitigung der Bedrohung', 'Angreifer entfernen, Zugangsdaten zurücksetzen, Persistenz bereinigen.']],
  continuity: [['Continuité d’activité', 'Mode dégradé, solutions de contournement, priorités pour les activités critiques.'], ['Geschäftskontinuität', 'Notbetrieb, Umgehungslösungen, Prioritäten für kritische Tätigkeiten.']],
  recovery: [['Reprise et reconstruction', 'Restaurer, reconstruire et redémarrer les services de façon maîtrisée.'], ['Wiederherstellung und Wiederaufbau', 'Dienste vertrauenswürdig wiederherstellen, neu aufbauen und neu starten.']],
  exit: [['Sortie de crise et retour d’expérience', 'Clore la crise, communiquer, tirer les enseignements.'], ['Krisenende und Lessons Learned', 'Krise abschließen, kommunizieren, Lessons Learned festhalten.']],
  twist: [['Rebondissement / escalade', 'Un événement aggravant qui accroît la pression ou change la situation.'], ['Wendung / Eskalation', 'Ein verschärfendes Ereignis, das den Druck erhöht oder die Lage verändert.']],
  crisis_cell: [['Cellule de crise et gouvernance', 'Activation, rôles, rythme de décision, arbitrages de la direction.'], ['Krisenstab und Governance', 'Aktivierung, Rollen, Entscheidungsrhythmus, Abwägungen der Geschäftsleitung.']],
  communication: [['Communication', 'Messages internes, médias, réseaux sociaux, déclarations publiques.'], ['Kommunikation', 'Interne Nachrichten, Medien, soziale Netzwerke, öffentliche Erklärungen.']],
  legal: [['Juridique et réglementaire', 'Notifications (RGPD, NIS2, sectorielles), plainte, assureurs, contrats.'], ['Recht und Regulierung', 'Meldungen (DSGVO, NIS2, Branche), Strafanzeige, Versicherer, Verträge.']],
  hr: [['RH et collaborateurs', 'Information du personnel, charge de travail, syndicats, bien-être, menace interne.'], ['Personal und Mitarbeitende', 'Information der Mitarbeitenden, Arbeitslast, Gewerkschaften, Wohlbefinden, Innentäter.']],
  logistics: [['Logistique', 'Locaux, équipements, salle de crise, fournisseurs, opérations physiques.'], ['Logistik', 'Räumlichkeiten, Ausstattung, Krisenraum, Lieferanten, physische Abläufe.']],
  customers: [['Clients et partenaires', 'Clients, partenaires et fournisseurs qui posent des questions ou mettent la pression.'], ['Kunden und Partner', 'Kunden, Partner und Lieferanten, die Fragen stellen oder Druck ausüben.']],
  custom: [['Bloc personnalisé', 'Tout ce qui est propre à votre exercice.'], ['Eigener Block', 'Alles, was für Ihre Übung spezifisch ist.']]
};
function sbBlockTypeText(key, index) {
  const type = SB_BLOCK_TYPES[key] || SB_BLOCK_TYPES.custom;
  const text = SB_BLOCK_TYPE_TEXT[SB_BLOCK_TYPES[key] ? key : 'custom'];
  const english = index ? type.hint : type.label;
  return tt(english, text?.[0]?.[index] || english, text?.[1]?.[index] || english);
}
function sbBlockTypeLabel(key) { return sbBlockTypeText(key, 0); }
function sbBlockTypeHint(key) { return sbBlockTypeText(key, 1); }
const SB_STRESS_TEXT = { 1: ['Calme', 'Ruhig'], 2: ['Faible', 'Niedrig'], 3: ['Tension', 'Anspannung'], 4: ['Élevé', 'Hoch'], 5: ['Pic', 'Höhepunkt'] };
function sbStressLabel(level) {
  const item = sbStressLevel(level);
  return tt(item.label, SB_STRESS_TEXT[item.level]?.[0] || item.label, SB_STRESS_TEXT[item.level]?.[1] || item.label);
}
const SB_TRACK_TEXT = {
  main: ['Storyline principale', 'Haupt-Storyline'], technical: ['Réponse technique', 'Technische Reaktion'], governance: ['Cellule de crise et décisions', 'Krisenstab und Entscheidungen'],
  communication: ['Communication', 'Kommunikation'], legal: ['Juridique et réglementaire', 'Recht und Regulierung'], business: ['Métier et continuité', 'Geschäft und Kontinuität'], people: ['Collaborateurs et logistique', 'Personal und Logistik']
};
/* A track still named after its preset shows the preset name in the application language. */
function sbTrackDisplayName(track) {
  const preset = SB_TRACK_PRESETS.find((item) => item.key === track.key);
  return preset && track.name === preset.name ? sbTrackPresetName(track.key) : track.name;
}
function sbTrackPresetName(key) {
  const preset = SB_TRACK_PRESETS.find((item) => item.key === key);
  if (!preset) return key || '';
  return tt(preset.name, SB_TRACK_TEXT[key]?.[0] || preset.name, SB_TRACK_TEXT[key]?.[1] || preset.name);
}
const SB_LIBRARY_CATEGORY_TEXT = {
  'Cyber attack': ['Cyberattaque', 'Cyberangriff'], Data: ['Données', 'Daten'], 'Third party': ['Tiers', 'Drittanbieter'],
  Fraud: ['Fraude', 'Betrug'], Operational: ['Opérationnel', 'Betrieb'], Custom: ['Personnalisé', 'Eigene']
};
function sbLibraryCategoryLabel(category) {
  const text = SB_LIBRARY_CATEGORY_TEXT[category];
  return text ? tt(category, text[0], text[1]) : category;
}
/* Undo/redo step names (stored in English), shown in the application language. */
const SB_HISTORY_TEXT = {
  'Rewrite block': ['Réécriture du bloc', 'Block neu schreiben'], 'Deepen block': ['Détail du bloc', 'Block vertiefen'], 'Suggest roles': ['Suggestion de rôles', 'Rollen vorschlagen'],
  'Plan injects': ['Planification des injects', 'Injects planen'], 'Resize block': ['Redimensionnement du bloc', 'Blockgröße ändern'], 'Reorder tracks': ['Réorganisation des pistes', 'Spuren neu ordnen'],
  'Remove role': ['Suppression du rôle', 'Rolle entfernen'], 'Move block': ['Déplacement du bloc', 'Block verschieben'], 'Move blocks': ['Déplacement des blocs', 'Blöcke verschieben'],
  'Move block to track': ['Déplacement du bloc vers une piste', 'Block in Spur verschieben'], 'Edit role': ['Modification du rôle', 'Rolle bearbeiten'],
  'Edit planned inject': ['Modification de l’inject prévu', 'Geplanten Inject bearbeiten'], 'Duplicate block': ['Duplication du bloc', 'Block duplizieren'],
  'Delete block': ['Suppression du bloc', 'Block löschen'], 'Delete blocks': ['Suppression des blocs', 'Blöcke löschen'], 'Delete track': ['Suppression de la piste', 'Spur löschen'],
  'Add role': ['Ajout d’un rôle', 'Rolle hinzufügen'],
  'Lock block': ['Verrouillage du bloc', 'Block sperren'], 'Unlock block': ['Déverrouillage du bloc', 'Block entsperren'],
  'Edit inject': ['Modification de l’inject', 'Inject bearbeiten'], 'Rename track': ['Renommage de la piste', 'Spur umbenennen'], 'Move main event': ['Déplacement de l’événement principal', 'Hauptereignis verschieben'],
  'Move inject': ['Déplacement de l’inject', 'Inject verschieben'], 'Mark as validated': ['Marquage comme validé', 'Als freigegeben markieren'], 'Link actors': ['Liaison des acteurs', 'Akteure verknüpfen'],
  'Generate injects': ['Génération des injects', 'Injects generieren'], 'Edit objectives': ['Modification des objectifs', 'Ziele bearbeiten'], 'Edit main event': ['Modification de l’événement principal', 'Hauptereignis bearbeiten'],
  'Delete main event': ['Suppression de l’événement principal', 'Hauptereignis löschen'], 'Delete inject': ['Suppression de l’inject', 'Inject löschen'], 'Delete cell': ['Suppression de la cellule', 'Zelle löschen'],
  'Delete actor': ['Suppression de l’acteur', 'Akteur löschen'], 'Create actors': ['Création des acteurs', 'Akteure erstellen'], 'Change duration': ['Changement de durée', 'Dauer ändern'],
  'Add main event': ['Ajout d’un événement principal', 'Hauptereignis hinzufügen'], 'Add inject': ['Ajout d’un inject', 'Inject hinzufügen'], 'Add cell': ['Ajout d’une cellule', 'Zelle hinzufügen'],
  'Update: re-plan phases': ['Mise à jour : nouvelle planification des phases', 'Aktualisierung: Phasen neu planen']
};
function sbHistoryLabel(label) {
  const text = SB_HISTORY_TEXT[label];
  return text ? tt(label, text[0], text[1]) : label;
}

function sbOption(value, label, current) {
  return `<option value="${escapeAttribute(value)}" ${String(value) === String(current) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function sbChannelColor(channel) {
  return CHANNEL_META[channel]?.color || '#6d687e';
}

function sbSvg(path, size = 16) {
  return `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
const SB_UI_ICONS = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>',
  wand: '<path d="m15 4 5 5"/><path d="M4 20 16 8"/><path d="M19 13v4"/><path d="M17 15h4"/><path d="M8 3v3"/><path d="M6.5 4.5h3"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  play: '<path d="m6 4 14 8-14 8z"/>',
  sync: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
  magnet: '<path d="M6 15a6 6 0 0 0 12 0V4h-4v11a2 2 0 0 1-4 0V4H6z"/><path d="M6 8h4"/><path d="M14 8h4"/>',
  ripple: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  agent: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  open: '<path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v7H3V3h7"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
  filePlus: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M12 12v6"/><path d="M9 15h6"/>',
  folderOpen: '<path d="M3 19V5a2 2 0 0 1 2-2h4l2 3h7a2 2 0 0 1 2 2v2"/><path d="M3 19l2.5-8H22l-2.5 8z"/>',
  sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>',
  book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
  demo: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  braces: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
  archive: '<rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 3v4"/><path d="M17 5h4"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 4v4"/><circle cx="12" cy="3" r="1"/><path d="M9 13v2"/><path d="M15 13v2"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  paperclip: '<path d="m21 12-8.6 8.6a5 5 0 0 1-7-7l8.5-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.3-2.3l8-8"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3z"/><path d="M3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
  pause: '<path d="M8 5v14"/><path d="M16 5v14"/>',
  rewind: '<path d="m19 20-10-8 10-8z"/><path d="M5 19V5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>'
};
function sbUiIcon(name, size = 16) {
  return sbSvg(SB_UI_ICONS[name] || '', size);
}


function renderSbStatusBar() {
  const busy = SbAI.busy || (SbPipeline.active ? SbPipeline.label || tt('Generating', 'Génération', 'Generierung') : '');
  if (busy) {
    const progress = SbPipeline.active && SbPipeline.total ? Math.round(100 * SbPipeline.step / SbPipeline.total) : null;
    return `<div class="sb-statusbar is-busy" role="status"><span class="ai-spinner"></span><span>${escapeHtml(busy)}…</span>${progress !== null ? `<span class="sb-progress"><i style="width:${progress}%"></i></span>` : '<span class="sb-progress is-indeterminate"><i></i></span>'}<button class="btn btn-secondary btn-xs" data-sb-action="${SbPipeline.active ? 'stop-pipeline' : 'stop-ai'}">${sbUiIcon('stop', 12)} ${escapeHtml(tt('Stop', 'Arrêter', 'Stoppen'))}</button></div>`;
  }
  if (SbAI.lastError) return `<div class="sb-statusbar is-error" role="alert"><span>${sbUiIcon('alert', 14)} ${escapeHtml(SbAI.lastError)}</span><button class="btn btn-secondary btn-xs" data-sb-action="dismiss-error">${escapeHtml(tt('Dismiss', 'Ignorer', 'Schließen'))}</button></div>`;
  return '';
}

// ── Bin (left panel) ─────────────────────────────────────────────────────────
function renderSbLibrary() {
  const ui = sbUI();
  ui.libraryCategory = ui.libraryCategory || '';
  const entries = sbLibraryEntries();
  const categories = [...new Set(entries.map((entry) => entry.category || 'Custom'))];
  const inCategory = entries.filter((entry) => !ui.libraryCategory || (entry.category || 'Custom') === ui.libraryCategory);
  // The query survives a category change and a re-render: both filters apply.
  const query = String(ui.libraryQuery || '');
  const matches = inCategory.filter((template) => sbTemplateMatches(template, query)).length;
  return `<div class="sb-library-tools">
      <input type="search" class="sb-search" data-sb-filter="library" value="${escapeAttribute(query)}" placeholder="${escapeAttribute(tt('Search scenarios…', 'Rechercher des scénarios…', 'Szenarien suchen…'))}" aria-label="${escapeAttribute(tt('Search the library', 'Rechercher dans la bibliothèque', 'Bibliothek durchsuchen'))}">
      <div class="sb-chips">${['', ...categories].map((category) => `<button class="sb-filter-chip ${ui.libraryCategory === category ? 'active' : ''}" data-sb-action="library-category" data-sb-value="${escapeAttribute(category)}">${escapeHtml(category ? sbLibraryCategoryLabel(category) : tt('All', 'Tous', 'Alle'))}</button>`).join('')}</div>
    </div>
    <div class="sb-library-list">
      ${inCategory.map((template) => renderSbTemplateCard(template, !sbTemplateMatches(template, query))).join('')}
      <p class="sb-empty" data-sb-library-empty ${matches ? 'hidden' : ''}>${escapeHtml(sbLibraryEmptyText(query, inCategory.length))}</p>
    </div>
    <div class="sb-library-footer">
      <label class="sb-mini-field">${escapeHtml(tt('Save the current storyboard as a template', 'Enregistrer le storyboard actuel comme modèle', 'Aktuelles Storyboard als Vorlage speichern'))}
        <span class="sb-inline"><input type="text" data-sb-ui="templateName" value="${escapeAttribute(ui.templateName)}" placeholder="${escapeAttribute(tt('Template name', 'Nom du modèle', 'Name der Vorlage'))}"><button class="btn btn-secondary btn-xs" data-sb-action="save-template">${escapeHtml(tt('Save', 'Enregistrer', 'Speichern'))}</button></span>
      </label>
    </div>`;
}

function sbMiniTimeline(template) {
  const duration = Number(template.duration_minutes) || SB_DEFAULT_DURATION;
  const blocks = Array.isArray(template.blocks) ? template.blocks : [];
  const rows = [...new Set(blocks.map((block) => block.track || 'main'))];
  return `<div class="sb-mini-timeline" aria-hidden="true">${rows.slice(0, 5).map((row) => `<div class="sb-mini-row ${row === 'main' ? 'is-main' : ''}">${blocks.filter((block) => (block.track || 'main') === row).map((block) => `<i style="left:${(100 * (block.start || 0) / duration).toFixed(2)}%;width:${Math.max(1, 100 * (block.duration || 0) / duration).toFixed(2)}%;background:${(SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom).color}"></i>`).join('')}</div>`).join('')}</div>`;
}

function sbTemplateSearchText(template) {
  return `${template.name} ${template.category} ${(template.tags || []).join(' ')} ${template.summary || ''}`.toLowerCase();
}

function sbTemplateMatches(template, query) {
  const text = String(query || '').trim().toLowerCase();
  return !text || sbTemplateSearchText(template).includes(text);
}

function sbLibraryEmptyText(query, inCategory) {
  const text = String(query || '').trim();
  if (!text) return inCategory ? '' : tt('No scenario in this category.', 'Aucun scénario dans cette catégorie.', 'Kein Szenario in dieser Kategorie.');
  return sbUI().libraryCategory
    ? tt(`No scenario matches "${text}" in this category.`, `Aucun scénario ne correspond à « ${text} » dans cette catégorie.`, `Kein Szenario entspricht „${text}“ in dieser Kategorie.`)
    : tt(`No scenario matches "${text}".`, `Aucun scénario ne correspond à « ${text} ».`, `Kein Szenario entspricht „${text}“.`);
}

function renderSbTemplateCard(template, hidden = false) {
  const stats = sbTemplateStats(template);
  const loaded = sbStoryboard().meta.library_id === template.id;
  return `<article class="sb-template-card ${loaded ? 'is-loaded' : ''}" data-sb-search="${escapeAttribute(sbTemplateSearchText(template))}" ${hidden ? 'hidden' : ''}>
    <div class="sb-template-head">
      <span class="sb-template-icon">${sbIcon(template.icon || 'square', 18)}</span>
      <div><strong>${escapeHtml(template.name)}</strong><small>${escapeHtml(sbLibraryCategoryLabel(template.category || 'Custom'))}${template.builtin ? '' : ` · ${escapeHtml(tt('My template', 'Mon modèle', 'Meine Vorlage'))}`}</small></div>
      ${loaded ? `<span class="sb-loaded-tag">${sbUiIcon('check', 12)} ${escapeHtml(tt('Loaded', 'Chargé', 'Geladen'))}</span>` : ''}
    </div>
    <p>${escapeHtml(template.summary || '')}</p>
    ${sbMiniTimeline(template)}
    <div class="sb-template-meta"><span>${escapeHtml(sbFormatDuration(stats.duration))}</span><span>${stats.blocks} ${escapeHtml(tt('blocks', 'blocs', 'Blöcke'))}</span><span>${stats.injects} ${escapeHtml(tt('injects', 'injects', 'Injects'))}</span></div>
    <div class="sb-template-actions">
      <button class="btn btn-secondary btn-xs" data-sb-action="preview-template" data-sb-template="${escapeAttribute(template.id)}">${escapeHtml(tt('Preview', 'Aperçu', 'Vorschau'))}</button>
      <button class="btn btn-primary btn-xs" data-sb-action="select-template" data-sb-template="${escapeAttribute(template.id)}">${escapeHtml(tt('Load', 'Charger', 'Laden'))}</button>
    </div>
  </article>`;
}

function renderSbCast(storyboard) {
  const project = appState.scenario;
  const usage = new Map();
  storyboard.blocks.forEach((block) => block.beats.forEach((beat) => usage.set(beat.cast_id, (usage.get(beat.cast_id) || 0) + 1)));
  const readOnly = sbReadOnly() ? 'disabled' : '';
  return `<p class="sb-help">${escapeHtml(tt('Roles who send injects. Each role is played by an actor of the exercise.', 'Rôles qui envoient les injects. Chaque rôle est joué par un acteur de l’exercice.', 'Rollen, die Injects senden. Jede Rolle wird von einem Akteur der Übung gespielt.'))}</p>
    <div class="sb-cast-actions">
      <button class="btn btn-secondary btn-xs" data-sb-action="add-cast" ${readOnly}>${sbUiIcon('plus', 12)} ${escapeHtml(tt('Role', 'Rôle', 'Rolle'))}</button>
      <button class="btn btn-secondary btn-xs" data-sb-action="plan-cast" ${readOnly} ${isLLMAvailable() && storyboard.blocks.length ? '' : 'disabled'}>${sbUiIcon('wand', 12)} ${escapeHtml(tt('Suggest roles', 'Suggérer des rôles', 'Rollen vorschlagen'))}</button>
      <button class="btn btn-secondary btn-xs" data-sb-action="create-actors" ${readOnly}>${escapeHtml(tt('Create missing actors', 'Créer les acteurs manquants', 'Fehlende Akteure erstellen'))}</button>
    </div>
    <div class="sb-cast-list">
      ${storyboard.cast.map((cast) => {
        const actor = cast.actor_id ? getActor(cast.actor_id) : null;
        return `<div class="sb-cast-card">
          <div class="sb-cast-row">
            <input type="text" data-sb-cast="${cast.id}.label" value="${escapeAttribute(cast.label)}" aria-label="${escapeAttribute(tt('Role label', 'Libellé du rôle', 'Rollenbezeichnung'))}" ${readOnly}>
            <button class="sb-icon-btn" data-sb-action="delete-cast" data-sb-cast-id="${cast.id}" title="${escapeAttribute(tt('Remove role', 'Retirer le rôle', 'Rolle entfernen'))}" ${readOnly}>${sbUiIcon('trash', 14)}</button>
          </div>
          <div class="sb-cast-row">
            <select data-sb-cast="${cast.id}.role" aria-label="${escapeAttribute(tt('Role type', 'Type de rôle', 'Rollentyp'))}" ${readOnly}>${ROLES.map((role) => sbOption(role.value, roleLabel(role.value), cast.role)).join('')}</select>
            <input type="text" data-sb-cast="${cast.id}.organization" value="${escapeAttribute(cast.organization)}" placeholder="${escapeAttribute(tt('Organisation', 'Organisation', 'Organisation'))}" aria-label="${escapeAttribute(tt('Organisation', 'Organisation', 'Organisation'))}" ${readOnly}>
          </div>
          <select class="sb-cast-actor ${actor ? 'is-linked' : ''}" data-sb-cast="${cast.id}.actor_id" aria-label="${escapeAttribute(tt('Actor', 'Acteur', 'Akteur'))}" ${readOnly}>
            ${sbOption('', tt('- No actor yet -', '- Aucun acteur pour l’instant -', '- Noch kein Akteur -'), cast.actor_id)}
            ${project.actors.map((item) => sbOption(item.id, `${item.name} · ${item.title || roleLabel(item.role)}`, actor?.id || '')).join('')}
          </select>
          <small class="sb-cast-usage">${usage.get(cast.id) || 0} ${escapeHtml(tt('planned inject(s)', 'inject(s) prévu(s)', 'geplante(r) Inject(s)'))}</small>
        </div>`;
      }).join('') || `<p class="sb-empty">${escapeHtml(tt('No role yet. Roles are created by the library, the AI skeleton, or manually.', 'Aucun rôle pour l’instant. Les rôles sont créés par la bibliothèque, le squelette IA ou à la main.', 'Noch keine Rolle. Rollen entstehen aus der Bibliothek, dem KI-Grundgerüst oder manuell.'))}</p>`}
    </div>`;
}

// ── Timeline ─────────────────────────────────────────────────────────────────
/* The timeline tools of the Main storyline (zoom, magnet, ripple), shown in its top toolbar.
   The exercise duration is set in Context. */
function renderSbTimelineTools() {
  const ui = sbUI();
  const magnet = ui.magnet !== false;
  return `<div class="sb-tb-group sb-tb-zoom">
      <button class="sb-tool" data-sb-action="zoom-out" title="${escapeAttribute(tt('Zoom out (-)', 'Dézoomer (-)', 'Verkleinern (-)'))}">${sbUiIcon('minus')}</button>
      <input class="sb-zoom" type="range" min="${SB_ZOOM_MIN}" max="${SB_ZOOM_MAX}" step="0.1" value="${ui.zoom}" data-sb-zoom aria-label="${escapeAttribute(tt('Zoom', 'Zoom', 'Zoom'))}">
      <button class="sb-tool" data-sb-action="zoom-in" title="${escapeAttribute(tt('Zoom in (+)', 'Zoomer (+)', 'Vergrößern (+)'))}">${sbUiIcon('plus')}</button>
      <button class="sb-tool" data-sb-action="zoom-fit" title="${escapeAttribute(tt('Fit the whole exercise', 'Afficher tout l’exercice', 'Ganze Übung einpassen'))}">${sbUiIcon('fit')}</button>
    </div>
    <div class="sb-tb-group sb-tb-snap">
      <button class="sb-tool ${magnet ? 'is-on' : ''}" data-sb-action="toggle-magnet" aria-pressed="${magnet}" title="${escapeAttribute(magnet ? tt('Magnet on: phases snap to the step and to the edges of the other phases. Click to move them freely.', 'Aimant activé : les phases s’alignent sur le pas et sur les bords des autres phases. Cliquez pour les déplacer librement.', 'Magnet an: Phasen rasten am Raster und an den Rändern der anderen Phasen ein. Klicken, um sie frei zu verschieben.') : tt('Magnet off: phases move freely by the minute. Click to snap them to the step.', 'Aimant désactivé : les phases se déplacent librement à la minute. Cliquez pour les aligner sur le pas.', 'Magnet aus: Phasen bewegen sich frei minutenweise. Klicken, um sie am Raster einrasten zu lassen.'))}">${sbUiIcon('magnet', 15)}</button>
      <select class="sb-snap-step" data-sb-ui-select="snap" aria-label="${escapeAttribute(tt('Magnet step', 'Pas de l’aimant', 'Magnetraster'))}" title="${escapeAttribute(tt('Step of the magnet: moves, resizes and arrow keys go by this step', 'Pas de l’aimant : déplacements, redimensionnements et flèches du clavier suivent ce pas', 'Raster des Magneten: Verschieben, Größenänderung und Pfeiltasten folgen diesem Schritt'))}" ${magnet ? '' : 'disabled'}>${[1, 5, 15, 30].map((value) => sbOption(value, `${value} min`, ui.snap)).join('')}</select>
      <span class="sb-tb-hint sb-hide-compact">${escapeHtml(magnet ? tt(`Moves by ${ui.snap} min`, `Pas de ${ui.snap} min`, `Raster ${ui.snap} Min.`) : tt('Free moves', 'Déplacement libre', 'Freie Bewegung'))}</span>
      <button class="sb-tool sb-tool-label ${ui.ripple ? 'is-on' : ''}" data-sb-action="toggle-ripple" aria-pressed="${ui.ripple}" title="${escapeAttribute(tt('Ripple: moving or resizing a phase shifts the following ones', 'Propagation : déplacer ou redimensionner une phase décale les suivantes', 'Nachziehen: Verschieben oder Ändern einer Phase verschiebt die folgenden'))}">${sbUiIcon('ripple', 14)}<span>${escapeHtml(tt('Ripple', 'Propagation', 'Nachziehen'))}</span></button>
    </div>`;
}

function renderSbTimeline(storyboard) {
  const ui = sbUI();
  const ppm = ui.zoom;
  const width = Math.ceil((storyboard.duration_minutes + 60) * ppm);
  return `<section class="sb-timeline-panel" aria-label="${escapeAttribute(tt('Timeline', 'Timeline', 'Zeitleiste'))}">
    <div class="sb-timeline-scroll" id="sb-timeline-scroll">
      <div class="sb-canvas" style="width:${sbHeaderWidth() + width}px;--ppm:${ppm};--hour:${(60 * ppm).toFixed(2)}px;--quarter:${(15 * ppm).toFixed(2)}px;--header:${sbHeaderWidth()}px">
        <div class="sb-ruler-row">
          <div class="sb-corner"><span>${escapeHtml(tt('Phases', 'Phases', 'Phasen'))}</span><small>${sbMainBlocks(storyboard).length}</small></div>
          <div class="sb-ruler" data-sb-ruler style="width:${width}px">${renderSbRuler(storyboard, ppm)}</div>
        </div>
        ${storyboard.tracks.map((track, index) => renderSbTrack(storyboard, track, index, width)).join('')}
        ${renderSbKeyRow(storyboard, width, ppm)}
        <div class="sb-end-zone" style="left:${sbHeaderWidth() + storyboard.duration_minutes * ppm}px"></div>
        <div class="sb-playhead" id="sb-playhead" style="left:${sbHeaderWidth() + ui.playhead * ppm}px"><span class="sb-playhead-handle" data-sb-playhead>${sbFormatOffset(ui.playhead)}</span></div>
      </div>
    </div>
  </section>`;
}

function renderSbRuler(storyboard, ppm) {
  const hourPx = 60 * ppm;
  const step = hourPx < 38 ? 240 : hourPx < 70 ? 120 : hourPx > 360 ? 15 : hourPx > 180 ? 30 : 60;
  const startDate = appState.scenario.scenario.start_date;
  const marks = [];
  for (let minute = 0; minute <= storyboard.duration_minutes + 60; minute += step) {
    const clock = minute % 60 === 0 ? sbClockTime(minute, startDate) : '';
    marks.push(`<span class="sb-tick ${minute % 60 === 0 ? 'is-hour' : ''}" style="left:${minute * ppm}px"><b>${sbFormatOffset(minute)}</b>${clock ? `<small>${escapeHtml(clock.split(' ')[1])}</small>` : ''}</span>`);
  }
  return marks.join('');
}

/* The main events of every phase, under the phases: click one to edit it in its phase. */
const SB_KEY_CARD_WIDTH = 150;
function renderSbKeyRow(storyboard, width, ppm) {
  const events = sbMainBlocks(storyboard).flatMap((block) => (block.events || []).map((event) => ({ block, event, at: block.start_minutes + event.offset_minutes })));
  const packing = sbPackTrack(events.map(({ event, at }) => ({ id: event.id, start_minutes: at, duration_minutes: (SB_KEY_CARD_WIDTH + 6) / ppm })));
  // At least the height of its label on two lines (a narrow header, a longer language).
  const height = Math.max(64, Math.max(1, packing.rows) * 44 + 10);
  return `<div class="sb-track-row sb-key-row">
    <div class="sb-track-head" style="height:${height}px"><strong>${sbUiIcon('star', 12)} ${escapeHtml(tt('Main events', 'Événements principaux', 'Hauptereignisse'))}</strong><small>${escapeHtml(events.length
      ? tt(`${events.length} main event${events.length > 1 ? 's' : ''} · click to edit`, `${events.length} événement${events.length > 1 ? 's' : ''} principa${events.length > 1 ? 'ux' : 'l'} · cliquez pour modifier`, `${events.length} Hauptereignis${events.length > 1 ? 'se' : ''} · zum Bearbeiten klicken`)
      : tt('Add them in the phase editor', 'Ajoutez-les dans l’éditeur de phase', 'Im Phasen-Editor hinzufügen'))}</small></div>
    <div class="sb-lane sb-key-lane" style="width:${width}px;height:${height}px">
      ${events.map(({ block, event, at }) => `<button class="sb-key-card is-written" data-tab-action="sl-event-focus" data-tab-value="${escapeAttribute(event.id)}" style="left:${(at * ppm).toFixed(1)}px;top:${packing.placement.get(event.id) * 44 + 5}px;width:${SB_KEY_CARD_WIDTH}px;--beat-color:${sbBlockColor(block)};--clip-color:${sbBlockColor(block)}" title="${escapeAttribute(`${sbFormatOffset(at)} · ${event.text || tt('Main event', 'Événement principal', 'Hauptereignis')}`)}">
          <span class="sb-key-meta">${sbUiIcon('star', 10)}${sbFormatOffset(at)}</span>
          <strong>${escapeHtml(event.text || tt('Main event', 'Événement principal', 'Hauptereignis'))}</strong>
        </button>`).join('')}
    </div>
  </div>`;
}

function renderSbTrack(storyboard, track, index, width) {
  const ui = sbUI();
  const blocks = sbSortedBlocks(storyboard, track.id);
  const packing = sbPackTrack(blocks);
  const rowHeight = sbRowHeight(track.kind === 'main');
  const height = packing.rows * rowHeight + 10;
  const injects = blocks.reduce((sum, block) => sum + block.stimuli_target, 0);
  const readOnly = sbReadOnly() ? 'disabled' : '';
  return `<div class="sb-track-row ${track.kind === 'main' ? 'is-main' : ''}" style="--track-color:${track.color}">
    <div class="sb-track-head" style="height:${height}px">
      <input class="sb-track-name" data-sb-track-name="${track.id}" value="${escapeAttribute(sbTrackDisplayName(track))}" aria-label="${escapeAttribute(tt('Track name', 'Nom de la piste', 'Spurname'))}" ${readOnly}>
      <small>${blocks.length} ${escapeHtml(tt('phases', 'phases', 'Phasen'))} · ${injects} ${escapeHtml(tt('injects', 'injects', 'Injects'))}</small>
      ${track.kind === 'main' ? '' : `<span class="sb-track-actions">
        <button class="sb-icon-btn" data-sb-action="move-track" data-sb-track="${track.id}" data-sb-value="-1" ${index <= 1 || readOnly ? 'disabled' : ''} title="${escapeAttribute(tt('Move up', 'Monter', 'Nach oben'))}">${sbUiIcon('up', 13)}</button>
        <button class="sb-icon-btn" data-sb-action="move-track" data-sb-track="${track.id}" data-sb-value="1" ${index === storyboard.tracks.length - 1 || readOnly ? 'disabled' : ''} title="${escapeAttribute(tt('Move down', 'Descendre', 'Nach unten'))}">${sbUiIcon('down', 13)}</button>
        <button class="sb-icon-btn" data-sb-action="delete-track" data-sb-track="${track.id}" ${readOnly} title="${escapeAttribute(tt('Remove track', 'Supprimer la piste', 'Spur entfernen'))}">${sbUiIcon('trash', 13)}</button>
      </span>`}
    </div>
    <div class="sb-lane" data-sb-lane="${track.id}" style="width:${width}px;height:${height}px">
      ${blocks.map((block) => renderSbClip(storyboard, block, packing.placement.get(block.id) * rowHeight + 5, rowHeight - 8)).join('')}
      ${!blocks.length ? `<span class="sb-lane-hint">${escapeHtml(track.kind === 'main' ? tt('Drop crisis stages here', 'Déposez les étapes de crise ici', 'Krisenphasen hier ablegen') : tt('Drop workstream blocks here', 'Déposez les blocs de chantier ici', 'Arbeitsstrang-Blöcke hier ablegen'))}</span>` : ''}
    </div>
  </div>`;
}

function renderSbClip(storyboard, block, top, height) {
  const ui = sbUI();
  const project = appState.scenario;
  const ppm = ui.zoom;
  const type = SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom;
  const level = sbDetailLevel(block);
  const selected = ui.selected.includes(block.id);
  const stimuli = sbStimuliForBlock(project, block.id);
  const statuses = stimuli.map((stimulus) => sbStimulusStatus(project, stimulus));
  const outdated = statuses.filter((status) => status && ['outdated', 'orphan', 'retime'].includes(status.key)).length;
  const aiFresh = block.ai_rev !== null && block.ai_rev >= storyboard.rev - 1;
  const widthPx = block.duration_minutes * ppm;
  const beats = block.beats.map((beat) => {
    const stimulus = sbStimulusForBeat(project, beat.id);
    const status = stimulus ? sbStimulusStatus(project, stimulus)?.key : 'planned';
    return `<i class="sb-beat is-${status}" style="left:${(100 * Math.min(beat.offset_minutes, block.duration_minutes - 1) / block.duration_minutes).toFixed(2)}%;--beat-color:${sbChannelColor(beat.channel)}" title="${escapeAttribute(`${sbFormatOffset(sbBeatAbsolute(block, beat))} · ${channelLabel(beat.channel)} · ${beat.title}`)}"></i>`;
  }).join('') + (block.events || []).map((event) => `<i class="sb-beat is-main" style="left:${(100 * Math.min(event.offset_minutes, block.duration_minutes - 1) / block.duration_minutes).toFixed(2)}%;--beat-color:var(--clip-color)" title="${escapeAttribute(`${tt('Main event', 'Événement principal', 'Hauptereignis')} · ${sbFormatOffset(block.start_minutes + event.offset_minutes)} · ${event.text}`)}"></i>`).join('');
  return `<div class="sb-clip ${selected ? 'is-selected' : ''} ${block.locked ? 'is-locked' : ''} ${widthPx < 90 ? 'is-narrow' : ''} ${aiFresh ? 'is-ai' : ''} is-${block.status}" data-sb-clip="${block.id}" tabindex="0" role="button" aria-pressed="${selected}" aria-label="${escapeAttribute(`${block.title}, ${sbFormatOffset(block.start_minutes)} ${tt('to', 'à', 'bis')} ${sbFormatOffset(sbBlockEnd(block))}`)}"
      style="left:${(block.start_minutes * ppm).toFixed(1)}px;width:${Math.max(6, widthPx).toFixed(1)}px;top:${top}px;height:${height}px;--clip-color:${sbBlockColor(block, storyboard)}">
    <span class="sb-clip-handle is-left" data-sb-resize="left"></span>
    <div class="sb-clip-body" title="${escapeAttribute(`${block.title} · ${tt('stress', 'stress', 'Stress')}: ${sbStressLabel(sbBlockStress(block))}`)}">
      <div class="sb-clip-head"><span class="sb-clip-icon">${sbIcon(type.icon, 13)}</span><strong>${escapeHtml(block.title)}</strong></div>
      ${block.brief ? `<div class="sb-clip-brief">${escapeHtml(block.brief)}</div>` : ''}
      <div class="sb-clip-meta">
      <span class="sb-clip-sub">${sbFormatOffset(block.start_minutes)} · ${escapeHtml(sbFormatDuration(block.duration_minutes))} · ${block.beats.length || block.stimuli_target}${block.beats.length && block.beats.length !== block.stimuli_target ? `/${block.stimuli_target}` : ''} inj.</span>
      <span class="sb-clip-flags">
        <span class="sb-level-pips" title="${escapeAttribute(`${tt('Level of detail', 'Niveau de détail', 'Detailgrad')}: ${[tt('structure', 'structure', 'Struktur'), tt('narrative', 'récit', 'Erzählung'), tt('inject plan', 'plan d’injects', 'Inject-Plan')][level - 1]}`)}">${[1, 2, 3].map((index) => `<i class="${index <= level ? 'on' : ''}"></i>`).join('')}</span>
        ${block.status === 'validated' ? `<span class="sb-flag is-ok" title="${escapeAttribute(tt('Validated', 'Validé', 'Freigegeben'))}">${sbUiIcon('check', 11)}</span>` : ''}
        ${(block.events || []).length ? `<span class="sb-flag is-main" title="${escapeAttribute(`${tt('Main events', 'Événements principaux', 'Hauptereignisse')}: ${block.events.map((event) => event.text || tt('Main event', 'Événement principal', 'Hauptereignis')).join(' · ')}`)}">${sbUiIcon('star', 10)}${block.events.length}</span>` : ''}
        ${block.locked ? `<span class="sb-flag" title="${escapeAttribute(tt('Locked', 'Verrouillé', 'Gesperrt'))}">${sbUiIcon('lock', 11)}</span>` : ''}
        ${aiFresh ? `<span class="sb-flag is-ai" title="${escapeAttribute(tt('Updated by AI', 'Mis à jour par l’IA', 'Von KI aktualisiert'))}">${escapeHtml(tt('AI', 'IA', 'KI'))}</span>` : ''}
        ${outdated ? `<span class="sb-flag is-warn" title="${escapeAttribute(tt(`${outdated} inject(s) need sync`, `${outdated} inject(s) à synchroniser`, `${outdated} Inject(s) müssen synchronisiert werden`))}">${outdated}</span>` : ''}
      </span>
      </div>
    </div>
    <div class="sb-clip-beats">${beats}</div>
    <span class="sb-clip-handle is-right" data-sb-resize="right"></span>
  </div>`;
}

// ── Inspector (right panel) ──────────────────────────────────────────────────
// ── Modals ───────────────────────────────────────────────────────────────────
function sbModalShell(title, body, footer = '', size = '') {
  return `<div class="modal-backdrop sb-modal-backdrop" data-sb-backdrop>
    <div class="modal-box sb-modal ${size}" role="dialog" aria-modal="true" aria-label="${escapeAttribute(title)}">
      <div class="modal-header"><h3>${title}</h3><button class="btn btn-secondary btn-xs" data-sb-action="close-modal" aria-label="${escapeAttribute(tt('Close', 'Fermer', 'Schließen'))}">${sbUiIcon('close', 14)}</button></div>
      <div class="modal-body sb-modal-body">${body}</div>
      ${footer ? `<div class="sb-modal-foot">${footer}</div>` : ''}
    </div>
  </div>`;
}

function renderSbModal(storyboard) {
  const ui = sbUI();
  switch (ui.modal) {
    case 'versions': return renderSbVersionsModal(storyboard);
    case 'generate': return renderSbGenerateModal(storyboard);
    case 'sync': return renderSbSyncModal(storyboard);
    case 'preview': return renderSbPreviewModal();
    case 'load-choice': return renderSbLoadChoiceModal();
    default: return '';
  }
}


/* Scenario context tab: starting points (library, AI) and exercise framing. */
function renderSbVersionsModal(storyboard) {
  const ui = sbUI();
  const versions = StoryboardHistory.versions();
  const selected = ui.diffVersionId ? StoryboardHistory.findVersion(ui.diffVersionId) : null;
  const diff = selected ? StoryboardHistory.diff(selected.id) : null;
  const kinds = {
    named: tt('Named', 'Nommée', 'Benannt'), auto: tt('Autosave', 'Sauvegarde auto', 'Automatisch gespeichert'), ai: tt('Before AI', 'Avant l’IA', 'Vor KI'),
    generation: tt('Before generation', 'Avant génération', 'Vor Generierung'), restore: tt('Before restore', 'Avant restauration', 'Vor Wiederherstellung')
  };
  const body = `<div class="sb-versions">
      <div class="sb-versions-list">
        <div class="sb-version-save">
          <input type="text" data-sb-ui="versionLabel" value="${escapeAttribute(ui.versionLabel)}" placeholder="${escapeAttribute(tt('Name this version (e.g. V1 sent to client)', 'Nommez cette version (ex. : V1 envoyée au client)', 'Version benennen (z. B. V1 an Kunden gesendet)'))}">
          <button class="btn btn-secondary btn-xs" data-sb-action="save-version">${sbUiIcon('star', 12)} ${escapeHtml(tt('Save', 'Enregistrer', 'Speichern'))}</button>
        </div>
        <button class="btn btn-ghost btn-xs" data-sb-action="mark-validated">${sbUiIcon('check', 12)} ${escapeHtml(tt('Mark current storyboard as validated', 'Marquer le storyboard actuel comme validé', 'Aktuelles Storyboard als freigegeben markieren'))}</button>
        <ol>${versions.map((version) => `<li class="${selected?.id === version.id ? 'active' : ''} is-${version.kind}">
          <button data-sb-action="compare-version" data-sb-version="${version.id}">
            <strong>${escapeHtml(version.label)}</strong>
            <small>${escapeHtml(kinds[version.kind] || version.kind)} · rev ${version.rev} · ${escapeHtml(new Date(version.created_at).toLocaleString(uiLocale()))}</small>
            <small>${version.stats?.blocks ?? '?'} ${escapeHtml(tt('blocks', 'blocs', 'Blöcke'))} · ${version.stats?.beats ?? '?'} ${escapeHtml(tt('planned injects', 'injects prévus', 'geplante Injects'))}</small>
          </button>
        </li>`).join('') || `<li class="sb-empty">${escapeHtml(tt('No version yet. Versions are saved before every AI operation, restore and generation, every 5 minutes while you edit, and when you name one.', 'Aucune version pour l’instant. Une version est enregistrée avant chaque opération IA, restauration et génération, toutes les 5 minutes pendant vos modifications, et quand vous en nommez une.', 'Noch keine Version. Versionen werden vor jeder KI-Aktion, Wiederherstellung und Generierung gespeichert, alle 5 Minuten während der Bearbeitung und wenn Sie eine benennen.'))}</li>`}</ol>
      </div>
      <div class="sb-versions-detail">
        ${selected ? `<h4>${escapeHtml(selected.label)}</h4>
          <p class="sb-help">${escapeHtml(tt('Changes from this version to the current storyboard.', 'Changements entre cette version et le storyboard actuel.', 'Änderungen von dieser Version zum aktuellen Storyboard.'))}</p>
          ${renderSbDiff(diff)}
          <div class="actions">
            <button class="btn btn-primary btn-sm" data-sb-action="restore-version" data-sb-version="${selected.id}">${escapeHtml(tt('Restore this version', 'Restaurer cette version', 'Diese Version wiederherstellen'))}</button>
            <button class="btn btn-secondary btn-sm" data-sb-action="delete-version" data-sb-version="${selected.id}">${sbUiIcon('trash', 12)} ${escapeHtml(tt('Delete', 'Supprimer', 'Löschen'))}</button>
          </div>` : `<p class="sb-empty">${escapeHtml(tt(`Select a version to compare it with the current storyboard. Undo/redo (${StoryboardHistory.undoStack.length}/${StoryboardHistory.redoStack.length}) covers every edit of this session.`, `Sélectionnez une version pour la comparer au storyboard actuel. Annuler/rétablir (${StoryboardHistory.undoStack.length}/${StoryboardHistory.redoStack.length}) couvre chaque modification de cette session.`, `Wählen Sie eine Version, um sie mit dem aktuellen Storyboard zu vergleichen. Rückgängig/Wiederholen (${StoryboardHistory.undoStack.length}/${StoryboardHistory.redoStack.length}) umfasst jede Bearbeitung dieser Sitzung.`))}</p>`}
      </div>
    </div>`;
  return sbModalShell(escapeHtml(tt('Versions', 'Versions', 'Versionen')), body, '', 'sb-modal-wide');
}

function renderSbDiff(diff) {
  if (!diff || !diff.count) return `<p class="sb-empty">${escapeHtml(tt('Identical to the current storyboard.', 'Identique au storyboard actuel.', 'Identisch mit dem aktuellen Storyboard.'))}</p>`;
  const fieldLabels = {
    title: tt('title', 'titre', 'Titel'), type: tt('type', 'type', 'Typ'), track_id: tt('track', 'piste', 'Spur'), start_minutes: tt('start', 'début', 'Beginn'),
    duration_minutes: tt('duration', 'durée', 'Dauer'), stimuli_target: tt('inject count', 'nombre d’injects', 'Anzahl Injects'), brief: tt('brief', 'déroulé', 'Ablauf'),
    narrative: tt('narrative', 'récit', 'Erzählung'), objectives: tt('objectives', 'objectifs', 'Ziele'), beats: tt('inject plan', 'plan d’injects', 'Inject-Plan'),
    status: tt('status', 'statut', 'Status'), locked: tt('lock', 'verrou', 'Sperre'), notes: tt('notes', 'notes', 'Notizen')
  };
  return `<ul class="sb-diff">
    ${diff.added.map((item) => `<li class="is-added">+ ${escapeHtml(item.title)} <small>${escapeHtml(tt('added since', 'ajouté depuis', 'seitdem hinzugefügt'))}</small></li>`).join('')}
    ${diff.removed.map((item) => `<li class="is-removed">− ${escapeHtml(item.title)} <small>${escapeHtml(tt('removed since', 'supprimé depuis', 'seitdem entfernt'))}</small></li>`).join('')}
    ${diff.changed.map((item) => `<li class="is-changed">~ ${escapeHtml(item.title)} <small>${item.fields.map((field) => fieldLabels[field] || field).join(', ')}</small></li>`).join('')}
    ${diff.meta.length ? `<li class="is-changed">~ ${escapeHtml(tt('Scenario', 'Scénario', 'Szenario'))} <small>${diff.meta.join(', ')}</small></li>` : ''}
    ${diff.cast.added.length + diff.cast.removed.length + diff.cast.changed.length ? `<li class="is-changed">~ ${escapeHtml(tt('Cast', 'Rôles', 'Rollen'))} <small>${[...diff.cast.added.map((label) => `+${label}`), ...diff.cast.removed.map((label) => `−${label}`), ...diff.cast.changed].map(escapeHtml).join(', ')}</small></li>` : ''}
  </ul>`;
}

function renderSbGenerateModal(storyboard) {
  const ui = sbUI();
  const project = appState.scenario;
  const options = ui.generate;
  const cell = options.scope === 'cell' ? sbCell(project, options.cellId) : null;
  const scope = sbSortedBlocks(storyboard);
  const wanted = (block) => block.stimuli_target > 0 || block.beats.length || !sbMainBlocks(project.storyboard).includes(block) ? block.stimuli_target : sbWantedInjects(block, project);
  const toPlan = cell ? [] : scope.filter((block) => !block.locked && block.beats.length < wanted(block));
  const missing = scope.reduce((sum, block) => sum + block.beats.filter((beat) => !sbStimulusForBeat(project, beat.id) && (!cell || sbReaches(beat.cell_id, cell.id))).length, 0);
  const toPlanCount = toPlan.reduce((sum, block) => sum + wanted(block) - block.beats.length, 0);
  const castMissing = storyboard.cast.filter((cast) => !sbFindActorForCast(project, cast)).length;
  const running = SbPipeline.active;
  const ai = isLLMAvailable();
  const cellOption = sbCell(project, options.cellId);
  const body = `<div class="sb-generate">
      <div class="sb-mini-field">${escapeHtml(tt('Scope', 'Périmètre', 'Umfang'))}
        <div class="sb-segmented">
          <button class="${!cell ? 'active' : ''}" data-sb-action="generate-scope" data-sb-value="all">${escapeHtml(tt(`Whole exercise · ${storyboard.blocks.length} phases`, `Tout l’exercice · ${storyboard.blocks.length} phases`, `Gesamte Übung · ${storyboard.blocks.length} Phasen`))}</button>
          ${cellOption ? `<button class="${cell ? 'active' : ''}" data-sb-action="generate-scope" data-sb-value="cell">${escapeHtml(tt(`${cellOption.name} only`, `${cellOption.name} uniquement`, `Nur ${cellOption.name}`))}</button>` : ''}
        </div>
      </div>
      <div class="sb-pipeline">
        <label class="${options.plan && ai && !cell ? 'on' : ''}"><input type="checkbox" data-sb-generate="plan" ${options.plan && ai && !cell ? 'checked' : ''} ${ai && !cell ? '' : 'disabled'}><span><b>1 · ${escapeHtml(tt('Plan', 'Planifier', 'Planen'))}</b>${escapeHtml(cell ? tt('Not used for a single cell: its planned injects are written as they are', 'Non utilisé pour une seule cellule : ses injects prévus sont rédigés tels quels', 'Für eine einzelne Zelle nicht verwendet: Ihre geplanten Injects werden so geschrieben, wie sie sind') : tt(`Complete the inject plan with AI (${toPlanCount} to plan in ${toPlan.length} phase(s))`, `Compléter le plan d’injects avec l’IA (${toPlanCount} à planifier dans ${toPlan.length} phase(s))`, `Den Inject-Plan mit KI vervollständigen (${toPlanCount} zu planen in ${toPlan.length} Phase(n))`))}</span></label>
        <label class="${options.cast ? 'on' : ''}"><input type="checkbox" data-sb-generate="cast" ${options.cast ? 'checked' : ''}><span><b>2 · ${escapeHtml(tt('Cast', 'Distribuer', 'Besetzen'))}</b>${escapeHtml(tt(`Create missing actors for the roles (${castMissing} role(s) without actor)`, `Créer les acteurs manquants pour les rôles (${castMissing} rôle(s) sans acteur)`, `Fehlende Akteure für die Rollen erstellen (${castMissing} Rolle(n) ohne Akteur)`))}</span></label>
        <label class="on"><input type="checkbox" checked disabled><span><b>3 · ${escapeHtml(tt('Create', 'Créer', 'Erstellen'))}</b>${escapeHtml(tt(`Create one inject per planned item (${missing} ready now), linked to its block`, `Créer un inject par élément prévu (${missing} prêt(s) maintenant), lié à son bloc`, `Einen Inject pro geplantem Element erstellen (${missing} jetzt bereit), mit seinem Block verknüpft`))}</span></label>
        <label class="${options.write && ai ? 'on' : ''}"><input type="checkbox" data-sb-generate="write" ${options.write && ai ? 'checked' : ''} ${ai ? '' : 'disabled'}><span><b>4 · ${escapeHtml(tt('Write', 'Rédiger', 'Schreiben'))}</b>${escapeHtml(tt(`Write each inject with AI in ${sbLanguageName(project)}, with the storyboard as context`, `Rédiger chaque inject avec l’IA en ${sbLanguageName(project)}, avec le storyboard comme contexte`, `Jeden Inject mit KI auf ${sbLanguageName(project)} schreiben, mit dem Storyboard als Kontext`))}</span></label>
      </div>
      ${!ai ? `<p class="agent-warning">${escapeHtml(tt('AI is not configured: injects already planned will be created as drafts, without content.', 'L’IA n’est pas configurée : les injects déjà prévus seront créés comme brouillons, sans contenu.', 'KI ist nicht eingerichtet: Bereits geplante Injects werden als Entwürfe ohne Inhalt erstellt.'))}</p>` : ''}
      ${SbPipeline.log.length ? `<ol class="agent-log sb-log">${SbPipeline.log.map((entry) => `<li class="agent-log-${entry.kind === 'error' ? 'error' : entry.kind === 'warning' ? 'warning' : 'success'}"><span>${sbUiIcon(entry.kind === 'success' ? 'check' : entry.kind === 'info' ? 'chevronRight' : 'alert', 13)} ${escapeHtml(entry.message)}</span></li>`).join('')}</ol>` : ''}
    </div>`;
  const footer = `${SbPipeline.checkpoint && SbPipeline.checkpoint.projectId === project.id && !running ? `<button class="btn btn-ghost btn-sm" data-sb-action="undo-generation" title="${escapeAttribute(tt(`Restore actors, injects and storyboard from before ${SbPipeline.checkpoint.label}`, `Restaurer les acteurs, les injects et le storyboard d’avant : ${SbPipeline.checkpoint.label}`, `Akteure, Injects und Storyboard vom Stand vor „${SbPipeline.checkpoint.label}“ wiederherstellen`))}">${sbUiIcon('undo', 13)} ${escapeHtml(tt('Undo', 'Annuler', 'Rückgängig:'))} ${escapeHtml(SbPipeline.checkpoint.label)}</button>` : ''}
    ${running ? `<button class="btn btn-secondary btn-sm" data-sb-action="stop-pipeline">${sbUiIcon('stop', 13)} ${escapeHtml(tt('Stop', 'Arrêter', 'Stoppen'))}</button>` : `<button class="btn btn-primary btn-sm" data-sb-action="start-generation" ${sbReadOnly() || !scope.length ? 'disabled' : ''}>${sbUiIcon('play', 13)} ${escapeHtml(tt('Start', 'Démarrer', 'Starten'))}</button>`}`;
  return sbModalShell(escapeHtml(tt('Generate actors and injects', 'Générer les acteurs et les injects', 'Akteure und Injects generieren')), body, footer, 'sb-modal-wide');
}

function renderSbSyncModal(storyboard) {
  const ui = sbUI();
  if (!ui.impacts) ui.impacts = sbComputeImpacts(appState.scenario);
  const impacts = ui.impacts;
  // In cascade order: phases, then actors, then the injects.
  const kinds = [
    ['replan', tt('Phases', 'Phases', 'Phasen'), tt('What happens changed: the AI updates the inject plan of the phase, then its injects follow (timing, content, new and removed injects).', 'Le déroulé a changé : l’IA met à jour le plan d’injects de la phase, puis ses injects suivent (timing, contenu, injects ajoutés et supprimés).', 'Der Ablauf hat sich geändert: Die KI aktualisiert den Inject-Plan der Phase, dann folgen ihre Injects (Timing, Inhalt, neue und entfernte Injects).')],
    ['actor_missing', tt('Missing actors', 'Acteurs manquants', 'Fehlende Akteure'), tt('Roles used by planned injects without an actor.', 'Rôles utilisés par des injects prévus, sans acteur.', 'Rollen, die von geplanten Injects genutzt werden, ohne Akteur.')],
    ['actor_outdated', tt('Actors', 'Acteurs', 'Akteure'), tt('Roles changed since their actor was created.', 'Rôles modifiés depuis la création de leur acteur.', 'Rollen, die sich seit der Erstellung ihres Akteurs geändert haben.')],
    ['rename', tt('Players', 'Joueurs', 'Spieler'), tt('Players renamed in Cells & actors (real names instead of invented ones): their new name, role and email replace the old ones in the injects that cite them, exactly, without AI.', 'Joueurs renommés dans Cellules et acteurs (noms réels à la place de noms inventés) : leur nouveau nom, rôle et e-mail remplacent les anciens dans les injects qui les citent, à l’identique, sans IA.', 'In Zellen und Akteure umbenannte Spieler (echte statt erfundener Namen): Ihr neuer Name, ihre Rolle und E-Mail ersetzen die alten in den Injects, die sie nennen, exakt und ohne KI.')],
    ['retime', tt('Timing', 'Timing', 'Timing'), tt('Phases or planned injects moved: injects are rescheduled; content is untouched.', 'Phases ou injects prévus déplacés : les injects sont reprogrammés ; le contenu n’est pas modifié.', 'Phasen oder geplante Injects wurden verschoben: Die Injects werden neu terminiert; der Inhalt bleibt unverändert.')],
    ['outdated', tt('Content', 'Contenu', 'Inhalt'), tt('The storyline or the inject plan changed after the inject was written. Manual edits are adapted, not overwritten.', 'La storyline ou le plan d’injects a changé après la rédaction de l’inject. Les modifications manuelles sont adaptées, pas écrasées.', 'Die Storyline oder der Inject-Plan hat sich geändert, nachdem der Inject geschrieben wurde. Manuelle Änderungen werden angepasst, nicht überschrieben.')],
    ['people', tt('Senders and cells', 'Émetteurs et cellules', 'Absender und Zellen'), tt('An actor or a cell was edited in Cells & actors after the inject was written: names, signatures and tone are adapted.', 'Un acteur ou une cellule a été modifié dans Cellules et acteurs après la rédaction de l’inject : noms, signatures et ton sont adaptés.', 'Ein Akteur oder eine Zelle wurde in Zellen und Akteure bearbeitet, nachdem der Inject geschrieben wurde: Namen, Signaturen und Ton werden angepasst.')],
    ['orphan', tt('Orphans', 'Orphelins', 'Verwaiste'), tt('Injects whose phase or planned item was removed.', 'Injects dont la phase ou l’élément prévu a été supprimé.', 'Injects, deren Phase oder geplantes Element entfernt wurde.')],
    ['missing', tt('New injects', 'Nouveaux injects', 'Neue Injects'), tt('Planned injects without a stimulus yet.', 'Injects prévus sans stimulus pour l’instant.', 'Geplante Injects, die noch keinen Stimulus haben.')]
  ];
  const actionLabels = {
    apply: tt('Apply', 'Appliquer', 'Anwenden'), skip: tt('Skip', 'Ignorer', 'Überspringen'), unlink: tt('Keep, unlink', 'Garder, délier', 'Behalten, Verknüpfung lösen'),
    delete: tt('Delete inject', 'Supprimer l’inject', 'Inject löschen'), regenerate: tt('Regenerate', 'Régénérer', 'Neu generieren'),
    adapt: tt('Adapt, keep manual edits', 'Adapter, garder les modifications manuelles', 'Anpassen, manuelle Änderungen behalten'), accept: tt('Keep as is', 'Garder tel quel', 'Unverändert lassen'),
    create: tt('Create', 'Créer', 'Erstellen'), update: tt('Update actor', 'Mettre à jour l’acteur', 'Akteur aktualisieren'), replan: tt('Re-plan with AI', 'Replanifier avec l’IA', 'Mit KI neu planen')
  };
  const body = `<p class="sb-help sb-cascade">${sbUiIcon('sync', 13)} ${tt('Changes flow down in cascade: <b>phases</b> → <b>inject plan</b> → <b>actors</b> → <b>timing and content of the injects</b>. One undo restores everything.', 'Les changements se répercutent en cascade : <b>phases</b> → <b>plan d’injects</b> → <b>acteurs</b> → <b>timing et contenu des injects</b>. Une seule annulation restaure tout.', 'Änderungen wirken sich kaskadenartig aus: <b>Phasen</b> → <b>Inject-Plan</b> → <b>Akteure</b> → <b>Timing und Inhalt der Injects</b>. Ein einziges Rückgängig stellt alles wieder her.')}</p>
    ${!isLLMAvailable() && impacts.some((impact) => ['replan', 'outdated', 'people'].includes(impact.kind)) ? `<p class="agent-warning">${escapeHtml(tt('AI is not configured: re-planning a phase and rewriting injects need an AI connection (Settings). Timing, orphans and actors can still be updated.', 'L’IA n’est pas configurée : replanifier une phase et réécrire des injects nécessitent une connexion IA (Paramètres). Le timing, les orphelins et les acteurs peuvent quand même être mis à jour.', 'KI ist nicht eingerichtet: Das Neuplanen einer Phase und das Neuschreiben von Injects erfordern eine KI-Verbindung (Einstellungen). Timing, verwaiste Injects und Akteure lassen sich trotzdem aktualisieren.'))}</p>` : ''}
    ${impacts.length ? kinds.map(([kind, title, help]) => {
      const list = impacts.filter((impact) => impact.kind === kind);
      if (!list.length) return '';
      return `<section class="sb-sync-group"><h4>${escapeHtml(title)} · ${list.length}</h4><p class="sb-help">${escapeHtml(help)}</p>
        <ul class="sb-sync-list">${list.map((impact) => `<li>
          <span class="sb-sync-label">${escapeHtml(impact.label)}${impact.manual ? ` <span class="sb-status is-manual">${escapeHtml(tt('manual', 'manuel', 'manuell'))}</span>` : ''}<small>${escapeHtml(impact.detail || '')}</small></span>
          <select data-sb-impact="${impact.id}" ${SbPipeline.active ? 'disabled' : ''}>${impact.options.map((option) => sbOption(option, actionLabels[option] || option, impact.action)).join('')}</select>
        </li>`).join('')}</ul></section>`;
    }).join('') : `<p class="sb-empty">${escapeHtml(tt('Everything is up to date: the inject plans, actors and injects match the storyline, the cells and the actors.', 'Tout est à jour : les plans d’injects, les acteurs et les injects correspondent à la storyline, aux cellules et aux acteurs.', 'Alles ist aktuell: Inject-Pläne, Akteure und Injects entsprechen der Storyline, den Zellen und den Akteuren.'))}</p>`}
    ${SbPipeline.log.length ? `<ol class="agent-log sb-log">${SbPipeline.log.slice(-12).map((entry) => `<li class="agent-log-${entry.kind === 'error' ? 'error' : entry.kind === 'warning' ? 'warning' : 'success'}"><span>${escapeHtml(entry.message)}</span></li>`).join('')}</ol>` : ''}`;
  const count = impacts.filter((impact) => impact.action !== 'skip').length;
  const footer = `${SbPipeline.checkpoint && SbPipeline.checkpoint.projectId === appState.scenario.id && !SbPipeline.active ? `<button class="btn btn-ghost btn-sm" data-sb-action="undo-generation">${sbUiIcon('undo', 13)} ${escapeHtml(tt('Undo', 'Annuler', 'Rückgängig:'))} ${escapeHtml(SbPipeline.checkpoint.label)}</button>` : ''}
    <button class="btn btn-secondary btn-sm" data-sb-action="refresh-sync" ${SbPipeline.active ? 'disabled' : ''}>${sbUiIcon('sync', 13)} ${escapeHtml(tt('Refresh', 'Actualiser', 'Aktualisieren'))}</button>
    ${SbPipeline.active ? `<button class="btn btn-secondary btn-sm" data-sb-action="stop-pipeline">${sbUiIcon('stop', 13)} ${escapeHtml(tt('Stop', 'Arrêter', 'Stoppen'))}</button>` : `<button class="btn btn-primary btn-sm" data-sb-action="apply-sync" ${count && !sbReadOnly() ? '' : 'disabled'}>${sbUiIcon('sync', 13)} ${escapeHtml(tt(`Update ${count} change(s)`, `Mettre à jour ${count} modification(s)`, `${count} Änderung(en) übernehmen`))}</button>`}`;
  return sbModalShell(escapeHtml(tt('Update next tabs', 'Mettre à jour les onglets suivants', 'Folgende Tabs aktualisieren')), body, footer, 'sb-modal-wide');
}

function renderSbPreviewModal() {
  const ui = sbUI();
  const template = sbFindTemplate(ui.previewId);
  if (!template) return '';
  const stats = sbTemplateStats(template);
  const cast = new Map((template.cast || []).map((item) => [String(item.key), item.label]));
  const tracks = [...new Set((template.blocks || []).map((block) => block.track || 'main'))];
  const body = `<div class="sb-preview-head">
      <span class="sb-template-icon is-large">${sbIcon(template.icon || 'square', 24)}</span>
      <div><p class="sb-help">${escapeHtml(sbLibraryCategoryLabel(template.category || 'Custom'))} · ${escapeHtml(sbFormatDuration(stats.duration))} · ${stats.blocks} ${escapeHtml(tt('blocks', 'blocs', 'Blöcke'))} · ${stats.injects} ${escapeHtml(tt('injects', 'injects', 'Injects'))}</p>
      <p>${escapeHtml(template.summary || '')}</p>
      ${template.threat ? `<p class="sb-help"><b>${escapeHtml(tt('Threat.', 'Menace.', 'Bedrohung.'))}</b> ${escapeHtml(template.threat)}</p>` : ''}</div>
    </div>
    <div class="sb-preview-timeline">${tracks.map((track) => `<div class="sb-preview-row"><span>${escapeHtml(sbTrackPresetName(track))}</span><div>${(template.blocks || []).filter((block) => (block.track || 'main') === track).map((block) => `<i style="left:${(100 * block.start / stats.duration).toFixed(2)}%;width:${(100 * block.duration / stats.duration).toFixed(2)}%;--clip-color:${(SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom).color}" title="${escapeAttribute(`${sbFormatOffset(block.start)} · ${block.title}`)}">${escapeHtml(block.title)}</i>`).join('')}</div></div>`).join('')}</div>
    ${(template.objectives || []).length ? `<h4>${escapeHtml(tt('Objectives', 'Objectifs', 'Ziele'))}</h4><ol class="sb-preview-objectives">${template.objectives.map((objective) => `<li>${escapeHtml(objective)}</li>`).join('')}</ol>` : ''}
    <h4>${escapeHtml(tt('Storyboard', 'Storyboard', 'Storyboard'))}</h4>
    <div class="sb-preview-blocks">${[...(template.blocks || [])].sort((a, b) => a.start - b.start).map((block) => `<details style="--clip-color:${(SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom).color}">
        <summary><span>${sbFormatOffset(block.start)}</span><strong>${escapeHtml(block.title)}</strong><small>${escapeHtml(sbTrackPresetName(block.track || 'main'))} · ${block.stimuli || (block.beats || []).length} ${escapeHtml(tt('injects', 'injects', 'Injects'))}</small></summary>
        <p>${escapeHtml(block.brief || '')}</p>${block.narrative ? `<p class="sb-help">${escapeHtml(block.narrative)}</p>` : ''}
        ${(block.beats || []).length ? `<ul>${block.beats.map((beat) => `<li><i class="sb-dot" style="background:${sbChannelColor(beat.channel)}"></i>${sbFormatOffset(block.start + beat.at)} · ${escapeHtml(channelLabel(beat.channel))} · <b>${escapeHtml(cast.get(String(beat.cast)) || '')}</b> ${escapeHtml(beat.title)}</li>`).join('')}</ul>` : ''}
      </details>`).join('')}</div>
    ${(template.cast || []).length ? `<h4>${escapeHtml(tt('Cast', 'Rôles', 'Rollen'))}</h4><div class="sb-chips">${template.cast.map((item) => `<span class="sb-filter-chip">${escapeHtml(item.label)}</span>`).join('')}</div>` : ''}`;
  const hasBlocks = sbStoryboard().blocks.length > 0;
  const footer = `${template.builtin ? '' : `<button class="btn btn-ghost btn-sm" data-sb-action="delete-template" data-sb-template="${escapeAttribute(template.id)}">${sbUiIcon('trash', 13)} ${escapeHtml(tt('Delete', 'Supprimer', 'Löschen'))}</button>`}
    <button class="btn btn-ghost btn-sm" data-sb-action="export-template" data-sb-template="${escapeAttribute(template.id)}">${sbUiIcon('download', 13)} ${escapeHtml(tt('Export', 'Exporter', 'Exportieren'))}</button>
    ${hasBlocks ? `<button class="btn btn-secondary btn-sm" data-sb-action="use-template" data-sb-template="${escapeAttribute(template.id)}" data-sb-mode="insert">${escapeHtml(tt('Insert after current storyline', 'Insérer après la storyline actuelle', 'Nach der aktuellen Storyline einfügen'))}</button>` : ''}
    <button class="btn btn-primary btn-sm" data-sb-action="select-template" data-sb-template="${escapeAttribute(template.id)}" title="${escapeAttribute(tt('Load it, set the key information in Context, then generate with AI or load the basic scenario', 'Chargez-le, renseignez les informations clés dans Contexte, puis générez avec l’IA ou chargez le scénario de base', 'Laden, die wichtigsten Angaben im Kontext festlegen, dann mit KI generieren oder das Basisszenario laden'))}">${escapeHtml(tt('Load', 'Charger', 'Laden'))}</button>`;
  return sbModalShell(escapeHtml(template.name), body, footer, 'sb-modal-wide');
}

/* Loading a library scenario into a project with content: a new project, or the storyline only. */
function renderSbLoadChoiceModal() {
  const ui = sbUI();
  const template = sbFindTemplate(ui.previewId);
  if (!template) return '';
  const name = String(appState.scenario.name || '').trim() || tt('Untitled project', 'Projet sans titre', 'Unbenanntes Projekt');
  const id = escapeAttribute(template.id);
  const body = `<p>${tt(`The current project <b>${escapeHtml(name)}</b> already has content. How do you want to use <b>${escapeHtml(template.name)}</b>?`, `Le projet actuel <b>${escapeHtml(name)}</b> a déjà du contenu. Comment voulez-vous utiliser <b>${escapeHtml(template.name)}</b> ?`, `Das aktuelle Projekt <b>${escapeHtml(name)}</b> hat bereits Inhalte. Wie möchten Sie <b>${escapeHtml(template.name)}</b> verwenden?`)}</p>
    <div class="sb-load-choices">
      <button class="sb-load-choice is-primary" data-sb-action="select-template" data-sb-template="${id}" data-sb-load="new">${sbUiIcon('plus', 16)}<strong>${escapeHtml(tt('Start a new project from this scenario', 'Démarrer un nouveau projet à partir de ce scénario', 'Neues Projekt aus diesem Szenario starten'))}</strong><small>${escapeHtml(tt('A fresh project framed by this scenario. The current project is replaced, including its copy saved in this browser: export it first to keep it.', 'Un nouveau projet cadré par ce scénario. Le projet actuel est remplacé, y compris sa copie enregistrée dans ce navigateur : exportez-le d’abord pour le conserver.', 'Ein neues Projekt auf Basis dieses Szenarios. Das aktuelle Projekt wird ersetzt, auch seine in diesem Browser gespeicherte Kopie: Exportieren Sie es zuerst, um es zu behalten.'))}</small></button>
      <button class="sb-load-choice" data-sb-action="select-template" data-sb-template="${id}" data-sb-load="storyline">${sbUiIcon('layers', 16)}<strong>${escapeHtml(tt('Replace only the storyline', 'Remplacer uniquement la storyline', 'Nur die Storyline ersetzen'))}</strong><small>${escapeHtml(tt('Keep the client, context and cells of this project. The scenario replaces the main storyline when you load it or generate with AI in Context; the injects and actors of the current storyline go with it, those you added by hand stay.', 'Conserver le client, le contexte et les cellules de ce projet. Le scénario remplace la storyline principale quand vous le chargez ou générez avec l’IA dans Contexte ; les injects et acteurs de la storyline actuelle partent avec elle, ceux ajoutés à la main restent.', 'Auftraggeber, Kontext und Zellen dieses Projekts behalten. Das Szenario ersetzt die Haupt-Storyline, wenn Sie es laden oder im Kontext mit KI generieren; die Injects und Akteure der aktuellen Storyline gehen mit ihr, von Hand hinzugefügte bleiben.'))}</small></button>
    </div>`;
  return sbModalShell(escapeHtml(tt('Load a library scenario', 'Charger un scénario de la bibliothèque', 'Bibliotheksszenario laden')), body, `<button class="btn btn-secondary btn-sm" data-sb-action="close-modal">${escapeHtml(tt('Cancel', 'Annuler', 'Abbrechen'))}</button>`);
}

// ── Focus preservation across full re-renders ────────────────────────────────
const SB_FOCUS_KEYS = ['sbField', 'sbMeta', 'sbProject', 'sbBeat', 'sbCast', 'sbTrackName', 'sbUi'];
function sbCaptureFocus() {
  const element = typeof document !== 'undefined' ? document.activeElement : null;
  const ui = sbUI();
  if (!element || !element.closest?.('[data-sb-scope]')) { ui.focus = null; return; }
  const key = SB_FOCUS_KEYS.find((name) => element.dataset?.[name] !== undefined);
  ui.focus = key ? { key, value: element.dataset[key], start: element.selectionStart, end: element.selectionEnd } : null;
}
function sbRestoreFocus() {
  const ui = sbUI();
  const focus = ui.focus;
  ui.focus = null;
  if (!focus) return;
  const attribute = `data-${focus.key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
  const element = [...document.querySelectorAll(`[${attribute}]`)].find((item) => item.getAttribute(attribute) === focus.value);
  if (!element || element.disabled) return;
  element.focus({ preventScroll: true });
  try { if (focus.start !== null && focus.start !== undefined) element.setSelectionRange(focus.start, focus.end); } catch (_) { /* Not a text field. */ }
}

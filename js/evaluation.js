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

/* Generic crisis management criteria, rated on every sheet below the scenario criteria and
   never rewritten by the AI. From the ANSSI guide "Organising a cyber crisis management
   exercise" (logbook, situation points, observation grid), the HSEEP Exercise Evaluation
   Guides and common crisis cell practice. [id, English, French, German], each language
   "category | criterion | what to observe". */
const EV_GENERIC_CRITERIA = [
  ['gen_mobilisation',
    'Mobilisation | The crisis cell is activated quickly and complete | Time from the alert to the first meeting; the right people present or replaced; crisis room and tools ready',
    'Mobilisation | La cellule de crise est activée rapidement et au complet | Délai entre l’alerte et la première réunion ; bonnes personnes présentes ou suppléées ; salle et outils de crise prêts',
    'Mobilisierung | Der Krisenstab wird schnell und vollständig aktiviert | Zeit von der Alarmierung bis zur ersten Sitzung; die richtigen Personen anwesend oder vertreten; Krisenraum und Werkzeuge bereit'],
  ['gen_roles',
    'Roles | Roles are assigned and known by everyone | Crisis lead, logkeeper, liaison, spokesperson named; each member knows their role; deputies designated',
    'Rôles | Les rôles sont attribués et connus de tous | Pilote de crise, main courante, liaison, porte-parole nommés ; chacun connaît son rôle ; suppléants désignés',
    'Rollen | Die Rollen sind verteilt und allen bekannt | Krisenleitung, Protokollführung, Verbindung, Sprecher benannt; alle kennen ihre Rolle; Vertretungen bestimmt'],
  ['gen_logbook',
    'Logbook | The logbook (main courante) is written consistently with every decision | Every event, decision and action time-stamped; who decided what and why; kept from start to end',
    'Main courante | La main courante est tenue en continu avec toutes les décisions | Chaque événement, décision et action horodaté ; qui a décidé quoi et pourquoi ; tenue du début à la fin',
    'Einsatztagebuch | Das Einsatztagebuch wird durchgehend mit allen Entscheidungen geführt | Jedes Ereignis, jede Entscheidung und Maßnahme mit Uhrzeit; wer was warum entschieden hat; vom Anfang bis zum Ende geführt'],
  ['gen_situation',
    'Situation points | Regular situation points keep a shared picture | Situation points at a set rhythm; facts separated from hypotheses; situation board updated after each new element',
    'Points de situation | Des points de situation réguliers entretiennent une vision partagée | Points à un rythme fixé ; faits distingués des hypothèses ; tableau de situation mis à jour à chaque nouvel élément',
    'Lagebesprechungen | Regelmäßige Lagebesprechungen sichern ein gemeinsames Lagebild | Besprechungen in festem Rhythmus; Fakten von Hypothesen getrennt; Lagetafel nach jedem neuen Element aktualisiert'],
  ['gen_actions',
    'Action follow-up | Actions are assigned and previous actions are checked regularly | Each action has an owner and a deadline; the action list is reviewed at each situation point; nothing left pending',
    'Suivi des actions | Les actions sont attribuées et les actions précédentes vérifiées régulièrement | Chaque action a un responsable et une échéance ; la liste est revue à chaque point de situation ; rien ne reste en suspens',
    'Maßnahmenverfolgung | Maßnahmen werden zugewiesen und frühere Maßnahmen regelmäßig überprüft | Jede Maßnahme hat Verantwortliche und Frist; die Liste wird in jeder Lagebesprechung geprüft; nichts bleibt offen'],
  ['gen_decisions',
    'Decisions | Decisions are taken in time and justified | Options, risks and criteria weighed; decision made despite uncertainty; decision communicated to those who apply it',
    'Décisions | Les décisions sont prises à temps et justifiées | Options, risques et critères évalués ; décision prise malgré l’incertitude ; décision communiquée à ceux qui l’appliquent',
    'Entscheidungen | Entscheidungen werden rechtzeitig getroffen und begründet | Optionen, Risiken und Kriterien abgewogen; Entscheidung trotz Unsicherheit getroffen; an die Umsetzenden kommuniziert'],
  ['gen_anticipation',
    'Anticipation | The cell anticipates how the crisis may evolve | Worst case and next hours considered; next deadlines and triggers prepared; resources planned for a long crisis',
    'Anticipation | La cellule anticipe l’évolution de la crise | Pire scénario et heures suivantes envisagés ; prochaines échéances et déclencheurs préparés ; moyens prévus pour une crise longue',
    'Antizipation | Der Stab antizipiert den Verlauf der Krise | Worst Case und die nächsten Stunden betrachtet; nächste Fristen und Auslöser vorbereitet; Ressourcen für eine lange Krise geplant'],
  ['gen_safety',
    'Health and safety | The health and safety of everyone are checked | People first: staff, customers, partners; wellbeing of the crisis team (breaks, rotation, fatigue); psychological support when needed',
    'Santé et sécurité | La santé et la sécurité de chacun sont vérifiées | Les personnes d’abord : salariés, clients, partenaires ; bien-être de la cellule (pauses, rotation, fatigue) ; soutien psychologique si besoin',
    'Gesundheit und Sicherheit | Gesundheit und Sicherheit aller werden geprüft | Menschen zuerst: Beschäftigte, Kunden, Partner; Wohlbefinden des Stabs (Pausen, Ablösung, Ermüdung); psychologische Unterstützung bei Bedarf'],
  ['gen_communication',
    'Communication | Internal and external communication is consistent and validated | One version of the facts; messages validated before release; staff told what to do and not to do',
    'Communication | La communication interne et externe est cohérente et validée | Une seule version des faits ; messages validés avant diffusion ; consignes claires au personnel',
    'Kommunikation | Interne und externe Kommunikation ist einheitlich und freigegeben | Eine Version der Fakten; Botschaften vor Veröffentlichung freigegeben; klare Anweisungen an die Mitarbeitenden'],
  ['gen_obligations',
    'Obligations | Legal, regulatory and contractual obligations are met on time | Notifications identified with their deadlines (authorities, data protection, insurer, customers); evidence preserved',
    'Obligations | Les obligations légales, réglementaires et contractuelles sont tenues dans les délais | Notifications identifiées avec leurs délais (autorités, protection des données, assureur, clients) ; preuves préservées',
    'Pflichten | Gesetzliche, regulatorische und vertragliche Pflichten werden fristgerecht erfüllt | Meldungen mit Fristen identifiziert (Behörden, Datenschutz, Versicherer, Kunden); Beweise gesichert'],
  ['gen_coordination',
    'Coordination | Coordination with the other cells and external partners works | Information shared at the right time; clear points of contact; no duplicate or contradictory actions',
    'Coordination | La coordination avec les autres cellules et les partenaires externes fonctionne | Informations partagées au bon moment ; interlocuteurs identifiés ; pas d’actions en doublon ou contradictoires',
    'Koordination | Die Abstimmung mit den anderen Zellen und externen Partnern funktioniert | Informationen rechtzeitig geteilt; klare Ansprechpartner; keine doppelten oder widersprüchlichen Maßnahmen'],
  ['gen_continuity',
    'Continuity | Critical activities are protected and degraded modes used | Critical activities listed; continuity plans and workarounds activated; recovery priorities set',
    'Continuité | Les activités critiques sont protégées et les modes dégradés utilisés | Activités critiques listées ; plans de continuité et contournements activés ; priorités de reprise fixées',
    'Kontinuität | Kritische Tätigkeiten werden geschützt und Notbetrieb genutzt | Kritische Tätigkeiten aufgelistet; Kontinuitätspläne und Umgehungen aktiviert; Wiederanlaufprioritäten festgelegt'],
  ['gen_information',
    'Information | Information is verified and crisis channels are secure | Sources checked before acting; out-of-band channels when systems may be compromised; confidentiality kept',
    'Information | L’information est vérifiée et les canaux de crise sont sûrs | Sources vérifiées avant d’agir ; canaux hors bande si les systèmes peuvent être compromis ; confidentialité préservée',
    'Information | Informationen werden geprüft und Krisenkanäle sind sicher | Quellen vor dem Handeln geprüft; Out-of-Band-Kanäle, wenn Systeme kompromittiert sein können; Vertraulichkeit gewahrt'],
  ['gen_exit',
    'Exit and lessons | Crisis exit and lessons learned are prepared | Exit criteria defined; return to normal planned; points to improve noted for the feedback session',
    'Sortie et retour d’expérience | La sortie de crise et le retour d’expérience sont préparés | Critères de sortie définis ; retour à la normale planifié ; points à améliorer notés pour le RETEX',
    'Ende und Lessons Learned | Krisenende und Lessons Learned werden vorbereitet | Kriterien für das Krisenende festgelegt; Rückkehr zum Normalbetrieb geplant; Verbesserungspunkte für die Nachbesprechung notiert']
];

/* The generic criteria in the app language. */
function evGenericCriteria() {
  const column = { en: 1, fr: 2, de: 3 }[typeof currentLanguage === 'function' ? currentLanguage() : 'en'] || 1;
  return EV_GENERIC_CRITERIA.map((row) => { const [category, text, observe] = row[column].split(' | '); return { id: row[0], category, text, observe }; });
}
const EV_GENERIC_IDS = EV_GENERIC_CRITERIA.map(([id]) => id);

/* Default criteria of each type of cell, one row per criterion in English, French and German;
   each language reads "category | criterion | what to observe". A sheet not edited yet shows
   them in the app language; a saved sheet keeps its own text. The generic crisis management
   criteria (mobilisation, roles, logbook…) are rated apart, below. */
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
  return (EV_CELL_CRITERIA[cell?.key] || EV_CELL_CRITERIA.operational)
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

function evNormalizeInjects(input) {
  const injects = {};
  if (input && typeof input === 'object') {
    for (const [key, mark] of Object.entries(input).slice(0, 500)) if (mark && typeof mark === 'object') injects[key.slice(0, 120)] = evNormalizeMark(mark);
  }
  return injects;
}

/* The ratings of the generic criteria, keyed by their stable id. */
function evNormalizeGeneric(input) {
  const generic = {};
  if (input && typeof input === 'object') {
    for (const id of EV_GENERIC_IDS) {
      const mark = input[id];
      if (!mark || typeof mark !== 'object') continue;
      const value = { rating: evRating(mark.rating), notes: evText(mark.notes, 2000) };
      if (value.rating || value.notes) generic[id] = value;
    }
  }
  return generic;
}

function evNormalizeSheet(sheet) {
  return {
    criteria: (Array.isArray(sheet.criteria) ? sheet.criteria : []).slice(0, 80).map(evNormalizeCriterion),
    injects: evNormalizeInjects(sheet.injects), generic: evNormalizeGeneric(sheet.generic),
    evaluator: evText(sheet.evaluator, 200), strengths: evText(sheet.strengths, 4000), improvements: evText(sheet.improvements, 4000),
    adapted_at: evText(sheet.adapted_at, 40)
  };
}

/* What one evaluator sent back for one cell (a .crisiseval.json or a filled Excel sheet).
   Kept apart from the sheet: the sheet holds the consolidated marks of the central team. */
function evNormalizeContribution(input = {}) {
  const criteria = {};
  if (input.criteria && typeof input.criteria === 'object') {
    for (const [id, mark] of Object.entries(input.criteria).slice(0, 120)) {
      if (mark && typeof mark === 'object') criteria[id.slice(0, 60)] = { rating: evRating(mark.rating), notes: evText(mark.notes, 2000), text: evText(mark.text, 600) };
    }
  }
  return {
    evaluator: evText(input.evaluator, 200).trim() || '?', source: input.source === 'xlsx' ? 'xlsx' : 'json', file: evText(input.file, 200),
    exported_at: evText(input.exported_at, 40), imported_at: evText(input.imported_at, 40),
    criteria, generic: evNormalizeGeneric(input.generic), injects: evNormalizeInjects(input.injects),
    strengths: evText(input.strengths, 4000), improvements: evText(input.improvements, 4000)
  };
}

function normalizeEvaluation(input) {
  const sheets = {};
  const contributions = {};
  const source = input && typeof input === 'object' && input.sheets && typeof input.sheets === 'object' ? input.sheets : {};
  for (const [cellId, sheet] of Object.entries(source)) {
    if (!sheet || typeof sheet !== 'object' || !Array.isArray(sheet.criteria)) continue;
    sheets[cellId] = evNormalizeSheet(sheet);
  }
  const received = input && typeof input === 'object' && input.contributions && typeof input.contributions === 'object' ? input.contributions : {};
  for (const [cellId, list] of Object.entries(received)) {
    if (Array.isArray(list) && list.length) contributions[cellId.slice(0, 120)] = list.filter((item) => item && typeof item === 'object').slice(0, 30).map(evNormalizeContribution);
  }
  return { sheets, contributions };
}

function evState(project = appState.scenario) {
  if (!project.evaluation || typeof project.evaluation !== 'object') project.evaluation = normalizeEvaluation(null);
  if (!project.evaluation.contributions || typeof project.evaluation.contributions !== 'object') project.evaluation.contributions = {};
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

/* Marks given on a sheet: counts per rating over the criteria, the injects and the generic criteria. */
function evTally(project, cell) {
  const sheet = evSheet(project, cell);
  const injects = evReceivedInjects(project, cell);
  const ratings = [...sheet.criteria.map((criterion) => criterion.rating), ...injects.map((inject) => evMark(sheet, inject).rating), ...EV_GENERIC_IDS.map((id) => sheet.generic?.[id]?.rating || '')];
  const counts = Object.fromEntries(EV_CODES.map((code) => [code, 0]));
  ratings.forEach((rating) => { if (rating) counts[rating]++; });
  return { counts, rated: ratings.filter(Boolean).length, total: ratings.length };
}


// ── View ────────────────────────────────────────────────────────────────────
function evUI() {
  appState.ui.evaluation = appState.ui.evaluation || { cell: '' };
  return appState.ui.evaluation;
}

const evRatingText = (code) => (evRatings().find(([value]) => value === code) || [code, ''])[1];

/* A rating drop-down: each option shows its code and what it means. */
function evRatingSelect(field, value, disabled, label) {
  return `<select class="ev-rating is-${escapeAttribute((value || 'none').replace('/', ''))}" data-ev-field="${field}" aria-label="${escapeAttribute(label)}" title="${escapeAttribute(value ? `${value} · ${evRatingText(value)}` : label)}" ${disabled}>
    <option value="">${escapeHtml(tt('Not rated', 'Non noté', 'Nicht bewertet'))}</option>${evRatings().map(([code, text]) => `<option value="${code}" ${code === value ? 'selected' : ''}>${escapeHtml(`${code} · ${text}`)}</option>`).join('')}
  </select>`;
}

/* The share of each rating, as one colored bar. */
function evTallyBar(tally) {
  const total = Math.max(1, tally.total);
  return `<span class="ev-bar" role="img" aria-label="${escapeAttribute(`${tally.rated}/${tally.total}`)}">${EV_CODES.map((code) => (tally.counts[code] ? `<i class="is-${code.replace('/', '')}" style="width:${(tally.counts[code] / total * 100).toFixed(2)}%" title="${escapeAttribute(`${code} · ${evRatingText(code)}: ${tally.counts[code]}`)}"></i>` : '')).join('')}</span>`;
}

/* The evaluators' ratings on a line, and the rating proposed from them. */
function evMarksChips(line, field, readOnly) {
  if (!line.marks.length) return '';
  const chips = line.marks.map((mark) => `<span class="ev-chip is-${escapeAttribute((mark.rating || 'none').replace('/', ''))}" title="${escapeAttribute(`${mark.evaluator}${mark.rating ? ` · ${mark.rating} ${evRatingText(mark.rating)}` : ` · ${tt('not rated', 'non noté', 'nicht bewertet')}`}${mark.notes ? `\n${mark.notes}` : ''}${mark.time ? `\n${mark.time}` : ''}`)}"><b>${escapeHtml(mark.rating || '–')}</b>${escapeHtml(evInitials(mark.evaluator))}</span>`).join('');
  const propose = line.proposal && line.proposal !== line.rating
    ? `<button type="button" class="ev-propose is-${escapeAttribute(line.proposal.replace('/', ''))}" data-ev-take="${field}" data-ev-value="${escapeAttribute(line.proposal)}" title="${escapeAttribute(tt('Proposed from the evaluators: the most frequent rating, the lowest on a tie. Click to take it.', 'Proposée à partir des évaluateurs : la note la plus fréquente, la plus basse en cas d’égalité. Cliquez pour la retenir.', 'Aus den Bewertenden vorgeschlagen: die häufigste Bewertung, bei Gleichstand die niedrigste. Zum Übernehmen klicken.'))}" ${readOnly}>${escapeHtml(tt('Take', 'Retenir', 'Übernehmen'))} ${escapeHtml(line.proposal)}</button>`
    : '';
  return `<div class="ev-marks">${chips}${propose}</div>`;
}

function evInitials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : String(parts[0] || '?').slice(0, 2)).toUpperCase();
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
  const received = cells.reduce((sum, entry) => sum + evContributions(project, entry.id).length, 0);
  const view = ui.view ? evReceivedInjects(project, cell).find((inject) => evInjectKey(inject) === ui.view) : null;
  if (ui.view && !view) ui.view = '';
  const width = evPaneWidth();
  return `<section class="tab-page ev-page" ${view ? `style="padding-right:${width + 12}px"` : ''}>
    <article class="card ev-intro">
      <div class="ev-intro-text">
        <span class="ev-kicker">${tt('Run', 'Jouer', 'Durchführen')} · ${tt('Evaluation', 'Évaluation', 'Bewertung')}</span>
        <h3>${tt('Evaluation sheets', 'Grilles d’évaluation', 'Bewertungsbögen')}</h3>
        <p class="subtle">${tt('One sheet per cell: rate the scenario criteria, each inject received and the generic crisis management criteria, note what you observe, then sum up strengths and areas for improvement.', 'Une grille par cellule : notez les critères du scénario, chaque inject reçu et les critères génériques de gestion de crise, consignez vos observations, puis synthétisez points forts et axes d’amélioration.', 'Ein Bogen pro Zelle: Szenariokriterien, jeden erhaltenen Inject und die allgemeinen Kriterien des Krisenmanagements bewerten, Beobachtungen notieren, dann Stärken und Verbesserungsbereiche zusammenfassen.')}</p>
        <div class="ev-scale">${evRatings().map(([code, label]) => `<span><b class="is-${code.replace('/', '')}">${code}</b>${escapeHtml(label)}</span>`).join('')}</div>
      </div>
      <div class="ev-intro-actions">
        <button class="btn btn-secondary" data-ev-action="ai-update" ${aiReady && !EvAI.busy ? '' : 'disabled'} title="${escapeAttribute(aiReady ? tt('Adapt the scenario criteria of every sheet to this exercise (the generic criteria stay)', 'Adapter les critères du scénario de chaque grille à cet exercice (les critères génériques restent)', 'Die Szenariokriterien jedes Bogens an diese Übung anpassen (die allgemeinen Kriterien bleiben)') : tt('Configure an AI connection in Settings first', 'Configurez d’abord une connexion IA dans les Paramètres', 'Zuerst eine KI-Verbindung in den Einstellungen konfigurieren'))}">${sbUiIcon(EvAI.busy ? 'clock' : 'sparkles', 16)} ${EvAI.busy ? escapeHtml(EvAI.progress || tt('Updating…', 'Mise à jour…', 'Wird aktualisiert…')) : tt('Update with AI', 'Mettre à jour avec l’IA', 'Mit KI aktualisieren')}</button>
        ${EvAI.busy ? `<button class="btn btn-ghost btn-sm" data-ev-action="ai-stop">${tt('Stop', 'Arrêter', 'Stoppen')}</button>` : ''}
        <label class="btn btn-secondary ev-import" title="${escapeAttribute(tt('Import the evaluations sent back by the evaluators: .crisiseval.json or filled .xlsx files, several at once', 'Importer les évaluations renvoyées par les évaluateurs : fichiers .crisiseval.json ou .xlsx remplis, plusieurs à la fois', 'Die von den Bewertenden zurückgesandten Bewertungen importieren: Dateien .crisiseval.json oder ausgefüllte .xlsx, mehrere auf einmal'))}">${sbUiIcon('upload', 16)} ${tt('Import evaluations', 'Importer des évaluations', 'Bewertungen importieren')}<input type="file" data-ev-import accept=".json,.xlsx,application/json" multiple hidden ${editLocked}></label>
        <button class="btn btn-primary" data-ev-action="download-all" ${busy ? 'disabled' : ''}>${sbUiIcon(busy ? 'clock' : 'download', 16)} ${tt('Download all sheets (.zip)', 'Télécharger toutes les grilles (.zip)', 'Alle Bögen herunterladen (.zip)')}</button>
      </div>
      ${EvAI.error ? `<p class="agent-warning ev-ai-error">${escapeHtml(EvAI.error)}</p>` : ''}
      <details class="ev-howto" ${received ? '' : 'open'}>
        <summary>${sbUiIcon('info', 14)} ${tt('Several evaluators per cell', 'Plusieurs évaluateurs par cellule', 'Mehrere Bewertende pro Zelle')}${received ? ` <small>${received} ${tt('evaluation(s) imported', 'évaluation(s) importée(s)', 'Bewertung(en) importiert')}</small>` : ''}</summary>
        <ol>
          <li><b>${tt('Share', 'Partager', 'Teilen')}</b> ${tt('the Excel sheet of the cell, or the exercise file to open in CrisisMaker.', 'la grille Excel de la cellule, ou le fichier de l’exercice à ouvrir dans CrisisMaker.', 'den Excel-Bogen der Zelle oder die Übungsdatei zum Öffnen in CrisisMaker.')}</li>
          <li><b>${tt('Rate', 'Noter', 'Bewerten')}</b> ${tt('each on their own, then send back the filled .xlsx or the file from “Export my evaluation”.', 'chacun de son côté, puis renvoyer le .xlsx rempli ou le fichier de « Exporter mon évaluation ».', 'jede Person für sich, dann die ausgefüllte .xlsx oder die Datei aus „Meine Bewertung exportieren“ zurücksenden.')}</li>
          <li><b>${tt('Import', 'Importer', 'Importieren')}</b> ${tt('every file here: one evaluation per evaluator and cell, never overwritten; files from another exercise are refused.', 'tous les fichiers ici : une évaluation par évaluateur et par cellule, jamais écrasée ; les fichiers d’un autre exercice sont refusés.', 'alle Dateien hier: eine Bewertung pro Person und Zelle, nie überschrieben; Dateien einer anderen Übung werden abgelehnt.')}</li>
          <li><b>${tt('Consolidate', 'Consolider', 'Konsolidieren')}</b> ${tt('with the ratings side by side and a proposed rating, then download the consolidated Excel.', 'avec les notes côte à côte et une note proposée, puis téléchargez l’Excel consolidé.', 'mit den Bewertungen nebeneinander und einem Vorschlag, dann das konsolidierte Excel herunterladen.')}</li>
        </ol>
      </details>
      ${renderEvImportReport(ui.importReport)}
    </article>
    <nav class="ev-cells" aria-label="${escapeAttribute(tt('Cells', 'Cellules', 'Zellen'))}">${cells.map((entry) => {
      const tally = evTally(project, entry);
      const count = evContributions(project, entry.id).length;
      return `<button class="${entry.id === cell.id ? 'active' : ''}" data-ev-action="select" data-ev-cell="${escapeAttribute(entry.id)}" style="--cell-color:${escapeAttribute(entry.color)}">
        <span class="ev-cell-name"><span class="cell-dot"></span>${escapeHtml(entry.name)}</span>
        <span class="ev-cell-meta">${evTallyBar(tally)}<small>${tally.rated}/${tally.total}</small>${count ? `<small class="ev-cell-count" title="${escapeAttribute(tt('Evaluations imported', 'Évaluations importées', 'Importierte Bewertungen'))}">${sbUiIcon('agent', 11)} ${count}</small>` : ''}</span>
      </button>`;
    }).join('')}</nav>
    ${renderEvaluationSheet(project, cell, editLocked)}
    ${view ? renderEvView(project, cell, view) : ''}
  </section>`;
}

function renderEvImportReport(report) {
  if (!report) return '';
  const list = (items, className, label) => (items.length ? `<p class="${className}"><b>${label}</b> ${items.map(escapeHtml).join(' · ')}</p>` : '');
  return `<div class="ev-report">
    ${list(report.added, 'is-ok', tt('Imported:', 'Importées :', 'Importiert:'))}
    ${list(report.replaced, 'is-ok', tt('Replaced:', 'Remplacées :', 'Ersetzt:'))}
    ${list(report.kept, 'is-info', tt('Kept as they were:', 'Conservées telles quelles :', 'Unverändert behalten:'))}
    ${list(report.refused, 'is-error', tt('Refused:', 'Refusés :', 'Abgelehnt:'))}
    <button class="sb-icon-btn" data-ev-action="close-report" title="${escapeAttribute(tt('Close', 'Fermer', 'Schließen'))}">${sbUiIcon('close', 13)}</button>
  </div>`;
}

function renderEvContributions(project, cell, lines, readOnly) {
  const contributions = evContributions(project, cell.id);
  if (!contributions.length) return '';
  const pending = lines.filter((line) => line.proposal && !line.rating).length;
  const differ = lines.filter((line) => line.proposal && line.rating && line.rating !== line.proposal).length;
  const date = (value) => (value ? new Date(value).toLocaleString(typeof currentLanguage === 'function' ? currentLanguage() : 'en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  return `<section class="ev-contrib">
    <header>
      <h4>${sbUiIcon('agent', 15)} ${tt('Evaluations received', 'Évaluations reçues', 'Erhaltene Bewertungen')} <small>${contributions.length}</small></h4>
      <p class="subtle">${tt('The ratings of each evaluator appear under each line. The sheet holds the consolidated rating: take the proposal (most frequent rating, the lowest on a tie) or choose another.', 'Les notes de chaque évaluateur apparaissent sous chaque ligne. La grille porte la note consolidée : retenez la proposition (note la plus fréquente, la plus basse en cas d’égalité) ou choisissez-en une autre.', 'Die Bewertungen jeder Person erscheinen unter jeder Zeile. Der Bogen enthält die konsolidierte Bewertung: den Vorschlag übernehmen (häufigste Bewertung, bei Gleichstand die niedrigste) oder eine andere wählen.')}</p>
      <button class="btn btn-primary btn-sm" data-ev-action="apply" data-ev-cell="${escapeAttribute(cell.id)}" ${pending || differ ? '' : 'disabled'} ${readOnly}>${sbUiIcon('check', 14)} ${tt('Take the proposals', 'Retenir les propositions', 'Vorschläge übernehmen')}${pending ? ` (${pending})` : ''}</button>
    </header>
    <ul>${contributions.map((item, index) => {
      const rated = [...Object.values(item.criteria), ...Object.values(item.generic), ...Object.values(item.injects)].filter((mark) => mark.rating).length;
      return `<li><span class="ev-avatar">${escapeHtml(evInitials(item.evaluator))}</span><span><b>${escapeHtml(item.evaluator)}</b><small>${item.source === 'xlsx' ? 'Excel' : 'JSON'} · ${escapeHtml(date(item.imported_at))} · ${rated} ${tt('rated', 'notés', 'bewertet')}</small></span><button class="sb-icon-btn is-danger" data-ev-action="remove-contribution" data-ev-cell="${escapeAttribute(cell.id)}" data-ev-index="${index}" title="${escapeAttribute(tt('Remove this evaluation', 'Retirer cette évaluation', 'Diese Bewertung entfernen'))}" ${readOnly}>${sbUiIcon('trash', 13)}</button></li>`;
    }).join('')}</ul>
    ${differ ? `<p class="ev-differ">${sbUiIcon('alert', 13)} ${tt(`${differ} consolidated rating(s) differ from the proposal.`, `${differ} note(s) consolidée(s) diffèrent de la proposition.`, `${differ} konsolidierte Bewertung(en) weichen vom Vorschlag ab.`)}</p>` : ''}
  </section>`;
}

function renderEvaluationSheet(project, cell, readOnly) {
  const sheet = evSheet(project, cell);
  const tally = evTally(project, cell);
  const lines = evLines(project, cell);
  const cellId = escapeAttribute(cell.id);
  const field = (...parts) => [cellId, ...parts.map((part) => escapeAttribute(part))].join('|');
  const label = { rating: tt('Rating', 'Note', 'Bewertung'), observe: tt('What to observe', 'Points à observer', 'Beobachtungspunkte'), observed: tt('Reaction observed', 'Réaction observée', 'Beobachtete Reaktion'), reactionTime: tt('Time of reaction', 'Heure de la réaction', 'Zeitpunkt der Reaktion') };
  const ui = evUI();
  const byScope = (scope) => lines.filter((line) => line.scope === scope);
  const criteria = byScope('crit'), injects = byScope('inject'), generic = byScope('gen');
  const rated = (items) => items.filter((line) => line.rating).length;
  const section = (number, title, items, note = '') => `<h4 class="ev-section"><span class="ev-step">${number}</span>${title} <small>${rated(items)}/${items.length}</small>${note ? `<em>${note}</em>` : ''}</h4>`;
  const ratingCell = (line, path) => `<td><div class="ev-rate">${evRatingSelect(path, line.rating, readOnly, label.rating)}${evMarksChips(line, path, readOnly)}</div></td>`;
  const notesMarks = (line) => (line.marks.some((mark) => mark.notes.trim()) ? `<details class="ev-their-notes"><summary>${tt('Evaluators’ notes', 'Notes des évaluateurs', 'Notizen der Bewertenden')}</summary>${line.marks.filter((mark) => mark.notes.trim()).map((mark) => `<p><b>${escapeHtml(mark.evaluator)}</b> ${escapeHtml(mark.notes)}</p>`).join('')}</details>` : '');
  const summaryMarks = (key) => {
    const items = evContributions(project, cell.id).filter((item) => item[key].trim());
    return items.length ? `<details class="ev-their-notes"><summary>${tt('Evaluators’ notes', 'Notes des évaluateurs', 'Notizen der Bewertenden')} (${items.length})</summary>${items.map((item) => `<p><b>${escapeHtml(item.evaluator)}</b> ${escapeHtml(item[key])}</p>`).join('')}</details>` : '';
  };
  return `<article class="card ev-sheet" style="--cell-color:${escapeAttribute(cell.color)}">
    <header class="ev-sheet-head">
      <div class="ev-sheet-title"><h3><span class="cell-dot"></span>${escapeHtml(cell.name)}</h3><p class="subtle">${escapeHtml(cell.description || '')}</p></div>
      <div class="ev-tally">${evTallyBar(tally)}<span class="ev-tally-codes">${EV_CODES.map((code) => `<b class="is-${code.replace('/', '')}" title="${escapeAttribute(evRatingText(code))}">${code} ${tally.counts[code]}</b>`).join('')}</span><span>${tally.rated}/${tally.total} ${tt('rated', 'notés', 'bewertet')}</span></div>
      <span class="ev-sheet-actions">
        <button class="btn btn-ghost btn-xs" data-ev-action="reset" data-ev-cell="${cellId}" ${readOnly || sheet.isDefault ? 'disabled' : ''} title="${escapeAttribute(tt('Back to the default criteria of this type of cell, marks cleared', 'Revenir aux critères par défaut de ce type de cellule, notes effacées', 'Zurück zu den Standardkriterien dieses Zelltyps, Bewertungen gelöscht'))}">${tt('Reset', 'Réinitialiser', 'Zurücksetzen')}</button>
        <button class="btn btn-secondary btn-sm" data-ev-action="export" data-ev-cell="${cellId}" title="${escapeAttribute(tt('For an evaluator: download your marks as a .crisiseval.json file to send to the central team', 'Pour un évaluateur : téléchargez vos notes dans un fichier .crisiseval.json à envoyer à l’équipe centrale', 'Für Bewertende: Ihre Bewertungen als Datei .crisiseval.json für das zentrale Team herunterladen'))}">${sbUiIcon('braces', 14)} ${tt('Export my evaluation', 'Exporter mon évaluation', 'Meine Bewertung exportieren')}</button>
        <button class="btn btn-secondary btn-sm" data-ev-action="download" data-ev-cell="${cellId}">${sbUiIcon('sheet', 14)} ${evContributions(project, cell.id).length ? tt('Consolidated Excel', 'Excel consolidé', 'Konsolidiertes Excel') : tt('Excel sheet', 'Grille Excel', 'Excel-Bogen')}</button>
      </span>
    </header>
    <label class="field ev-evaluator">${tt('Evaluator', 'Évaluateur', 'Bewertende Person')}<input type="text" data-ev-field="${field('sheet', 'evaluator')}" value="${escapeAttribute(sheet.evaluator || '')}" placeholder="${escapeAttribute(tt('Your name', 'Votre nom', 'Ihr Name'))}" ${readOnly}></label>
    ${renderEvContributions(project, cell, lines, readOnly)}
    ${section(1, tt('Scenario criteria', 'Critères du scénario', 'Szenariokriterien'), criteria, sheet.adapted_at ? tt('adapted to the scenario with AI', 'adaptés au scénario avec l’IA', 'mit KI an das Szenario angepasst') : sheet.isDefault ? tt('default criteria for this type of cell', 'critères par défaut pour ce type de cellule', 'Standardkriterien für diesen Zelltyp') : '')}
    <table class="ev-table ev-criteria">
      <thead><tr><th>${tt('Category', 'Catégorie', 'Kategorie')}</th><th>${tt('Criterion and what to observe', 'Critère et points à observer', 'Kriterium und Beobachtungspunkte')}</th><th>${label.rating}</th><th>${tt('Observations and evidence', 'Observations et éléments de preuve', 'Beobachtungen und Nachweise')}</th><th></th></tr></thead>
      <tbody>${criteria.map((line) => `<tr>
        <td><input type="text" class="ev-category" data-ev-field="${field('crit', line.id, 'category')}" value="${escapeAttribute(line.category)}" aria-label="${escapeAttribute(tt('Category', 'Catégorie', 'Kategorie'))}" ${readOnly}></td>
        <td class="ev-criterion"><textarea rows="2" data-ev-field="${field('crit', line.id, 'text')}" aria-label="${escapeAttribute(tt('Criterion', 'Critère', 'Kriterium'))}" ${readOnly}>${escapeHtml(line.text)}</textarea><textarea rows="2" class="ev-observe" data-ev-field="${field('crit', line.id, 'observe')}" aria-label="${escapeAttribute(label.observe)}" placeholder="${escapeAttribute(label.observe)}" ${readOnly}>${escapeHtml(line.observe)}</textarea></td>
        ${ratingCell(line, field('crit', line.id, 'rating'))}
        <td><textarea rows="3" data-ev-field="${field('crit', line.id, 'notes')}" aria-label="${escapeAttribute(tt('Observations', 'Observations', 'Beobachtungen'))}" placeholder="${escapeAttribute(tt('What the cell did, with times', 'Ce que la cellule a fait, avec les heures', 'Was die Zelle getan hat, mit Uhrzeiten'))}" ${readOnly}>${escapeHtml(line.notes)}</textarea>${notesMarks(line)}</td>
        <td><button class="sb-icon-btn is-danger" data-ev-action="delete" data-ev-cell="${cellId}" data-ev-criterion="${escapeAttribute(line.id)}" title="${escapeAttribute(tt('Remove', 'Supprimer', 'Entfernen'))}" ${readOnly}>${sbUiIcon('trash', 13)}</button></td>
      </tr>`).join('')}</tbody>
    </table>
    <button class="btn btn-ghost btn-xs ev-add" data-ev-action="add" data-ev-cell="${cellId}" ${readOnly}>${sbUiIcon('plus', 12)} ${tt('Criterion', 'Critère', 'Kriterium')}</button>
    ${section(2, tt('Injects received', 'Injects reçus', 'Erhaltene Injects'), injects, tt('the eye shows what the players see', 'l’œil montre ce que voient les joueurs', 'das Auge zeigt, was die Spieler sehen'))}
    ${injects.length ? `<table class="ev-table ev-injects">
      <thead><tr><th>${tt('Time', 'Heure', 'Zeit')}</th><th>${tt('Inject and reaction expected', 'Inject et réaction attendue', 'Inject und erwartete Reaktion')}</th><th>${label.rating}</th><th>${label.observed}</th><th>${label.reactionTime}</th></tr></thead>
      <tbody>${injects.map((line) => `<tr class="${ui.view === line.id ? 'is-viewed' : ''}">
          <td class="ev-time"><b>${escapeHtml(line.number)}</b>${line.inject.numberLabel ? `<small>${escapeHtml(line.inject.numberLabel)}</small>` : ''}<button type="button" class="ev-eye ${ui.view === line.id ? 'active' : ''}" data-ev-view="${escapeAttribute(line.id)}" title="${escapeAttribute(line.inject.stimulus ? tt('See what the players see', 'Voir ce que voient les joueurs', 'Sehen, was die Spieler sehen') : tt('Planned, not written yet', 'Prévu, pas encore rédigé', 'Geplant, noch nicht geschrieben'))}" aria-label="${escapeAttribute(tt('View', 'Voir', 'Ansehen'))}">${sbUiIcon('eye', 15)}</button></td>
          <td class="ev-inject"><strong>${escapeHtml(line.text)}</strong>${line.inject.channel ? `<span class="ev-channel">${escapeHtml(channelLabel(line.inject.channel))}${line.inject.sender ? ` · ${escapeHtml(line.inject.sender)}` : ''}</span>` : ''}${line.observe ? `<span class="subtle">${escapeHtml(line.observe)}</span>` : ''}</td>
          ${ratingCell(line, field('inject', line.id, 'rating'))}
          <td><textarea rows="2" data-ev-field="${field('inject', line.id, 'observed')}" aria-label="${escapeAttribute(label.observed)}" ${readOnly}>${escapeHtml(line.notes)}</textarea>${notesMarks(line)}</td>
          <td><input type="text" data-ev-field="${field('inject', line.id, 'time')}" value="${escapeAttribute(line.time)}" placeholder="H+0:20" aria-label="${escapeAttribute(label.reactionTime)}" ${readOnly}></td>
        </tr>`).join('')}</tbody>
    </table>` : `<p class="subtle">${tt('No inject reaches this cell yet.', 'Aucun inject n’atteint encore cette cellule.', 'Noch erreicht kein Inject diese Zelle.')}</p>`}
    ${section(3, tt('Generic crisis management criteria', 'Critères génériques de gestion de crise', 'Allgemeine Kriterien des Krisenmanagements'), generic, tt('for every crisis exercise (ANSSI guide, HSEEP); not changed by the AI', 'pour tout exercice de crise (guide ANSSI, HSEEP) ; non modifiés par l’IA', 'für jede Krisenübung (ANSSI-Leitfaden, HSEEP); von der KI nicht geändert'))}
    <table class="ev-table ev-generic">
      <thead><tr><th>${tt('Category', 'Catégorie', 'Kategorie')}</th><th>${tt('Criterion and what to observe', 'Critère et points à observer', 'Kriterium und Beobachtungspunkte')}</th><th>${label.rating}</th><th>${tt('Observations and evidence', 'Observations et éléments de preuve', 'Beobachtungen und Nachweise')}</th></tr></thead>
      <tbody>${generic.map((line) => `<tr>
        <td><span class="ev-tag">${escapeHtml(line.category)}</span></td>
        <td class="ev-criterion-text"><strong>${escapeHtml(line.text)}</strong><span class="subtle">${escapeHtml(line.observe)}</span></td>
        ${ratingCell(line, field('gen', line.id, 'rating'))}
        <td><textarea rows="2" data-ev-field="${field('gen', line.id, 'notes')}" aria-label="${escapeAttribute(tt('Observations', 'Observations', 'Beobachtungen'))}" placeholder="${escapeAttribute(tt('What the cell did, with times', 'Ce que la cellule a fait, avec les heures', 'Was die Zelle getan hat, mit Uhrzeiten'))}" ${readOnly}>${escapeHtml(line.notes)}</textarea>${notesMarks(line)}</td>
      </tr>`).join('')}</tbody>
    </table>
    <h4 class="ev-section"><span class="ev-step">4</span>${tt('Summary', 'Synthèse', 'Zusammenfassung')}</h4>
    <div class="ev-summary">
      <label class="field">${tt('Strengths', 'Points forts', 'Stärken')}<textarea rows="4" data-ev-field="${field('sheet', 'strengths')}" placeholder="${escapeAttribute(tt('What worked well', 'Ce qui a bien fonctionné', 'Was gut funktioniert hat'))}" ${readOnly}>${escapeHtml(sheet.strengths || '')}</textarea>${summaryMarks('strengths')}</label>
      <label class="field">${tt('Areas for improvement', 'Axes d’amélioration', 'Verbesserungsbereiche')}<textarea rows="4" data-ev-field="${field('sheet', 'improvements')}" placeholder="${escapeAttribute(tt('What to improve, and how', 'Ce qu’il faut améliorer, et comment', 'Was zu verbessern ist, und wie'))}" ${readOnly}>${escapeHtml(sheet.improvements || '')}</textarea>${summaryMarks('improvements')}</label>
    </div>
  </article>`;
}

/* The right pane: the stimulus as the players receive it, like the live stimuli of Play. */
const EV_PANE_WIDTH = 520;
function evPaneWidth() {
  const max = typeof window !== 'undefined' && window.innerWidth ? Math.max(320, window.innerWidth - 360) : 1600;
  return Math.round(Math.min(max, Math.max(320, evUI().viewWidth || EV_PANE_WIDTH)));
}

function renderEvView(project, cell, inject) {
  const injects = evReceivedInjects(project, cell);
  const index = injects.findIndex((item) => evInjectKey(item) === evInjectKey(inject));
  const width = evPaneWidth();
  const zoom = Math.min(1, (width - 40) / 840).toFixed(3);
  const step = (offset) => injects[index + offset] ? evInjectKey(injects[index + offset]) : '';
  return `<aside class="ev-view" style="width:${width}px" aria-label="${escapeAttribute(tt('What the players see', 'Ce que voient les joueurs', 'Was die Spieler sehen'))}">
    <div class="play-pane-resize" data-ev-resize title="${escapeAttribute(tt('Drag to widen', 'Glisser pour élargir', 'Ziehen zum Verbreitern'))}"></div>
    <div class="play-log-head">
      <h3>${sbUiIcon('eye', 16)} ${tt('What the players see', 'Ce que voient les joueurs', 'Was die Spieler sehen')}</h3>
      <span class="ev-view-nav">
        <button class="sb-icon-btn" data-ev-view="${escapeAttribute(step(-1))}" ${step(-1) ? '' : 'disabled'} title="${escapeAttribute(tt('Previous inject', 'Inject précédent', 'Vorheriger Inject'))}">${sbUiIcon('up', 14)}</button>
        <small>${index + 1}/${injects.length}</small>
        <button class="sb-icon-btn" data-ev-view="${escapeAttribute(step(1))}" ${step(1) ? '' : 'disabled'} title="${escapeAttribute(tt('Next inject', 'Inject suivant', 'Nächster Inject'))}">${sbUiIcon('down', 14)}</button>
      </span>
      <button class="assistant-close" data-ev-view="" aria-label="${escapeAttribute(tt('Close', 'Fermer', 'Schließen'))}">${sbUiIcon('close', 18)}</button>
    </div>
    <p class="ev-view-meta"><b>${escapeHtml([inject.numberLabel, sbFormatOffset(inject.time)].filter(Boolean).join(' · '))}</b> ${escapeHtml([inject.channel ? channelLabel(inject.channel) : '', inject.sender, inject.cell ? `→ ${inject.cell.name}` : tt('→ all cells', '→ toutes les cellules', '→ alle Zellen')].filter(Boolean).join(' · '))}</p>
    ${inject.intent ? `<p class="ev-view-expected"><b>${tt('Reaction expected', 'Réaction attendue', 'Erwartete Reaktion')}</b> ${escapeHtml(inject.intent)}</p>` : ''}
    <div class="play-live-list">
      ${inject.stimulus
        ? `<article class="play-live-card"><div class="play-live-preview"><div class="play-live-stage" style="zoom:${zoom}">${renderStimulusPreview(inject.stimulus)}</div></div></article>`
        : `<p class="play-live-empty"><b>${escapeHtml(inject.title || '')}</b><br>${escapeHtml(tt('Planned but not written yet: write it in the Detailed storyline to see it as the players will.', 'Prévu mais pas encore rédigé : rédigez-le dans la Storyline détaillée pour le voir comme les joueurs.', 'Geplant, aber noch nicht geschrieben: Schreiben Sie ihn in der detaillierten Storyline, um ihn wie die Spieler zu sehen.'))}</p>`}
    </div>
  </aside>`;
}

const EV_LIMITS = { category: 120, text: 600, observe: 1000, notes: 2000, observed: 2000, time: 40, evaluator: 200, strengths: 4000, improvements: 4000 };

/* One field of a sheet, from its data-ev-field "cellId|sheet|name", "cellId|crit|id|name",
   "cellId|gen|id|name" or "cellId|inject|key|name". Returns true when the tally changed (a rating). */
function evApplyField(project, path, value) {
  const [cellId, scope, id, name] = path.split('|');
  const cell = (project.cells || []).find((entry) => entry.id === cellId);
  if (!cell) return false;
  const sheet = evEditableSheet(project, cell);
  if (scope === 'sheet' && ['evaluator', 'strengths', 'improvements'].includes(id) && name === undefined) { sheet[id] = String(value).slice(0, EV_LIMITS[id]); return false; }
  if (scope === 'crit') {
    const criterion = sheet.criteria.find((item) => item.id === id);
    if (!criterion || !['category', 'text', 'observe', 'rating', 'notes'].includes(name)) return false;
    criterion[name] = name === 'rating' ? evRating(value) : String(value).slice(0, EV_LIMITS[name]);
    return name === 'rating';
  }
  if (scope === 'gen' && EV_GENERIC_IDS.includes(id) && ['rating', 'notes'].includes(name)) {
    sheet.generic = sheet.generic || {};
    const mark = sheet.generic[id] || (sheet.generic[id] = { rating: '', notes: '' });
    mark[name] = name === 'rating' ? evRating(value) : String(value).slice(0, EV_LIMITS[name]);
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
  const ui = evUI();
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
  root.querySelectorAll('[data-ev-take]').forEach((button) => button.addEventListener('click', () => {
    evApplyField(project, button.dataset.evTake, button.dataset.evValue);
    saveLocal(false);
    App.render();
  }));
  root.querySelectorAll('[data-ev-view]').forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.evView;
    // The eye of the inject shown closes the pane; the arrows of the pane move to another.
    ui.view = !key || (ui.view === key && !button.closest('.ev-view')) ? '' : key;
    App.render();
  }));
  root.querySelector('[data-ev-import]')?.addEventListener('change', async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (files.length) await evImportFiles(project, files);
  });
  root.querySelector('[data-ev-resize]')?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const handle = event.currentTarget;
    const pane = handle.parentElement;
    const startX = event.clientX, startWidth = pane.getBoundingClientRect().width;
    handle.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => { ui.viewWidth = startWidth + startX - moveEvent.clientX; pane.style.width = `${evPaneWidth()}px`; };
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); App.render(); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
  root.querySelectorAll('[data-ev-action]').forEach((button) => button.addEventListener('click', async () => {
    const action = button.dataset.evAction;
    const cell = cellOf(button.dataset.evCell);
    if (action === 'download-all') { await evDownloadAll(project); return; }
    if (action === 'ai-update') { await EvAI.updateAll(project); return; }
    if (action === 'ai-stop') { EvAI.stop(); return; }
    if (action === 'close-report') { ui.importReport = null; App.render(); return; }
    if (!cell) return;
    if (action === 'select') { ui.cell = cell.id; ui.view = ''; App.render(); return; }
    if (action === 'download') { await evDownloadCell(project, cell); return; }
    if (action === 'export') { evExportContribution(project, cell); return; }
    const state = evState(project);
    if (action === 'apply') {
      const differ = evLines(project, cell).filter((line) => line.proposal && line.rating && line.rating !== line.proposal).length;
      const replace = differ > 0 && window.confirm(tt(`${differ} consolidated rating(s) already set differ from the proposal. Replace them too? (Cancel keeps them and fills only the empty ones.)`, `${differ} note(s) consolidée(s) déjà saisie(s) diffèrent de la proposition. Les remplacer aussi ? (Annuler les conserve et ne remplit que les vides.)`, `${differ} bereits gesetzte konsolidierte Bewertung(en) weichen vom Vorschlag ab. Auch ersetzen? (Abbrechen behält sie und füllt nur die leeren.)`));
      const changed = evApplyProposals(project, cell, { replace });
      pushToast(tt(`${changed} rating(s) taken from the proposals.`, `${changed} note(s) reprise(s) des propositions.`, `${changed} Bewertung(en) aus den Vorschlägen übernommen.`), 'success');
    }
    if (action === 'remove-contribution') {
      const list = state.contributions[cell.id] || [];
      const item = list[Number(button.dataset.evIndex)];
      if (!item || !window.confirm(tt(`Remove the evaluation of ${item.evaluator} for ${cell.name}? The consolidated ratings stay.`, `Retirer l’évaluation de ${item.evaluator} pour ${cell.name} ? Les notes consolidées restent.`, `Die Bewertung von ${item.evaluator} für ${cell.name} entfernen? Die konsolidierten Bewertungen bleiben.`))) return;
      list.splice(Number(button.dataset.evIndex), 1);
      if (!list.length) delete state.contributions[cell.id];
    }
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

// ── Several evaluators: contributions and consolidation ─────────────────────
/* Each evaluator rates their cell in their own browser (the exercise file opened there) or in
   the Excel sheet, then sends back a .crisiseval.json or the filled .xlsx. The central team
   imports every file here: one contribution per evaluator and cell, never overwritten by
   another evaluator; the sheet itself holds the consolidated marks, proposed from the
   contributions and edited by the central team. */
const EV_FORMAT = 'crisismaker-evaluation';
const EV_PERFORMANCE = ['P', 'S', 'M', 'U'];
const evPersonKey = (name) => String(name || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

function evContributions(project, cellId) {
  const list = evState(project).contributions[cellId];
  return Array.isArray(list) ? list : [];
}

/* The consolidated rating proposed from the evaluators' ratings: the most frequent; on a tie,
   the lowest (the more demanding reading). N/A only when nobody could rate. */
function evProposal(ratings) {
  const counts = {};
  ratings.filter((rating) => EV_PERFORMANCE.includes(rating)).forEach((rating) => { counts[rating] = (counts[rating] || 0) + 1; });
  const values = Object.values(counts);
  if (!values.length) return ratings.includes('N/A') ? 'N/A' : '';
  const max = Math.max(...values);
  return EV_PERFORMANCE.filter((code) => counts[code] === max).pop();
}

/* The evaluators' marks on one line of a sheet: scope crit, gen or inject. */
function evContributionMarks(project, cell, scope, id) {
  return evContributions(project, cell.id).map((contribution) => {
    const mark = (scope === 'crit' ? contribution.criteria : scope === 'gen' ? contribution.generic : contribution.injects)[id];
    return { evaluator: contribution.evaluator, rating: mark?.rating || '', notes: String((scope === 'inject' ? mark?.observed : mark?.notes) || ''), time: scope === 'inject' ? mark?.time || '' : '' };
  });
}

/* Every line of a sheet with its consolidated mark and the evaluators' marks. */
function evLines(project, cell) {
  const sheet = evSheet(project, cell);
  const lines = [];
  sheet.criteria.forEach((criterion, index) => lines.push({ scope: 'crit', id: criterion.id, number: `C${index + 1}`, category: criterion.category, text: criterion.text, observe: criterion.observe, rating: criterion.rating, notes: criterion.notes || '', time: '' }));
  evReceivedInjects(project, cell).forEach((inject) => {
    const mark = evMark(sheet, inject);
    lines.push({ scope: 'inject', id: evInjectKey(inject), number: sbFormatOffset(inject.time), category: [inject.numberLabel, inject.channel ? channelLabel(inject.channel) : ''].filter(Boolean).join(' · '), text: inject.title || '', observe: inject.intent || '', rating: mark.rating, notes: mark.observed, time: mark.time, inject });
  });
  evGenericCriteria().forEach((criterion, index) => {
    const mark = sheet.generic?.[criterion.id] || {};
    lines.push({ scope: 'gen', id: criterion.id, number: `G${index + 1}`, category: criterion.category, text: criterion.text, observe: criterion.observe, rating: mark.rating || '', notes: mark.notes || '', time: '' });
  });
  const contributions = evContributions(project, cell.id);
  lines.forEach((line) => {
    line.marks = contributions.length ? evContributionMarks(project, cell, line.scope, line.id) : [];
    line.proposal = evProposal(line.marks.map((mark) => mark.rating));
  });
  return lines;
}

/* Fills the consolidated sheet from the contributions: the proposed rating where none is set
   (every one with replace), the evaluators' notes where the sheet has none. */
function evApplyProposals(project, cell, { replace = false } = {}) {
  const sheet = evEditableSheet(project, cell);
  const contributions = evContributions(project, cell.id);
  const joined = (items, max) => items.filter((item) => item.text.trim()).map((item) => `${item.who}: ${item.text.trim()}`).join('\n').slice(0, max);
  let changed = 0;
  const settle = (target, notesKey, marks) => {
    if (!marks.some((mark) => mark.rating || mark.notes.trim())) return;
    const proposal = evProposal(marks.map((mark) => mark.rating));
    if (proposal && (replace || !target.rating) && target.rating !== proposal) { target.rating = proposal; changed++; }
    if (!target[notesKey]) target[notesKey] = joined(marks.map((mark) => ({ who: mark.evaluator, text: mark.notes })), 2000);
  };
  sheet.criteria.forEach((criterion) => settle(criterion, 'notes', evContributionMarks(project, cell, 'crit', criterion.id)));
  sheet.generic = sheet.generic || {};
  EV_GENERIC_IDS.forEach((id) => {
    const marks = evContributionMarks(project, cell, 'gen', id);
    if (!marks.some((mark) => mark.rating || mark.notes.trim())) return;
    sheet.generic[id] = sheet.generic[id] || { rating: '', notes: '' };
    settle(sheet.generic[id], 'notes', marks);
  });
  sheet.injects = sheet.injects || {};
  evReceivedInjects(project, cell).forEach((inject) => {
    const key = evInjectKey(inject);
    const marks = evContributionMarks(project, cell, 'inject', key);
    if (!marks.some((mark) => mark.rating || mark.notes.trim() || mark.time)) return;
    const mark = sheet.injects[key] || (sheet.injects[key] = evNormalizeMark());
    settle(mark, 'observed', marks);
    if (!mark.time) mark.time = marks.find((item) => item.time)?.time || '';
  });
  if (!sheet.strengths) sheet.strengths = joined(contributions.map((item) => ({ who: item.evaluator, text: item.strengths })), 4000);
  if (!sheet.improvements) sheet.improvements = joined(contributions.map((item) => ({ who: item.evaluator, text: item.improvements })), 4000);
  return changed;
}

/* The evaluator's own marks on a cell, to send to the central team. */
function evContributionOf(project, cell) {
  const sheet = evSheet(project, cell);
  return {
    format: EV_FORMAT, version: 1, exported_at: new Date().toISOString(),
    project: { id: project.id || '', name: project.name || '' },
    cell: { id: cell.id, name: cell.name },
    evaluator: sheet.evaluator || '',
    criteria: Object.fromEntries(sheet.criteria.map((criterion) => [criterion.id, { rating: criterion.rating, notes: criterion.notes || '', text: criterion.text }])),
    generic: evNormalizeGeneric(sheet.generic),
    injects: Object.fromEntries(Object.entries(sheet.injects || {}).filter(([, mark]) => mark.rating || mark.observed || mark.time)),
    strengths: sheet.strengths || '', improvements: sheet.improvements || ''
  };
}

function evAskEvaluator(project, cell) {
  const sheet = evSheet(project, cell);
  if (sheet.evaluator.trim()) return sheet.evaluator.trim();
  const name = String(window.prompt(tt('Your name, so the central team can tell the evaluations apart:', 'Votre nom, pour que l’équipe centrale distingue les évaluations :', 'Ihr Name, damit das zentrale Team die Bewertungen unterscheiden kann:')) || '').trim().slice(0, 200);
  if (name) evEditableSheet(project, cell).evaluator = name;
  return name;
}

function evExportContribution(project, cell) {
  const evaluator = evAskEvaluator(project, cell);
  if (!evaluator) return;
  saveLocal(false);
  const data = evContributionOf(project, cell);
  evSave(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `evaluation-${evFileName(cell.name)}-${evFileName(evaluator)}.crisiseval.json`);
  pushToast(tt('Your evaluation is downloaded: send the .crisiseval.json file to the central team.', 'Votre évaluation est téléchargée : envoyez le fichier .crisiseval.json à l’équipe centrale.', 'Ihre Bewertung wurde heruntergeladen: Senden Sie die Datei .crisiseval.json an das zentrale Team.'), 'success');
  App.render();
}

function evParseContributionJson(data) {
  if (!data || typeof data !== 'object') throw new Error(tt('Unreadable file.', 'Fichier illisible.', 'Datei nicht lesbar.'));
  if (data.format !== EV_FORMAT) {
    throw new Error(Array.isArray(data.stimuli) || Array.isArray(data.cells)
      ? tt('This is an exercise file, not an evaluation: evaluators export theirs with “Export my evaluation”.', 'C’est un fichier d’exercice, pas une évaluation : les évaluateurs exportent la leur avec « Exporter mon évaluation ».', 'Das ist eine Übungsdatei, keine Bewertung: Bewertende exportieren ihre mit „Meine Bewertung exportieren“.')
      : tt('Not a CrisisMaker evaluation.', 'Ce n’est pas une évaluation CrisisMaker.', 'Keine CrisisMaker-Bewertung.'));
  }
  return [{ ...data, source: 'json' }];
}

/* Adds one contribution to its cell. Refused when it comes from another exercise or names a
   cell this exercise does not have; the same evaluator replaces their own after confirmation. */
function evAddContribution(project, data, fileName, report) {
  const from = data.project || {};
  if (from.id && project.id && from.id !== project.id) throw new Error(tt(`From another exercise (${from.name || from.id}).`, `Provient d’un autre exercice (${from.name || from.id}).`, `Stammt aus einer anderen Übung (${from.name || from.id}).`));
  if (!from.id && from.name && project.name && evPersonKey(from.name) !== evPersonKey(project.name)) throw new Error(tt(`From another exercise (${from.name}).`, `Provient d’un autre exercice (${from.name}).`, `Stammt aus einer anderen Übung (${from.name}).`));
  const cells = project.cells || [];
  const cell = cells.find((entry) => entry.id === data.cell?.id) || cells.find((entry) => evPersonKey(entry.name) === evPersonKey(data.cell?.name));
  if (!cell) throw new Error(tt(`The cell “${data.cell?.name || '?'}” is not in this exercise.`, `La cellule « ${data.cell?.name || '?'} » n’existe pas dans cet exercice.`, `Die Zelle „${data.cell?.name || '?'}“ gibt es in dieser Übung nicht.`));
  const evaluator = String(data.evaluator || '').trim() || String(fileName || '').replace(/\.(crisiseval\.)?(json|xlsx)$/i, '').slice(0, 200);
  const contribution = evNormalizeContribution({ ...data, evaluator, file: fileName, imported_at: new Date().toISOString() });
  // Criteria are matched by id, else by their text; one the sheet lacks is added to it.
  const sheet = evSheet(project, cell);
  const criteria = {};
  for (const [id, mark] of Object.entries(contribution.criteria)) {
    let target = sheet.criteria.find((criterion) => criterion.id === id) || (mark.text && sheet.criteria.find((criterion) => evPersonKey(criterion.text) === evPersonKey(mark.text)));
    if (!target && mark.text && (mark.rating || mark.notes)) {
      const editable = evEditableSheet(project, cell);
      target = evNormalizeCriterion({ id: editable.criteria.some((criterion) => criterion.id === id) ? undefined : id, category: tt('Added by an evaluator', 'Ajouté par un évaluateur', 'Von Bewertenden ergänzt'), text: mark.text });
      editable.criteria.push(target);
    }
    if (target) criteria[target.id] = mark;
  }
  contribution.criteria = criteria;
  const state = evState(project);
  const list = state.contributions[cell.id] || (state.contributions[cell.id] = []);
  const index = list.findIndex((item) => evPersonKey(item.evaluator) === evPersonKey(contribution.evaluator));
  if (index >= 0) {
    if (!window.confirm(tt(`${cell.name}: an evaluation of ${contribution.evaluator} is already imported. Replace it with this file (${fileName})?`, `${cell.name} : une évaluation de ${contribution.evaluator} est déjà importée. La remplacer par ce fichier (${fileName}) ?`, `${cell.name}: Eine Bewertung von ${contribution.evaluator} ist bereits importiert. Durch diese Datei (${fileName}) ersetzen?`))) { report.kept.push(`${contribution.evaluator} · ${cell.name}`); return; }
    list[index] = contribution;
    report.replaced.push(`${contribution.evaluator} · ${cell.name}`);
    return;
  }
  if (list.length >= 30) throw new Error(tt(`${cell.name}: 30 evaluations at most.`, `${cell.name} : 30 évaluations au plus.`, `${cell.name}: höchstens 30 Bewertungen.`));
  list.push(contribution);
  report.added.push(`${contribution.evaluator} · ${cell.name}`);
}

async function evImportFiles(project, files) {
  const report = { added: [], replaced: [], kept: [], refused: [] };
  for (const file of files) {
    try {
      let entries;
      if (/\.json$/i.test(file.name)) entries = evParseContributionJson(JSON.parse(await file.text()));
      else if (/\.xlsx$/i.test(file.name)) { await evLibraries(); entries = evParseContributionWorkbook(XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })); }
      else throw new Error(tt('Only .crisiseval.json and .xlsx files.', 'Uniquement des fichiers .crisiseval.json et .xlsx.', 'Nur Dateien .crisiseval.json und .xlsx.'));
      if (!entries.length) throw new Error(tt('No mark in this file.', 'Aucune note dans ce fichier.', 'Keine Bewertung in dieser Datei.'));
      for (const entry of entries) {
        try { evAddContribution(project, entry, file.name, report); }
        catch (error) { report.refused.push(`${file.name}: ${error.message}`); }
      }
    } catch (error) {
      report.refused.push(`${file.name}: ${error instanceof SyntaxError ? tt('not valid JSON.', 'JSON invalide.', 'kein gültiges JSON.') : error.message}`);
    }
  }
  evUI().importReport = report;
  if (report.added.length || report.replaced.length) saveLocal(false);
  const done = report.added.length + report.replaced.length;
  pushToast(done
    ? tt(`${done} evaluation(s) imported${report.refused.length ? `, ${report.refused.length} refused` : ''}.`, `${done} évaluation(s) importée(s)${report.refused.length ? `, ${report.refused.length} refusée(s)` : ''}.`, `${done} Bewertung(en) importiert${report.refused.length ? `, ${report.refused.length} abgelehnt` : ''}.`)
    : tt('No evaluation imported.', 'Aucune évaluation importée.', 'Keine Bewertung importiert.'), done ? (report.refused.length ? 'info' : 'success') : 'error');
  App.render();
  return report;
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
Write 6 to 10 criteria the evaluator of this cell will rate on the P/S/M/U scale. Each criterion is an observable capability or decision, specific to THIS scenario: name the stakes, deadlines, main events and injects the cell faces (with their time when useful), and link them to the learning objectives. Do not repeat the generic crisis management criteria, rated apart on every sheet: ${EV_GENERIC_CRITERIA.map((row) => row[1].split(' | ')[0]).join(', ')}. Write what is specific to this cell and this scenario.
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
/* The Excel files follow the Wavestone palette: an indigo title band with a green accent,
   one filterable table per sheet (scenario criteria, injects and generic criteria, told apart
   by the Section column), frozen headers, a drop-down with the meaning of each rating, and
   ratings colored as in the app. A hidden sheet and a hidden key column let the filled file
   be imported back, line by line. */
const EV_XL = { indigo: '451DC7', indigo700: '36169B', indigo950: '150939', green: '04F06A', greenTint: 'E1FDED', greenInk: '0B6B38', indigoTint: 'EEEAFF', panel: 'F5F4F9', entry: 'FBFAFE', line: 'E6E4EE', muted: '6B6580', faint: 'A8A4B8' };
const EV_XL_RATING = { P: ['DCF5E3', '146C2E'], S: ['EEF6D5', '4D6410'], M: ['FDEBD0', '8A4B08'], U: ['FBDCDC', '9B1C1C'], 'N/A': ['ECEBF0', '5B5670'] };
const EV_META_SHEET = '_crisismaker';

function evXlStyles(book) {
  if (book.evStyles) return book.evStyles;
  const st = (spec) => book.style(spec);
  const section = (fill, color) => st({ font: { b: true, sz: 9, color }, fill, border: 'thin', align: { v: 'top', wrap: true } });
  book.evStyles = {
    title: st({ font: { b: true, sz: 16, color: 'FFFFFF' }, fill: EV_XL.indigo, align: { v: 'center', indent: 1 } }),
    subtitle: st({ font: { sz: 10, color: 'FFFFFF' }, fill: EV_XL.indigo700, align: { v: 'center', indent: 1, wrap: true } }),
    accent: st({ fill: EV_XL.green }),
    label: st({ font: { b: true, sz: 9, color: EV_XL.indigo700 }, align: { v: 'center', indent: 1 } }),
    value: st({ font: { sz: 10 }, align: { v: 'center', wrap: true } }),
    input: st({ font: { b: true, sz: 11 }, fill: EV_XL.panel, border: 'bottom', borderColor: EV_XL.indigo, borderStyle: 'medium', align: { v: 'center', indent: 1 } }),
    header: st({ font: { b: true, sz: 9, color: 'FFFFFF' }, fill: EV_XL.indigo950, border: 'thin', borderColor: EV_XL.indigo950, align: { v: 'center', wrap: true } }),
    headerRating: st({ font: { b: true, sz: 9, color: EV_XL.indigo950 }, fill: EV_XL.green, border: 'thin', borderColor: EV_XL.indigo950, align: { h: 'center', v: 'center', wrap: true } }),
    crit: section(EV_XL.indigoTint, EV_XL.indigo700),
    inject: section(EV_XL.greenTint, EV_XL.greenInk),
    gen: section(EV_XL.panel, EV_XL.muted),
    number: st({ font: { b: true, sz: 10, color: EV_XL.indigo700 }, border: 'thin', align: { v: 'top' } }),
    cell: st({ font: { sz: 10 }, border: 'thin', align: { v: 'top', wrap: true } }),
    strong: st({ font: { b: true, sz: 10 }, border: 'thin', align: { v: 'top', wrap: true } }),
    muted: st({ font: { sz: 9, color: EV_XL.muted }, border: 'thin', align: { v: 'top', wrap: true } }),
    rating: st({ font: { b: true, sz: 11 }, border: 'thin', borderColor: EV_XL.indigo, align: { h: 'center', v: 'top' } }),
    ratingRead: st({ font: { b: true, sz: 10 }, border: 'thin', align: { h: 'center', v: 'top' } }),
    entry: st({ font: { sz: 10 }, fill: EV_XL.entry, border: 'thin', align: { v: 'top', wrap: true } }),
    blank: st({ fill: EV_XL.panel, border: 'thin' }),
    key: st({ font: { sz: 8, color: EV_XL.faint } }),
    blockTitle: st({ font: { b: true, sz: 11, color: EV_XL.indigo700 }, border: 'bottom', borderColor: EV_XL.green, borderStyle: 'medium', align: { v: 'bottom' } }),
    block: st({ font: { sz: 10 }, fill: EV_XL.entry, border: 'thin', align: { v: 'top', wrap: true } }),
    footer: st({ font: { i: true, sz: 8, color: EV_XL.faint } }),
    count: st({ font: { sz: 10 }, border: 'thin', align: { h: 'center', v: 'center' } }),
    codes: Object.fromEntries(Object.entries(EV_XL_RATING).map(([code, [fill, color]]) => [code, st({ font: { b: true, sz: 9, color }, fill, border: 'thin', borderColor: EV_XL.indigo950, align: { h: 'center', v: 'center' } })])),
    dxf: Object.fromEntries(Object.entries(EV_XL_RATING).map(([code, [fill, color]]) => [code, book.dxf({ color, fill })]))
  };
  return book.evStyles;
}

const evColon = () => tt(':', ' :', ':');
const evScaleText = () => evRatings().map(([code, label]) => `${code} = ${label}`).join('   ·   ');
const evTallyText = (tally) => `${EV_CODES.map((code) => `${code} ${tally.counts[code]}`).join('  ·  ')}   (${tally.rated}/${tally.total} ${tt('rated', 'notés', 'bewertet')})`;

/* The rows of one cell's sheet. consolidated: the evaluators' ratings side by side, the
   rating proposed from them and the consolidated rating of the central team. */
function evSheetSpec(project, cell, book, { consolidated = false } = {}) {
  const S = evXlStyles(book);
  const sheet = evSheet(project, cell);
  const lines = evLines(project, cell);
  const contributions = consolidated ? evContributions(project, cell.id) : [];
  const tally = evTally(project, cell);
  const colon = evColon();
  const columns = [
    { role: 'number', head: '#', width: 9 },
    { role: 'section', head: tt('Section', 'Section', 'Abschnitt'), width: 15 },
    { role: 'category', head: tt('Category', 'Catégorie', 'Kategorie'), width: 18 },
    { role: 'text', head: tt('Criterion or inject', 'Critère ou inject', 'Kriterium oder Inject'), width: 42 },
    { role: 'observe', head: tt('What to observe · reaction expected', 'Points à observer · réaction attendue', 'Beobachtungspunkte · erwartete Reaktion'), width: 40 },
    ...contributions.map((item, index) => ({ role: `by:${index}`, head: item.evaluator, width: 11, rating: true })),
    ...(consolidated ? [{ role: 'proposal', head: tt('Proposed', 'Proposée', 'Vorschlag'), width: 11, rating: true }] : []),
    { role: 'rating', head: consolidated ? tt('Consolidated rating', 'Note consolidée', 'Konsolidierte Bewertung') : tt('Rating', 'Note', 'Bewertung'), width: 13, rating: true },
    { role: 'notes', head: tt('Observations and evidence', 'Observations et éléments de preuve', 'Beobachtungen und Nachweise'), width: 44 },
    ...(consolidated ? [{ role: 'their', head: tt('Evaluators’ notes', 'Notes des évaluateurs', 'Notizen der Bewertenden'), width: 44 }] : []),
    { role: 'time', head: tt('Time of reaction', 'Heure de la réaction', 'Zeitpunkt der Reaktion'), width: 12 },
    { role: 'key', head: '', width: 8, hidden: true }
  ];
  const width = columns.length;
  const last = width - 2, keyCol = width - 1;
  const lastCol = xlsxColumn(last);
  const blankRow = () => Array(width).fill(null);
  const band = (value, style) => { const row = Array(width).fill({ v: '', s: style }); row[0] = { v: value, s: style }; row[keyCol] = null; return row; };
  const rows = [], merges = [], heights = {}, hiddenRows = [];
  const push = (row, height) => { if (height) heights[rows.length] = height; rows.push(row); return rows.length - 1; };
  const mergeRow = (index, from = 0, to = last) => merges.push(`${xlsxColumn(from)}${index + 1}:${xlsxColumn(to)}${index + 1}`);
  const labelled = (label, value, key, valueStyle = S.value) => {
    const row = blankRow();
    row[0] = { v: label, s: S.label }; row[1] = { v: '', s: S.label };
    row[2] = { v: value, s: valueStyle };
    for (let c = 3; c <= last; c++) row[c] = { v: '', s: valueStyle };
    if (key) row[keyCol] = { v: key, s: S.key };
    const index = push(row);
    mergeRow(index, 0, 1); mergeRow(index, 2, last);
    return index;
  };

  mergeRow(push(band(`${consolidated ? tt('Consolidated evaluation', 'Évaluation consolidée', 'Konsolidierte Bewertung') : tt('Evaluation sheet', 'Grille d’évaluation', 'Bewertungsbogen')} · ${cell.name}`, S.title), 34));
  const date = project.scenario?.start_date ? String(project.scenario.start_date).slice(0, 10) : '';
  mergeRow(push(band([`${tt('Exercise', 'Exercice', 'Übung')}${colon} ${project.name || ''}`, project.client?.name ? `${tt('Organisation', 'Organisation', 'Organisation')}${colon} ${project.client.name}` : '', date ? `${tt('Date', 'Date', 'Datum')}${colon} ${date}` : ''].filter(Boolean).join('   ·   '), S.subtitle), 22));
  mergeRow(push(band('', S.accent), 4));
  push(blankRow(), 6);
  const evaluatorRow = consolidated
    ? labelled(tt('Evaluators', 'Évaluateurs', 'Bewertende'), contributions.map((item) => item.evaluator).join(', ') || sheet.evaluator || '', '__evaluators', S.value)
    : labelled(tt('Evaluator', 'Évaluateur', 'Bewertende Person'), sheet.evaluator || '', '__evaluator', S.input);
  heights[evaluatorRow] = 22;
  labelled(tt('Marks', 'Notes', 'Bewertungen'), evTallyText(tally));
  labelled(tt('Rating scale', 'Échelle de notation', 'Bewertungsskala'), evScaleText());
  push(blankRow(), 6);
  const roles = columns.map((column) => column.role);
  roles[keyCol] = '__roles';
  hiddenRows.push(push(roles.map((value) => ({ v: value, s: S.key }))));
  const headerRow = push(columns.map((column, index) => (index === keyCol ? { v: 'key', s: S.key } : { v: column.head, s: column.rating ? S.headerRating : S.header })), 30);

  const sectionLabel = { crit: tt('Scenario criteria', 'Critères du scénario', 'Szenariokriterien'), inject: tt('Injects received', 'Injects reçus', 'Erhaltene Injects'), gen: tt('Generic criteria', 'Critères génériques', 'Allgemeine Kriterien') };
  const first = rows.length;
  lines.forEach((line) => {
    const their = line.marks.filter((mark) => mark.notes.trim()).map((mark) => `${mark.evaluator}: ${mark.notes.trim()}`).join('\n');
    const value = {
      number: { v: line.number, s: S.number }, section: { v: sectionLabel[line.scope], s: S[line.scope] },
      category: { v: line.category, s: S.muted }, text: { v: line.text, s: S.strong }, observe: { v: line.observe, s: S.muted },
      proposal: { v: line.proposal, s: S.ratingRead }, rating: { v: line.rating, s: S.rating },
      notes: { v: line.notes, s: S.entry }, their: { v: their, s: S.muted },
      time: line.scope === 'inject' ? { v: line.time, s: S.entry } : { v: '', s: S.blank },
      key: { v: `${line.scope}:${line.id}`, s: S.key }
    };
    push(columns.map((column) => {
      if (column.role.startsWith('by:')) return { v: line.marks[Number(column.role.slice(3))]?.rating || '', s: S.ratingRead };
      return value[column.role];
    }));
  });
  const end = Math.max(first, rows.length - 1);
  const range = (role) => { const c = xlsxColumn(roles.indexOf(role)); return `${c}${first + 1}:${c}${end + 1}`; };
  const ratingRanges = columns.filter((column) => column.rating).map((column) => range(column.role)).join(' ');

  push(blankRow(), 10);
  const block = (title, text, key) => {
    mergeRow(push(band(title, S.blockTitle), 20));
    const row = band(text || '', S.block);
    row[keyCol] = { v: key, s: S.key };
    const index = push(row, Math.max(48, Math.min(300, String(text || '').split('\n').length * 14 + 20)));
    mergeRow(index);
  };
  block(tt('Strengths', 'Points forts', 'Stärken'), sheet.strengths, '__strengths');
  block(tt('Areas for improvement', 'Axes d’amélioration', 'Verbesserungsbereiche'), sheet.improvements, '__improvements');
  if (consolidated) contributions.forEach((item) => {
    if (item.strengths.trim() || item.improvements.trim()) block(`${item.evaluator}`, [item.strengths.trim() && `${tt('Strengths', 'Points forts', 'Stärken')}${colon} ${item.strengths.trim()}`, item.improvements.trim() && `${tt('Areas for improvement', 'Axes d’amélioration', 'Verbesserungsbereiche')}${colon} ${item.improvements.trim()}`].filter(Boolean).join('\n'), '');
  });
  push(blankRow(), 10);
  mergeRow(push(band(tt('About this cell', 'À propos de cette cellule', 'Über diese Zelle'), S.blockTitle), 20));
  labelled(tt('Mission', 'Mission', 'Auftrag'), cell.description || '');
  if (project.scenario?.learning_objectives) labelled(tt('Learning objectives', 'Objectifs pédagogiques', 'Lernziele'), project.scenario.learning_objectives);
  labelled(tt('Generic criteria', 'Critères génériques', 'Allgemeine Kriterien'), tt('For every crisis exercise, after the ANSSI guide “Organising a cyber crisis management exercise” and the HSEEP Exercise Evaluation Guides.', 'Pour tout exercice de crise, d’après le guide ANSSI « Organiser un exercice de gestion de crise cyber » et les Exercise Evaluation Guides HSEEP.', 'Für jede Krisenübung, nach dem ANSSI-Leitfaden „Organising a cyber crisis management exercise“ und den HSEEP Exercise Evaluation Guides.'));
  push(blankRow(), 8);
  mergeRow(push(band(`CrisisMaker · Wavestone · ${new Date().toISOString().slice(0, 10)}`, S.footer)));

  const prompt = evRatings().map(([code, label]) => `${code} = ${label}`).join('\n');
  return {
    name: cell.name || tt('Cell', 'Cellule', 'Zelle'),
    tab: String(cell.color || '').replace('#', '').length === 6 ? String(cell.color).replace('#', '') : EV_XL.indigo,
    rows, merges, heights, hiddenRows,
    cols: columns.map((column) => ({ width: column.width, hidden: column.hidden })),
    freeze: { rows: headerRow + 1, cols: 0 },
    filter: `A${headerRow + 1}:${lastCol}${end + 1}`,
    validations: lines.length ? [{ sqref: range('rating'), list: EV_CODES, title: tt('Rating', 'Note', 'Bewertung'), prompt, error: `${tt('Choose one of', 'Choisissez parmi', 'Wählen Sie aus')} ${EV_CODES.join(', ')}.\n${prompt}` }] : [],
    highlights: lines.length ? EV_CODES.map((code) => ({ sqref: ratingRanges, equal: code, dxf: S.dxf[code] })) : []
  };
}

/* The plain values of a cell's sheet, row by row (tests, previews). */
function evSheetRows(project, cell, options = {}) {
  return evSheetSpec(project, cell, new XlsxBook(), options).rows.map((row) => row.map((value) => (value && typeof value === 'object' ? value.v : value ?? '')));
}

/* The overview of every cell's marks, first sheet of the all-cells workbook. */
function evOverviewSpec(project, cells, book) {
  const S = evXlStyles(book);
  const head = [tt('Cell', 'Cellule', 'Zelle'), tt('Evaluator(s)', 'Évaluateur(s)', 'Bewertende'), tt('Evaluations received', 'Évaluations reçues', 'Erhaltene Bewertungen'), ...EV_CODES, tt('Rated', 'Notés', 'Bewertet'), tt('Total', 'Total', 'Gesamt'), '%'];
  const width = head.length;
  const band = (value, style) => { const row = Array(width).fill({ v: '', s: style }); row[0] = { v: value, s: style }; return row; };
  const rows = [
    band(`${tt('Evaluation overview', 'Synthèse de l’évaluation', 'Bewertungsübersicht')} · ${project.name || ''}`, S.title),
    band(evScaleText(), S.subtitle),
    band('', S.accent),
    Array(width).fill(null),
    head.map((value, index) => ({ v: value, s: index >= 3 && index < 3 + EV_CODES.length ? S.codes[EV_CODES[index - 3]] : S.header })),
    ...cells.map((cell) => {
      const tally = evTally(project, cell);
      const contributions = evContributions(project, cell.id);
      return [
        { v: cell.name, s: S.strong }, { v: contributions.map((item) => item.evaluator).join(', ') || evSheet(project, cell).evaluator || '', s: S.cell }, { v: contributions.length, s: S.count },
        ...EV_CODES.map((code) => ({ v: tally.counts[code], s: S.count })), { v: tally.rated, s: S.count }, { v: tally.total, s: S.count },
        { v: tally.total ? Math.round(tally.rated / tally.total * 100) : 0, s: S.count }
      ];
    })
  ];
  const lastCol = xlsxColumn(width - 1);
  return {
    name: tt('Overview', 'Synthèse', 'Übersicht'), tab: EV_XL.green, rows,
    merges: [`A1:${lastCol}1`, `A2:${lastCol}2`, `A3:${lastCol}3`],
    heights: { 0: 34, 1: 22, 2: 4, 4: 30 },
    cols: [{ width: 32 }, { width: 30 }, { width: 13 }, ...EV_CODES.map(() => ({ width: 8 })), { width: 9 }, { width: 9 }, { width: 8 }],
    freeze: { rows: 5, cols: 1 },
    filter: `A5:${lastCol}${Math.max(5, rows.length)}`
  };
}

/* One workbook: an overview (several cells), one sheet per cell, and the hidden sheet that
   lets it be imported back. consolidated: the cells with evaluations received show them. */
function evBuildWorkbook(project, cells, { overview = false, consolidated = false } = {}) {
  const book = new XlsxBook();
  if (overview) book.sheet(evOverviewSpec(project, cells, book));
  const placed = cells.map((cell) => {
    const mode = consolidated && evContributions(project, cell.id).length ? 'consolidated' : 'evaluator';
    return { cell, mode, sheet: book.sheet(evSheetSpec(project, cell, book, { consolidated: mode === 'consolidated' })) };
  });
  const S = evXlStyles(book);
  const meta = [['format', EV_FORMAT], ['version', 1], ['project_id', project.id || ''], ['project_name', project.name || ''], ['exported_at', new Date().toISOString()],
    ...placed.map(({ cell, mode, sheet }) => ['sheet', sheet.name, cell.id, cell.name, mode])];
  book.sheet({ name: EV_META_SHEET, hidden: true, rows: meta.map((row) => row.map((value) => ({ v: value, s: S.key }))), cols: [{ width: 14 }, { width: 30 }, { width: 24 }, { width: 30 }, { width: 14 }] });
  return book;
}

/* A rating typed in Excel: "P", "p", "S · Performed…", "n/a". */
function evRatingFromCell(value) {
  const text = String(value || '').trim().toUpperCase();
  if (/^N\s*\/?\s*A\b/.test(text)) return 'N/A';
  return evRating(text.split(/[\s·.,:;-]/)[0]);
}

/* The evaluations in a filled workbook: one per evaluator sheet with at least one mark. */
function evParseContributionWorkbook(workbook) {
  const metaSheet = workbook.Sheets?.[EV_META_SHEET];
  if (!metaSheet) throw new Error(tt('This workbook was not made by CrisisMaker: fill the Excel sheet downloaded from the Evaluation tab.', 'Ce classeur n’a pas été produit par CrisisMaker : remplissez la grille Excel téléchargée depuis l’onglet Évaluation.', 'Diese Arbeitsmappe stammt nicht aus CrisisMaker: Füllen Sie den im Tab Bewertung heruntergeladenen Excel-Bogen aus.'));
  const meta = XLSX.utils.sheet_to_json(metaSheet, { header: 1, defval: '', raw: false });
  const get = (key) => String((meta.find((row) => row[0] === key) || [])[1] || '');
  if (get('format') !== EV_FORMAT) throw new Error(tt('Not a CrisisMaker evaluation.', 'Ce n’est pas une évaluation CrisisMaker.', 'Keine CrisisMaker-Bewertung.'));
  const project = { id: get('project_id'), name: get('project_name') };
  const found = [];
  meta.filter((row) => row[0] === 'sheet').forEach(([, sheetName, cellId, cellName, mode]) => {
    // A consolidated sheet is the central team's own work, not an evaluator's.
    if (mode !== 'evaluator' || !workbook.Sheets[sheetName]) return;
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
    let roles = null, keyCol = -1;
    rows.some((row) => { keyCol = row.indexOf('__roles'); if (keyCol >= 0) roles = row; return keyCol >= 0; });
    if (!roles) return;
    const cellOf = (row, role) => String(roles.indexOf(role) >= 0 ? row[roles.indexOf(role)] ?? '' : '').trim();
    const keyed = (key) => rows.find((row) => row[keyCol] === key) || [];
    const entry = {
      format: EV_FORMAT, source: 'xlsx', project, cell: { id: cellId, name: cellName },
      evaluator: String(keyed('__evaluator')[2] || '').trim(),
      strengths: String(keyed('__strengths')[0] || '').trim(), improvements: String(keyed('__improvements')[0] || '').trim(),
      criteria: {}, generic: {}, injects: {}
    };
    let marks = 0;
    rows.forEach((row) => {
      const match = String(row[keyCol] || '').match(/^(crit|gen|inject):(.+)$/);
      if (!match) return;
      const [, scope, id] = match;
      const rating = evRatingFromCell(cellOf(row, 'rating'));
      const notes = cellOf(row, 'notes');
      if (!rating && !notes && !(scope === 'inject' && cellOf(row, 'time'))) return;
      marks++;
      if (scope === 'crit') entry.criteria[id] = { rating, notes, text: cellOf(row, 'text') };
      else if (scope === 'gen') entry.generic[id] = { rating, notes };
      else entry.injects[id] = { rating, observed: notes, time: cellOf(row, 'time') };
    });
    if (marks || entry.strengths || entry.improvements) found.push(entry);
  });
  return found;
}

function evFileName(text) {
  return String(text || 'sheet').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'sheet';
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
    await evLibraries(true);
    const consolidated = evContributions(project, cell.id).length > 0;
    const data = await evBuildWorkbook(project, [cell], { consolidated }).toArrayBuffer();
    evSave(new Blob([data], { type: EV_XLSX_TYPE }), `evaluation-${consolidated ? 'consolidated-' : ''}${evFileName(cell.name)}.xlsx`);
    pushToast(consolidated
      ? tt(`Consolidated evaluation of the ${cell.name} downloaded.`, `Évaluation consolidée de la cellule ${cell.name} téléchargée.`, `Konsolidierte Bewertung der Zelle ${cell.name} heruntergeladen.`)
      : tt(`Evaluation sheet of the ${cell.name} downloaded.`, `Grille d’évaluation de la cellule ${cell.name} téléchargée.`, `Bewertungsbogen der Zelle ${cell.name} heruntergeladen.`), 'success');
  } catch (error) {
    if (typeof CrisisError !== 'undefined') CrisisError.toast(error, { operation: tt('Download an evaluation sheet', 'Télécharger une grille d’évaluation', 'Bewertungsbogen herunterladen') });
    else pushToast(error.message || String(error), 'error');
  }
}

/* One ZIP: a workbook per cell for its evaluators, plus one workbook with every sheet (the
   consolidated marks of the cells with evaluations received). */
async function evDownloadAll(project) {
  const cells = project.cells || [];
  if (!cells.length) return;
  appState.ui.actionLoading = { ...(appState.ui.actionLoading || {}), 'ev-download-all': true };
  App.render();
  try {
    await evLibraries(true);
    const zip = new JSZip();
    for (const [index, cell] of cells.entries()) {
      zip.file(`${String(index + 1).padStart(2, '0')}-evaluation-${evFileName(cell.name)}.xlsx`, await evBuildWorkbook(project, [cell]).toArrayBuffer());
    }
    const consolidated = cells.some((cell) => evContributions(project, cell.id).length);
    zip.file(consolidated ? '00-evaluation-consolidated.xlsx' : '00-evaluation-all-cells.xlsx', await evBuildWorkbook(project, cells, { overview: true, consolidated }).toArrayBuffer());
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

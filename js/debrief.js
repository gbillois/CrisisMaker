      const DEBRIEF_PHASE_PRESETS = [
        { id: 'prelude', label: 'Before the crisis · Silent compromise', range: 'Weeks before H0', start: 0, end: 0.34, color: '#d4a03c' },
        { id: 'detonation', label: 'The crisis · Detonation and escalation', range: 'H0 · Crisis day', start: 0.34, end: 0.76, color: '#dc3c28' },
        { id: 'fallout', label: 'After the crisis · Recovery and lessons', range: 'Days and weeks after', start: 0.76, end: 1, color: '#b4afa5' }
      ];
      const DEBRIEF_KIND_LABELS = { context:'Context',intrusion:'Intrusion',exfiltration:'Exfiltration',attack:'Attack',impact:'Impact',threat:'Threat',regulatory:'Regulatory',media:'Media',decision:'Decision',recovery:'Recovery',leak:'Leak',lessons:'Lessons',milestone:'Milestone' };

      function makeEmptyDebrief(scenario = {}) {
        const clientName = scenario.client?.name || 'Organisation';
        const crisisType = scenario.scenario?.type || 'Crisis';
        return {
          schema_version: 2,
          meta: {
            title: `${clientName} - ${crisisType}`,
            subtitle: '— crisis reconstruction',
            badge: 'CRISIS EXERCISE · SCENARIO REVEAL',
            lang: scenario.settings?.language || scenario.client?.language || 'en'
          },
          theme: {
            preset: 'cyber-dark', bg: '#0d0b08', fg: '#e6dcc8', ink: '#f6f1e4', accent: '#dc3c28', panel: '#0a0907',
            line: '#2a2620', muted: '#9a9283', fontTitle: 'Fraunces', fontBody: 'Inter', fontMono: 'JetBrains Mono', scale: 1
          },
          layout: { showMap: true, showEventList: true, showSeverity: true, showArtifacts: true, showPlayback: true, mapSide: 'right' },
          map: { mode: 'globe', label: 'Crisis footprint' },
          kindLabels: deepClone(DEBRIEF_KIND_LABELS),
          phases: deepClone(DEBRIEF_PHASE_PRESETS),
          events: [],
          generated_at: null,
          generation_method: 'manual_story_reconstruction'
        };
      }

      function normalizeDebrief(input, scenario) {
        const base = makeEmptyDebrief(scenario);
        const isLegacyStimulusDebrief = input && (input.schema_version !== 2 || (input.events || []).some((event) => event.stimulus_id));
        if (!input || typeof input !== 'object' || isLegacyStimulusDebrief) return buildDebriefFromScenario(scenario);
        const normalized = {
          ...base, ...input, schema_version: 2,
          meta: { ...base.meta, ...(input.meta || {}) },
          theme: { ...base.theme, ...(input.theme || {}) },
          layout: { ...base.layout, ...(input.layout || {}) },
          map: { ...base.map, ...(input.map || {}) },
          kindLabels: { ...base.kindLabels, ...(input.kindLabels || {}) },
          phases: Array.isArray(input.phases) && input.phases.length ? input.phases.map((phase, index) => ({ ...deepClone(DEBRIEF_PHASE_PRESETS[index] || DEBRIEF_PHASE_PRESETS[2]), ...phase, id: phase.id || `phase_${index + 1}` })) : base.phases,
          events: Array.isArray(input.events) ? input.events.map(normalizeDebriefEvent) : []
        };
        return normalized;
      }

      function normalizeDebriefEvent(event) {
        const coords = Array.isArray(event.coords) && event.coords.length === 2 ? event.coords.map(Number) : null;
        return {
          id: event.id || uid('story'), phase: event.phase || 'detonation', order: Number.isFinite(Number(event.order)) ? Number(event.order) : 0,
          dateLabel: event.dateLabel || '', title: event.title || 'Story milestone', headline: event.headline || '', body: event.body || '',
          severity: Math.max(1, Math.min(5, Number(event.severity || 3))), kind: event.kind || 'milestone', location: event.location || '',
          coords: coords && coords.every(Number.isFinite) ? coords : null, artifacts: Array.isArray(event.artifacts) ? event.artifacts : [],
          casualties: event.casualties || '', damageUSD: event.damageUSD || '', t: Number.isFinite(Number(event.t)) ? Number(event.t) : 0
        };
      }

      function buildDebriefFromScenario(scenario) {
        if (String(scenario.client?.name || '').toLowerCase() === 'stonawave') return buildStonaWaveDebrief(scenario);
        const debrief = makeEmptyDebrief(scenario);
        const org = scenario.client?.name || 'The organisation';
        const type = scenario.scenario?.type || 'crisis';
        const summary = cleanDebriefText(scenario.scenario?.summary || 'A crisis unfolds and forces the organisation to protect its critical activities.');
        const context = cleanDebriefText(scenario.scenario?.detailed_context || summary);
        debrief.events = [
          { phase:'prelude', dateLabel:'Before the exercise', title:'The conditions for the crisis are already in place', location:org, severity:2, kind:'context', headline:`The ${type.toLowerCase()} scenario begins before the first visible alert.`, body:context, artifacts:['Scenario assumptions'] },
          { phase:'prelude', dateLabel:'J-1', title:'The threat prepares the decisive action', location:'Digital environment', severity:3, kind:'intrusion', headline:'The attacker or initiating event reaches the point where disruption becomes possible.', body:summary, artifacts:['Attack path or initiating cause'] },
          { phase:'detonation', dateLabel:'H0', title:'The crisis becomes visible', location:org, severity:4, kind:'attack', headline:'The first operational symptoms reveal that this is no longer a routine incident.', body:summary, artifacts:['Initial alert','First confirmed impacts'] },
          { phase:'detonation', dateLabel:'Crisis day', title:'Operational and stakeholder impacts spread', location:org, severity:5, kind:'impact', headline:'The situation expands beyond the initial technical or operational perimeter.', body:`The crisis affects critical activities and creates uncertainty for employees, partners, authorities, customers, and leadership. ${summary}`, artifacts:['Business continuity measures','Stakeholder notifications'] },
          { phase:'detonation', dateLabel:'Crisis day', title:'Leadership faces the central crisis decisions', location:org, severity:4, kind:'decision', headline:'Containment, continuity, communication, and legal obligations compete for priority.', body:'The crisis team must establish a shared picture, assign decision rights, protect critical operations, and communicate despite incomplete information.', artifacts:['Crisis governance','Decision log','Communication strategy'] },
          { phase:'fallout', dateLabel:'Following days', title:'Stabilization begins, but the full scope emerges', location:org, severity:3, kind:'recovery', headline:'Recovery reveals hidden dependencies and the lasting consequences of the event.', body:'Teams rebuild trusted operations, validate data and systems, manage regulatory duties, and support affected stakeholders. The real cost becomes clearer over time.', artifacts:['Recovery plan','Forensic findings','Regulatory follow-up'] },
          { phase:'fallout', dateLabel:'After the crisis', title:'The organization turns the crisis into resilience lessons', location:org, severity:2, kind:'lessons', headline:'The reconstruction connects root causes, decisions, impacts, and improvements.', body:'The debrief identifies what enabled the crisis, what limited the damage, which decisions mattered most, and what must change before the next event.', artifacts:['Lessons learned','Remediation roadmap'] }
        ].map((event,index)=>normalizeDebriefEvent({...event,order:index}));
        debrief.generated_at = new Date().toISOString(); debrief.generation_method = 'deterministic_story_skeleton';
        return refreshDebriefPositions(debrief);
      }

      function buildStonaWaveDebrief(scenario) {
        const d = makeEmptyDebrief(scenario);
        d.meta = { ...d.meta, title:'Operation Bitter Pill', subtitle:'— the StonaWave ransomware crisis reconstructed', badge:'SCENARIO REVEAL · STONAWAVE · 15 MAR 2026' };
        d.map = { mode:'globe', label:'StonaWave global crisis footprint' };
        const e = (phase,dateLabel,title,location,coords,severity,kind,headline,body,artifacts=[],casualties='',damageUSD='') => normalizeDebriefEvent({phase,dateLabel,title,location,coords,severity,kind,headline,body,artifacts,casualties,damageUSD});
        d.events = [
          e('prelude','J-21','A stolen VPN credential opens the first door','Initial access broker · online',[52.37,4.90],2,'intrusion','PharmLeaks buys valid remote-access credentials belonging to a StonaWave contractor.','Three weeks before the exercise, a contractor account without phishing-resistant MFA is sold by an initial access broker. The login looks legitimate and gives PharmLeaks a quiet foothold into StonaWave’s European environment. At this point, no ransomware has been deployed and no alarm is raised.',['Compromised contractor account','Valid VPN session token']),
          e('prelude','J-18 → J-10','PharmLeaks maps the global StonaWave network','Paris region, France',[48.86,2.35],3,'intrusion','The attackers discover that corporate identity, manufacturing, clinical research, and backups share critical trust relationships.','Using the compromised account, PharmLeaks enumerates Active Directory, escalates privileges, and moves laterally. The group identifies domain administrators, backup consoles, the clinical trial management system, ERP services, and manufacturing execution systems in New Jersey, Frankfurt, and Hyderabad. The future blast radius is designed during this reconnaissance phase.',['Active Directory map','Privileged accounts','Network and backup inventory']),
          e('prelude','J-9 → J-3','2.4 TB of clinical and patient data is exfiltrated','StonaWave research cloud · Europe',[50.11,8.68],4,'exfiltration','The attack quietly becomes a data-breach crisis before it becomes a ransomware crisis.','PharmLeaks stages and exfiltrates clinical trial results, patient records, regulatory submissions, and internal legal documents. The transfer is throttled and disguised as normal cloud traffic. This creates the leverage for double extortion and guarantees regulatory exposure even if StonaWave restores every encrypted system.',['2.4 TB staged archive','Clinical trial records','Patient data'], 'Patients and trial participants potentially exposed'),
          e('prelude','J-2','Recovery paths are sabotaged','Backup infrastructure · Paris region',[48.86,2.35],4,'attack','Before detonating ransomware, the attackers target the systems StonaWave will need to recover.','PharmLeaks deletes online backup catalogs, compromises backup administration accounts, and disables several replication jobs. Immutable copies exist, but their age and integrity are unknown. The attackers then pre-position encryption payloads through software deployment tools.',['Deleted backup catalogs','Disabled replication jobs','Pre-positioned payloads']),
          e('detonation','H0 · 07:45 ET','Coordinated encryption begins on a Sunday morning','New Jersey, United States',[40.68,-74.29],5,'attack','A deliberately timed detonation strikes when staffing is lowest and decision-makers are dispersed.','Encryption is triggered simultaneously across core Windows servers. Active Directory authentication becomes unstable, ERP transactions stop, CTMS is unreachable, and MES services fail at manufacturing sites. Within minutes, a technical incident becomes a global operational crisis.',['Ransomware payload','Compromised deployment tooling','Ransom note'], 'MES, CTMS, ERP and identity services disrupted'),
          e('detonation','H+00:15','Three manufacturing sites enter degraded operations','New Jersey · Frankfurt · Hyderabad',[50.11,8.68],5,'impact','Production of critical oncology medicines is halted or moved to manual contingency procedures.','New Jersey and Frankfurt stop multiple production lines because electronic batch records and quality-release workflows are unavailable. Hyderabad isolates its network early and preserves part of its production capability, but loses access to central planning. Patient safety has not yet been affected, but supply continuity is now at risk.',['Manual batch records','Plant isolation procedures','Quality-release backlog'], 'Three global manufacturing sites affected', '$18M estimated daily production exposure'),
          e('detonation','H+01:00','The supply chain starts to fracture','MediChem · New Jersey',[40.74,-74.17],4,'impact','Partners lose EDI and API connectivity, turning an internal outage into an ecosystem crisis.','Contract manufacturer MediChem cannot confirm twelve active supply orders or access quality documents for three oncology batches. Distributors begin asking whether deliveries will be delayed. The crisis now involves external dependencies StonaWave cannot directly control.',['12 blocked supply orders','3 oncology batches awaiting release','Manual partner coordination'], 'Critical drug deliveries at risk'),
          e('detonation','H+01:30','$25 million ransom demand reveals double extortion','PharmLeaks leak infrastructure · online',[55.75,37.62],5,'threat','PharmLeaks confirms the data theft and gives StonaWave 72 hours before publication.','The ransom note demands $25 million in Bitcoin. It includes samples of patient and clinical-trial data as proof. Leadership must now decide how to handle negotiation, law-enforcement engagement, disclosure duties, and the risk that stolen data will be released regardless of payment.',['$25M ransom demand','Patient-data samples','72-hour deadline'], '2.4 TB of sensitive data threatened', '$25M ransom demand'),
          e('detonation','H+02:40','Authorities connect the intrusion to an exploited VPN weakness','Paris · Washington · Brussels',[48.86,2.35],4,'regulatory','CERT-FR identifies the likely entry route while health regulators focus on drug continuity.','CERT-FR links the incident to exploitation of CVE-2026-21337 and shares indicators of compromise. ANSSI supports containment, while the EMA and FDA request urgent assurances about medicine availability and product integrity. The crisis team must communicate facts before the forensic picture is complete.',['CERT-FR advisory','CVE-2026-21337','EMA and FDA information requests']),
          e('detonation','H+03:30','The crisis becomes global news','Paris · New York · Frankfurt',[40.71,-74.01],4,'media','International coverage transforms an operational incident into a reputational and market event.','Journalists confirm manufacturing disruption across three continents and report the ransom demand. Social media amplifies claims about patient data and medicine shortages. StonaWave’s first public statement must balance transparency, uncertainty, regulatory constraints, and the need to avoid creating panic.',['International media coverage','Social-media speculation','First public statement']),
          e('detonation','H+05:30','A clean recovery path is found, but restoration will take days','Hyderabad, India',[17.39,78.49],3,'recovery','An isolated immutable backup and the partially preserved Hyderabad environment become the foundation for recovery.','Forensic teams confirm that a protected backup set predates the attackers’ sabotage and appears clean. Hyderabad’s early isolation provides trusted identity and configuration data. StonaWave decides not to pay the ransom and begins a staged rebuild, prioritizing identity, quality systems, and critical oncology production.',['Immutable backup set','Preserved Hyderabad services','Prioritized recovery sequence']),
          e('fallout','Day +2','PharmLeaks publishes a first data sample','Online leak site',[55.75,37.62],4,'leak','The refusal to pay triggers a controlled leak designed to sustain pressure and media attention.','PharmLeaks publishes a small sample of patient and clinical-trial data. StonaWave begins direct notifications, expands credit-monitoring support, and coordinates with data-protection authorities. The publication confirms that recovery of systems does not end the crisis.',['Leak-site publication','Patient notification process','Regulatory breach filings'], 'Thousands of individuals require notification'),
          e('fallout','Day +5','Critical production resumes in stages','New Jersey · Frankfurt · Hyderabad',[40.68,-74.29],3,'recovery','The first oncology lines restart after validation, while other systems remain on manual processes.','Identity services, MES, and quality-release workflows are rebuilt in clean environments. Critical batches are released first and partner connectivity is restored cautiously. Full ERP and clinical-platform recovery will take several more weeks.',['Validated clean-room rebuild','First released oncology batches','Restored partner connectivity'], 'Critical medicine supply stabilized', '$85M initial response and downtime estimate'),
          e('fallout','Week +6','The real root cause is governance, not one stolen password','Paris region, France',[48.86,2.35],2,'lessons','The post-crisis review connects identity weakness, excessive trust, fragile recovery, and delayed detection.','The investigation concludes that the stolen credential was only the entry point. The scale of the crisis came from weak partner access controls, shared identity trust across IT and manufacturing, insufficient monitoring of backup administration, and recovery plans that had not been tested against a simultaneous global outage.',['Board after-action review','Zero-trust partner-access program','Immutable backup and recovery testing roadmap'], 'Long-term remediation across the global group', '$140M total estimated impact')
        ];
        d.events.forEach((event,index)=>event.order=index);
        d.generated_at = new Date().toISOString(); d.generation_method = 'authored_story_reconstruction';
        return refreshDebriefPositions(d);
      }

      function cleanDebriefText(value) { return String(value || '').replace(/<br\s*\/?>/gi,' ').replace(/<\/p>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim(); }
      function debriefStimulusText(stimulus) { const fields=stimulus?.fields || {}; return cleanDebriefText(fields.body || fields.text || fields.subheadline || fields.description || fields.headline || fields.subject || stimulus?.generation_prompt || ''); }
      function formatDebriefOffset(offsetMinutes) { const minutes=Math.max(0,Number(offsetMinutes||0)),hours=Math.floor(minutes/60),remainder=minutes%60; return `H+${String(hours).padStart(2,'0')}:${String(remainder).padStart(2,'0')}`; }
      function refreshDebriefPositions(debrief) { const events=[...(debrief.events||[])].sort((a,b)=>Number(a.order||0)-Number(b.order||0)); events.forEach((event,index)=>{event.order=index;event.t=events.length===1?0:index/(events.length-1);}); debrief.events=events; return debrief; }

      function debriefToTimelineConfig(debrief) {
        const clean=deepClone(debrief);
        clean.events=(clean.events||[]).slice().sort((a,b)=>Number(a.t||0)-Number(b.t||0));
        return { meta:clean.meta,theme:clean.theme,layout:clean.layout,map:clean.map,phases:clean.phases,kindLabels:{ ...DEBRIEF_KIND_LABELS, ...(clean.kindLabels || {}) },events:clean.events.map(({id,phase,dateLabel,t,title,location,coords,severity,kind,headline,body,artifacts,casualties,damageUSD})=>({id,phase,dateLabel,t,title,location,coords,severity,kind,headline,body,artifacts,casualties,damageUSD})) };
      }

      function buildDebriefHTML(debrief) {
        const config = debriefToTimelineConfig(debrief);
        const theme = config.theme || {};
        const title = config.meta?.title || 'Crisis debrief';
        const json = JSON.stringify(config).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');
        const renderer = CRISIS_DEBRIEF_RENDERER_SOURCE.replace(/<\/script/gi, '<\\/script');
        return `<!DOCTYPE html>
<html lang="${escapeAttribute(config.meta?.lang || 'en')}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    html, body, #root { height: 100%; margin: 0; padding: 0; background: ${theme.bg || '#f5f4f9'}; }
    body { font-family: "${String(theme.fontBody || 'Inter').replace(/"/g, '')}", sans-serif; color: ${theme.fg || '#39334d'}; overflow: hidden; -webkit-font-smoothing: antialiased; }
    body::before { content:''; position:fixed; inset:0; pointer-events:none; background-image: radial-gradient(circle at 20% 30%, rgba(220,60,40,0.035) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(212,160,60,0.025) 0%, transparent 50%); z-index:0; }
    #root { position: relative; z-index: 1; width: 100%; height: 100%; }
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.4;transform:scale(0.85);} }
    button { font-family: inherit; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>window.TIMELINE_CONFIG = ${json};<\/script>
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js"><\/script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"><\/script>
  <script type="text/babel" data-presets="react">${renderer}<\/script>
</body>
</html>`;
      }

      function exportDebriefHTML() {
        const debrief = normalizeDebrief(appState.scenario.debrief, appState.scenario);
        appState.scenario.debrief = debrief;
        downloadBlob(new Blob([buildDebriefHTML(debrief)], { type: 'text/html' }), `${slugify(debrief.meta.title || 'crisis-debrief')}.debrief.html`);
        pushToast(tt('Debrief HTML exported.', 'HTML de debrief exporté.', 'Debrief-HTML exportiert.'), 'success');
      }

      function exportDebriefConfig() {
        const config = debriefToTimelineConfig(appState.scenario.debrief);
        downloadBlob(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }), `${slugify(config.meta?.title || 'crisis-debrief')}.debrief.json`);
        pushToast(tt('Debrief configuration exported.', 'Configuration du debrief exportée.', 'Debrief-Konfiguration exportiert.'), 'success');
      }

      function applyLLMDebrief(result, scenario) {
        const current = makeEmptyDebrief(scenario);
        if (result.meta && typeof result.meta === 'object') current.meta = { ...current.meta, ...result.meta };
        if (result.theme && typeof result.theme === 'object') current.theme = { ...current.theme, ...result.theme };
        if (result.map && typeof result.map === 'object') current.map = { ...current.map, ...result.map };
        if (Array.isArray(result.phases) && result.phases.length) current.phases = result.phases.map((phase,index)=>({ ...deepClone(DEBRIEF_PHASE_PRESETS[index] || DEBRIEF_PHASE_PRESETS[2]), ...phase, id:phase.id || `phase_${index+1}` }));
        const proposedEvents = Array.isArray(result) ? result : (result.events || []);
        const validPhaseIds = new Set(current.phases.map((phase)=>phase.id));
        current.events = proposedEvents.map((event,index)=>normalizeDebriefEvent({ ...event, id:event.id || uid('story'), order:index, phase:validPhaseIds.has(event.phase)?event.phase:(index < proposedEvents.length*.34?'prelude':index < proposedEvents.length*.76?'detonation':'fallout') }));
        current.generated_at = new Date().toISOString(); current.generation_method = 'llm_story_reconstruction';
        scenario.debrief = refreshDebriefPositions(current); return scenario.debrief;
      }

      function buildDebriefEditorHTML(debrief) {
        const configJson = JSON.stringify(debriefToTimelineConfig(debrief)).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');
        const language = currentLanguage();
        const integratedLabel = tt('Integrated project workspace', 'Espace intégré au projet', 'Integrierter Projektbereich');
        const integratedStyles = '<style>.group:has(#btn-load){display:none}</style>';
        return CRISIS_DEBRIEF_EDITOR_SOURCE
          .replace('<html lang="fr">', `<html lang="${language}">`)
          .replace('Standalone workspace', integratedLabel)
          .replace('</head>', `${integratedStyles}<script>window.CRISISMAKER_INITIAL_CONFIG = ${configJson};<\/script></head>`);
      }

      function mountDebriefEditor() {
        const frame = document.getElementById('debrief-editor-frame');
        if (!frame || !appState?.scenario?.debrief) return;
        frame.srcdoc = buildDebriefEditorHTML(appState.scenario.debrief);
      }

      function applyDebriefEditorConfig(config, scenario) {
        if (!config || typeof config !== 'object') return;
        const current = normalizeDebrief(scenario.debrief, scenario);
        scenario.debrief = {
          ...current,
          ...deepClone(config),
          schema_version: 2,
          meta: { ...current.meta, ...(config.meta || {}) },
          theme: { ...current.theme, ...(config.theme || {}) },
          layout: { ...current.layout, ...(config.layout || {}) },
          map: { ...current.map, ...(config.map || {}) },
          kindLabels: { ...current.kindLabels, ...(config.kindLabels || {}) },
          phases: Array.isArray(config.phases) ? deepClone(config.phases) : current.phases,
          events: Array.isArray(config.events) ? config.events.map((event, index) => normalizeDebriefEvent({ ...event, order:index })) : current.events
        };
      }

      function renderDebriefView() {
        const debrief = appState.scenario.debrief = normalizeDebrief(appState.scenario.debrief, appState.scenario);
        return `
          ${renderLLMConfigBlock('debrief',
            tt('Example: Reconstruct the complete hidden story: initial compromise, attacker preparation, detonation, global business impacts, response, recovery, and root causes. Add locations and evidence.',
              'Exemple : reconstruis toute l’histoire cachée : compromission initiale, préparation de l’attaquant, déclenchement, impacts métier mondiaux, réponse, reprise et causes racines. Ajoute les lieux et les preuves.',
              'Beispiel: Rekonstruiere die vollständige verborgene Geschichte: Erstkompromittierung, Vorbereitung, Auslösung, globale Auswirkungen, Reaktion, Wiederherstellung und Ursachen.'),
            { title:tt('Generate a new debrief with AI','Générer un nouveau debrief avec l’IA','Neues Debrief mit KI generieren'), subtitle:tt('The LLM creates a first story reconstruction from the scenario context. It explains the major arc and never turns participant injects into debrief events. The complete CrisisDebrifier editor below remains available for manual refinement.','Le LLM crée une première reconstruction narrative à partir du contexte du scénario. Il explique l’arc majeur et ne transforme jamais les injects participants en événements de debrief. L’éditeur CrisisDebrifier complet ci-dessous permet ensuite de l’affiner manuellement.','Das LLM erstellt aus dem Szenariokontext eine erste Rekonstruktion. Der vollständige CrisisDebrifier-Editor darunter ermöglicht die manuelle Überarbeitung.'), generateLabel:tt('Create new debrief ✨','Créer un nouveau debrief ✨','Neues Debrief erstellen ✨'), successMessage:(count)=>tt(`${count} story steps generated. Review them in CrisisDebrifier.`,`${count} étapes narratives générées. Vérifiez-les dans CrisisDebrifier.`,`${count} Handlungsschritte generiert. Prüfen Sie sie in CrisisDebrifier.`) })}
          <section class="debrief-embedded-workspace" aria-label="CrisisDebrifier editor">
            <iframe id="debrief-editor-frame" class="debrief-editor-frame" title="CrisisDebrifier timeline editor"></iframe>
          </section>`;
      }

      const DEBRIEF_PHASE_PRESETS = [
        { id: 'prelude', label: 'Before the crisis · Silent compromise', range: 'Weeks before H0', start: 0, end: 0.34, color: '#451DC7' },
        { id: 'detonation', label: 'The crisis · Detonation and escalation', range: 'H0 · Crisis day', start: 0.34, end: 0.76, color: '#D8412F' },
        { id: 'fallout', label: 'After the crisis · Recovery and lessons', range: 'Days and weeks after', start: 0.76, end: 1, color: '#088A42' }
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
            preset: 'wavestone', bg: '#F5F4F9', fg: '#3A3550', ink: '#16121F', accent: '#04F06A', panel: '#FFFFFF',
            line: '#E6E4EE', muted: '#6B6580', fontTitle: 'Poppins', fontBody: 'Inter', fontMono: 'IBM Plex Mono', scale: 1
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

      /* The theme is written into the exported page's <style>: colours and font names only. */
      function debriefSafeTheme(theme, fallback) {
        const out = { ...theme };
        for (const key of ['bg', 'fg', 'ink', 'accent', 'panel', 'line', 'muted']) {
          const value = String(theme[key] ?? '');
          out[key] = /^[#a-zA-Z0-9(),.%\s-]{1,80}$/.test(value) && !/url|expression/i.test(value) ? value : fallback[key];
        }
        for (const key of ['fontTitle', 'fontBody', 'fontMono']) {
          const value = String(theme[key] ?? '');
          out[key] = /^[A-Za-z0-9 _-]{1,60}$/.test(value) ? value : fallback[key];
        }
        out.preset = ['wavestone', 'cyber-dark'].includes(theme.preset) ? theme.preset : fallback.preset;
        const scale = Number(theme.scale);
        out.scale = Number.isFinite(scale) ? Math.min(2, Math.max(0.5, scale)) : 1;
        return out;
      }

      function normalizeDebrief(input, scenario) {
        const base = makeEmptyDebrief(scenario);
        const isLegacyStimulusDebrief = input && (input.schema_version !== 2 || (input.events || []).some((event) => event.stimulus_id));
        if (!input || typeof input !== 'object' || isLegacyStimulusDebrief) return buildDebriefFromScenario(scenario);
        const normalized = {
          ...base, ...input, schema_version: 2,
          meta: { ...base.meta, ...(input.meta || {}) },
          theme: debriefSafeTheme({ ...base.theme, ...(input.theme || {}) }, base.theme),
          layout: { ...base.layout, ...(input.layout || {}) },
          map: { ...base.map, ...(input.map || {}) },
          kindLabels: { ...base.kindLabels, ...(input.kindLabels || {}) },
          phases: Array.isArray(input.phases) && input.phases.length ? input.phases.map((phase, index) => ({ ...deepClone(DEBRIEF_PHASE_PRESETS[index] || DEBRIEF_PHASE_PRESETS[2]), ...phase, id: phase.id || `phase_${index + 1}` })) : base.phases,
          events: Array.isArray(input.events) ? input.events.map(normalizeDebriefEvent) : []
        };
        // Wavestone theme: the default phase colours of the dark theme (gold, red, grey) follow the
        // Wavestone palette; colours chosen by the designer stay.
        if (normalized.theme.preset === 'wavestone') {
          const palette = { '#d4a03c': '#451DC7', '#dc3c28': '#D8412F', '#b4afa5': '#088A42' };
          normalized.phases = normalized.phases.map((phase) => ({ ...phase, color: palette[String(phase.color || '').toLowerCase()] || phase.color }));
        }
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
        d.meta = { ...d.meta, title:'Operation Cold Chain', subtitle:'The StonaWave ransomware crisis reconstructed', badge:'SCENARIO REVEAL · STONAWAVE · 16 NOV 2026' };
        d.map = { mode:'globe', label:'StonaWave crisis footprint' };
        const e = (phase,dateLabel,title,location,coords,severity,kind,headline,body,artifacts=[],casualties='',damageUSD='') => normalizeDebriefEvent({phase,dateLabel,title,location,coords,severity,kind,headline,body,artifacts,casualties,damageUSD});
        d.events = [
          e('prelude','D-19','A contractor VPN account opens the door','Maintenance contractor · remote access',[48.86,2.35],2,'intrusion','PharmLeaks logs in with the VPN credential of a maintenance contractor, bought from an access broker.','The account had no MFA and was used at night from an unusual country. The login looked legitimate and raised no alert.',['VPN logs','Access broker listing']),
          e('prelude','D-17 → D-14','From a service account to domain administrator','Paris region, France',[48.86,2.35],3,'intrusion','Kerberoasting of the svc-backup account gives the attackers the keys of the domain.','The service account had a weak password that never expired. With domain administrator rights, the attackers reach the backup console, the ERP and the MES servers.',['Kerberos tickets','RDP sessions']),
          e('prelude','D-12 → D-3','1.9 TB of clinical and patient data leaves quietly','StonaWave data centre · Paris',[48.86,2.35],4,'exfiltration','The attack becomes a data breach before it becomes a ransomware crisis.','Clinical-trial results, pharmacovigilance files, 38,000 patient records of the early access programme and contracts are sent to a cloud storage service at night, in small batches.',['Proxy logs','Cloud storage account']),
          e('prelude','D-1 · 23:50','Recovery paths are sabotaged','Backup infrastructure · Paris',[48.86,2.35],4,'attack','EDR is disabled on 40 servers and the online backup catalogs are deleted.','The Hyderabad immutable vault, offline for its weekly cycle, stays out of reach: the detail that will save the recovery.',['Backup console screenshots']),
          e('detonation','05:40','Encryption on a Monday before dawn','Frankfurt · New Jersey · Lyon',[50.11,8.68],5,'attack','Ransomware pushed by group policy hits the ERP, the MES, the warehouse system and identity servers.','Frankfurt stops two oncology lines at 07:10, the Lyon cold-chain warehouse loses its temperature monitoring and hospitals can no longer order.',['Ransom note','SOC alert 06:05']),
          e('detonation','08:30 · H0','The crisis cell convenes','Paris headquarters',[48.86,2.35],4,'decision','Five cells start working with an incomplete picture: what is encrypted, what was stolen, is the attacker still inside?','The executive committee declares the crisis, activates the incident response retainer and must decide on the isolation of the sites.',['Crisis log','First SOC report']),
          e('detonation','08:55','Double extortion: 18 million USD in 72 hours','PharmLeaks leak site · online',[55.75,37.62],5,'threat','PharmLeaks proves the data theft with 20 patient records and starts a countdown.','Paying would not stop the leak: a broker linked to the group already offers the data for sale on a dark web forum.',['Ransom email','Forum listing']),
          e('detonation','09:55','All sites isolated to protect Hyderabad','Paris · Frankfurt · New Jersey · Hyderabad',[17.39,78.49],4,'decision','The committee accepts two days without ERP, email or badges to protect the last clean backups.','Partner links, including the MediChem EDI, are cut. Orders move to phone and paper; the crisis moves to business continuity.',['Isolation decision','Break-glass accounts']),
          e('detonation','10:00 → 10:15','The leak goes public and global','Paris · New York · Frankfurt',[40.71,-74.01],5,'leak','2,000 patient records are published; CNN, Le Monde, the New York Times and the FAZ cover the story.','A patient association demands answers, the CNIL and the ANSM ask for notifications and a shortage assessment, and the share price falls.',['Leak site','Press coverage']),
          e('detonation','10:45','Patients first: degraded distribution','Lyon cold-chain warehouse',[45.76,4.84],3,'recovery','Critical oncology treatments leave Lyon on paper records with manual temperature logs.','Hospitals get a named contact and MediChem takes over part of the packaging under strict security conditions.',['Priority list','Manual temperature log']),
          e('detonation','11:00','A clean path to recovery','Hyderabad, India',[17.39,78.49],3,'recovery','Delta Advisory confirms the Hyderabad vault is clean; the rebuild starts in a clean room.','StonaWave confirms it will not pay. The recovery teams take over at 11:30 with a staged plan: identity, ERP, then the Frankfurt lines.',['Recovery sequence']),
          e('fallout','Day +3','Production restarts line by line','Frankfurt, Germany',[50.11,8.68],3,'recovery','Line 3 restarts after validation; the other systems follow over the next week.','Three days of data are entered again by hand. No shortage is declared for the three critical oncology treatments.',['Batch release records']),
          e('fallout','Week +6','Root cause: trust, not one password','Paris region, France',[48.86,2.35],2,'lessons','The review connects contractor access without MFA, weak service accounts and backups reachable from the domain.','The action plan enforces MFA on every third-party access, tiers administration accounts and tests a full recovery from the offline vault twice a year.',['Lessons learned report'])
        ];
        d.events.forEach((event,index)=>event.order=index);
        d.generated_at = new Date().toISOString(); d.generation_method = 'authored_story_reconstruction';
        return refreshDebriefPositions(d);
      }

      function cleanDebriefText(value) { return String(value || '').replace(/<br\s*\/?>/gi,' ').replace(/<\/p>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim(); }
      function debriefStimulusText(stimulus) { const fields=stimulus?.fields || {}; return cleanDebriefText(fields.body || fields.message_content || fields.text || fields.subheadline || fields.description || fields.headline || fields.thread_title || fields.subject || stimulus?.generation_prompt || ''); }
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
  <script>window.__cdnFailed = function () { var root = document.getElementById('root'); if (!root || root.dataset.failed) return; root.dataset.failed = '1'; root.innerHTML = ${JSON.stringify(`<p style="padding:24px;max-width:560px;font:15px/1.5 sans-serif">${escapeHtml(tt('The timeline cannot be shown: React and Babel load from unpkg.com, which this computer cannot reach (offline, firewall or proxy).', 'La frise ne peut pas s’afficher : React et Babel sont chargés depuis unpkg.com, injoignable depuis ce poste (hors ligne, pare-feu ou proxy).', 'Die Zeitleiste kann nicht angezeigt werden: React und Babel werden von unpkg.com geladen, das von diesem Rechner nicht erreichbar ist (offline, Firewall oder Proxy).'))}</p>`).replace(/</g, '\\u003c')}; };<\/script>
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js" onerror="__cdnFailed()"><\/script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" onerror="__cdnFailed()"><\/script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" onerror="__cdnFailed()"><\/script>
  <script type="text/babel" data-presets="react">${renderer}<\/script>
</body>
</html>`;
      }

      function exportDebriefHTML() {
        try {
          const debrief = normalizeDebrief(appState.scenario.debrief, appState.scenario);
          appState.scenario.debrief = debrief;
          downloadBlob(new Blob([buildDebriefHTML(debrief)], { type: 'text/html' }), `${slugify(debrief.meta.title || 'crisis-debrief')}.debrief.html`);
          pushToast(tt('Debrief HTML exported.', 'HTML de debrief exporté.', 'Debrief-HTML exportiert.'), 'success');
        } catch (error) {
          throw CrisisError.wrap(error, {
            operation: 'Export debrief HTML',
            detail: `Debrief=${appState.scenario?.debrief?.meta?.title || 'untitled'}`
          });
        }
      }

      function exportDebriefConfig() {
        try {
          const config = debriefToTimelineConfig(appState.scenario.debrief);
          downloadBlob(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }), `${slugify(config.meta?.title || 'crisis-debrief')}.debrief.json`);
          pushToast(tt('Debrief configuration exported.', 'Configuration du debrief exportée.', 'Debrief-Konfiguration exportiert.'), 'success');
        } catch (error) {
          throw CrisisError.wrap(error, {
            operation: 'Export debrief JSON configuration',
            detail: `Debrief=${appState.scenario?.debrief?.meta?.title || 'untitled'}`
          });
        }
      }

      function applyLLMDebrief(result, scenario) {
        const current = makeEmptyDebrief(scenario);
        if (result.meta && typeof result.meta === 'object') current.meta = { ...current.meta, ...result.meta };
        if (result.theme && typeof result.theme === 'object') current.theme = debriefSafeTheme({ ...current.theme, ...result.theme }, current.theme);
        if (result.map && typeof result.map === 'object') current.map = { ...current.map, ...result.map };
        if (Array.isArray(result.phases) && result.phases.length) current.phases = result.phases.map((phase,index)=>({ ...deepClone(DEBRIEF_PHASE_PRESETS[index] || DEBRIEF_PHASE_PRESETS[2]), ...phase, id:phase.id || `phase_${index+1}` }));
        const proposedEvents = Array.isArray(result) ? result : (result.events || []);
        const validPhaseIds = new Set(current.phases.map((phase)=>phase.id));
        current.events = proposedEvents.map((event,index)=>normalizeDebriefEvent({ ...event, id:event.id || uid('story'), order:index, phase:validPhaseIds.has(event.phase)?event.phase:(index < proposedEvents.length*.34?'prelude':index < proposedEvents.length*.76?'detonation':'fallout') }));
        current.generated_at = new Date().toISOString(); current.generation_method = 'llm_story_reconstruction';
        scenario.debrief = refreshDebriefPositions(current); return scenario.debrief;
      }

      /* The editor's own interface is written in French: each entry is an exact piece of its
         source and its English and German versions (a fourth value replaces the French too).
         Only the interface is translated, never the timeline content. Replacements inside the
         editor's script stay free of single quotes. */
      const DEBRIEF_EDITOR_UI = [
        ['<span class="nav-project-name">Crisis Debriefer · Timeline editor</span>', '<span class="nav-project-name">Crisis Debriefer · Timeline editor</span>', '<span class="nav-project-name">Crisis Debriefer · Zeitleisten-Editor</span>', '<span class="nav-project-name">Crisis Debriefer · Éditeur de timeline</span>'],
        ['<div class="sub">Configurez, prévisualisez et exportez une timeline de crise interactive.</div>', '<div class="sub">Configure, preview and export an interactive crisis timeline.</div>', '<div class="sub">Interaktive Krisen-Zeitleiste konfigurieren, ansehen und exportieren.</div>'],
        ['<span class="dot"></span>Source</div>', '<span class="dot"></span>Source</div>', '<span class="dot"></span>Quelle</div>'],
        ['Charger un fichier de config<span', 'Load a config file<span', 'Konfigurationsdatei laden<span'],
        ['Exemple StonaWave<span', 'Load the example<span', 'Beispiel laden<span', 'Charger l’exemple<span'],
        ['Télécharger la timeline', 'Download the timeline', 'Zeitleiste herunterladen'],
        ['Télécharger la config<span', 'Download the config<span', 'Konfiguration herunterladen<span'],
        ['>100% hors-ligne<', '>100% offline<', '>100 % offline<'],
        ['>Inclure les polices<', '>Include the fonts<', '>Schriften einbetten<'],
        ['>Inclure les données cartographiques<', '>Include the map data<', '>Kartendaten einbetten<'],
        ['Génération <code>10–30 s</code> selon la connexion.', 'Generation takes <code>10–30 s</code> depending on the connection.', 'Erstellung in <code>10–30 s</code> je nach Verbindung.'],
        ['Polices incluses →', 'Fonts included →', 'Mit Schriften →'],
        ['Carte incluse →', 'Map included →', 'Mit Karte →'],
        ['<span class="dot"></span>Blocs affichés</div>', '<span class="dot"></span>Displayed blocks</div>', '<span class="dot"></span>Angezeigte Blöcke</div>'],
        ['>Carte / globe<', '>Map / globe<', '>Karte / Globus<'],
        ['>Liste chronologique<', '>Chronological list<', '>Chronologische Liste<'],
        ['<label for="t-sev">Sévérité<', '<label for="t-sev">Severity<', '<label for="t-sev">Schweregrad<'],
        ['<label for="t-art">Artefacts<', '<label for="t-art">Artifacts<', '<label for="t-art">Artefakte<'],
        ['>Lecture automatique<', '>Autoplay<', '>Automatische Wiedergabe<'],
        ['<span class="dot"></span>Style visuel</div>', '<span class="dot"></span>Visual style</div>', '<span class="dot"></span>Visueller Stil</div>'],
        ['>Style du générateur<', '>Generator style<', '>Generator-Stil<'],
        ['<label for="m-title">Titre</label>', '<label for="m-title">Title</label>', '<label for="m-title">Titel</label>'],
        ['<label for="m-sub">Sous-titre</label>', '<label for="m-sub">Subtitle</label>', '<label for="m-sub">Untertitel</label>'],
        ['<span class="swatch-label">Fond</span>', '<span class="swatch-label">Base</span>', '<span class="swatch-label">Grund</span>'],
        ['<label>Arrière-plan</label>', '<label>Background</label>', '<label>Hintergrund</label>'],
        ['<span class="swatch-label">Texte</span>', '<span class="swatch-label">Text</span>', '<span class="swatch-label">Text</span>'],
        ['<label>Corps de texte</label>', '<label>Body text</label>', '<label>Fließtext</label>'],
        ['<span class="swatch-label">Titres</span>', '<span class="swatch-label">Titles</span>', '<span class="swatch-label">Titel</span>'],
        ['<label>Encre (titres)</label>', '<label>Ink (titles)</label>', '<label>Titelfarbe</label>'],
        ['<span class="swatch-label">Accent</span><input type="color" id="c-accent"><label>Accent</label>', '<span class="swatch-label">Accent</span><input type="color" id="c-accent"><label>Accent</label>', '<span class="swatch-label">Akzent</span><input type="color" id="c-accent"><label>Akzent</label>'],
        ['<span class="swatch-label">Panneaux</span>', '<span class="swatch-label">Panels</span>', '<span class="swatch-label">Flächen</span>'],
        ['<label>Bandeaux</label>', '<label>Banners</label>', '<label>Leisten</label>'],
        ['<span class="swatch-label">Bordures</span>', '<span class="swatch-label">Borders</span>', '<span class="swatch-label">Rahmen</span>'],
        ['<label>Lignes de séparation</label>', '<label>Divider lines</label>', '<label>Trennlinien</label>'],
        ['<span class="dot"></span>Typographie</div>', '<span class="dot"></span>Typography</div>', '<span class="dot"></span>Typografie</div>'],
        ['>Police des titres<', '>Title font<', '>Titelschrift<'],
        ['>Police du corps<', '>Body font<', '>Fließtextschrift<'],
        ['>Police mono<', '>Mono font<', '>Monospace-Schrift<'],
        ['<span class="swatch-label">Échelle</span>', '<span class="swatch-label">Scale</span>', '<span class="swatch-label">Größe</span>'],
        ['<span class="dot"></span>Disposition</div>', '<span class="dot"></span>Layout</div>', '<span class="dot"></span>Layout</div>'],
        ['>Type de carte<', '>Map type<', '>Kartentyp<'],
        ['>Globe (monde)<', '>Globe (world)<', '>Globus (Welt)<'],
        ['>Région / pays (villes clés)<', '>Region / country (key cities)<', '>Region / Land (wichtige Städte)<'],
        ['>Aucune carte<', '>No map<', '>Keine Karte<'],
        ['>Cadrage région — O, S, E, N (vide = auto)<', '>Region bounds: W, S, E, N (empty = auto)<', '>Regionsausschnitt: W, S, O, N (leer = automatisch)<'],
        ['placeholder="ex : 22, 44, 41, 53"', 'placeholder="e.g. 22, 44, 41, 53"', 'placeholder="z. B. 22, 44, 41, 53"'],
        ['>Pays en surbrillance (code ISO numérique, ex : 804)<', '>Highlighted country (numeric ISO code, e.g. 804)<', '>Hervorgehobenes Land (numerischer ISO-Code, z. B. 804)<'],
        ['placeholder="laisser vide = aucun"', 'placeholder="leave empty for none"', 'placeholder="leer lassen für keines"'],
        ['>Position de la carte<', '>Map position<', '>Kartenposition<'],
        ['>À droite<', '>Right<', '>Rechts<'],
        ['>À gauche<', '>Left<', '>Links<'],
        ['<span class="dot"></span>Contenu</div>', '<span class="dot"></span>Content</div>', '<span class="dot"></span>Inhalt</div>'],
        ['<div class="ce-sub">Phases</div>', '<div class="ce-sub">Phases</div>', '<div class="ce-sub">Phasen</div>'],
        ['<div class="ce-sub">Événements</div>', '<div class="ce-sub">Events</div>', '<div class="ce-sub">Ereignisse</div>'],
        ['Ajouter une phase<', 'Add a phase<', 'Phase hinzufügen<'],
        ['Ajouter un événement<', 'Add an event<', 'Ereignis hinzufügen<'],
        ['Appliquer le JSON<', 'Apply the JSON<', 'JSON anwenden<'],
        ['Le fichier d\'entrée décrit <code>meta</code>, <code>phases</code> et <code>events</code>.', 'The input file describes <code>meta</code>, <code>phases</code> and <code>events</code>.', 'Die Eingabedatei beschreibt <code>meta</code>, <code>phases</code> und <code>events</code>.'],
        ['Les sections <code>theme</code> et <code>layout</code> pilotent le style (couleurs, blocs).', 'The <code>theme</code> and <code>layout</code> sections drive the style (colours, blocks).', 'Die Abschnitte <code>theme</code> und <code>layout</code> steuern den Stil (Farben, Blöcke).'],
        ['La position de chaque étape est déduite de <code>t</code> (0→1) ou d\'un champ <code>date</code>.', 'The position of each step comes from <code>t</code> (0→1) or from a <code>date</code> field.', 'Die Position jedes Schritts ergibt sich aus <code>t</code> (0→1) oder einem Feld <code>date</code>.'],
        ['L\'aperçu est <em>exactement</em> le fichier téléchargé.', 'The preview is <em>exactly</em> the downloaded file.', 'Die Vorschau ist <em>genau</em> die heruntergeladene Datei.'],
        ['Aperçu de la timeline', 'Timeline preview', 'Vorschau der Zeitleiste'],
        ['>Mise à jour en direct<', '>Live update<', '>Live-Aktualisierung<'],
        ["'Supprimer la phase'", "'Delete the phase'", "'Phase löschen'"],
        ["'Monter'", "'Move up'", "'Nach oben'"],
        ["'Descendre'", "'Move down'", "'Nach unten'"],
        ["'Dupliquer'", "'Duplicate'", "'Duplizieren'"],
        ["'Supprimer'", "'Delete'", "'Löschen'"],
        ["'Identifiant (id)'", "'Identifier (id)'", "'Kennung (id)'"],
        ["'Libellé'", "'Label'", "'Bezeichnung'"],
        ["'Période (texte affiché)'", "'Period (displayed text)'", "'Zeitraum (angezeigter Text)'"],
        ["'Début (0 → 1)'", "'Start (0 → 1)'", "'Beginn (0 → 1)'"],
        ["'Fin (0 → 1)'", "'End (0 → 1)'", "'Ende (0 → 1)'"],
        ["'Couleur'", "'Colour'", "'Farbe'"],
        ["ceField('Titre',", "ceField('Title',", "ceField('Titel',"],
        ["'(sans titre)'", "'(untitled)'", "'(ohne Titel)'"],
        ["'Date (texte)'", "'Date (text)'", "'Datum (Text)'"],
        ["'Lieu'", "'Location'", "'Ort'"],
        ["'Sévérité (1 → 5)'", "'Severity (1 → 5)'", "'Schweregrad (1 → 5)'"],
        ["'Type (kind)'", "'Type (kind)'", "'Typ (kind)'"],
        ["'Accroche (headline)'", "'Headline'", "'Schlagzeile (headline)'"],
        ["'Description (body)'", "'Description (body)'", "'Beschreibung (body)'"],
        ["'Artefacts (un par ligne)'", "'Artifacts (one per line)'", "'Artefakte (einer pro Zeile)'"],
        ["'Pertes (casualties)'", "'Casualties'", "'Verluste (casualties)'"],
        ["'Coût (damageUSD)'", "'Cost (damageUSD)'", "'Kosten (damageUSD)'"],
        ["' (copie)'", "' (copy)'", "' (Kopie)'"],
        ["'Nouvel événement'", "'New event'", "'Neues Ereignis'"],
        ["'Nouvelle phase'", "'New phase'", "'Neue Phase'"],
        ["'Fichier invalide : '", "'Invalid file: '", "'Ungültige Datei: '"],
        ["'JSON invalide : '", "'Invalid JSON: '", "'Ungültiges JSON: '"],
        ["'Génération…'", "'Generating…'", "'Wird erstellt…'"],
        ["'Export hors-ligne : '", "'Offline export: '", "'Offline-Export: '"],
        ["'Chargement échoué : '", "'Loading failed: '", "'Laden fehlgeschlagen: '"]
      ];

      function localizeDebriefEditorSource(source, language) {
        const column = language === 'de' ? 2 : 1;
        return DEBRIEF_EDITOR_UI.reduce((html, entry) => {
          const replacement = language === 'fr' ? entry[3] : entry[column];
          return replacement === undefined ? html : html.split(entry[0]).join(replacement);
        }, source);
      }

      function buildDebriefEditorHTML(debrief) {
        const configJson = JSON.stringify(debriefToTimelineConfig(debrief)).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');
        const language = currentLanguage();
        const integratedLabel = tt('Integrated project workspace', 'Espace intégré au projet', 'Integrierter Projektbereich');
        const integratedStyles = '<style>.group:has(#btn-load){display:none}</style>';
        return localizeDebriefEditorSource(CRISIS_DEBRIEF_EDITOR_SOURCE, language)
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
          theme: debriefSafeTheme({ ...current.theme, ...(config.theme || {}) }, current.theme),
          layout: { ...current.layout, ...(config.layout || {}) },
          map: { ...current.map, ...(config.map || {}) },
          kindLabels: { ...current.kindLabels, ...(config.kindLabels || {}) },
          phases: Array.isArray(config.phases) ? deepClone(config.phases) : current.phases,
          events: Array.isArray(config.events) ? config.events.map((event, index) => normalizeDebriefEvent({ ...event, order:index })) : current.events
        };
      }

      function renderStoryDebriefView() {
        const debrief = appState.scenario.debrief = normalizeDebrief(appState.scenario.debrief, appState.scenario);
        return `
          ${renderLLMConfigBlock('debrief',
            tt('Example: Reconstruct the complete hidden story: initial compromise, attacker preparation, detonation, global business impacts, response, recovery, and root causes. Add locations and evidence.',
              'Exemple : reconstruis toute l’histoire cachée : compromission initiale, préparation de l’attaquant, déclenchement, impacts métier mondiaux, réponse, reprise et causes racines. Ajoute les lieux et les preuves.',
              'Beispiel: Rekonstruiere die vollständige verborgene Geschichte: Erstkompromittierung, Vorbereitung, Auslösung, globale Auswirkungen, Reaktion, Wiederherstellung und Ursachen.'),
            { title:tt('Generate a new debrief with AI','Générer un nouveau debrief avec l’IA','Neues Debrief mit KI generieren'), subtitle:tt('The LLM creates a first story reconstruction from the scenario context. It explains the major arc and never turns participant injects into debrief events. The complete CrisisDebrifier editor below remains available for manual refinement.','Le LLM crée une première reconstruction narrative à partir du contexte du scénario. Il explique l’arc majeur et ne transforme jamais les injects participants en événements de debrief. L’éditeur CrisisDebrifier complet ci-dessous permet ensuite de l’affiner manuellement.','Das LLM erstellt aus dem Szenariokontext eine erste Rekonstruktion. Der vollständige CrisisDebrifier-Editor darunter ermöglicht die manuelle Überarbeitung.'), generateLabel:tt('Create new debrief','Créer un nouveau debrief','Neues Debrief erstellen'), successMessage:(count)=>tt(`${count} story steps generated. Review them in CrisisDebrifier.`,`${count} étapes narratives générées. Vérifiez-les dans CrisisDebrifier.`,`${count} Handlungsschritte generiert. Prüfen Sie sie in CrisisDebrifier.`) })}
          <section class="debrief-embedded-workspace" aria-label="CrisisDebrifier editor">
            <iframe id="debrief-editor-frame" class="debrief-editor-frame" title="CrisisDebrifier timeline editor"></iframe>
          </section>`;
      }

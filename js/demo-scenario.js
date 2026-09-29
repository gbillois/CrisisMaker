      /* The demo project loaded on a first visit and by "Load the example": StonaWave, operation
         "Cold Chain". A three-hour ransomware exercise that shows every part of CrisisMaker at work:
         framing, cells and players, simulated actors, a storyline with main events, injects on
         every channel in sync with their plan, evaluation, debriefs and the checklist.
         Called by defaultScenario() (data.js); the storyline part needs scenario-model.js and
         scenario-sync.js, and is skipped when a tool loads data.js alone. */

      const DEMO_START = '2026-11-16T08:30';

      function buildStonaWaveDemo() {
        const actorSpecs = [
          ['soc', 'Karim Benali', 'internal', 'StonaWave', 'SOC night-shift lead', 'en', 'Lucas Ferrand'],
          ['plant', 'Greta Hoffmann', 'internal', 'StonaWave', 'Site director, Frankfurt plant', 'en', 'Lucas Ferrand'],
          ['servicedesk', 'StonaWave IT Service Desk', 'internal', 'StonaWave', 'Global IT service desk', 'en', 'Lucas Ferrand'],
          ['pressoffice', 'StonaWave Press Office', 'internal', 'StonaWave', 'Group press office', 'en', 'Ines Carvalho'],
          ['hr', 'Nathalie Brunet', 'internal', 'StonaWave', 'Head of HR, France', 'en', 'Maya Okonkwo'],
          ['attacker', 'PharmLeaks', 'attacker', 'PharmLeaks ransomware group', 'Threat actor', 'en', 'Paul Desmarais'],
          ['broker', 'c0ldCha1n', 'attacker', 'Underground forum seller', 'Data broker linked to PharmLeaks', 'en', 'Paul Desmarais'],
          ['lemonde', 'Camille Vasseur', 'journalist', 'Le Monde', 'Cybersecurity journalist', 'fr', 'Ines Carvalho'],
          ['nyt', 'Hannah Brooks', 'journalist', 'The New York Times', 'Technology reporter', 'en', 'Ines Carvalho'],
          ['faz', 'Jonas Reinhardt', 'journalist', 'Frankfurter Allgemeine Zeitung', 'Business correspondent', 'de', 'Ines Carvalho'],
          ['ft', 'Oliver Grant', 'journalist', 'Financial Times', 'Pharma and healthcare editor', 'en', 'Ines Carvalho'],
          ['tv', 'CNN Newsdesk', 'journalist', 'CNN International', 'Breaking news desk', 'en', 'Ines Carvalho'],
          ['certfr', 'CERT-FR', 'authority', 'ANSSI', 'Government cyber alert and response centre', 'fr', 'Maya Okonkwo'],
          ['cnil', 'CNIL data breach desk', 'authority', 'CNIL', 'Personal data breach notifications', 'fr', 'Maya Okonkwo'],
          ['ansm', 'Dr. Laure Fontaine', 'authority', 'ANSM', 'Head of the drug shortage unit', 'fr', 'Maya Okonkwo'],
          ['hospital', 'Dr. Isabelle Roux', 'client_b2b', 'Saint-Aurele University Hospital', 'Chief pharmacist', 'fr', 'Maya Okonkwo'],
          ['patients', 'Marc Lemaire', 'client_b2c', 'Hope Oncology patient association', 'President', 'fr', 'Ines Carvalho'],
          ['medichem', 'David Chen', 'partner', 'MediChem Manufacturing', 'VP Supply Chain Operations', 'en', 'Paul Desmarais'],
          ['insurer', 'Aline Garnier', 'partner', 'Northbridge Cyber Insurance', 'Cyber claims manager', 'en', 'Paul Desmarais', 'insurers'],
          ['delta', 'Elise Warren', 'analyst', 'Delta Advisory', 'Incident response lead', 'en', 'Lucas Ferrand'],
          ['intel', 'DarkFeed Watch', 'analyst', 'Independent threat intelligence', 'Ransomware tracker', 'en', 'Ines Carvalho']
        ];
        const categories = [{ id: 'category_insurers', label: 'Insurers', role: 'partner' }];
        const actorByKey = {};
        const actors = actorSpecs.map(([key, name, role, organization, title, language, playedBy, category]) => {
          const initials = name.replace(/^Dr\. /, '').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase();
          const actor = { id: `actor_demo_${key}`, name, role, organization, title, language, avatar_initials: initials, avatar_url: '', played_by: playedBy };
          if (category) actor.category = `category_${category}`;
          actorByKey[key] = actor;
          return actor;
        });
        const scenario = {
          id: uid('scenario'),
          name: 'CrisisMaker demo - StonaWave - Operation Cold Chain',
          client: { name: 'StonaWave', sector: 'Pharmaceutical', language: 'en', logo_url: '' },
          scenario: {
            type: 'Ransomware',
            summary: 'On Monday 16 November 2026, the ransomware group PharmLeaks encrypts the systems of StonaWave, a pharmaceutical group headquartered near Paris with plants in Frankfurt, New Jersey and Hyderabad. Production of oncology treatments stops, the cold-chain distribution to hospitals is blind and the attackers claim 1.9 TB of stolen clinical-trial and patient data. Over three hours the executive committee, IT, communication, legal and business continuity cells must contain the attack, protect patients, answer the extortion, notify the authorities and keep control of the story while the data leaks and the media storm grows.',
            detailed_context: 'Operation Cold Chain starts nineteen days before the visible crisis, when PharmLeaks logs in to the VPN with the credential of a maintenance contractor that had no MFA. The group escalates to domain administrator through a service account with a weak password, maps the backup console and exfiltrates 1.9 TB (clinical-trial results, pharmacovigilance files, 38,000 patient records from the French early-access programme, contracts) to a cloud storage service. At 05:40 on Monday the ransomware is pushed by group policy to the ERP, the manufacturing execution systems (MES), the warehouse management system and the identity servers. The Frankfurt plant stops two oncology lines, the temperature monitoring of the cold-chain warehouse in Lyon goes dark and hospitals can no longer place orders. At 08:30 the crisis cell convenes. PharmLeaks demands 18 million USD in 72 hours, publishes a sample on its leak site and a broker puts the data on sale on a dark web forum. The immutable backup vault in Hyderabad was isolated in time: it offers a clean path to recovery. The exercise ends at 11:30 with the handover to the recovery teams.',
            start_date: DEMO_START,
            end_date: '',
            timezone: 'Europe/Paris',
            objectives: [
              'Qualify the attack and decide on the isolation of the plants under uncertainty',
              'Decide on the response to the extortion without contact with the attacker outside a controlled process',
              'Notify ANSSI, the CNIL and the ANSM on time, and involve the insurer',
              'Protect patients: secure the supply of critical oncology treatments',
              'Communicate to staff, hospitals, patients and the media with one consistent voice',
              'Plan the recovery from trusted backups and hand over to the recovery teams'
            ].join('\n'),
            learning_objectives: [
              'Everyone: apply the crisis management procedure, take documented decisions under uncertainty and share one situation picture.',
              'Executive committee: arbitrate between production, patient safety and security, and take a position on the ransom within the first two hours.',
              'IT & technical cell: scope the compromise, choose what to isolate and prove which backups can be trusted before any restore.',
              'Communication cell: hold consistent messages to staff, hospitals, patients and the press, and react to the leak without denying facts.',
              'Legal & compliance cell: notify ANSSI (NIS2), the CNIL (GDPR, 72 hours) and the ANSM, file the insurance claim and document every decision.',
              'Business continuity cell: run degraded production and cold-chain distribution, and prioritise the patients who cannot wait.'
            ].join('\n'),
            attack_path: [
              '28 Oct 2026, 22:14: Initial access with the VPN credential of a maintenance contractor (no MFA), bought from an access broker',
              '30 Oct 2026: Discovery and privilege escalation: Active Directory enumeration and Kerberoasting of the svc-backup service account, cracked offline',
              '2 Nov 2026: Lateral movement with domain administrator rights: RDP to the backup console, the ERP and MES servers',
              '4 to 13 Nov 2026: Exfiltration of 1.9 TB to a cloud storage service over HTTPS at night',
              '15 Nov 2026, 23:50: Defense evasion: EDR disabled on 40 servers, online backup catalogs deleted (the Hyderabad vault, offline, is out of reach)',
              '16 Nov 2026, 05:40: Impact: ransomware pushed by group policy to ERP, MES, warehouse and identity servers; ransom note on every screen',
              '16 Nov 2026, 06:05: Detection: SOC alert; 07:10: Frankfurt lines stop; 08:30: crisis cell convened (start of the exercise)'
            ].join('\n')
          },
          actors,
          actor_categories: categories,
          stimuli: [],
          custom_templates: [],
          settings: { language: 'en', inject_language: 'en', ai_provider: 'anthropic', ai_model: 'claude-sonnet-5', ai_api_key: '', ollama_mode: 'local', ollama_endpoint: 'http://localhost:11434', azure_endpoint: '', azure_api_key: '', azure_deployment: '', azure_api_version: DEFAULT_AZURE_API_VERSION, azure_speech_key: '', azure_speech_region: 'westeurope', max_versions: 3, auto_save_interval_seconds: 30, template_quality: 'hd', watermark_enabled: true, watermark_text: 'EXERCISE EXERCISE EXERCISE', watermark_text_size: 16, watermark_position_v: 'top', watermark_position_h: 'center', watermark_opacity: 50, watermark_rotation: 0, watermark_audio_enabled: true, confidentiality_acknowledged: false }
        };

        // The simulated clock: 08:30 on Monday 16 November 2026, Paris time.
        const clock = (minutes) => {
          const total = 8 * 60 + 30 + minutes;
          return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        };
        const usClock = (minutes) => {
          const total = 8 * 60 + 30 + minutes;
          const hours = Math.floor(total / 60);
          return `${hours > 12 ? hours - 12 : hours}:${String(total % 60).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
        };
        const mail = (name) => `${name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.')}@stonawave.example`;

        // ── Cells and players ────────────────────────────────────────────────
        const cellSpecs = [
          ['decision', 'Executive committee', 'Arbitration between production, patients and security; ransom position; external commitments.', [['Claire Martin', 'Chief Executive Officer'], ['Henri Dubreuil', 'Chief Operating Officer'], ['Amelie Garnier', 'Chief Financial Officer']]],
          ['it', 'IT & security cell', 'Investigation, containment, backups and recovery of information and manufacturing systems.', [['Sophie Delacroix', 'Chief Information Security Officer'], ['Thomas Bergmann', 'Chief Information Officer'], ['Ravi Menon', 'Head of OT and manufacturing systems']]],
          ['communication', 'Communication cell', 'Staff, hospitals, patients, media and social networks.', [['Sofia Rossi', 'Head of communications'], ['Mark Ellison', 'Social media lead'], ['Julie Moreau', 'Internal communications manager']]],
          ['legal', 'Legal & compliance cell', 'Notifications to ANSSI, CNIL and ANSM, insurance, legal exposure and evidence.', [['Laura Schmidt', 'General counsel'], ['Hugo Lefevre', 'Data protection officer'], ['Priya Nair', 'Head of regulatory affairs']]],
          ['business', 'Business continuity cell', 'Degraded production, cold-chain distribution, hospitals and suppliers.', [['Anika Patel', 'Head of manufacturing'], ['James Carter', 'Supply chain director'], ['Elena Vogel', 'Customer service director']]]
        ];
        const hasModel = storyboardModelLoaded();
        const cellByKey = {};
        scenario.cells = cellSpecs.map(([key, name, description, players]) => {
          const cell = { id: `cell_demo_${key}`, key, name, description, objectives: '', color: '', players: players.map(([playerName, role], index) => ({ id: `player_demo_${key}_${index + 1}`, name: playerName, role, email: mail(playerName) })) };
          const normalized = hasModel ? sbNormalizeCell(cell) : cell;
          cellByKey[key] = normalized;
          return normalized;
        });
        scenario.player_pool = [['Marion Leclerc', 'Deputy crisis manager (reserve)'], ['Samuel Okafor', 'Pharmacovigilance officer (observer)']]
          .map(([name, role], index) => ({ id: `player_demo_pool_${index + 1}`, name, role, email: mail(name) }));
        scenario.exercise = { players_count: 15, cells_count: scenario.cells.length };

        // ── Main storyline: six phases, exactly 180 minutes ──────────────────
        const phaseSpecs = [
          { type: 'trigger', start: 0, duration: 25, title: 'Monday 08:30: the plants stop',
            brief: 'The crisis cell convenes while the ransom note is on every screen and the Frankfurt lines are stopped.',
            narrative: 'Encryption started at 05:40. The SOC confirms a ransomware attack on the ERP, the MES and the identity servers. Frankfurt has stopped two oncology lines and the cold-chain warehouse in Lyon has lost its temperature monitoring. Nobody knows yet how far the attackers went.',
            events: [[0, '08:30 Crisis cell convened: ERP, MES and identity servers encrypted, ransom message on every screen'], [10, '08:40 Frankfurt confirms two oncology lines stopped; the Lyon warehouse is blind on temperatures']],
            objectives: [0] },
          { type: 'investigation', start: 25, duration: 30, title: 'Scoping and double extortion',
            brief: 'PharmLeaks claims the attack, demands 18 million USD and proves it stole data. Hospitals start calling.',
            narrative: 'The attacker writes to the executives with a 72-hour deadline and a proof file of patient records. Delta Advisory joins the response and finds signs that the attackers may still be inside. A partner hospital cannot place orders.',
            events: [[0, '08:55 PharmLeaks ransom email: 18M USD in 72 hours, 1.9 TB stolen'], [20, '09:15 Delta Advisory: attacker still active with domain administrator rights']],
            objectives: [0, 1] },
          { type: 'containment', start: 55, duration: 35, title: 'The isolation dilemma',
            brief: 'IT asks to cut every link between sites and partners; the authorities ask for information.',
            narrative: 'Cutting the links saves Hyderabad and its backup vault but stops orders, badges and email for two days. CERT-FR sends indicators, the insurer must be notified within 24 hours and the CNIL clock started when the theft was confirmed.',
            events: [[5, '09:30 Go or no-go requested on isolating all sites before 10:00'], [20, '09:45 CERT-FR alert with indicators; first regulatory deadlines confirmed']],
            objectives: [0, 2] },
          { type: 'twist', start: 90, duration: 30, title: 'The leak goes public',
            brief: 'A data sample is published, the data is on sale on a forum and the story reaches TV and the international press.',
            narrative: 'PharmLeaks publishes 2,000 patient records to raise the pressure. A broker sells the full set on a dark web forum. CNN runs breaking news, patients worry on social networks and a patient association demands answers.',
            events: [[0, '10:00 Leak site publishes a first sample of patient records'], [10, '10:10 Breaking news on CNN; the story trends on X and Reddit']],
            objectives: [1, 4] },
          { type: 'continuity', start: 120, duration: 30, title: 'Patients first: degraded supply',
            brief: 'Critical oncology treatments must reach hospitals without ERP: the continuity plan is tested for real.',
            narrative: 'The ANSM asks for a shortage risk assessment. MediChem offers to take over part of the packaging. The Lyon warehouse runs on manual temperature readings and paper orders. The attacker calls to raise the pressure.',
            events: [[0, '10:30 ANSM request: shortage risk for three oncology treatments'], [15, '10:45 Manual distribution of critical treatments starts from Lyon']],
            objectives: [3, 4] },
          { type: 'exit', start: 150, duration: 30, title: 'Recovery path and crisis exit',
            brief: 'A clean backup opens the way to recovery; the cell sets priorities and hands over to the recovery teams.',
            narrative: 'Delta Advisory confirms the Hyderabad vault is clean. The executive committee confirms that no ransom will be paid, the statement is updated and the recovery teams take over for the next operational period.',
            events: [[0, '11:00 Hyderabad immutable backups confirmed clean'], [25, '11:25 Handover to the recovery teams; next crisis committee at 14:00']],
            objectives: [5] }
        ];

        // ── Injects: [minute, channel, template, actor, cells, title, intent, fields, nudge] ──
        const all = 'all';
        const injectSpecs = [
          [0, 'email_internal', null, 'soc', 'it', 'SOC confirms ransomware on the core systems', 'Starts the exercise: facts known, facts unknown, first request for decisions.', {
            from_email: 'karim.benali@stonawave.example', to: 'IT & security cell', cc: 'Claire Martin (CEO)',
            subject: 'CRITICAL - Ransomware confirmed on ERP, MES and identity servers',
            body: '<p>All,</p><p>Since 05:40 our monitoring shows mass encryption on the ERP, the MES of Frankfurt and New Jersey, the warehouse system in Lyon and two domain controllers. Every affected screen shows a note signed <strong>PharmLeaks</strong>.</p><ul><li>Hyderabad and its backup vault do not show encryption so far</li><li>EDR was disabled on about 40 servers last night</li><li>We do not know yet how the attackers got in</li></ul><p>We need a decision on the isolation of the sites and on calling our incident response retainer.</p><p>Karim Benali<br>SOC night-shift lead</p>',
            attachment_name: 'SOC_timeline_0540-0825.xlsx' }],
          [4, 'sms_notification', null, 'servicedesk', all, 'Staff SMS: do not switch on your computer', 'Shows the first staff communication and its gaps.', {
            sender: 'StonaWave IT', text: 'STONAWAVE IT ALERT: a major IT incident is in progress. Do not switch on or connect your work computer until further notice. Updates on this number. Do not reply.', device: 'iphone' }],
          [10, 'email_internal', null, 'plant', 'business', 'Frankfurt: two oncology lines stopped', 'Makes the production impact concrete for business continuity.', {
            from_email: 'greta.hoffmann@stonawave.example', to: 'Business continuity cell', cc: 'Anika Patel',
            subject: 'Frankfurt plant - Lines 3 and 4 stopped, 11,000 doses in quarantine',
            body: '<p>Anika, James,</p><p>The MES went down at 07:10. Lines 3 and 4 (oncology injectables) stopped mid-batch. Without the MES we cannot release or trace the 11,000 doses in progress: they are in quarantine.</p><p>We can restart one line on paper batch records, with two quality assurance staff per shift, from 13:00 at the earliest. I need your go and a priority list of products.</p><p>Greta Hoffmann<br>Site director, Frankfurt</p>' }],
          [16, 'internal_memo', null, 'hr', 'communication', 'HR note: staff arriving at the sites', 'Staff need instructions; the communication cell must take over internal messages.', {
            to: 'Communication cell', subject: 'Staff arriving at the sites without instructions',
            body: '<p>Site managers report that staff arriving for the 09:00 shift in Paris and Lyon have no instructions. Badges do not work in Lyon, rumours circulate on WhatsApp and some employees are posting pictures of the ransom note.</p><p>We need a first internal message within the hour: what to do, what not to post, who to call.</p>', classification: 'Internal' }],
          [20, 'email_internal', null, 'soc', 'decision', 'The crisis level is still not declared', 'Relaunches the executive committee if it has not declared the crisis level.', {
            from_email: 'karim.benali@stonawave.example', to: 'Claire Martin; Henri Dubreuil', cc: 'Sophie Delacroix',
            subject: 'Reminder - crisis level and incident response retainer still pending',
            body: '<p>Claire, Henri,</p><p>We still have no crisis level declared and no go to activate our incident response retainer with Delta Advisory. Every hour of delay leaves the attackers in the network. Can the executive committee decide now?</p><p>Karim</p>' }, true],
          [25, 'email_external', null, 'attacker', 'decision', 'PharmLeaks ransom email', 'The double extortion: amount, deadline, proof of data theft.', {
            from_email: 'negotiation@pharmleaks.example', to: 'claire.martin@stonawave.example; sophie.delacroix@stonawave.example', cc: '',
            subject: 'StonaWave: your systems are ours. 1.9 TB of your data too',
            body: '<p>StonaWave management,</p><p>Your ERP, your plants and your warehouses are encrypted. Before that we copied 1.9 TB: clinical trials, pharmacovigilance, 38,000 patient files of your early access programme, contracts.</p><p><strong>18,000,000 USD in Bitcoin within 72 hours.</strong> After payment: decryption tool and deletion proof.</p><p>Proof attached: 20 patient records. Our chat: <code>pharmleaks[.]onion/sw-1611</code>, key <code>CC-4481</code>. Every hour of silence, we publish more.</p><p>PharmLeaks</p>',
            has_attachment: true, attachment_name: 'proof_20_patients.txt', importance: 'high' }],
          [28, 'email_internal', null, 'soc', 'legal', 'SOC asks how to preserve evidence', 'Brings the legal cell in early: evidence, complaint and the regulatory clocks.', {
            from_email: 'karim.benali@stonawave.example', to: 'Laura Schmidt; Hugo Lefevre', cc: 'Sophie Delacroix',
            subject: 'Evidence before we wipe - and does the data theft start any legal clock?',
            body: '<p>Laura, Hugo,</p><p>Before we reset accounts and rebuild servers, we can take forensic images of the 12 key servers. It takes about four hours. Do you need them for a police complaint or for the insurer?</p><p>Also: the attacker claims patient data. From when do we count the notification deadlines?</p><p>Karim Benali<br>SOC night-shift lead</p>' }],
          [30, 'email_external', null, 'hospital', 'business', 'Hospital pharmacy cannot order chemotherapy', 'Patient impact: an urgent order for a hospital.', {
            from_name: 'Dr. Isabelle Roux', from_email: 'i.roux@saint-aurele-hospital.example', to: 'customer.service@stonawave.example', cc: 'elena.vogel@stonawave.example',
            subject: 'URGENT - Order portal down, 42 patients need treatment this week',
            body: '<p>Dear StonaWave team,</p><p>Your order portal has been unreachable since this morning and your hotline does not answer. We have 42 patients scheduled for chemotherapy with your product this week and stock for three days.</p><p>Can you confirm by noon whether our Wednesday delivery is maintained? If not, I must switch patients to another treatment today.</p><p>Dr. Isabelle Roux<br>Chief pharmacist, Saint-Aurele University Hospital</p>' }],
          [35, 'post_reddit', null, 'intel', 'communication', 'Reddit thread spots the attack', 'The story is public before any statement.', {
            subreddit: 'r/cybersecurity', author: 'u/darkfeed_watch', author_flair: 'Threat Intel', title: 'PharmLeaks lists French pharma group StonaWave on its leak site, countdown 72h',
            body: '<p>PharmLeaks just added StonaWave to its leak site with a 72 hour countdown and a claim of 1.9 TB. Their order portal is down and several employees posted the ransom note on social media. No statement from the company yet.</p>',
            upvotes: 1284, comments_count: 211, date: '12 min ago',
            top_comment: { author: 'u/hospital_it_ops', flair: 'Hospital IT', text: 'Our pharmacy just told us StonaWave orders are down. If this lasts, oncology wards will feel it by Wednesday.', upvotes: 342, date: '5 min ago' } }],
          [40, 'email_internal', null, 'delta', 'it', 'Delta Advisory: attacker still inside', 'Pushes the isolation decision with new technical facts.', {
            from_name: 'Elise Warren', from_email: 'elise.warren@delta-advisory.example', to: 'Sophie Delacroix; Thomas Bergmann', cc: 'Ravi Menon',
            subject: 'First findings - active domain admin session, initial access via contractor VPN',
            body: '<p>Sophie, Thomas,</p><p>First findings from our team:</p><ul><li>Initial access on 28 October through the VPN account of a maintenance contractor, without MFA</li><li>A domain administrator session is still active from a server in Paris</li><li>Large outbound transfers to a cloud storage service between 4 and 13 November</li></ul><p>We recommend resetting the domain admin accounts twice and isolating the sites now, before the attacker reaches Hyderabad.</p><p>Elise Warren<br>Incident response lead, Delta Advisory</p>',
            attachment_name: 'Delta_first_findings.pdf' }],
          [45, 'post_twitter', null, 'intel', 'communication', 'Threat intel account on X', 'Public pressure and precise technical claims circulate.', {
            display_name: 'DarkFeed Watch', handle: '@darkfeed_watch', verified: true, avatar_initials: 'DW',
            text: 'PharmLeaks claims #StonaWave: 1.9 TB incl. clinical trials and patient files, 18M USD demand, 72h countdown. Order portal and plants reported down. Hospitals should check their stock. #ransomware #pharma',
            date: `${usClock(45)} · Nov 16, 2026`, retweets: 842, quotes: 61, likes: 2310, views: 128000, replies: 97 }],
          [50, 'email_internal', null, 'insurer', 'legal', 'Insurer asks for the claim notification', 'The policy requires notice within 24 hours and forbids contact with the attacker without the insurer.', {
            from_name: 'Aline Garnier', from_email: 'a.garnier@northbridge-cyber.example', to: 'laura.schmidt@stonawave.example', cc: 'amelie.garnier@stonawave.example',
            subject: 'Policy NBC-7720 - Notice of claim and panel providers',
            body: '<p>Dear Ms Schmidt,</p><p>We saw the reports about StonaWave. Under policy NBC-7720, please send the notice of claim within 24 hours of discovery. Please do not engage with the threat actor or pay anything without our prior agreement, and use our panel for negotiation and forensics.</p><p>Our crisis line is open 24/7.</p><p>Aline Garnier<br>Cyber claims manager, Northbridge Cyber Insurance</p>' }],
          [55, 'email_internal', null, 'delta', 'decision+it', 'Go or no-go on isolating all sites', 'The key dilemma of the containment phase.', {
            from_email: 'elise.warren@delta-advisory.example', to: 'Executive committee', cc: 'Sophie Delacroix; Thomas Bergmann',
            subject: 'DECISION BEFORE 10:00 - Isolate all sites and partner links',
            body: '<p>All,</p><p>With your IT team we recommend to isolate now:</p><ul><li>Cut the links between Paris, Lyon, Frankfurt, New Jersey and Hyderabad</li><li>Close every partner connection, including the MediChem EDI</li><li>Switch to break-glass accounts and reset all domain admin accounts</li></ul><p><strong>Cost:</strong> no email, ERP or badges for 24 to 48 hours; orders by phone and paper. <strong>Risk if we wait:</strong> losing Hyderabad and the last clean backups.</p><p>We need a go or no-go before 10:00.</p><p>Elise Warren<br>Incident response lead, Delta Advisory</p>',
            attachment_name: 'Isolation_options.pdf' }],
          [60, 'email_external', null, 'medichem', 'business', 'MediChem: EDI down, packaging slots at risk', 'A partner offers help but needs a decision.', {
            from_email: 'david.chen@medichem-mfg.example', to: 'james.carter@stonawave.example', cc: 'anika.patel@stonawave.example',
            subject: 'EDI down - we can take over packaging for 5 days if you confirm today',
            body: '<p>James,</p><p>Our EDI link with you has been down since this morning. We have packaging capacity for your oncology products for five days, but I must book the slots before 15:00 and we need your batch records on paper.</p><p>Also: our security team asks whether our connection to your network is safe. Should we disconnect?</p><p>David Chen<br>VP Supply Chain Operations, MediChem</p>' }],
          [65, 'email_authority', null, 'certfr', 'legal+it', 'CERT-FR alert with indicators', 'The national authority engages; information sharing and NIS2 notification.', {
            reference: 'CERTFR-2026-CTI-1611', from_email: 'cert-fr@ssi.example', to: 'Sophie Delacroix, CISO - StonaWave',
            subject: 'PharmLeaks campaign - indicators of compromise and request for information',
            date: '16 November 2026',
            body: '<p>Madam,</p><p>CERT-FR is aware of the attack claimed by PharmLeaks against StonaWave. Please find attached the indicators observed in this campaign against two other European healthcare companies.</p><p>As an essential entity under NIS2, StonaWave must send an early warning within 24 hours. We ask you to share your first findings and to tell us whether operators of vital importance are affected.</p><p>CERT-FR</p>',
            severity: 'critical' }],
          [70, 'sms_notification', null, 'servicedesk', 'it', 'Hyderabad still connected', 'Relaunches the IT cell if isolation has not been decided.', {
            sender: 'SW Service Desk', text: 'Hyderabad NOC: still connected to Paris over the WAN, backup vault online for replication at 10:00. Confirm isolation or we keep the schedule.', device: 'android' }, true],
          [75, 'article_press', 'lemonde', 'lemonde', 'communication', 'Le Monde: StonaWave paralysed', 'First national article; asks for a statement.', {
            headline: 'Le laboratoire StonaWave paralyse par une cyberattaque', subheadline: 'Le groupe pharmaceutique francais a arrete deux lignes de production. Des hopitaux s\'inquietent pour leurs livraisons.',
            author: 'Camille Vasseur', date: '16 novembre 2026 a 09h45', category: 'Pixels',
            body: '<p>Le groupe pharmaceutique StonaWave est victime depuis lundi matin d\'une attaque par rancongiciel revendiquee par le groupe PharmLeaks. Selon nos informations, les usines de Francfort et du New Jersey sont a l\'arret et le portail de commande des hopitaux est inaccessible.</p><p>Contacte par Le Monde, le groupe n\'a pas souhaite commenter. Les attaquants affirment detenir 1,9 teraoctet de donnees, dont des dossiers de patients.</p>' }],
          [80, 'email_internal', null, 'plant', 'decision', 'No ransom position yet', 'Relaunches the executive committee on the ransom position before the leak.', {
            from_email: 'greta.hoffmann@stonawave.example', to: 'Claire Martin; Henri Dubreuil', cc: '',
            subject: 'Journalists at the plant gate ask whether we will pay',
            body: '<p>Claire, Henri,</p><p>Two journalists are at the Frankfurt gate and ask whether StonaWave will pay the ransom. My staff ask the same question. What is the committee position, and what can I say?</p><p>Greta Hoffmann<br>Site director, Frankfurt</p>' }, true],
          [85, 'email_internal', null, 'hr', 'communication', 'Employees post the ransom note', 'Internal communication must handle staff behaviour online.', {
            from_email: 'nathalie.brunet@stonawave.example', to: 'Sofia Rossi; Julie Moreau', cc: '',
            subject: 'Ransom note pictures shared by staff on LinkedIn',
            body: '<p>Sofia, Julie,</p><p>At least six employees have posted photos of the ransom note, one with visible server names. Managers ask what they should say to their teams and whether staff will be paid on time.</p><p>Nathalie Brunet<br>Head of HR, France</p>' }],
          [90, 'dark_web_forum', null, 'broker', 'decision+legal', 'Stolen data on sale on a forum', 'The data is sold independently of the ransom: paying does not protect patients.', {
            thread_prefix: 'SELLING', thread_title: '[SELLING] StonaWave pharma - clinical trials + 38k EU patient files - 1.9 TB',
            leaker_name: 'c0ldCha1n', leaker_avatar: 'CC', post_date: '2026-11-16 09:02:11 UTC',
            message_content: '<p>fresh from the PharmLeaks op. full StonaWave set: oncology trial results, pharmacovigilance db, 38k patient files from the french early access program, supplier contracts. sample in thread, verified by staff. exclusive sale, escrow accepted.</p>',
            breach_date: '2026-11', victim: 'STONAWAVE', victim_domain: 'stonawave.example', records_count: '38K+', data_size: '1.9 TB', price: '12 BTC', replies_count: 18, views_count: 2143, last_reply: '00:04:12 ago' }],
          [95, 'article_press', 'nyt', 'nyt', 'communication', 'New York Times: hospital supplies at risk', 'International coverage focused on patients in the US.', {
            headline: 'Cyberattack on Drugmaker StonaWave Threatens Cancer Drug Supplies', subheadline: 'A ransomware group says it stole the files of thousands of patients and demands $18 million.',
            author: 'Hannah Brooks', date: 'November 16, 2026', update_time: 'Updated 4:05 a.m. ET', location: 'PARIS',
            body: '<p>PARIS - A ransomware attack has halted production at StonaWave, a French pharmaceutical group that supplies cancer drugs to hospitals in Europe and the United States, according to employees and hospital pharmacists.</p><p>The group behind the attack, PharmLeaks, published a sample of patient records on Monday. StonaWave has not yet commented publicly.</p>' }],
          [100, 'breaking_news_tv', 'cnn', 'tv', all, 'CNN breaking news on the leak', 'Everyone sees the story go global.', {
            headline: 'STONAWAVE HACK: PATIENT DATA LEAKED', subline: 'Ransomware group publishes 2,000 patient records, demands $18M', ticker: 'French drugmaker StonaWave halts cancer drug lines after cyberattack * Hospitals check stocks * Company silent so far', category: 'BREAKING NEWS' }],
          [104, 'post_twitter', null, 'patients', 'communication', 'Patient association on X', 'Patients ask whether their data and treatments are safe.', {
            display_name: 'Hope Oncology', handle: '@hope_oncology', verified: false, avatar_initials: 'HO',
            text: 'Our members are receiving calls from worried patients: is their data online? Will their treatment be delivered? @StonaWave, patients deserve answers today, not tomorrow.',
            date: `${usClock(104)} · Nov 16, 2026`, retweets: 311, quotes: 44, likes: 1204, views: 56000, replies: 88 }],
          [108, 'email_external', null, 'patients', 'legal+communication', 'Patient association demands answers', 'Pressure to inform patients; the DPO must frame what can be said.', {
            from_name: 'Marc Lemaire', from_email: 'president@hope-oncology.example', to: 'contact@stonawave.example', cc: 'dpo@stonawave.example',
            subject: 'Our members\' data - request for information under the GDPR',
            body: '<p>Madam, Sir,</p><p>Several of our members took part in your early access programme. The press says their files are online. We ask you to tell us today which data is affected, what you are doing, and how patients will be informed.</p><p>We will publish a statement at 14:00.</p><p>Marc Lemaire<br>President, Hope Oncology</p>' }],
          [112, 'post_linkedin', null, 'delta', 'communication', 'LinkedIn post from an expert', 'An expert voice frames the story; the company still has not spoken.', {
            display_name: 'Elise Warren', title: 'Incident response lead at Delta Advisory', avatar_initials: 'EW',
            text: 'Ransomware on a drugmaker is never only an IT problem. The first hours decide three things: whether patients keep getting their treatment, whether the backups are clean, and whether the company speaks first. Thinking of every team working through the night on incidents like this one.',
            date: '15m', reactions_count: 412, comments_count: 37, reposts_count: 21 }],
          [116, 'email_internal', null, 'hr', 'communication', 'No internal message yet', 'Relaunches the communication cell if staff are still without a message.', {
            from_email: 'nathalie.brunet@stonawave.example', to: 'Sofia Rossi', cc: 'Claire Martin',
            subject: 'Still no message to staff - they learn from CNN',
            body: '<p>Sofia,</p><p>It is past 10:00 and employees learn about the leak from CNN. The unions ask for a meeting. Can we send the CEO message now, even short?</p><p>Nathalie</p>' }, true],
          [120, 'email_authority', null, 'ansm', 'legal+business', 'ANSM asks for a shortage risk assessment', 'Health authority: patient safety and shortage declaration.', {
            reference: 'ANSM-RUP-2026-1611', from_name: 'Dr. Laure Fontaine, ANSM', from_email: 'ruptures@ansm.example', to: 'Priya Nair, Head of regulatory affairs - StonaWave',
            subject: 'Shortage risk - three oncology treatments - information requested by 14:00', date: '16 November 2026',
            body: '<p>Madam,</p><p>Following the reports of a production stop at StonaWave, the ANSM asks you to send by 14:00 a shortage risk assessment for your oncology treatments marketed in France: stock available, coverage in weeks, restart date and measures to secure supplies.</p><p>If a shortage risk is confirmed, a formal declaration is required.</p><p>Dr. Laure Fontaine<br>Drug shortage unit, ANSM</p>', severity: 'high' }],
          [124, 'email_authority', null, 'cnil', 'legal', 'CNIL: notification reminder', 'The GDPR clock: 72 hours from awareness of the breach.', {
            reference: 'CNIL-VIOL-2026-88412', from_name: 'CNIL - Data breach desk', from_email: 'violations@cnil.example', to: 'Hugo Lefevre, DPO - StonaWave',
            subject: 'Personal data breach reported in the press - notification expected', date: '16 November 2026',
            body: '<p>Sir,</p><p>The CNIL has noted press reports of a breach involving health data held by StonaWave. We remind you that a notification is due within 72 hours of becoming aware of the breach, with an initial notification possible if the investigation is ongoing.</p><p>Please also tell us whether the persons concerned will be informed, given the sensitivity of health data.</p><p>CNIL</p>', severity: 'high' }],
          [128, 'audio_message', null, 'attacker', 'decision', 'Voice message from the attacker', 'Psychological pressure on the executives; tests the rule of no direct contact.', {
            title: 'Voice message left on the CEO\'s mobile', tts_language: 'en-US',
            text: 'Hello Madame Martin. This is PharmLeaks. You saw the news: two thousand patients are online. Tomorrow at nine it will be twenty thousand, and your oncology trial results will be sent to your competitors. Log in to the chat before midnight. Only you. No lawyers, no police.' }],
          [132, 'email_external', null, 'hospital', 'business', 'Hospital second request, patients rescheduled', 'Relaunches the business continuity cell if the hospital has had no answer.', {
            from_name: 'Dr. Isabelle Roux', from_email: 'i.roux@saint-aurele-hospital.example', to: 'elena.vogel@stonawave.example', cc: 'james.carter@stonawave.example',
            subject: 'Second request - we are rescheduling 12 patients',
            body: '<p>Ms Vogel,</p><p>Without an answer on our Wednesday delivery, we are rescheduling 12 patients this afternoon. Other hospitals in our network are in the same situation. Can you send us a named contact and an emergency ordering procedure?</p><p>Dr. Isabelle Roux</p>' }, true],
          [136, 'internal_memo', null, 'plant', 'business', 'Lyon warehouse: manual temperature log', 'Degraded mode in practice: quality risk on the cold chain.', {
            from_name: 'Greta Hoffmann, Site director, Frankfurt plant', to: 'Business continuity cell',
            subject: 'Cold chain in degraded mode - quality release rules',
            body: '<p>Frankfurt and Lyon quality teams agree on the degraded procedure:</p><ul><li>Temperature read by hand every 30 minutes in the Lyon cold rooms, signed log</li><li>Batches released only with a paper record countersigned by a qualified person</li><li>Priority shipments: three oncology products, list attached</li></ul><p>Capacity: about 40 percent of a normal day. Please confirm the priority hospitals.</p>', classification: 'Internal' }],
          [140, 'post_reddit', null, 'intel', 'it', 'Reddit: researchers analyse the sample', 'Technical details from outside that IT must check.', {
            subreddit: 'r/netsec', author: 'u/malware_unpacked', author_flair: 'Malware analyst', title: 'PharmLeaks StonaWave sample: files show backup console screenshots',
            body: '<p>Went through the StonaWave sample on the leak site. Besides patient files there are screenshots of their backup console dated 15 Nov, 23:50, with online catalogs being deleted. Nothing about the Hyderabad vault though, maybe it was offline.</p>',
            upvotes: 604, comments_count: 73, date: '20 min ago',
            top_comment: { author: 'u/ir_consultant', flair: 'DFIR', text: 'If an offline vault survived, that is the whole game. Check it for implants before restoring anything.', upvotes: 188, date: '11 min ago' } }],
          [144, 'article_press', 'faz', 'faz', 'communication+business', 'FAZ: Frankfurt plant at a standstill', 'German coverage focused on the plant and its staff.', {
            headline: 'Cyberangriff legt StonaWave-Werk in Frankfurt lahm', subheadline: 'Zwei Produktionslinien fuer Krebsmedikamente stehen still. Die Belegschaft wartet auf Informationen.',
            author: 'Von Jonas Reinhardt, Frankfurt', date: '16.11.2026', time: clock(144),
            body: '<p>Im Frankfurter Werk des Pharmakonzerns StonaWave stehen seit Montagmorgen zwei Produktionslinien still. Mitarbeiter berichten von Erpresserbotschaften auf den Bildschirmen.</p><p>Eine Stellungnahme des Unternehmens lag bis zum Mittag nicht vor.</p>' }],
          [152, 'email_internal', null, 'insurer', 'legal', 'Insurer still without notice of claim', 'Relaunches the legal cell on the insurance notification.', {
            from_name: 'Aline Garnier', from_email: 'a.garnier@northbridge-cyber.example', to: 'laura.schmidt@stonawave.example', cc: '',
            subject: 'Follow-up - notice of claim NBC-7720 not received',
            body: '<p>Dear Ms Schmidt,</p><p>We have not received your notice of claim yet. Our panel negotiator and forensic firm are on standby. Please confirm today, as costs incurred without our agreement may not be covered.</p><p>Aline Garnier</p>' }, true],
          [150, 'email_internal', null, 'delta', 'it', 'Hyderabad backups confirmed clean', 'The recovery path opens: sequence and conditions.', {
            from_name: 'Elise Warren', from_email: 'elise.warren@delta-advisory.example', to: 'Sophie Delacroix; Thomas Bergmann; Ravi Menon', cc: '',
            subject: 'Hyderabad vault clean - proposed recovery sequence',
            body: '<p>All,</p><p>The immutable copies in the Hyderabad vault (13 November, 02:00) are clean: no implant, no attacker account, checksums verified.</p><p><strong>Proposed sequence:</strong></p><ol><li>Tonight: rebuild Active Directory in a clean room</li><li>Tuesday: ERP restore and order backlog reconciliation</li><li>Wednesday: MES Frankfurt, line 3 first</li></ol><p>Three days of data will have to be entered again. Nothing goes back on the network without new credentials and EDR.</p><p>Elise Warren</p>',
            attachment_name: 'Recovery_sequence_v1.pdf' }],
          [155, 'press_release', null, 'pressoffice', 'communication', 'StonaWave statement (draft for validation)', 'The public statement the cells must validate and send.', {
            organization: 'StonaWave', date: `Paris, November 16, 2026, ${clock(155)} CET`,
            title: 'StonaWave provides an update on the cyberattack affecting its operations',
            body: '<p>StonaWave confirms that it is the victim of a cyberattack detected early on 16 November. The group immediately isolated its systems and is working with cybersecurity experts and the authorities, including ANSSI.</p><p>Patient safety is our priority: deliveries of critical oncology treatments continue in degraded mode and every hospital customer has a dedicated contact.</p><p>Data was stolen and part of it published. We are notifying the competent authorities and will inform the people concerned directly.</p>',
            contact_name: 'StonaWave Press Office', contact_email: 'press@stonawave.example', contact_phone: '+33 1 55 00 00 00' }],
          [160, 'article_press', 'ft', 'ft', 'decision+communication', 'Financial Times: markets and the ransom question', 'Investors and the ransom question: the committee position is tested.', {
            headline: 'StonaWave shares fall as hackers demand $18mn ransom', subheadline: 'Drugmaker says patient safety is its priority but will not say whether it will pay.',
            author: 'Oliver Grant', date: 'November 16 2026',
            body: '<p>Shares in StonaWave fell 7 per cent in Paris on Monday after the French drugmaker confirmed a cyberattack that halted two production lines and exposed patient data.</p><p>Analysts said the key question was whether the company had clean backups. People familiar with the matter said the board would meet in the afternoon.</p>' }],
          [165, 'email_external', null, 'medichem', 'business', 'MediChem confirms packaging capacity', 'A partner solution with conditions to accept.', {
            from_email: 'david.chen@medichem-mfg.example', to: 'james.carter@stonawave.example', cc: 'anika.patel@stonawave.example',
            subject: 'Packaging slots confirmed from Wednesday - conditions',
            body: '<p>James,</p><p>We can pack 25,000 units of your two priority products from Wednesday. Conditions: paper batch records signed by your qualified person, no network connection between our sites until your ERP is validated, and a written quality agreement by tomorrow.</p><p>David</p>' }],
          [170, 'sms_notification', null, 'attacker', 'decision', 'Attacker SMS: countdown', 'Last pressure before the end: the committee must hold its position.', {
            sender: '+44 7700 900418', text: 'PharmLeaks: 61 hours left. We know you found backups. Backups do not unpublish patients. Chat key CC-4481.', device: 'iphone' }],
          [175, 'internal_memo', null, 'soc', all, 'Situation report and handover', 'Closes the exercise: status, priorities, handover.', {
            from_name: 'Karim Benali, SOC night-shift lead', to: 'All cells', subject: 'Situation report 11:25 - handover to the recovery teams',
            body: '<p><strong>Status at 11:25</strong></p><ul><li>All sites isolated, domain admin accounts reset, no new encryption since 10:05</li><li>Hyderabad vault clean; Active Directory rebuild tonight</li><li>ANSSI, CNIL, ANSM and insurer notified or in progress</li><li>Critical oncology deliveries running in degraded mode</li></ul><p><strong>Next operational period:</strong> recovery teams take over at 11:30; next crisis committee at 14:00; next staff and media update at 15:00.</p>', classification: 'Confidential' }]
        ];

        injectSpecs.sort((a, b) => a[0] - b[0]);
        const cellIdsFor = (value) => value === all ? SB_ALL_CELLS_DEMO : value.split('+').map((key) => cellByKey[key]?.id).filter(Boolean).join('+');
        const SB_ALL_CELLS_DEMO = typeof SB_ALL_CELLS !== 'undefined' ? SB_ALL_CELLS : 'all';
        const stimuli = injectSpecs.map(([minute, channel, templateId, actorKey, cells, title, intent, content, nudge]) => {
          const actor = actorByKey[actorKey];
          const stimulus = makeStimulus(channel, actor.id, minute, templateId);
          const fields = stimulus.fields;
          if ('from_name' in fields) fields.from_name = channel === 'internal_memo' && actor.title ? `${actor.name}, ${actor.title}` : actor.name;
          if ('sender' in fields) fields.sender = actor.name;
          if (typeof sbSetClockFields === 'function') sbSetClockFields(stimulus, scenario);
          if ('time' in fields && !('time' in content) && channel !== 'breaking_news_tv') fields.time = clock(minute);
          if (channel === 'breaking_news_tv') fields.time = clock(minute);
          Object.assign(fields, content);
          stimulus.name = title;
          stimulus.status = minute <= 60 ? 'validated' : 'draft';
          stimulus.cell_id = cellIdsFor(cells);
          stimulus._demo = { title, intent, nudge: nudge === true };
          return stimulus;
        });
        scenario.stimuli = stimuli;
        scenario.storyboard_versions = [];

        if (hasModel) {
          const storyboard = sbEmptyStoryboard(180);
          storyboard.tracks = sbDefaultTracks(['main']);
          storyboard.cast = actors.map((actor) => sbMakeCast({ id: `cast_demo_${actor.id.replace('actor_demo_', '')}`, label: actor.title, role: actor.role, organization: actor.organization, description: actor.name, actor_id: actor.id }));
          const castFor = (actorId) => storyboard.cast.find((cast) => cast.actor_id === actorId)?.id || '';
          const objectiveList = scenario.scenario.objectives.split('\n');
          storyboard.blocks = phaseSpecs.map((spec, index) => sbMakeBlock(spec.type, {
            id: `block_demo_${index + 1}`, title: spec.title, track_id: sbMainTrack(storyboard).id, start_minutes: spec.start, duration_minutes: spec.duration,
            brief: spec.brief, narrative: spec.narrative, status: 'validated',
            objectives: spec.objectives.map((item) => objectiveList[item]),
            events: spec.events.map(([at, text], eventIndex) => ({ id: `event_demo_${index + 1}_${eventIndex + 1}`, offset_minutes: at, text }))
          }, storyboard));
          for (const stimulus of stimuli) {
            const minute = stimulus.timestamp_offset_minutes;
            const block = storyboard.blocks.find((item) => minute >= item.start_minutes && minute < item.start_minutes + item.duration_minutes) || storyboard.blocks[storyboard.blocks.length - 1];
            const beat = sbMakeBeat({
              offset_minutes: minute - block.start_minutes, channel: stimulus.channel, template_id: stimulus.template_id,
              cast_id: castFor(stimulus.actor_id), cell_id: stimulus.cell_id, title: stimulus._demo.title, intent: stimulus._demo.intent,
              ...(stimulus._demo.nudge ? { kind: 'nudge' } : {})
            });
            block.beats.push(beat);
            stimulus._link = { block, beat };
          }
          storyboard.blocks.forEach((block) => {
            block.stimuli_target = block.beats.length;
            block.key_cast = [...new Set(block.beats.map((beat) => beat.cast_id).filter(Boolean))];
          });
          storyboard.meta.synopsis = scenario.scenario.summary;
          storyboard.meta.threat = 'PharmLeaks: contractor VPN access without MFA, Kerberoasting to domain admin, backup catalogs deleted, 1.9 TB exfiltrated, double extortion and resale of the data.';
          storyboard.meta.brief = 'Three-hour executive exercise for StonaWave. Five cells play in parallel from the crisis room: executive committee, IT & security, communication, legal & compliance, business continuity. Players are experienced managers; the animation team plays the attacker, the press, the authorities, hospitals, patients and partners. The attacker escalates in the second hour; the exercise ends with the handover to the recovery teams.';
          scenario.storyboard = storyboard;
          for (const stimulus of stimuli) {
            const { block, beat } = stimulus._link;
            delete stimulus._link;
            delete stimulus._demo;
            if (typeof sbStampStimulus === 'function') sbStampStimulus(stimulus, block, beat, storyboard, scenario);
          }
          scenario.scenario.phases = sbDerivePhases(storyboard);
          sbSealLinks(scenario);
          storyboard.meta.validated_rev = storyboard.rev;
          if (typeof bfFramingPrints === 'function') {
            scenario.framing_validation = { at: '2026-11-02T16:00:00.000Z', version_id: '', prints: bfFramingPrints(scenario) };
          }
        } else {
          stimuli.forEach((stimulus) => { delete stimulus._demo; });
        }

        // ── Evaluation, debriefs and checklist ───────────────────────────────
        const criteria = {
          decision: [['Decision', 'The crisis level is declared and the incident response retainer activated within 30 minutes', 'Time of the decision; who decided; how it was shared'], ['Extortion', 'A clear position on the ransom is taken with legal and the insurer, without direct contact with the attacker', 'Rationale recorded; no private reply to the attacker'], ['Arbitration', 'The isolation trade-off is decided before 10:00 with its business cost', 'Go or no-go recorded with owner and time']],
          it: [['Containment', 'Isolation decided and executed while protecting Hyderabad', 'Links cut, admin accounts reset, order of actions'], ['Backups', 'No restore before the backups are proven clean', 'Integrity checks requested; clean-room approach'], ['Situation picture', 'Technical facts shared with the other cells in plain words', 'Status updates every 30 minutes']],
          communication: [['Staff', 'A first message reaches staff within the hour', 'Content: what to do, what not to post, who to call'], ['Media', 'The statement is factual, patient-focused and does not deny the data theft', 'Holding statement ready before the TV breaking news'], ['Social networks', 'Posts from patients and experts are monitored and answered consistently', 'Owner of social listening; answers validated']],
          legal: [['Notifications', 'ANSSI, CNIL and ANSM are notified on time with the right content', 'NIS2 early warning; GDPR 72-hour clock; shortage declaration'], ['Insurance', 'The insurer is notified and its panel involved before any negotiation', 'Notice of claim sent; costs pre-approved'], ['Evidence', 'Decisions and evidence are logged for later proceedings', 'Decision log; evidence preservation instruction']],
          business: [['Patients', 'Critical oncology deliveries are prioritised and hospitals get a named contact', 'Priority list; answer to Saint-Aurele hospital'], ['Degraded mode', 'Production and cold chain run on paper with quality controls', 'Manual temperature log; release by a qualified person'], ['Partners', 'The MediChem offer is assessed and answered with security conditions', 'Decision before 15:00; no network reconnection']]
        };
        const ratings = { decision: ['S', 'M', 'S'], it: ['P', 'S', 'M'], communication: ['M', 'S', 'U'], legal: ['S', 'M', 'S'], business: ['P', 'S', 'S'] };
        const evaluators = { decision: 'Paul Desmarais', it: 'Lucas Ferrand', communication: 'Ines Carvalho', legal: 'Maya Okonkwo', business: 'Maya Okonkwo' };
        const sheets = {};
        for (const [key, rows] of Object.entries(criteria)) {
          const cell = cellByKey[key];
          sheets[cell.id] = {
            criteria: rows.map(([category, text, observe], index) => ({ id: `crit_demo_${key}_${index + 1}`, category, text, observe, rating: ratings[key][index], notes: '' })),
            injects: {}, evaluator: evaluators[key],
            strengths: key === 'business' ? 'Quick priority list of oncology treatments; hospitals called back by name.' : '',
            improvements: key === 'communication' ? 'The first staff message came after the TV breaking news.' : ''
          };
        }
        scenario.evaluation = typeof normalizeEvaluation === 'function' ? normalizeEvaluation({ sheets }) : { sheets };
        const slideDebrief = {
          title: 'Operation Cold Chain: debrief',
          subtitle: 'StonaWave crisis exercise, 16 November 2026',
          key_messages: 'Patients first: every decision was weighed against treatment continuity\nIsolate early: protecting Hyderabad saved the clean backups\nOne voice: staff must hear the news from us, before TV\nThe ransom does not stop the leak: the data was on sale anyway\nRegulatory clocks start at discovery: ANSSI, CNIL, ANSM and the insurer',
          went_well: 'Isolation decided before 10:00 with its business cost stated\nPriority list of oncology treatments drawn up in 20 minutes\nNo direct contact with the attacker',
          to_improve: 'First staff message sent after the leak reached TV\nInsurer notified late, after a reminder\nNo shared situation board between cells during the first hour',
          recommendations: 'Enforce MFA on every contractor access (CIO, 1 month)\nPre-approved holding statements for a data leak (Communication, 6 weeks)\nNotification matrix with deadlines and owners (General counsel, 1 month)',
          next_steps: 'Exercise report to the executive committee within two weeks\nAction plan follow-up at the next security committee\nTechnical recovery exercise from the Hyderabad vault in Q1'
        };
        scenario.slide_debrief = typeof normalizeSlideDebrief === 'function' ? normalizeSlideDebrief(slideDebrief) : slideDebrief;
        scenario.checklist = normalizeChecklist({ checked: { playability_0: true, playability_1: true, playability_2: true, observation_0: true, realism_0: true, realism_1: true } });
        scenario.debrief = buildDebriefFromScenario(scenario);
        scenario.video_debrief = normalizeVideoDebrief({ source_material: scenario.scenario.summary }, 'en');
        return scenario;
      }

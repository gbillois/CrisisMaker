/* Built-in Scenario Builder library: ready-made crisis storyboards (English). */
const SCENARIO_LIBRARY = [
  {
    id: 'ransomware-double-extortion',
    name: 'Ransomware with double extortion',
    category: 'Cyber attack',
    icon: 'lock',
    duration_minutes: 180,
    summary: 'In the early hours, a ransomware affiliate that has been inside the network for three weeks encrypts servers across the organisation, including the virtualisation clusters and file shares. Before detonating, the group quietly exfiltrated several hundred gigabytes of HR, finance and customer data, which it threatens to publish on its leak site unless a ransom is paid within 72 hours. The crisis cell must keep critical activities running without trusted IT, take a documented position on the ransom under pressure from executives and the insurer, and meet NIS2 and GDPR deadlines while journalists pick up the leak-site listing. Backups turn out to be only partially usable, forcing hard choices about what is rebuilt first.',
    threat: 'The ransomware-as-a-service affiliate "Obsidian Ledger" entered through an unpatched VPN appliance with stolen credentials, escalated to domain administrator, exfiltrated about 380 GB of data and pushed the encryptor through group policy. Impact: most Windows servers encrypted, business applications down and a public leak threatened.',
    tags: ['ransomware', 'double extortion', 'GDPR', 'NIS2', 'backups', 'ransom payment'],
    objectives: [
      'Qualify the incident quickly and activate the crisis organisation with clear roles, a decision log and a battle rhythm',
      'Decide on isolation measures (Internet cut-off, VPN shutdown, Active Directory containment) while weighing their business cost',
      'Take and document a position on ransom payment and any contact with the attackers, involving the insurer, legal counsel and executive leadership',
      'Meet regulatory obligations on time: NIS2 early warning within 24 hours, GDPR notification within 72 hours, criminal complaint',
      'Keep internal, customer and media communication consistent as the leak becomes public',
      'Prioritise the restoration of critical business processes and define explicit exit criteria for the crisis'
    ],
    cast: [
      { key: 'soc', label: 'SOC analyst on duty', role: 'internal', organization: 'The organisation', description: 'Night-shift analyst who sees the EDR console light up and escalates the first alerts.' },
      { key: 'ciso', label: 'Chief Information Security Officer', role: 'internal', organization: 'The organisation', description: 'Leads the technical investigation and relays forensic findings to the crisis cell.' },
      { key: 'cio', label: 'Chief Information Officer', role: 'internal', organization: 'The organisation', description: 'Owns the infrastructure, the isolation options and the restoration plan.' },
      { key: 'ceo', label: 'Chief Executive Officer', role: 'internal', organization: 'The organisation', description: 'Chairs the strategic crisis cell and wants fast, simple answers.' },
      { key: 'comms', label: 'Communication director', role: 'internal', organization: 'The organisation', description: 'Drafts holding statements and handles incoming media requests.' },
      { key: 'dpo', label: 'Data Protection Officer', role: 'internal', organization: 'The organisation', description: 'Assesses the personal data impact and owns the GDPR notification.' },
      { key: 'legal', label: 'General counsel', role: 'internal', organization: 'The organisation', description: 'Advises on sanctions, contractual exposure, complaints and evidence.' },
      { key: 'attacker', label: 'Obsidian Ledger', role: 'attacker', organization: 'Ransomware group', description: 'Professional extortion crew using a leak site and direct pressure on executives.' },
      { key: 'journalist', label: 'Cybersecurity journalist', role: 'journalist', organization: 'News outlet', description: 'Monitors leak sites, breaks the story online and follows it for business and TV news.' },
      { key: 'agency', label: 'National cybersecurity agency', role: 'authority', organization: 'National CSIRT', description: 'Receives the NIS2 notification and offers technical support.' },
      { key: 'client', label: 'Key account customer', role: 'client_b2b', organization: 'Major B2B customer', description: 'Large customer whose supply chain depends on the organisation\'s deliveries and interconnections.' },
      { key: 'insurer', label: 'Cyber insurer incident manager', role: 'partner', organization: 'Cyber insurance carrier', description: 'Activates the incident response panel and sets conditions on any ransom discussion.' }
    ],
    tracks: ['main', 'governance', 'communication', 'legal', 'business'],
    blocks: [
      {
        key: 'trigger',
        type: 'trigger',
        title: 'Encryption strikes at dawn',
        track: 'main',
        start: 0,
        duration: 20,
        stimuli: 3,
        brief: 'Open the exercise with scattered technical signals that quickly converge into an obvious ransomware attack.',
        narrative: 'At 05:40 the EDR raises hundreds of alerts on file servers while the first shift arrives to find business applications unreachable. Players only see symptoms: nobody yet knows the entry point, the scope or that data has already left the network. The expected decisions are to qualify the event as a major incident, alert the on-call chain and convene the crisis cell rather than keep troubleshooting.',
        objectives: [0],
        events: [
          { at: 0, text: 'Before dawn, an encryptor pushed through group policy starts locking file servers and virtualisation clusters' },
          { at: 10, text: 'Staff arriving for the first shift find workstations and shared drives unusable; the helpdesk queue explodes' }
        ],
        beats: [
          { at: 0, channel: 'sms_notification', cast: 'soc', cell: 'it', title: 'EDR alert storm on file servers', intent: 'Automated SMS escalation: 400+ critical EDR alerts in ten minutes on file servers and hypervisors. Forces the on-call chain to decide whether this is a false positive or a major incident.' },
          { at: 7, channel: 'email_internal', cast: 'cio', cell: 'operational', title: 'Business applications down on every site', intent: 'The CIO reports that ERP, email and the order portal are unreachable and asks who is authorised to shut systems down. Creates pressure to name a crisis lead.' },
          { at: 14, channel: 'email_internal', cast: 'soc', cell: 'decision', title: 'Ransom note found on the servers', intent: 'The analyst forwards the ransom note left on every server: data stolen, contact via a Tor chat within 72 hours. Confirms ransomware and hints at extortion.' }
        ]
      },
      {
        key: 'investigation',
        type: 'investigation',
        title: 'Scoping the intrusion',
        track: 'main',
        start: 20,
        duration: 30,
        stimuli: 3,
        brief: 'Shift players from reaction to structured investigation and reveal that the incident is also a data breach.',
        narrative: 'Forensics points to the VPN appliance and a domain administrator account compromised three weeks ago. The insurer\'s panel is ready to deploy but sets conditions. Firewall logs reveal a large outbound transfer to a cloud storage provider, turning a technical outage into a data breach. Players must decide whom to bring in, what evidence to preserve and whether to start the GDPR clock now.',
        objectives: [0, 3],
        events: [
          { at: 0, text: 'Encryption stops spreading, but most Windows servers and business applications remain down' },
          { at: 15, text: 'Forensic images of the VPN appliance and domain controllers are taken for analysis' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ciso', cell: 'it', title: 'First findings: the VPN was the door', intent: 'The CISO shares early evidence of VPN exploitation and a compromised domain admin account. Raises the question of trusting Active Directory at all.' },
          { at: 10, channel: 'email_external', cast: 'insurer', cell: 'legal', title: 'Insurer activates its response panel', intent: 'The insurer confirms coverage subject to conditions: use panel responders, preserve evidence, no contact with attackers without prior agreement. Constrains the cell\'s freedom of action.' },
          { at: 21, channel: 'email_internal', cast: 'soc', cell: 'legal', title: '380 GB left the network ten days ago', intent: 'Firewall logs show 380 GB uploaded to a cloud storage service over two nights. Players must treat the case as a personal data breach and involve the DPO.' }
        ]
      },
      {
        key: 'containment',
        type: 'containment',
        title: 'Pulling the plug',
        track: 'main',
        start: 50,
        duration: 25,
        stimuli: 3,
        brief: 'Force an explicit containment decision with a visible business cost.',
        narrative: 'The CIO presents isolation options, from cutting Internet access to shutting down all interconnections with customers and subsidiaries. Every option stops a business flow, and a key customer is already asking whether it is at risk. The national agency offers help but needs indicators of compromise. The dilemma is speed versus disruption: containing too little risks re-encryption, containing too much halts deliveries.',
        objectives: [1, 3],
        events: [
          { at: 0, text: 'The organisation still runs with Internet access, remote VPN and partner interconnections open' },
          { at: 12, text: 'Attacker tooling is seen probing surviving servers, raising fears of a second encryption wave' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'cio', cell: 'decision', title: 'Three isolation scenarios and their cost', intent: 'The CIO proposes full Internet cut-off, partial segmentation or keeping partner links open, each with an estimated revenue impact. Requires a documented decision from the crisis cell.' },
          { at: 10, channel: 'email_authority', cast: 'agency', cell: 'it', title: 'Agency offers support and asks for IoCs', intent: 'The national CSIRT has seen the same group elsewhere and asks for indicators and a point of contact. Reminds players that the NIS2 early warning is expected within 24 hours.' },
          { at: 18, channel: 'email_external', cast: 'client', cell: 'business', title: 'Customer threatens to cut the interconnection', intent: 'A key account asks for written assurance that its EDI link is safe, otherwise it disconnects within the hour. Forces a customer answer before facts are known.' }
        ]
      },
      {
        key: 'leak-countdown',
        type: 'twist',
        title: 'The leak-site countdown',
        track: 'main',
        start: 75,
        duration: 25,
        stimuli: 4,
        brief: 'Escalate: the extortion goes public and pressure shifts to the executives.',
        narrative: 'Obsidian Ledger lists the organisation on its leak site with a 72-hour countdown and screenshots of payslips and customer contracts. The group phones the CEO directly with a recorded message, while a journalist relays the listing on social media. The CEO asks bluntly whether paying would make the problem disappear. Players must avoid improvised contact, frame the ransom decision properly and prepare for the story going public.',
        objectives: [2, 4],
        events: [
          { at: 0, text: 'The extortion goes public: the group shifts pressure from IT to the executives and the outside world' },
          { at: 14, text: 'Screenshots of payslips and customer contracts circulate among threat-intel accounts on social media' }
        ],
        beats: [
          { at: 0, channel: 'dark_web_forum', cast: 'attacker', cell: 'operational', title: 'Listed on the leak site with a 72h timer', intent: 'Leak-site post naming the organisation, showing redacted payslips and customer contracts, with a countdown and a price. Makes the data theft undeniable.' },
          { at: 6, channel: 'audio_message', cast: 'attacker', cell: 'decision', title: 'Voice message left for the CEO', intent: 'A calm, rehearsed voice tells the CEO that a discount is available if the call is returned within 12 hours and that customers will be contacted next. Tests whether executives resist direct engagement.' },
          { at: 12, channel: 'post_twitter', cast: 'journalist', cell: 'communication', title: 'Journalist relays the leak listing', intent: 'A well-followed journalist posts a screenshot of the listing and asks the organisation to comment. Starts the public clock on communication.' },
          { at: 19, channel: 'email_internal', cast: 'ceo', cell: 'decision', kind: 'nudge', title: 'CEO presses for a ransom position', intent: 'The CEO chases the cell for a documented ransom position: amount demanded, insurer and legal constraints, and whether paying would really stop the leak. Relaunches a stalled decision.' }
        ]
      },
      {
        key: 'eradication',
        type: 'eradication',
        title: 'Rebuilding a trusted core',
        track: 'main',
        start: 100,
        duration: 25,
        stimuli: 2,
        brief: 'Confront players with the limits of their backups and the risk of reinfection.',
        narrative: 'Restoration tests show that only about 60% of backups are clean: the attackers deleted snapshots and encrypted the backup catalogue. Active Directory must be rebuilt from scratch before anything is restored. A restored server already shows the attackers\' persistence tool. The dilemma is restoring fast to relieve the business versus rebuilding cleanly and slowly.',
        objectives: [1, 5],
        events: [
          { at: 0, text: 'Restore tests begin; the attackers had deleted snapshots and encrypted the backup catalogue' },
          { at: 10, text: 'Rebuild of a clean Active Directory forest starts in an isolated environment' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ciso', cell: 'operational', title: 'Backups only partially usable', intent: 'The CISO reports that immutable backups cover 60% of critical servers and that Active Directory must be rebuilt. Forces prioritisation of what gets restored first.' },
          { at: 14, channel: 'email_internal', cast: 'soc', cell: 'it', title: 'Persistence found on a restored server', intent: 'A freshly restored server beacons to the attackers\' infrastructure. Highlights the cost of rushing and the need for a clean restoration process.' }
        ]
      },
      {
        key: 'continuity',
        type: 'continuity',
        title: 'Running the business on paper',
        track: 'main',
        start: 125,
        duration: 20,
        stimuli: 3,
        brief: 'Test degraded-mode operations and their limits once the outage lasts.',
        narrative: 'Sites switch to paper order forms and phone confirmations, but invoicing and payroll are frozen. A key customer invokes contractual penalties and the story reaches the business press. Players must decide which activities to protect, which commitments to renegotiate and how long degraded mode can be sustained.',
        objectives: [4, 5],
        events: [
          { at: 0, text: 'Sites switch to paper order forms and phone confirmations; invoicing and payroll are frozen' },
          { at: 10, text: 'Delivery delays pile up for key accounts as manual processing reaches its limits' }
        ],
        beats: [
          { at: 0, channel: 'internal_memo', cast: 'cio', cell: 'business', title: 'Degraded-mode instructions for all sites', intent: 'Draft memo listing manual procedures and the few systems still available. Tests whether continuity plans exist and are realistic.' },
          { at: 8, channel: 'email_external', cast: 'client', cell: 'business', title: 'Customer invokes SLA penalties', intent: 'The key account notifies late deliveries and reserves its right to penalties and to switch supplier. Raises the question of commercial gestures.' },
          { at: 15, channel: 'article_press', cast: 'journalist', cell: 'communication', title: 'Operations disrupted, stolen data online', intent: 'Business article citing employees and the leak site, questioning the organisation\'s cyber maturity. Tests message consistency with the official line.' }
        ]
      },
      {
        key: 'recovery',
        type: 'recovery',
        title: 'Day +3: restoring priority services',
        track: 'main',
        start: 145,
        duration: 20,
        stimuli: 2,
        brief: 'Compress time to Day +3 and test the go/no-go on the first restoration wave while the leak materialises.',
        narrative: 'Simulated time jumps to Day +3. A clean core is ready and the CIO seeks approval to restore ERP and payroll. The countdown has expired without payment and the group publishes a first sample of HR files. Players must decide on employee notification, monitoring of the leak and the pace of reopening.',
        objectives: [3, 5],
        events: [
          { at: 0, text: 'Day +3: a clean core infrastructure is ready and the ransom deadline has passed without payment' },
          { at: 5, text: 'Employees ask their managers whether their payslips and ID documents are among the stolen files' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'cio', cell: 'decision', title: 'Go/no-go for restoration wave 1', intent: 'The CIO presents the wave 1 plan (ERP, payroll, email) with residual risks. Requires an explicit risk acceptance by the cell.' },
          { at: 9, channel: 'dark_web_forum', cast: 'attacker', cell: 'hr', title: 'First data sample published', intent: 'The group publishes 12 GB of HR files, including ID scans. Triggers notification of affected employees and an update to the data protection authority.' }
        ]
      },
      {
        key: 'exit',
        type: 'exit',
        title: 'Day +10: stepping down the crisis cell',
        track: 'main',
        start: 165,
        duration: 15,
        stimuli: 2,
        brief: 'Close the exercise on exit criteria and follow-up obligations.',
        narrative: 'Simulated time jumps to Day +10. Most critical services are back, but monitoring of the leak, regulatory follow-ups and remediation remain. Players must agree on when the crisis ends, who owns what afterwards and what is reported to authorities and the board.',
        objectives: [0, 5],
        events: [
          { at: 0, text: 'Day +10: most critical services are back online and no attacker activity has been seen for several days' },
          { at: 8, text: 'Leak monitoring, regulatory follow-ups and the remediation programme remain open' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ciso', cell: 'decision', title: 'Proposed crisis exit criteria', intent: 'The CISO proposes criteria (clean AD, EDR coverage, no attacker activity for 7 days) and a remediation roadmap. Tests how the cell formalises the end of the crisis.' },
          { at: 7, channel: 'email_authority', cast: 'agency', cell: 'legal', title: 'Final incident report requested', intent: 'The agency requests the NIS2 final report within one month, with root cause and measures. Ensures regulatory follow-up is owned.' }
        ]
      },
      {
        key: 'crisis-cell',
        type: 'crisis_cell',
        title: 'Crisis cell and ransom posture',
        track: 'governance',
        start: 25,
        duration: 70,
        stimuli: 3,
        brief: 'Structure governance and bring the ransom question to a documented decision.',
        narrative: 'The executive crisis cell forms while facts are still thin. Over two hours, the insurer and legal counsel frame what is allowed regarding payment and negotiation. Players must separate strategic and operational cells, keep a decision log and state a clear ransom position with its rationale.',
        objectives: [0, 2],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ceo', cell: 'decision', title: 'CEO convenes the executive crisis cell', intent: 'The CEO calls the executive committee to a crisis room and asks for a first situation report in 30 minutes. Tests activation, roles and meeting rhythm.' },
          { at: 29, channel: 'email_external', cast: 'insurer', cell: 'decision', title: 'Insurer position on the ransom', intent: 'The insurer states it will only consider reimbursement after sanctions screening and via a specialised negotiator. Frames the ransom options.' },
          { at: 55, channel: 'email_internal', cast: 'legal', cell: 'legal', title: 'Sanctions screening on the group', intent: 'Counsel warns that one affiliate of the group may be linked to a sanctioned entity, which could make payment unlawful. Adds a legal constraint to the decision.' }
        ]
      },
      {
        key: 'notification-clock',
        type: 'legal',
        title: 'Notification clocks',
        track: 'legal',
        start: 35,
        duration: 110,
        stimuli: 3,
        brief: 'Make regulatory deadlines visible and test ownership of notifications.',
        narrative: 'The data exfiltration starts the GDPR 72-hour clock and the service disruption triggers NIS2 reporting. Legal counsel also wants a criminal complaint and evidence preservation. Players must notify on time with incomplete information and plan updates.',
        objectives: [3],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'dpo', cell: 'legal', title: 'Stolen-data claim: is the GDPR clock running?', intent: 'The DPO notes that the ransom note claims data theft and asks whether the organisation must already consider itself aware of a breach, proposing to prepare an initial notification with partial facts. Tests the decision to notify early and complete later.' },
          { at: 28, channel: 'email_internal', cast: 'legal', cell: 'legal', kind: 'nudge', title: 'NIS2 early warning still unsigned', intent: 'Counsel reminds the cell that the agency expects the NIS2 early warning within 24 hours and that nobody has yet been named to sign and send it. Relaunches ownership of regulatory notifications.' },
          { at: 73, channel: 'email_internal', cast: 'legal', cell: 'it', title: 'Criminal complaint and evidence chain', intent: 'Counsel asks for disk images and logs to be preserved before reinstallation and proposes filing a complaint today. Creates tension with fast restoration.' }
        ]
      },
      {
        key: 'media',
        type: 'communication',
        title: 'Holding lines under media pressure',
        track: 'communication',
        start: 60,
        duration: 90,
        stimuli: 3,
        brief: 'Test the timing and consistency of public communication.',
        narrative: 'The communication director prepares a holding statement while the story spreads from specialist media to television. Journalists ask precise questions about stolen payroll data. Players must choose when to speak, what to confirm and how to align employees, customers and the press.',
        objectives: [4],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'comms', cell: 'communication', title: 'Holding statement for validation', intent: 'Draft statement mentioning a "technical incident". Players must decide whether to name a cyber attack and whether to mention data theft.' },
          { at: 33, channel: 'breaking_news_tv', cast: 'journalist', cell: 'communication', title: 'Breaking: ransomware halts operations', intent: 'TV ticker reports the attack and a possible data leak affecting employees and customers. Accelerates the need for an official statement.' },
          { at: 66, channel: 'email_external', cast: 'journalist', cell: 'communication', kind: 'nudge', title: 'Journalist calls back on payroll data', intent: 'With earlier requests unanswered, the journalist asks again whether employee bank details are in the leak and whether a ransom was paid, with a one-hour deadline. Tests precision and discipline.' }
        ]
      },
      {
        key: 'customers',
        type: 'customers',
        title: 'Customer and partner fallout',
        track: 'business',
        start: 80,
        duration: 75,
        stimuli: 2,
        brief: 'Bring the customer relationship into the crisis and test proactive outreach.',
        narrative: 'Customers learn about the leak from the press before hearing from the organisation. One asks whether its contracts and contacts are in the stolen data, another publicly announces it has cut links. Players must organise account-by-account outreach and answer consistently.',
        objectives: [4, 5],
        beats: [
          { at: 0, channel: 'email_external', cast: 'client', cell: 'business', title: 'Is our data in the leak?', intent: 'Having seen the leak-site screenshots of customer contracts, the key account asks for a list of its data potentially exfiltrated and for the organisation\'s notification plan. Tests the ability to answer precisely.' },
          { at: 43, channel: 'post_linkedin', cast: 'client', cell: 'business', title: 'Customer CISO posts about cutting links', intent: 'The customer\'s CISO publicly explains they disconnected from a "compromised supplier". Tests reputational response and account management.' }
        ]
      }
    ]
  },
  {
    id: 'personal-data-breach',
    name: 'Personal data breach: customer database for sale',
    category: 'Data',
    icon: 'database',
    duration_minutes: 180,
    summary: 'A threat intelligence provider warns the organisation that a file presented as its customer database, 2.1 million records including contact details, dates of birth, legacy password hashes and partial bank details, is for sale on a dark web forum. No intrusion is found in production: the data comes from a monthly marketing export left in a publicly readable storage bucket by an analytics agency. While the organisation verifies, contains and assesses the risk, criminals use the data for a targeted smishing wave and the story reaches the press. The crisis cell must notify the data protection authority within 72 hours, decide how and when to inform two million customers, and manage a processor that denies responsibility.',
    threat: 'An opportunistic data broker ("k0rrupt") scraped an exposed cloud storage bucket used by a marketing analytics agency and resells the dataset, while buyers launch phishing and credential-stuffing campaigns. Impact: large-scale personal data breach, fraud risk for customers, regulatory and reputational exposure.',
    tags: ['data breach', 'GDPR', 'dark web', 'processor', 'phishing', 'customer communication'],
    objectives: [
      'Verify the authenticity and origin of the leaked data quickly, without alerting the seller or destroying evidence',
      'Contain the exposure (processor storage, credentials, forced password reset) and limit harm to customers',
      'Assess the risk to individuals and meet GDPR obligations: authority notification within 72 hours and communication to data subjects when the risk is high',
      'Manage the relationship and liability with the data processor responsible for the exposure',
      'Communicate proactively and consistently with customers, media and employees while criminals exploit the leak',
      'Absorb the customer care surge and decide on remediation and compensation measures'
    ],
    cast: [
      { key: 'threat_intel', label: 'Threat intelligence analyst', role: 'analyst', organization: 'Threat intelligence provider', description: 'Monitors underground forums on the organisation\'s behalf and raises the first alert.' },
      { key: 'seller', label: 'k0rrupt', role: 'attacker', organization: 'Dark web data broker', description: 'Data broker advertising the database; buyers of the file run smishing with it, and the broker later tries to sell the organisation a paid \'deletion\'.' },
      { key: 'ciso', label: 'Chief Information Security Officer', role: 'internal', organization: 'The organisation', description: 'Leads verification, forensics and containment measures.' },
      { key: 'dpo', label: 'Data Protection Officer', role: 'internal', organization: 'The organisation', description: 'Owns the risk assessment, the authority notification and the letters to data subjects.' },
      { key: 'cmo', label: 'Chief Marketing Officer', role: 'internal', organization: 'The organisation', description: 'Owns the marketing export and the relationship with the analytics agency.' },
      { key: 'ceo', label: 'Chief Executive Officer', role: 'internal', organization: 'The organisation', description: 'Chairs the crisis cell and is under pressure from the board.' },
      { key: 'comms', label: 'Communication director', role: 'internal', organization: 'The organisation', description: 'Handles press relations and public statements.' },
      { key: 'care', label: 'Head of customer care', role: 'internal', organization: 'The organisation', description: 'Runs the contact centre facing worried and angry customers.' },
      { key: 'vendor', label: 'Account director, analytics agency', role: 'partner', organization: 'Marketing analytics agency', description: 'Processor whose misconfigured bucket exposed the data and who is keen to limit its liability.' },
      { key: 'dpa', label: 'Data protection authority case officer', role: 'authority', organization: 'Data protection authority', description: 'Receives the breach notification and follows up with detailed questions.' },
      { key: 'journalist', label: 'Consumer affairs journalist', role: 'journalist', organization: 'National news media', description: 'Has obtained the sample file, verified it with affected customers and covers the story in print and on TV.' },
      { key: 'customer', label: 'Affected customer', role: 'client_b2c', organization: 'Retail customer', description: 'Vocal customer who received a phishing SMS and shares it publicly.' }
    ],
    tracks: ['main', 'governance', 'legal', 'communication', 'business'],
    blocks: [
      {
        key: 'trigger',
        type: 'trigger',
        title: 'For sale: 2.1 million customers',
        track: 'main',
        start: 0,
        duration: 20,
        stimuli: 3,
        brief: 'Start from an external signal the organisation does not control and cannot yet confirm.',
        narrative: 'A threat intelligence provider flags a forum listing claiming to sell the organisation\'s customer base. The sample looks real but nobody knows where it comes from, whether it is recent or whether systems are still compromised. Players must decide how to verify discreetly, who to alert and whether the GDPR clock has started.',
        objectives: [0],
        events: [
          { at: 0, text: 'A customer dataset attributed to the organisation surfaces on an underground forum; its origin and freshness are unknown' },
          { at: 10, text: 'Production systems keep running normally, with no alert raised by security monitoring' }
        ],
        beats: [
          { at: 0, channel: 'email_external', cast: 'threat_intel', cell: 'operational', title: 'Your customer database is for sale', intent: 'The provider shares a link to a forum listing and a 20-line sample with names, emails and order numbers. Forces an initial qualification and escalation decision.' },
          { at: 7, channel: 'dark_web_forum', cast: 'seller', cell: 'it', title: 'Listing: 2.1M fresh customer records', intent: 'Forum post advertising 2.1 million records with dates of birth, MD5 password hashes and partial IBANs, 1,000 free lines as proof. Shows the scale and sensitivity of the data.' },
          { at: 13, channel: 'email_internal', cast: 'ciso', cell: 'decision', title: 'Sample lines match real customers', intent: 'Spot checks show 18 of 20 sample lines match active accounts. Players must decide whether this is now a confirmed breach and activate the crisis cell.' }
        ]
      },
      {
        key: 'investigation',
        type: 'investigation',
        title: 'Is it really ours, and where did it leak?',
        track: 'main',
        start: 20,
        duration: 40,
        stimuli: 4,
        brief: 'Lead players from the assumption of an intrusion to the discovery of a third-party exposure.',
        narrative: 'Production logs show no intrusion, but one column exists only in the monthly marketing export. The CMO reveals that the export is shared with an analytics agency, which admits a test bucket was publicly readable for five months. The DPO concludes the risk to individuals is high. Players must preserve evidence, establish the timeline and prepare for mandatory notifications.',
        objectives: [0, 2, 3],
        events: [
          { at: 0, text: 'Forensic teams comb production logs and database access records for any sign of intrusion' },
          { at: 15, text: 'The seller\'s free sample keeps spreading as other forum members download and repost it' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ciso', cell: 'it', title: 'No trace of intrusion in production', intent: 'Forensics finds no compromise of the customer database, but the file contains a "segment_score" column only present in marketing exports. Points investigators to a copy of the data.' },
          { at: 12, channel: 'email_internal', cast: 'cmo', cell: 'operational', title: 'Monthly export shared with an agency', intent: 'The CMO explains that a full export is sent every month to an analytics agency, a practice nobody formally reviewed. Raises questions of data minimisation and governance.' },
          { at: 24, channel: 'email_external', cast: 'vendor', cell: 'business', title: 'Agency admits a public test bucket', intent: 'The agency confirms a test bucket was publicly readable since spring but insists it held "test data only". Tests how players challenge a processor.' },
          { at: 34, channel: 'email_internal', cast: 'dpo', cell: 'decision', title: 'Risk assessment: high risk to individuals', intent: 'The DPO rates the risk as high because of dates of birth, weak password hashes and partial IBANs, which means individuals must be informed. Sets up the notification decision.' }
        ]
      },
      {
        key: 'containment',
        type: 'containment',
        title: 'Closing the leak',
        track: 'main',
        start: 60,
        duration: 30,
        stimuli: 3,
        brief: 'Force concrete containment choices whose side effects affect customers and the processor relationship.',
        narrative: 'The bucket is closed but the data is out. The CISO proposes a forced password reset for every account, which would flood the contact centre. The agency asks not to be named publicly, while first worried customers already call. Players must balance protection of customers against operational strain and relationship management.',
        objectives: [1, 3],
        events: [
          { at: 0, text: 'The exposed bucket is finally closed, but copies of the dataset are already in criminal hands' },
          { at: 15, text: 'Suspicious messages quoting real order numbers start reaching a first handful of customers' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ciso', cell: 'decision', title: 'Force a reset for 2.1 million accounts?', intent: 'Options: forced reset for all accounts, targeted reset for reused passwords, or monitoring only, with estimated impact on logins and the contact centre. Requires a decision.' },
          { at: 11, channel: 'email_external', cast: 'vendor', cell: 'communication', title: 'Agency asks not to be named', intent: 'The agency requests that its name be kept out of any communication and proposes a joint statement minimising the incident. Tests independence and transparency.' },
          { at: 21, channel: 'email_internal', cast: 'care', cell: 'business', title: 'First worried customers on the phone', intent: 'Agents receive calls from customers who got suspicious messages quoting their order numbers, early signs the data is being used. The contact centre asks what to say before any official line exists.' }
        ]
      },
      {
        key: 'phishing-wave',
        type: 'twist',
        title: 'Phishing wave hits customers',
        track: 'main',
        start: 90,
        duration: 25,
        stimuli: 4,
        brief: 'Escalate: the leak becomes visible harm to customers and a public story.',
        narrative: 'Criminals who bought the file send a smishing campaign impersonating the organisation. A customer posts the message on social media and it goes viral. The seller then contacts the organisation offering to "delete" the data for a fee, and a news channel runs the story. Players must warn customers fast, refuse or handle the extortion attempt and align all channels.',
        objectives: [1, 4],
        events: [
          { at: 0, text: 'Buyers of the file launch a mass smishing campaign spoofing the organisation\'s name and a fake login page' },
          { at: 12, text: 'The story spreads on social media and reaches newsrooms while copycat phishing pages multiply' }
        ],
        beats: [
          { at: 0, channel: 'sms_notification', cast: 'seller', cell: 'operational', title: 'Smishing: "Your account is suspended"', intent: 'Fraudulent SMS sent by buyers of the file, spoofing the organisation and quoting the customer\'s name and last order number, with a link to a fake login page. Shows concrete harm and the urgency of a customer warning.' },
          { at: 7, channel: 'post_twitter', cast: 'customer', cell: 'communication', title: 'Customer shares the phishing SMS', intent: 'A customer posts a screenshot asking whether the brand leaked her data, gaining thousands of shares. Tests social media response before the official statement.' },
          { at: 14, channel: 'dark_web_forum', cast: 'seller', cell: 'decision', title: 'Seller offers paid "exclusive deletion"', intent: 'The seller posts that the organisation can buy the file back for exclusive deletion, otherwise it goes free in 48 hours. Creates an extortion dilemma with no guarantee.' },
          { at: 20, channel: 'breaking_news_tv', cast: 'journalist', cell: 'communication', title: 'Millions of customer records leaked', intent: 'News ticker reports a massive leak and a phishing campaign targeting customers. Raises the pressure for a public statement and executive visibility.' }
        ]
      },
      {
        key: 'continuity',
        type: 'continuity',
        title: 'Keeping online sales open',
        track: 'main',
        start: 115,
        duration: 25,
        stimuli: 3,
        brief: 'Test business trade-offs between revenue, customer trust and operational capacity.',
        narrative: 'A major promotional campaign is scheduled for tomorrow and would reach customers already bombarded by phishing. The contact centre is saturated and the board raises compensation. Players must decide whether to freeze marketing, how to scale customer care and what gesture, if any, to offer.',
        objectives: [5],
        events: [
          { at: 0, text: 'Contact centre queues keep growing as phishing and account takeover reports pile up' },
          { at: 12, text: 'A major promotional campaign due tomorrow is still scheduled to reach every customer' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'cmo', cell: 'business', title: 'Tomorrow\'s campaign: keep or freeze?', intent: 'The CMO asks whether to maintain a campaign worth a significant share of the monthly revenue, which customers may mistake for phishing. Forces a business decision.' },
          { at: 9, channel: 'email_internal', cast: 'care', cell: 'operational', kind: 'nudge', title: 'Contact centre still without a FAQ', intent: 'Waiting time reaches 40 minutes, agents give contradictory answers and the FAQ requested earlier has still not arrived. The head of care asks again for it and for extra staff.' },
          { at: 17, channel: 'email_internal', cast: 'ceo', cell: 'decision', title: 'Should we offer compensation?', intent: 'The CEO asks the cell to cost options: voucher, free identity monitoring or nothing. Tests the link between remediation, liability and reputation.' }
        ]
      },
      {
        key: 'recovery',
        type: 'recovery',
        title: 'Day +2: notifying two million people',
        track: 'main',
        start: 140,
        duration: 25,
        stimuli: 2,
        brief: 'Compress time to Day +2 and test the quality of the notification to data subjects.',
        narrative: 'Simulated time jumps to Day +2. The DPO submits the letter to affected customers, which must be clear, specific and actionable without looking like another phishing message. Customers start exercising their rights and threatening collective action. Players must validate content, channels and follow-up capacity.',
        objectives: [2, 4],
        events: [
          { at: 0, text: 'Day +2: the 72-hour deadline is close and two million customers still await an official letter' },
          { at: 10, text: 'Consumer groups start gathering affected customers for a possible collective action' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'dpo', cell: 'legal', title: 'Customer notification letter for approval', intent: 'Draft letter explaining what data leaked, the risks and what to do, sent by email and in-app. Players must check clarity and avoid phishing-like wording.' },
          { at: 12, channel: 'email_external', cast: 'customer', cell: 'legal', title: 'Access request and collective action threat', intent: 'A customer demands a copy of all data held and says she is joining a consumer collective action. Tests handling of rights requests at scale.' }
        ]
      },
      {
        key: 'exit',
        type: 'exit',
        title: 'Day +30: regulator follow-up',
        track: 'main',
        start: 165,
        duration: 15,
        stimuli: 2,
        brief: 'Close on accountability, lessons learned and regulatory scrutiny.',
        narrative: 'Simulated time jumps to Day +30. The authority opens an investigation and the board wants structural commitments. Players must define the exit of the crisis, the remediation plan and ownership of the regulatory file.',
        objectives: [2, 3],
        events: [
          { at: 0, text: 'Day +30: the leak is out of the headlines but customer trust indicators remain low' },
          { at: 8, text: 'The contractual dispute with the analytics agency over liability remains unresolved' }
        ],
        beats: [
          { at: 0, channel: 'email_authority', cast: 'dpa', cell: 'legal', title: 'Authority opens an investigation', intent: 'The case officer requests the processing agreement with the agency, the data protection impact assessment and retention rules. Tests readiness of accountability documentation.' },
          { at: 8, channel: 'internal_memo', cast: 'ceo', cell: 'decision', title: 'CEO memo: our commitments', intent: 'Draft memo announcing processor audits, data minimisation and a customer trust programme. Players must validate the commitments and owners.' }
        ]
      },
      {
        key: 'crisis-cell',
        type: 'crisis_cell',
        title: 'Deciding with incomplete facts',
        track: 'governance',
        start: 20,
        duration: 75,
        stimuli: 2,
        brief: 'Test crisis cell activation and executive alignment before facts are established.',
        narrative: 'The CEO wants a quick answer on who is to blame, while the board chair insists on being briefed before any statement. Players must structure the cell, protect decision-making from premature conclusions and keep a decision log.',
        objectives: [0, 4],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ceo', cell: 'decision', title: 'Who is to blame, and how fast?', intent: 'The CEO convenes the crisis cell and wants to know within the hour how the data got out and who is at fault. Tests fact discipline versus blame before the origin is established.' },
          { at: 41, channel: 'email_internal', cast: 'ceo', cell: 'decision', title: 'Board chair wants a briefing first', intent: 'The CEO relays the board chair\'s request to validate any public statement personally. Adds a governance step that may delay communication.' }
        ]
      },
      {
        key: 'gdpr-clock',
        type: 'legal',
        title: 'The GDPR 72-hour clock',
        track: 'legal',
        start: 35,
        duration: 110,
        stimuli: 3,
        brief: 'Make the notification timeline and processor liability explicit.',
        narrative: 'The DPO debates when the organisation became aware of the breach. The authority, alerted by the press, calls before the notification is filed. The agency claims to be a joint controller to dilute responsibility. Players must notify on time, possibly in phases, and secure their contractual position.',
        objectives: [2, 3],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'dpo', cell: 'legal', title: 'When did we become aware?', intent: 'The DPO argues the clock started with the threat intelligence alert, not the confirmation, and proposes an initial notification today. Tests awareness of GDPR timing.' },
          { at: 37, channel: 'email_authority', cast: 'dpa', cell: 'legal', kind: 'nudge', title: 'Authority asks about the forum listing', intent: 'Alerted to the dark web listing, the authority asks whether a breach notification is coming and requests preliminary facts. Relaunches the pending notification decision.' },
          { at: 81, channel: 'email_external', cast: 'vendor', cell: 'legal', title: 'Agency disputes its liability', intent: 'The agency\'s counsel claims joint controllership and rejects indemnification under the contract. Forces a legal position on the processor.' }
        ]
      },
      {
        key: 'communication',
        type: 'communication',
        title: 'Talking to two million customers',
        track: 'communication',
        start: 70,
        duration: 95,
        stimuli: 3,
        brief: 'Test the timing, transparency and tone of public communication.',
        narrative: 'The communication director wants to wait for full facts, but a journalist already holds the sample and has spoken to customers. When the article appears, it focuses on the hours of silence. Players must choose between proactive disclosure and reactive defence.',
        objectives: [4],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'comms', cell: 'communication', title: 'Proactive or reactive?', intent: 'The communication director proposes a reactive stance until the investigation is complete. Players must decide when and how to go public.' },
          { at: 30, channel: 'email_external', cast: 'journalist', cell: 'communication', kind: 'nudge', title: 'Journalist calls back: publishing at 6 pm', intent: 'After unanswered messages, the journalist says she has verified the sample with five customers and will publish at 6 pm with or without a comment. Relaunches the stalled statement.' },
          { at: 65, channel: 'article_press', cast: 'journalist', cell: 'communication', title: 'Article: "The brand knew for hours"', intent: 'Article quoting angry customers and pointing at the delay between the alert and the first statement. Tests reputational response.' }
        ]
      },
      {
        key: 'customer-care',
        type: 'customers',
        title: 'Customer care surge',
        track: 'business',
        start: 105,
        duration: 65,
        stimuli: 2,
        brief: 'Show the downstream impact on customers and frontline staff.',
        narrative: 'Customers who reused passwords see accounts on other sites taken over and blame the brand online. Agents lack validated answers. Players must equip the frontline and monitor community channels.',
        objectives: [5, 4],
        beats: [
          { at: 0, channel: 'post_reddit', cast: 'customer', cell: 'it', title: 'Reddit thread: accounts hijacked', intent: 'Thread gathering customers whose other online accounts were hijacked after the leak, while credential-stuffing attempts hit the organisation\'s own login page. Tests monitoring and technical response.' },
          { at: 36, channel: 'email_internal', cast: 'care', cell: 'hr', title: 'Agents improvising answers', intent: 'Quality control finds agents contradicting the official line on what data leaked, and supervisors report exhausted staff facing abusive callers. Requires a validated script, briefings and support for frontline staff.' }
        ]
      }
    ]
  },
  {
    id: 'software-supply-chain',
    name: 'Software supply chain compromise',
    category: 'Third party',
    icon: 'package',
    duration_minutes: 180,
    summary: 'The national cybersecurity agency warns that a signed update of a widely used remote monitoring and management agent contains a backdoor. The organisation, which uses this agent internally and deploys it in 140 client environments as part of its managed services, installed the update automatically two weeks ago. Investigation shows the attackers used the backdoor to reach the organisation\'s own build pipeline and tampered with one of its software releases, turning the organisation from victim into an unwitting vector. The crisis cell must contain a trusted tool without abandoning its clients, coordinate with a defensive vendor and the authorities, clarify its liability and rebuild a verifiable release process.',
    threat: 'A state-linked espionage group ("Cobalt Heron") compromised the build system of the software vendor Northgate Systems and shipped a backdoored, validly signed update, then moved from the organisation\'s management console to its source code and signing infrastructure. Impact: stealthy access to the organisation and its clients, tainted software release, massive trust and liability issue.',
    tags: ['supply chain', 'third party', 'managed services', 'code signing', 'NIS2', 'coordinated disclosure'],
    objectives: [
      'Assess exposure quickly from an external advisory: affected versions, internal deployments and client environments',
      'Decide how to contain a trusted third-party tool (uninstall, block, keep under watch) and accept its operational impact on managed services',
      'Coordinate with the vendor, the authorities and clients under shared responsibility and uncertain facts',
      'Determine the organisation\'s role and liability toward clients, including contractual and regulatory obligations (NIS2, GDPR)',
      'Manage disclosure timing and media exposure while investigations are still ongoing',
      'Rebuild trust through a clean rebuild, a verifiable release and lessons on third-party risk management'
    ],
    cast: [
      { key: 'vendor', label: 'Vendor PSIRT lead', role: 'partner', organization: 'Northgate Systems', description: 'Security response lead of the compromised software vendor, keen to control the narrative.' },
      { key: 'agency', label: 'National cybersecurity agency', role: 'authority', organization: 'National CSIRT', description: 'Issues the advisory, coordinates the national response and expects MSPs to inform their clients.' },
      { key: 'ciso', label: 'Chief Information Security Officer', role: 'internal', organization: 'The organisation', description: 'Leads the security investigation and the relationship with the incident response firm.' },
      { key: 'cto', label: 'Chief Technology Officer', role: 'internal', organization: 'The organisation', description: 'Owns the managed services platform, the build pipeline and product releases.' },
      { key: 'ceo', label: 'Chief Executive Officer', role: 'internal', organization: 'The organisation', description: 'Chairs the crisis cell and owns the relationship with the largest clients.' },
      { key: 'ir_lead', label: 'Incident response lead', role: 'partner', organization: 'Incident response firm', description: 'External forensic team mandated to scope the compromise.' },
      { key: 'comms', label: 'Communication director', role: 'internal', organization: 'The organisation', description: 'Prepares statements and coordinates messaging with the vendor and the agency.' },
      { key: 'legal', label: 'General counsel', role: 'internal', organization: 'The organisation', description: 'Advises on contracts, regulatory scope and the position toward the vendor.' },
      { key: 'client_bank', label: 'CISO of a banking client', role: 'client_b2b', organization: 'Regional bank', description: 'Regulated client with strict third-party obligations and little patience.' },
      { key: 'client_hospital', label: 'IT director of a hospital group', role: 'client_b2b', organization: 'Hospital group', description: 'Critical client worried above all about continuity of clinical systems.' },
      { key: 'journalist', label: 'Technology journalist', role: 'journalist', organization: 'Business and technology media', description: 'Covers the global supply chain attack and looks for the MSP angle.' },
      { key: 'researcher', label: 'Independent security researcher', role: 'analyst', organization: 'Independent', description: 'Publishes technical analysis on social media, sometimes ahead of official sources.' }
    ],
    tracks: ['main', 'governance', 'business', 'legal', 'communication'],
    blocks: [
      {
        key: 'trigger',
        type: 'trigger',
        title: 'Advisory: a trojanised update',
        track: 'main',
        start: 0,
        duration: 20,
        stimuli: 3,
        brief: 'Start from an external advisory and let players discover how exposed they are.',
        narrative: 'The agency publishes an alert on a backdoored version of the Northgate agent, while a researcher already shares technical details online. Internally, the CTO realises auto-update pushed the version to every internal server and client environment. Players do not know whether the backdoor was activated for them. They must decide quickly how to inventory and whom to mobilise.',
        objectives: [0],
        events: [
          { at: 0, text: 'A validly signed update of the widely used Northgate management agent is revealed to carry a backdoor planted by a state-linked group' },
          { at: 10, text: 'Northgate customers worldwide scramble to inventory deployments while no one yet knows who received second-stage activity' }
        ],
        beats: [
          { at: 0, channel: 'email_authority', cast: 'agency', cell: 'it', title: 'Alert: trojanised Northgate agent 9.4.2', intent: 'Advisory stating that version 9.4.2, validly signed, contains a backdoor, with initial measures and an urgent inventory request. Starts the exposure assessment.' },
          { at: 6, channel: 'post_reddit', cast: 'researcher', cell: 'it', title: 'Researcher thread: backdoor analysis', intent: 'Detailed thread with C2 domains, noting that managed service providers pushed the update to all their clients. Adds public visibility and a first technical lead.' },
          { at: 12, channel: 'email_internal', cast: 'cto', cell: 'decision', title: 'We deployed 9.4.2 everywhere', intent: 'The CTO confirms auto-update installed 9.4.2 two weeks ago on 60 internal servers and in 140 client environments. Makes the organisation both victim and potential vector.' }
        ]
      },
      {
        key: 'investigation',
        type: 'investigation',
        title: 'Collateral damage or target?',
        track: 'main',
        start: 20,
        duration: 30,
        stimuli: 4,
        brief: 'Reveal that the backdoor was actively used against the organisation, beyond the vendor\'s reassuring story.',
        narrative: 'The vendor claims impact is limited, but forensics finds beacons from the management console and hands-on-keyboard activity. The attackers cloned the source code repository and touched the signing infrastructure. Meanwhile, a regulated client demands answers. Players must reconcile contradictory sources and escalate the severity.',
        objectives: [0, 2],
        events: [
          { at: 0, text: 'Forensic responders start imaging the management console and reviewing two weeks of agent traffic' },
          { at: 14, text: 'Hands-on-keyboard activity is traced from the console toward the organisation\'s development servers' }
        ],
        beats: [
          { at: 0, channel: 'email_external', cast: 'vendor', cell: 'operational', title: 'Vendor: "fewer than 1% of customers affected"', intent: 'The vendor says second-stage activity is rare, promises a hotfix and provides no indicators yet. Tests critical reading of third-party statements.' },
          { at: 8, channel: 'email_external', cast: 'ir_lead', cell: 'it', title: 'The backdoor was active on our console', intent: 'Forensics finds C2 beacons from the management console and a second-stage payload on one server. Confirms targeted activity.' },
          { at: 18, channel: 'email_internal', cast: 'ciso', cell: 'decision', title: 'Source code repository was cloned', intent: 'Logs show the attackers cloned the main repository and accessed the vault holding the code-signing key. Raises the fear of tainted releases.' },
          { at: 25, channel: 'email_external', cast: 'client_bank', cell: 'business', title: 'Bank client demands answers in two hours', intent: 'The bank\'s CISO invokes its regulatory third-party obligations and wants the list of actions performed in its environment. Pressure to communicate before facts are solid.' }
        ]
      },
      {
        key: 'containment',
        type: 'containment',
        title: 'Cutting off a trusted tool',
        track: 'main',
        start: 50,
        duration: 25,
        stimuli: 3,
        brief: 'Force a containment decision that degrades the service delivered to clients.',
        narrative: 'Removing the agent everywhere would blind monitoring and patching for 140 clients; blocking C2 traffic only may not be enough. The hospital group refuses any intervention on clinical servers without its approval, and the agency expects coordinated action. Players must choose a containment strategy and a client-by-client approach.',
        objectives: [1, 2],
        events: [
          { at: 0, text: 'The agent remains the backbone of monitoring and patching for 140 client environments; every containment option degrades service' },
          { at: 12, text: 'Other managed service providers start pulling the agent, raising client expectations of similar action' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'cto', cell: 'decision', title: 'Kill the agent everywhere?', intent: 'The CTO presents three options (full uninstall, C2 blocking, isolation of the console) with their effect on managed services. Requires a decision and a mandate to act in client environments.' },
          { at: 9, channel: 'email_external', cast: 'client_hospital', cell: 'business', title: 'Hospital: do not touch our servers', intent: 'The hospital group forbids any change on clinical systems without its own validation. Tests the balance between security action and client autonomy.' },
          { at: 18, channel: 'email_authority', cast: 'agency', cell: 'legal', kind: 'nudge', title: 'Agency chases: client notice still pending', intent: 'The agency follows up: as a provider, the organisation has not yet informed its clients nor shared indicators with the CSIRT, and a deadline is set. Relaunches the pending notification decision.' }
        ]
      },
      {
        key: 'tainted-release',
        type: 'twist',
        title: 'Our own release is tainted',
        track: 'main',
        start: 75,
        duration: 25,
        stimuli: 3,
        brief: 'Escalate: the organisation discovers it has itself distributed malicious code.',
        narrative: 'Analysis of last week\'s client portal plugin shows an extra module signed with the organisation\'s own key. The researcher publicly links the second backdoor to the organisation before it has informed its clients. The bank suspends all access. Players must switch from victim posture to responsible supplier posture.',
        objectives: [3, 4],
        events: [
          { at: 0, text: 'The client portal plugin shipped last week is already installed in dozens of client environments' },
          { at: 14, text: 'Clients begin disabling the organisation\'s plugin on their own; account managers are flooded with calls' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ciso', cell: 'decision', title: 'Our release was signed with a stolen key', intent: 'The CISO confirms that release 5.2 of the client plugin contains a malicious module signed with the organisation\'s key. Changes the nature of the crisis.' },
          { at: 10, channel: 'post_twitter', cast: 'researcher', cell: 'communication', title: 'Researcher names the organisation', intent: 'Public post linking the second-stage implant to the organisation\'s signed plugin. Clients learn it from social media.' },
          { at: 18, channel: 'email_external', cast: 'client_bank', cell: 'business', title: 'Bank suspends all access and invokes audit', intent: 'The bank cuts every connection with the organisation and triggers its contractual audit right. Tests account management and contractual response.' }
        ]
      },
      {
        key: 'eradication',
        type: 'eradication',
        title: 'Revoke, rebuild, re-sign',
        track: 'main',
        start: 100,
        duration: 25,
        stimuli: 3,
        brief: 'Make the cost and depth of a real eradication visible.',
        narrative: 'The incident response firm recommends revoking the signing certificate, rebuilding the pipeline and rotating every secret, freezing releases for two weeks. The vendor ships a clean version but trust is low. Hunting reveals a dormant account created in a client domain. Players must decide scope and accept delays.',
        objectives: [1, 5],
        events: [
          { at: 0, text: 'Forensics concludes the attackers held access to the build pipeline and signing vault for most of the past two weeks' },
          { at: 12, text: 'Threat hunting extends into client environments where the agent held administrative rights' }
        ],
        beats: [
          { at: 0, channel: 'email_external', cast: 'ir_lead', cell: 'decision', title: 'Eradication plan: revoke and rebuild', intent: 'Plan to revoke the code-signing certificate, rebuild the CI/CD pipeline and rotate all secrets, with a release freeze until the rebuilt pipeline is verified (up to two weeks). Requires validation of scope and cost.' },
          { at: 10, channel: 'email_external', cast: 'vendor', cell: 'it', title: 'Vendor ships 9.4.3 and indicators', intent: 'The vendor publishes a clean version and asks customers to reinstall. Players must decide whether to trust it and on what evidence.' },
          { at: 19, channel: 'email_internal', cast: 'ciso', cell: 'it', title: 'Dormant account in a client domain', intent: 'Hunting finds an administrator account created by the attackers in the hospital\'s domain via the agent. Extends eradication to client environments.' }
        ]
      },
      {
        key: 'continuity',
        type: 'continuity',
        title: 'Serving clients without the platform',
        track: 'main',
        start: 125,
        duration: 20,
        stimuli: 3,
        brief: 'Test how managed services continue without the central tool.',
        narrative: 'Without the agent, engineers must patch and monitor manually, and capacity is far below demand. A hospital server fails and needs urgent intervention. The press frames the organisation as the weak link. Players must prioritise clients and staff.',
        objectives: [1, 4],
        events: [
          { at: 0, text: 'The agent is switched off across the managed estate; remote monitoring and automated patching stop for all clients' },
          { at: 10, text: 'Media coverage shifts from the vendor to managed service providers as the weak link of the attack' }
        ],
        beats: [
          { at: 0, channel: 'internal_memo', cast: 'cto', cell: 'hr', title: 'Manual operations for managed services', intent: 'Memo organising manual patching and monitoring by client tier, with capacity limits, extended engineer shifts and overtime. Tests prioritisation of clients and staff.' },
          { at: 8, channel: 'email_external', cast: 'client_hospital', cell: 'operational', title: 'Urgent: clinical server down', intent: 'The hospital needs support on a failed server but remote access is cut. Players must decide on on-site dispatch or temporary exception.' },
          { at: 14, channel: 'article_press', cast: 'journalist', cell: 'communication', title: 'IT provider spread backdoor to clients', intent: 'Article describing the organisation as a relay of the attack, quoting an unnamed client. Tests reputational messaging.' }
        ]
      },
      {
        key: 'recovery',
        type: 'recovery',
        title: 'Day +5: a verifiable release',
        track: 'main',
        start: 145,
        duration: 20,
        stimuli: 2,
        brief: 'Compress time to Day +5 and test the conditions for restarting deliveries.',
        narrative: 'Simulated time jumps to Day +5. A rebuilt pipeline produces a new signed release, but clients want independent assurance. The bank sets conditions for reconnection. Players must define the evidence they will provide and the pace of reconnection.',
        objectives: [5, 2],
        events: [
          { at: 0, text: 'Day +5: the rebuilt pipeline runs with a new signing key and rotated secrets' },
          { at: 10, text: 'Most clients keep the organisation\'s access suspended until they see evidence that new releases are clean' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'cto', cell: 'decision', title: 'Clean release ready: ship it?', intent: 'The rebuilt pipeline has been verified ahead of estimate; the CTO proposes lifting the release freeze early to ship a reproducible build signed with a new key. Players must decide on third-party verification before release.' },
          { at: 9, channel: 'email_external', cast: 'client_bank', cell: 'business', kind: 'nudge', title: 'Bank chases: still no audit plan', intent: 'The bank reminds the organisation it has received no proposal yet and will reconnect only after an independent audit report. Relaunches negotiation and prioritisation of client recovery.' }
        ]
      },
      {
        key: 'exit',
        type: 'exit',
        title: 'Day +21: restoring trust',
        track: 'main',
        start: 165,
        duration: 15,
        stimuli: 2,
        brief: 'Close on accountability, regulatory follow-up and third-party risk lessons.',
        narrative: 'Simulated time jumps to Day +21. The agency requests a post-incident report and the CEO prepares a letter to all clients. Players must decide what to acknowledge, what to commit to and when the crisis organisation stands down.',
        objectives: [3, 5],
        events: [
          { at: 0, text: 'Day +21: managed services are back for most clients and known attacker accesses are closed' },
          { at: 8, text: 'The vendor publishes its root cause analysis; client contract reviews and service credit claims begin' }
        ],
        beats: [
          { at: 0, channel: 'email_authority', cast: 'agency', cell: 'legal', title: 'Post-incident report requested', intent: 'The agency asks for the final report with timeline, root cause and third-party controls. Ensures regulatory ownership.' },
          { at: 6, channel: 'internal_memo', cast: 'ceo', cell: 'decision', title: 'Draft CEO letter to all clients', intent: 'Draft letter acknowledging the tainted release, detailing measures and proposing service credits. Players must validate tone and commitments.' }
        ]
      },
      {
        key: 'crisis-cell',
        type: 'crisis_cell',
        title: 'Victim or culprit? Governance under ambiguity',
        track: 'governance',
        start: 15,
        duration: 60,
        stimuli: 2,
        brief: 'Test crisis activation when the organisation is both victim and link in the chain.',
        narrative: 'The CEO activates the crisis cell and wants a clear posture. The vendor invites the organisation into its war room under a restrictive confidentiality agreement. Players must preserve their freedom to inform clients while cooperating.',
        objectives: [2, 3],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ceo', cell: 'decision', title: 'Are we a victim or a culprit?', intent: 'The CEO convenes the crisis cell and asks for a position on the organisation\'s role within two hours. Tests fact-based governance.' },
          { at: 35, channel: 'email_internal', cast: 'legal', cell: 'legal', title: 'Joining the vendor\'s war room?', intent: 'Counsel flags that the vendor\'s war room requires an NDA limiting disclosure to clients. Forces a trade-off between cooperation and transparency.' }
        ]
      },
      {
        key: 'clients',
        type: 'customers',
        title: 'Client coordination at scale',
        track: 'business',
        start: 45,
        duration: 50,
        stimuli: 3,
        brief: 'Organise communication and support for 140 clients with different risk profiles.',
        narrative: 'Clients must be informed in order of criticality, while some detect suspicious activity themselves. A client CISO speaks publicly about third-party risk. Players must organise tiering, dedicated contacts and consistent technical guidance.',
        objectives: [2, 4],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'cto', cell: 'business', title: 'Client tiering for notification', intent: 'Proposed ranking of 140 clients by criticality and regulatory exposure, with a notification sequence. Players must validate order and content.' },
          { at: 22, channel: 'audio_message', cast: 'client_hospital', cell: 'operational', title: 'Hospital: suspicious admin login', intent: 'The hospital\'s IT director leaves an urgent voicemail about an unexpected admin login overnight. Tests escalation paths with clients.' },
          { at: 40, channel: 'post_linkedin', cast: 'client_bank', cell: 'communication', title: 'Bank CISO on third-party risk', intent: 'Public post implying the bank was put at risk by its IT provider. Tests account management and public response.' }
        ]
      },
      {
        key: 'legal',
        type: 'legal',
        title: 'Contracts, NIS2 and liability',
        track: 'legal',
        start: 60,
        duration: 70,
        stimuli: 2,
        brief: 'Clarify the regulatory scope and liability chain.',
        narrative: 'As a managed service provider, the organisation falls within NIS2 and may have exposed client personal data. The vendor\'s counsel refuses any admission. Players must notify authorities, secure evidence and define a position toward both clients and vendor.',
        objectives: [3],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'legal', cell: 'legal', title: 'What we owe: NIS2 and client contracts', intent: 'Counsel outlines the 24-hour NIS2 early warning, possible GDPR notifications as processor and contractual liability caps. Tests ownership of obligations.' },
          { at: 40, channel: 'email_external', cast: 'vendor', cell: 'legal', title: 'Vendor counsel: no admission of fault', intent: 'The vendor\'s lawyers refuse any liability and ask the organisation not to name them. Forces a position on recourse and messaging.' }
        ]
      },
      {
        key: 'disclosure',
        type: 'communication',
        title: 'Coordinated disclosure',
        track: 'communication',
        start: 80,
        duration: 70,
        stimuli: 3,
        brief: 'Test public communication aligned with the vendor, the agency and clients.',
        narrative: 'A journalist asks whether the organisation spread the backdoor. The vendor and the agency each push their own narrative. When television picks up the story, players must speak with one voice without prejudging the investigation.',
        objectives: [4],
        beats: [
          { at: 0, channel: 'email_external', cast: 'journalist', cell: 'communication', title: 'Did you spread the backdoor?', intent: 'The journalist, working on the MSP angle, asks whether the organisation\'s clients were infected through its management platform, with a two-hour deadline. Tests messaging when clients are not all informed.' },
          { at: 22, channel: 'email_internal', cast: 'comms', cell: 'communication', kind: 'nudge', title: 'Reminder: our statement is still not validated', intent: 'The communication director chases the crisis cell: the journalist\'s deadline has passed, no statement is validated and the vendor\'s draft blames "misconfigured customers". Players must decide on alignment or divergence.' },
          { at: 45, channel: 'breaking_news_tv', cast: 'journalist', cell: 'communication', title: 'IT provider\'s 140 clients caught in supply chain attack', intent: 'Ticker naming the organisation as a relay of the attack. Accelerates the need for a public statement and client reassurance.' }
        ]
      }
    ]
  },
  {
    id: 'ddos-hacktivism',
    name: 'Hacktivist DDoS and disinformation campaign',
    category: 'Cyber attack',
    icon: 'wave',
    duration_minutes: 180,
    summary: 'After the organisation announces a high-profile partnership, a hacktivist collective publicly designates it as a target and launches waves of distributed denial-of-service attacks against its website, mobile app and customer portal. As mitigation takes hold, the group shifts to DNS and claims to have defaced the homepage and stolen the customer database, backed by a doctored screenshot and a recycled leak from an old third-party breach. A forged press release announcing the suspension of all online services circulates on social media. The crisis cell must restore service with painful mitigation trade-offs, debunk false claims without amplifying them and prepare for a campaign that lasts several days.',
    threat: 'The hacktivist collective "Iron Chorus" mobilises volunteers and rented botnets for application-layer floods and DNS attacks, and runs an influence operation with fake defacement and data theft claims. Impact: customer-facing services unavailable for hours, customer frustration and reputational damage fuelled by disinformation.',
    tags: ['DDoS', 'hacktivism', 'disinformation', 'availability', 'social media', 'fake leak'],
    objectives: [
      'Detect and qualify a volumetric and application-layer DDoS campaign and bring in the right providers quickly',
      'Decide on mitigation trade-offs (scrubbing, geo-blocking, rate limiting, degraded service) with a clear view of their customer impact',
      'Verify hacktivist claims (defacement, data theft) before responding and avoid amplifying false information',
      'Counter disinformation and communicate calmly and factually with customers, media and employees',
      'Coordinate with the national cyber agency and law enforcement and assess regulatory reporting',
      'Maintain essential customer services and organise for a campaign that lasts several days'
    ],
    cast: [
      { key: 'attacker', label: 'Iron Chorus', role: 'attacker', organization: 'Hacktivist collective', description: 'Ideologically motivated group that announces targets publicly and inflates its successes.' },
      { key: 'noc', label: 'Network operations engineer', role: 'internal', organization: 'The organisation', description: 'On-call engineer watching traffic, latency and DNS health.' },
      { key: 'ciso', label: 'Chief Information Security Officer', role: 'internal', organization: 'The organisation', description: 'Coordinates the security response and the link with authorities.' },
      { key: 'cdo', label: 'Chief Digital Officer', role: 'internal', organization: 'The organisation', description: 'Owns online channels and measures the business impact of the outage.' },
      { key: 'ceo', label: 'Chief Executive Officer', role: 'internal', organization: 'The organisation', description: 'Publicly exposed by the partnership that triggered the campaign.' },
      { key: 'comms', label: 'Communication director', role: 'internal', organization: 'The organisation', description: 'Owns press relations and the public line on the attack.' },
      { key: 'social', label: 'Social media manager', role: 'internal', organization: 'The organisation', description: 'Monitors mentions and moderates the organisation\'s accounts.' },
      { key: 'ddos_provider', label: 'Mitigation provider SOC lead', role: 'partner', organization: 'Anti-DDoS provider', description: 'Can reroute traffic through scrubbing centres, at a price and with technical prerequisites.' },
      { key: 'agency', label: 'National cybersecurity agency', role: 'authority', organization: 'National CSIRT', description: 'Tracks the campaign across several targets and shares intelligence.' },
      { key: 'journalist', label: 'Technology journalist', role: 'journalist', organization: 'National news media', description: 'Relays the group\'s claims and asks the organisation to confirm or deny.' },
      { key: 'customer', label: 'Frustrated customer', role: 'client_b2c', organization: 'Retail customer', description: 'Cannot access online services and voices frustration publicly.' },
      { key: 'analyst', label: 'Threat intelligence analyst', role: 'internal', organization: 'The organisation', description: 'Assesses the group\'s credibility and verifies its claims.' }
    ],
    tracks: ['main', 'governance', 'communication', 'business', 'legal'],
    blocks: [
      {
        key: 'trigger',
        type: 'trigger',
        title: 'Announced in advance',
        track: 'main',
        start: 0,
        duration: 20,
        stimuli: 3,
        brief: 'Open with a public threat, giving players a short window to prepare before the first wave.',
        narrative: 'The group names the organisation on its channel and sets an attack time. Threat intelligence rates it as credible but prone to exaggeration. First latency alerts arrive before any real outage. Players must decide whether to pre-emptively activate protections and the crisis organisation, or wait for impact.',
        objectives: [0],
        events: [
          { at: 0, text: 'The organisation\'s high-profile partnership announcement becomes a rallying point on hacktivist channels' },
          { at: 9, text: 'Volunteers share attack tools and target lists covering the website, mobile app and customer portal' }
        ],
        beats: [
          { at: 0, channel: 'post_twitter', cast: 'attacker', cell: 'decision', title: '"Operation Black Tide" targets the organisation', intent: 'The group names the organisation, denounces its new partnership and calls followers to strike within the next half hour. Opens a short preparation window.' },
          { at: 5, channel: 'email_internal', cast: 'analyst', cell: 'operational', title: 'The group is credible but boastful', intent: 'Assessment: past attacks reached 200 Gbps, claims are often exaggerated or fabricated. Helps calibrate the response.' },
          { at: 13, channel: 'sms_notification', cast: 'noc', cell: 'it', title: 'Latency alert on the public website', intent: 'Automated alert on unusual traffic on login and search pages. Tests whether players act before the outage.' }
        ]
      },
      {
        key: 'first-waves',
        type: 'investigation',
        title: 'Waves one and two',
        track: 'main',
        start: 20,
        duration: 30,
        stimuli: 3,
        brief: 'Make the outage real and show that existing protections are insufficient.',
        narrative: 'An application-layer flood takes down the website and app. The mitigation provider can onboard emergency protection but needs a DNS change, certificates and a contract upgrade. Customers start complaining publicly. Players must understand the attack pattern and commit to mitigation.',
        objectives: [0, 1],
        events: [
          { at: 0, text: 'Attack traffic from rented botnets and volunteer machines hits the organisation\'s online services' },
          { at: 15, text: 'A second wave follows as the group boasts of its first success; complaints multiply on every channel' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'noc', cell: 'it', title: 'Website and app down: layer 7 flood', intent: 'Millions of requests per minute on the login page saturate the application servers. Current rate limiting is not enough.' },
          { at: 11, channel: 'email_external', cast: 'ddos_provider', cell: 'decision', title: 'Emergency onboarding in two hours', intent: 'The provider can reroute traffic if the organisation changes DNS, shares TLS certificates and signs an emergency upgrade. Requires fast approval.' },
          { at: 21, channel: 'post_twitter', cast: 'customer', cell: 'business', title: '"I cannot pay my bills"', intent: 'Customers complain they cannot access their accounts before a payment deadline. Adds visible customer pressure.' }
        ]
      },
      {
        key: 'mitigation',
        type: 'containment',
        title: 'Scrubbing and geo-blocking',
        track: 'main',
        start: 50,
        duration: 30,
        stimuli: 3,
        brief: 'Force explicit mitigation trade-offs that also hurt legitimate customers.',
        narrative: 'Geo-blocking would stop most attack traffic but lock out customers travelling or living abroad. The group adapts and targets DNS. Business wants the payment API protected first. Players must choose what to sacrifice and for how long.',
        objectives: [1, 5],
        events: [
          { at: 0, text: 'Emergency scrubbing goes live for part of the traffic, but attackers adapt their patterns within minutes' },
          { at: 16, text: 'Legitimate customers abroad and on mobile networks are caught in rate limits as mitigation tightens' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ciso', cell: 'decision', title: 'Geo-blocking proposal', intent: 'Blocking foreign traffic would cut 80% of the attack but also thousands of customers abroad. Requires a business-risk decision.' },
          { at: 11, channel: 'email_external', cast: 'ddos_provider', cell: 'it', title: 'The attack shifts to DNS', intent: 'The provider reports a DNS flood that makes all services unreachable, including partner APIs. Tests adaptation and escalation.' },
          { at: 21, channel: 'email_internal', cast: 'cdo', cell: 'business', kind: 'nudge', title: 'CDO chases: still no mitigation decision', intent: 'With online sales down 70% and no decision yet on geo-blocking, the CDO presses the crisis cell to protect payment and account access first. Relaunches the pending prioritisation.' }
        ]
      },
      {
        key: 'claims',
        type: 'twist',
        title: 'Defacement claims and a fake leak',
        track: 'main',
        start: 80,
        duration: 30,
        stimuli: 4,
        brief: 'Escalate from availability to perception: false claims test verification and restraint.',
        narrative: 'The group posts a screenshot of a defaced homepage and claims to have stolen customer data. Analysis shows the screenshot is doctored and the data is recycled from an old third-party breach. A forged press release announces that all online services are suspended. Players must verify before denying and avoid amplifying the claims.',
        objectives: [2, 3],
        events: [
          { at: 0, text: 'The group pivots from availability to perception, flooding social media with claims of a deeper breach' },
          { at: 18, text: 'Hashtags tied to the alleged leak trend nationally as bot accounts repost the claims' }
        ],
        beats: [
          { at: 0, channel: 'post_twitter', cast: 'attacker', cell: 'it', title: 'Screenshot of a "defaced" homepage', intent: 'The group shares an image of the homepage covered with its logo. Players must check whether it is real before reacting.' },
          { at: 8, channel: 'dark_web_forum', cast: 'attacker', cell: 'legal', title: 'Claim: customer database stolen', intent: 'Post offering a "customer database" with 50,000 lines. Creates fear of a data breach and GDPR obligations.' },
          { at: 15, channel: 'email_internal', cast: 'analyst', cell: 'communication', title: 'Fake defacement, recycled data', intent: 'Analysis shows the screenshot is edited and the data matches a 2019 breach at a former supplier. Gives players facts to debunk carefully.' },
          { at: 22, channel: 'post_twitter', cast: 'attacker', cell: 'communication', title: 'Forged release circulates: "online services suspended"', intent: 'The group spreads a fake press release imitating the organisation\'s layout, announcing the indefinite shutdown of online services. Tests rapid disinformation response.' }
        ]
      },
      {
        key: 'hardening',
        type: 'eradication',
        title: 'Hardening the perimeter',
        track: 'main',
        start: 110,
        duration: 25,
        stimuli: 2,
        brief: 'Address the weaknesses that allowed attacks to bypass mitigation.',
        narrative: 'Attackers reached origin servers directly because their IP addresses were exposed. Changing them requires an urgent infrastructure change during business hours. Players must accept residual risk and plan structural fixes.',
        objectives: [1, 5],
        events: [
          { at: 0, text: 'Service is partly restored behind the scrubbing provider, but intermittent outages continue' },
          { at: 14, text: 'The group\'s channel calls on volunteers to hunt for unprotected systems of the organisation' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'noc', cell: 'it', title: 'Origin IPs exposed: change needed', intent: 'The engineer shows that attackers bypass scrubbing by hitting origin IPs, requiring an emergency re-addressing. Needs a change approval under pressure.' },
          { at: 12, channel: 'email_external', cast: 'ddos_provider', cell: 'operational', title: 'Protection in place, residual risk', intent: 'The provider confirms mitigation holds but warns that new vectors are likely. Frames the multi-day posture.' }
        ]
      },
      {
        key: 'recovery',
        type: 'recovery',
        title: 'Day +2: services back, campaign continues',
        track: 'main',
        start: 135,
        duration: 25,
        stimuli: 3,
        brief: 'Compress time to Day +2 and test decisions on lifting restrictions while threats persist.',
        narrative: 'Simulated time jumps to Day +2. Services are stable and business wants geo-blocking lifted, but the group announces a new wave on payday. Media continue covering the campaign. Players must decide on the pace of normalisation and the watch posture.',
        objectives: [5, 1],
        events: [
          { at: 0, text: 'Day +2: services are stable behind scrubbing and geo-blocking remains in place' },
          { at: 12, text: 'Other organisations in the sector are hit by the same collective, keeping the campaign in the news' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'cdo', cell: 'decision', title: 'Lift geo-blocking now?', intent: 'The CDO asks to reopen access to customers abroad after 36 hours of stability. Requires a risk decision.' },
          { at: 9, channel: 'post_twitter', cast: 'attacker', cell: 'operational', title: 'New wave announced for payday', intent: 'The group promises a larger attack on the day salaries are paid. Tests readiness and customer messaging.' },
          { at: 18, channel: 'breaking_news_tv', cast: 'journalist', cell: 'communication', title: 'Hacktivists vow to continue', intent: 'Ticker reports a third day of attacks and repeats the unverified data theft claim. Tests persistence of the debunking effort.' }
        ]
      },
      {
        key: 'exit',
        type: 'exit',
        title: 'Day +7: the campaign fades',
        track: 'main',
        start: 160,
        duration: 20,
        stimuli: 2,
        brief: 'Close with lessons learned and a return to a normal watch posture.',
        narrative: 'Simulated time jumps to Day +7. The group moves to other targets. The agency shares a campaign report and the CEO wants to thank teams and set priorities. Players must formalise exit criteria and improvements.',
        objectives: [4, 5],
        events: [
          { at: 0, text: 'Day +7: attack traffic is back to background levels and the group has moved to other targets' },
          { at: 8, text: 'Temporary restrictions and fallback arrangements are still in place, awaiting a decision to keep, adapt or lift them' }
        ],
        beats: [
          { at: 0, channel: 'email_authority', cast: 'agency', cell: 'it', title: 'Campaign report from the agency', intent: 'The agency shares indicators, the list of sectors targeted and recommendations. Tests feedback loop and lessons learned.' },
          { at: 10, channel: 'internal_memo', cast: 'ceo', cell: 'hr', title: 'CEO memo to staff', intent: 'Draft memo thanking teams and announcing investments in resilience. Players must validate the message and actions.' }
        ]
      },
      {
        key: 'crisis-cell',
        type: 'crisis_cell',
        title: 'Posture toward the group',
        track: 'governance',
        start: 20,
        duration: 65,
        stimuli: 2,
        brief: 'Test executive composure and a sustainable crisis rhythm.',
        narrative: 'The CEO wants to answer the group publicly and questions the partnership. The CISO proposes a duty roster for a campaign that may last a week. Players must avoid emotional decisions and organise for endurance.',
        objectives: [3, 5],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ceo', cell: 'decision', title: 'Should we answer them publicly?', intent: 'The CEO wants to respond to the group on social media and asks whether to review the partnership. Tests restraint and strategic posture.' },
          { at: 36, channel: 'email_internal', cast: 'ciso', cell: 'hr', title: 'A duty roster for a long campaign', intent: 'The CISO proposes 12-hour shifts and a daily crisis meeting for at least five days. Tests endurance planning.' }
        ]
      },
      {
        key: 'disinformation',
        type: 'communication',
        title: 'Fighting disinformation',
        track: 'communication',
        start: 75,
        duration: 90,
        stimuli: 4,
        brief: 'Test communication when false claims spread faster than facts.',
        narrative: 'Mentions explode and bot accounts amplify the fake leak. A journalist asks for confirmation. An article mixes verified facts and claims. Players must choose what to deny, with what evidence, and on which channels.',
        objectives: [2, 3],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'social', cell: 'communication', title: 'Mentions up 4,000%, bots amplifying', intent: 'Bot accounts amplify the group\'s hashtag and outage complaints; the social media manager asks whether to respond to each post, pin a statement or stay silent. Tests channel strategy.' },
          { at: 30, channel: 'email_external', cast: 'journalist', cell: 'communication', title: 'Was customer data stolen?', intent: 'The journalist asks for confirmation of the data theft claim before publishing. Tests a precise, evidence-based denial.' },
          { at: 45, channel: 'email_internal', cast: 'comms', cell: 'decision', kind: 'nudge', title: 'Reminder: factual denial awaiting validation', intent: 'The communication director chases the crisis cell: the draft denying the defacement and the data theft, with evidence, and flagging the forged release is still unvalidated as the journalist\'s deadline nears. Players must decide whether to publish it and where.' },
          { at: 68, channel: 'article_press', cast: 'journalist', cell: 'communication', title: 'Article: the organisation under siege', intent: 'Article covering the outage and quoting the group\'s claims, with the organisation\'s answer. Tests whether the denial landed.' }
        ]
      },
      {
        key: 'customers',
        type: 'customers',
        title: 'Keeping customers served',
        track: 'business',
        start: 45,
        duration: 90,
        stimuli: 2,
        brief: 'Test fallback channels and customer remediation.',
        narrative: 'With digital channels down, the contact centre and branches become the only access. Customers ask for compensation for missed deadlines. Players must organise fallbacks and decide on goodwill gestures.',
        objectives: [5],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'cdo', cell: 'business', title: 'Contact centre and branches as fallback', intent: 'The CDO proposes extended opening hours and a phone service for urgent operations. Requires resources and approval.' },
          { at: 45, channel: 'email_external', cast: 'customer', cell: 'business', title: 'Late fee because of the outage', intent: 'A customer charged a late fee demands a refund and compensation. Tests remediation policy.' }
        ]
      },
      {
        key: 'authorities',
        type: 'legal',
        title: 'Authorities and complaint',
        track: 'legal',
        start: 60,
        duration: 90,
        stimuli: 2,
        brief: 'Test coordination with authorities and the reporting decision.',
        narrative: 'The agency reveals a coordinated campaign against several organisations in the sector. The CISO asks whether the incident is reportable and whether to file a complaint. Players must decide and assign ownership.',
        objectives: [4],
        beats: [
          { at: 0, channel: 'email_authority', cast: 'agency', cell: 'legal', title: 'You are one of twelve targets', intent: 'The agency explains the campaign hits the whole sector and asks for traffic samples. Tests information sharing.' },
          { at: 45, channel: 'email_internal', cast: 'ciso', cell: 'legal', kind: 'nudge', title: 'Reminder: reporting and complaint decision pending', intent: 'The CISO reminds the cell that the agency\'s request is unanswered and the reporting clock runs: does the outage meet NIS2 significance thresholds, and should a criminal complaint be filed? Requires a formal decision.' }
        ]
      }
    ]
  },
  {
    id: 'ceo-fraud-deepfake',
    name: 'CEO fraud with a deepfake voice',
    category: 'Fraud',
    icon: 'mask',
    duration_minutes: 180,
    summary: 'In the morning, the treasury manager wired 4.8 million euros to a foreign account after a call in which a cloned voice of the CEO, backed by emails from a fake M&A lawyer, invoked a confidential acquisition. The exercise starts in the afternoon when a second, larger transfer is requested and the bank\'s fraud desk questions the first one. The investigation reveals that the CFO\'s real mailbox has been compromised for six weeks, which the attackers also used to send fake bank detail changes to customers. The crisis cell must race to freeze funds, stop further payments, secure identities, support the employee involved and handle insurance, audit and disclosure questions.',
    threat: 'A professional fraud ring combined an adversary-in-the-middle phishing of the CFO\'s account, voice cloning of the CEO from public videos and lookalike domains to run a business email compromise. Impact: millions of euros diverted, customer payments redirected, internal trust and control environment shaken.',
    tags: ['CEO fraud', 'BEC', 'deepfake', 'payment fraud', 'mailbox compromise', 'insurance'],
    objectives: [
      'React within the first hours to maximise the chances of recalling or freezing the fraudulent funds (bank recall, police complaint, beneficiary bank)',
      'Stop further fraudulent payments and secure the compromised accounts and mailboxes',
      'Investigate the scope of the business email compromise and its impact on customers and suppliers',
      'Support the employees involved fairly and avoid a blame culture while establishing the facts',
      'Manage legal, insurance, audit and disclosure obligations, including communication to affected third parties',
      'Strengthen payment and identity verification controls against deepfake-enabled fraud'
    ],
    cast: [
      { key: 'treasury', label: 'Treasury manager', role: 'internal', organization: 'The organisation', description: 'Experienced employee who executed the transfer and is now devastated.' },
      { key: 'cfo', label: 'Chief Financial Officer', role: 'internal', organization: 'The organisation', description: 'Owner of payment processes, whose mailbox turns out to be compromised.' },
      { key: 'ceo', label: 'Chief Executive Officer', role: 'internal', organization: 'The organisation', description: 'Whose voice was cloned; returns from a conference to discover the fraud.' },
      { key: 'ciso', label: 'Chief Information Security Officer', role: 'internal', organization: 'The organisation', description: 'Investigates the mailbox compromise and leads identity remediation.' },
      { key: 'bank', label: 'Fraud desk officer', role: 'partner', organization: 'Relationship bank', description: 'Can launch recalls and restrict accounts, but needs formal requests and a complaint.' },
      { key: 'impostor', label: 'Impostor posing as the CEO', role: 'attacker', organization: 'Fraud ring', description: 'Uses a cloned voice, lookalike domains and urgency to push more transfers.' },
      { key: 'police', label: 'Financial crime investigator', role: 'authority', organization: 'Financial crime police unit', description: 'Needs a complaint and evidence quickly to support international freezing requests.' },
      { key: 'hr', label: 'HR director', role: 'internal', organization: 'The organisation', description: 'Balances support for the employee with pressure for sanctions.' },
      { key: 'legal', label: 'General counsel', role: 'internal', organization: 'The organisation', description: 'Handles the complaint, insurance claim and disclosure questions.' },
      { key: 'customer', label: 'Accounts payable manager', role: 'client_b2b', organization: 'Major customer', description: 'Paid an invoice to the fraudulent account after a genuine-looking email.' },
      { key: 'journalist', label: 'Financial journalist', role: 'journalist', organization: 'Business newspaper', description: 'Has heard about a multi-million deepfake fraud and wants confirmation.' },
      { key: 'auditor', label: 'Statutory audit partner', role: 'partner', organization: 'Audit firm', description: 'Assesses the impact on internal control and the financial statements.' }
    ],
    tracks: ['main', 'governance', 'people', 'legal', 'communication', 'business'],
    blocks: [
      {
        key: 'trigger',
        type: 'trigger',
        title: 'The second transfer request',
        track: 'main',
        start: 0,
        duration: 20,
        stimuli: 3,
        brief: 'Open with a convincing new request and a first external doubt.',
        narrative: 'At 15:00, the "CEO" asks for a second, larger transfer before the bank cut-off, while the bank\'s fraud desk questions this morning\'s payment. Players only have the treasury manager\'s perspective at first. They must recognise the fraud pattern, stop the second payment and verify through an independent channel.',
        objectives: [0, 1],
        events: [
          { at: 0, text: 'This morning the treasury manager wired 4.8 million euros abroad, believing the CEO had ordered it for a secret acquisition' },
          { at: 8, text: 'The CEO is travelling back from a conference and hard to reach, while the bank\'s daily cut-off draws closer' }
        ],
        beats: [
          { at: 0, channel: 'email_external', cast: 'impostor', cell: 'operational', title: 'Urgent: second tranche, strictly confidential', intent: 'Email from a lookalike domain asking for 6.5 million euros before the 17:00 cut-off for "Project Heron", with a ban on discussing it. Tests fraud detection under urgency.' },
          { at: 5, channel: 'audio_message', cast: 'impostor', cell: 'decision', title: 'Voicemail in the CEO\'s voice', intent: 'A convincing cloned voice insists on confidentiality and says the CFO must not be involved because of insider rules. Makes the deepfake tangible.' },
          { at: 12, channel: 'email_external', cast: 'bank', cell: 'operational', title: 'Fraud desk questions this morning\'s transfer', intent: 'The bank reports the beneficiary account is linked to a money mule network and asks to confirm the 4.8 million euro payment. Confirms the fraud and starts the race.' }
        ]
      },
      {
        key: 'investigation',
        type: 'investigation',
        title: 'Tracing the money',
        track: 'main',
        start: 20,
        duration: 30,
        stimuli: 3,
        brief: 'Reconstruct the fraud and launch recovery actions while time runs out.',
        narrative: 'The treasury manager explains how the morning unfolded. The bank has launched a recall but part of the funds has already been split across other countries. The real CEO learns what happened. Players must file a complaint quickly, feed the bank and avoid wasting time on blame.',
        objectives: [0, 3],
        events: [
          { at: 0, text: 'The second transfer is blocked; recovering the 4.8 million euros already sent abroad becomes the priority' },
          { at: 15, text: 'The fake M&A lawyer\'s domain goes offline and the number used for the CEO call is no longer reachable' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'treasury', cell: 'operational', title: '"I thought it was him"', intent: 'The treasury manager describes the call, the lawyer\'s documents and the pressure of confidentiality. Gives facts and tests empathy.' },
          { at: 11, channel: 'email_external', cast: 'bank', cell: 'legal', kind: 'nudge', title: 'Bank chases the formal recall request', intent: 'The fraud desk still has no signed recall request: 1.9 million euros are frozen at the beneficiary bank, the rest has moved to three accounts abroad. A police complaint is needed within hours to support freezes.' },
          { at: 21, channel: 'email_internal', cast: 'ceo', cell: 'decision', title: 'CEO: "I never made that call"', intent: 'The CEO, back from a conference, demands to know how this happened and who is responsible. Tests calm governance under executive anger.' }
        ]
      },
      {
        key: 'containment',
        type: 'containment',
        title: 'Locking down the mailbox',
        track: 'main',
        start: 50,
        duration: 30,
        stimuli: 3,
        brief: 'Reveal the underlying compromise and force decisions on payments and evidence.',
        narrative: 'The CISO finds that the CFO\'s mailbox has been accessed from abroad for six weeks, with rules hiding bank messages. A large supplier payment run is scheduled tonight with recently changed bank details. The police want evidence immediately. Players must secure accounts without destroying evidence and decide on the payment run.',
        objectives: [1, 2],
        events: [
          { at: 0, text: 'The security team pulls sign-in and mailbox logs for all finance executives' },
          { at: 18, text: 'New sign-in attempts from abroad hit the CFO\'s account while it is under investigation: the attackers are still active' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ciso', cell: 'it', title: 'CFO mailbox compromised for six weeks', intent: 'Sign-ins from abroad via a stolen session token and inbox rules hiding emails containing "bank" or "transfer". Shows the fraud was prepared from inside.' },
          { at: 11, channel: 'email_internal', cast: 'cfo', cell: 'decision', title: 'Tonight\'s payment run: stop it?', intent: 'A 12 million euro supplier run is due tonight, with seven IBANs changed recently. Freezing it delays genuine suppliers. Requires a decision.' },
          { at: 21, channel: 'email_authority', cast: 'police', cell: 'legal', kind: 'nudge', title: 'Investigator chases: still no complaint', intent: 'The investigator calls back: without a formal complaint and the voicemail file, email headers and bank documents, no international freeze can be requested tonight. Tests evidence preservation.' }
        ]
      },
      {
        key: 'customers-hit',
        type: 'twist',
        title: 'The fraud spreads to customers',
        track: 'main',
        start: 80,
        duration: 30,
        stimuli: 4,
        brief: 'Escalate: third parties are defrauded in the organisation\'s name and the attackers are still active.',
        narrative: 'A customer reveals it paid an invoice to a "new account" announced from the CFO\'s real mailbox. The CISO finds 34 such letters. The impostor now targets a subsidiary, and a journalist has heard about the fraud. Players must warn customers quickly and decide on exposure.',
        objectives: [2, 4],
        events: [
          { at: 0, text: 'Customers who received bank detail change letters from the CFO\'s genuine address have started paying the fraudsters' },
          { at: 14, text: 'Rumours of a multi-million fraud circulate in the market, well beyond the restricted crisis cell' }
        ],
        beats: [
          { at: 0, channel: 'email_external', cast: 'customer', cell: 'business', title: '"We paid to your new account"', intent: 'A customer confirms it paid 900,000 euros following a bank detail change letter from the CFO\'s genuine address. Extends the crisis to third parties.' },
          { at: 9, channel: 'email_internal', cast: 'ciso', cell: 'communication', title: 'Fake IBAN letters sent to 34 customers', intent: 'Sent items were deleted but logs show 34 letters to customers over two weeks. Requires an urgent customer warning campaign.' },
          { at: 16, channel: 'sms_notification', cast: 'impostor', cell: 'operational', title: 'SMS from the "CEO" to a subsidiary', intent: 'The subsidiary\'s finance head receives an SMS signed by the CEO announcing a call about a confidential deal. Shows the attackers are still active.' },
          { at: 24, channel: 'email_external', cast: 'journalist', cell: 'communication', title: 'Journalist asks about a deepfake fraud', intent: 'A financial journalist asks to confirm a multi-million loss involving the CEO\'s cloned voice. Tests disclosure strategy.' }
        ]
      },
      {
        key: 'eradication',
        type: 'eradication',
        title: 'Cleaning identities and payment processes',
        track: 'main',
        start: 110,
        duration: 25,
        stimuli: 2,
        brief: 'Test remediation measures and their impact on finance operations.',
        narrative: 'Every finance account must have sessions revoked and move to phishing-resistant MFA, locking the team out during month-end close. A new call-back rule for bank details slows payments. Players must accept operational friction to close the gaps.',
        objectives: [1, 5],
        events: [
          { at: 0, text: 'Month-end close is under way and the finance team is working at full load' },
          { at: 10, text: 'Attacker sessions on the CFO\'s account are cut, malicious inbox rules removed and lookalike domains reported for takedown' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ciso', cell: 'decision', title: 'Token revocation and MFA re-enrolment', intent: 'The CISO wants to revoke all finance sessions and enforce hardware keys, disrupting month-end close. Requires executive backing.' },
          { at: 12, channel: 'email_internal', cast: 'cfo', cell: 'operational', title: 'Call-back rule for every bank detail change', intent: 'The CFO proposes a mandatory call-back to a known number and dual approval above a threshold. Players must validate controls and their cost.' }
        ]
      },
      {
        key: 'recovery',
        type: 'recovery',
        title: 'Day +2: recovering funds and payments',
        track: 'main',
        start: 135,
        duration: 25,
        stimuli: 2,
        brief: 'Compress time to Day +2 and test the handling of partial recovery and third-party disputes.',
        narrative: 'Simulated time jumps to Day +2. A court order freezes part of the funds but the rest is probably lost. The customer that paid the fraudulent account refuses to pay twice. Players must decide on commercial and legal positions.',
        objectives: [0, 4],
        events: [
          { at: 0, text: 'Two days later, recall procedures and the police investigation are running in several countries' },
          { at: 12, text: 'Customers who received fake letters are reviewing all their recent payments to the organisation' }
        ],
        beats: [
          { at: 0, channel: 'email_external', cast: 'bank', cell: 'legal', title: 'Court order freezes 1.9 million', intent: 'The bank confirms a partial freeze and low chances for the remaining 2.9 million. Tests loss acceptance and follow-up.' },
          { at: 13, channel: 'email_external', cast: 'customer', cell: 'decision', title: 'Customer refuses to pay twice', intent: 'The customer argues the fraudulent letter came from the organisation\'s real mailbox, so the loss is not theirs. Forces a commercial and legal decision.' }
        ]
      },
      {
        key: 'exit',
        type: 'exit',
        title: 'Day +15: controls and accountability',
        track: 'main',
        start: 160,
        duration: 20,
        stimuli: 2,
        brief: 'Close with control improvements and governance reporting.',
        narrative: 'Simulated time jumps to Day +15. The auditor qualifies the case as a significant deficiency and the CEO announces new verification rules. Players must formalise lessons learned and exit the crisis.',
        objectives: [4, 5],
        events: [
          { at: 0, text: 'Fifteen days on, no new fraud attempt has been detected and 1.9 million euros remain frozen pending court decisions' },
          { at: 8, text: 'The board\'s audit committee schedules a dedicated session on the fraud and the remediation plan' }
        ],
        beats: [
          { at: 0, channel: 'email_external', cast: 'auditor', cell: 'legal', title: 'Significant deficiency in internal control', intent: 'The auditor will report the case to the audit committee and asks for the remediation plan. Tests accountability and reporting.' },
          { at: 10, channel: 'internal_memo', cast: 'ceo', cell: 'decision', title: 'CEO memo: verification rules for all', intent: 'Draft memo introducing call-back, code words for urgent requests and deepfake awareness for all managers. Players must validate content.' }
        ]
      },
      {
        key: 'crisis-cell',
        type: 'crisis_cell',
        title: 'A small, confidential crisis cell',
        track: 'governance',
        start: 20,
        duration: 70,
        stimuli: 2,
        brief: 'Test governance of a sensitive financial crisis.',
        narrative: 'The CFO wants a very restricted cell to avoid leaks, while counsel raises whether the loss is inside information for a listed company. Players must balance confidentiality, board information and disclosure obligations.',
        objectives: [4],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'cfo', cell: 'decision', title: 'A restricted cell to avoid leaks', intent: 'The CFO proposes a cell of four people and no board information until facts are known. Tests governance and conflicts of interest.' },
          { at: 44, channel: 'email_internal', cast: 'legal', cell: 'legal', title: 'Is the loss inside information?', intent: 'Counsel asks whether a loss of this size requires market disclosure. Forces an explicit decision and documentation.' }
        ]
      },
      {
        key: 'people',
        type: 'hr',
        title: 'Supporting the treasury manager',
        track: 'people',
        start: 30,
        duration: 90,
        stimuli: 3,
        brief: 'Test the HR and human dimension of social engineering fraud.',
        narrative: 'The CFO wants the treasury manager suspended while the employee is in shock and rumours spread in the finance team. Players must establish facts fairly, provide support and communicate internally without naming anyone.',
        objectives: [3],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'hr', cell: 'hr', title: 'Suspension or support?', intent: 'The HR director reports the CFO\'s request to suspend the employee and recommends psychological support. Players must decide.' },
          { at: 38, channel: 'email_internal', cast: 'treasury', cell: 'hr', title: '"Everyone is blaming me"', intent: 'The employee writes that colleagues avoid her and she fears dismissal. Tests the organisation\'s duty of care.' },
          { at: 75, channel: 'internal_memo', cast: 'hr', cell: 'hr', kind: 'nudge', title: 'Rumours in finance: the note is still pending', intent: 'The HR director reminds the cell that the note to finance teams, explaining the fraud technique without naming anyone and restating verification rules, is still not validated while rumours name the treasury manager.' }
        ]
      },
      {
        key: 'legal',
        type: 'legal',
        title: 'Complaint, insurer and auditor',
        track: 'legal',
        start: 45,
        duration: 95,
        stimuli: 2,
        brief: 'Test insurance and audit obligations after a fraud.',
        narrative: 'The crime policy must be notified quickly and may cap social engineering losses. The auditor wants details before the quarterly close. Players must secure the claim and prepare accounting treatment.',
        objectives: [4],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'legal', cell: 'legal', title: 'Crime insurance: deadlines and sublimit', intent: 'Counsel notes the policy requires notification within 48 hours and caps social engineering losses at 1 million euros. Tests claims management.' },
          { at: 51, channel: 'email_external', cast: 'auditor', cell: 'legal', title: 'Auditor requests incident details', intent: 'The auditor asks for a written account and the expected loss before the quarterly close. Tests financial reporting readiness.' }
        ]
      },
      {
        key: 'communication',
        type: 'communication',
        title: 'Confidential until it leaks',
        track: 'communication',
        start: 105,
        duration: 65,
        stimuli: 2,
        brief: 'Test communication once the fraud becomes public.',
        narrative: 'The press publishes the story of the deepfake and a customer warns peers publicly. Players must communicate on the fraud without revealing investigative details and reassure partners.',
        objectives: [4, 2],
        beats: [
          { at: 0, channel: 'article_press', cast: 'journalist', cell: 'communication', title: 'Deepfake of CEO costs millions', intent: 'Article published shortly after the journalist\'s request, with or without the organisation\'s comment, describing the cloned voice fraud and questioning controls. Tests the public line and the CEO\'s exposure.' },
          { at: 36, channel: 'post_linkedin', cast: 'customer', cell: 'business', title: 'Customer warns peers about fake IBAN letters', intent: 'The customer publicly warns others about fake bank detail letters from the organisation. Tests partner communication.' }
        ]
      },
      {
        key: 'payments',
        type: 'continuity',
        title: 'Payments on hold',
        track: 'business',
        start: 55,
        duration: 75,
        stimuli: 2,
        brief: 'Test the continuity of financial operations when payments are frozen.',
        narrative: 'With the payment run stopped and the bank restricting transfers, suppliers go unpaid. Players must define a secure exception process for critical payments.',
        objectives: [1, 5],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'cfo', cell: 'business', title: 'If the payment run is frozen: which suppliers are critical?', intent: 'Ahead of the decision on tonight\'s run, the CFO lists critical suppliers that would stop deliveries if left unpaid. Players must define a verified exception process.' },
          { at: 45, channel: 'email_external', cast: 'bank', cell: 'business', title: 'Bank restricts outgoing transfers', intent: 'The bank limits outgoing transfers pending a review of the organisation\'s access. Tests banking relationship management.' }
        ]
      }
    ]
  },
  {
    id: 'destructive-wiper',
    name: 'Destructive wiper disguised as ransomware',
    category: 'Cyber attack',
    icon: 'flame',
    duration_minutes: 180,
    summary: 'On a Monday morning, thousands of workstations and servers reboot onto a ransom screen. Within hours, analysts establish that the malicious code overwrites disks and never stored any key: this is a wiper disguised as ransomware, part of a wider campaign hitting several countries. Domain controllers, the backup server, email and telephony are destroyed, and factories and warehouses stop. The crisis cell must run the organisation without IT, protect what is still intact, keep essential operations going on paper and govern a rebuild from scratch that will take weeks, while caring for employees and facing customers who fear contamination.',
    threat: 'A state-aligned group used a compromised administrator account to deploy a destructive wiper ("PayLock") through group policy across the domain, disguised as ransomware to blur attribution. Impact: most Windows systems and backups destroyed, no decryption possible, weeks of degraded operations.',
    tags: ['wiper', 'destructive attack', 'rebuild', 'IT outage', 'business continuity', 'out-of-band'],
    objectives: [
      'Recognise quickly that the attack is destructive and that paying would not restore anything, and adapt the strategy accordingly',
      'Run the crisis organisation without email, phones or collaboration tools, using out-of-band means',
      'Contain the spread and protect what is still intact (offline backups, cloud tenant, subsidiaries, industrial sites)',
      'Plan and govern a full rebuild: clean core, prioritisation of business services and mass workstation reimaging',
      'Keep essential operations and customer commitments running in degraded mode for several days',
      'Look after employees and communicate with staff, customers, authorities and media once internal channels are gone'
    ],
    cast: [
      { key: 'helpdesk', label: 'IT service desk lead', role: 'internal', organization: 'The organisation', description: 'First to see screens go red and flooded with calls from employees.' },
      { key: 'cio', label: 'Chief Information Officer', role: 'internal', organization: 'The organisation', description: 'Faces the loss of the entire IT estate and owns the rebuild plan.' },
      { key: 'ciso', label: 'Chief Information Security Officer', role: 'internal', organization: 'The organisation', description: 'Drives containment and the security of the new clean environment.' },
      { key: 'ceo', label: 'Chief Executive Officer', role: 'internal', organization: 'The organisation', description: 'Chairs the crisis cell and must keep the company functioning.' },
      { key: 'coo', label: 'Chief Operating Officer', role: 'internal', organization: 'The organisation', description: 'Responsible for factories, warehouses and deliveries.' },
      { key: 'hr', label: 'HR director', role: 'internal', organization: 'The organisation', description: 'Must reach and organise 6,000 employees without email or intranet.' },
      { key: 'comms', label: 'Communication director', role: 'internal', organization: 'The organisation', description: 'Handles media and internal messaging with no digital channels.' },
      { key: 'ir_firm', label: 'Incident response lead', role: 'partner', organization: 'Incident response firm', description: 'Leads forensics and designs the rebuild approach.' },
      { key: 'agency', label: 'National cybersecurity agency', role: 'authority', organization: 'National CSIRT', description: 'Coordinates the response to a multi-country campaign.' },
      { key: 'journalist', label: 'Business journalist', role: 'journalist', organization: 'International business media', description: 'Covers the global wiper campaign and its corporate victims.' },
      { key: 'customer', label: 'Supply chain director', role: 'client_b2b', organization: 'Major industrial customer', description: 'Depends on deliveries and fears contamination through interconnections.' },
      { key: 'attacker', label: '"PayLock" persona', role: 'attacker', organization: 'State-aligned group', description: 'Fake ransomware persona used to mask a destructive operation.' }
    ],
    tracks: ['main', 'governance', 'communication', 'people'],
    blocks: [
      {
        key: 'trigger',
        type: 'trigger',
        title: 'Black screens at 08:05',
        track: 'main',
        start: 0,
        duration: 15,
        stimuli: 3,
        brief: 'Open with a sudden, massive outage that also takes down the usual crisis tools.',
        narrative: 'Hundreds of workstations reboot onto a ransom screen as staff arrive. Email, telephony and the ERP disappear within minutes, so the first alerts come by SMS and voicemail. Players believe it is ransomware. They must activate the crisis organisation without their usual tools and give first instructions to staff.',
        objectives: [1, 0],
        events: [
          { at: 0, text: 'As staff arrive on Monday morning, workstations and servers across all sites reboot one after another onto a ransom screen' },
          { at: 8, text: 'Employees gather in corridors and call colleagues on personal phones; rumours spread across sites' }
        ],
        beats: [
          { at: 0, channel: 'sms_notification', cast: 'helpdesk', cell: 'it', title: 'Hundreds of PCs reboot to a red screen', intent: 'The service desk lead reports massive reboots and a ransom message on every screen. Starts activation without email.' },
          { at: 4, channel: 'audio_message', cast: 'cio', cell: 'operational', title: 'CIO voicemail: email, phones and ERP gone', intent: 'The CIO leaves a hurried voicemail: core systems unreachable, IP telephony down. Forces out-of-band coordination.' },
          { at: 9, channel: 'email_external', cast: 'helpdesk', cell: 'decision', title: 'Photo of the ransom note', intent: 'Sent from a personal webmail: a photo of the note asking for bitcoin to an email address. Makes players think about the ransom option.' }
        ]
      },
      {
        key: 'investigation',
        type: 'investigation',
        title: 'Ransomware that does not want money',
        track: 'main',
        start: 15,
        duration: 30,
        stimuli: 4,
        brief: 'Reveal the destructive nature of the attack and the scale of the damage.',
        narrative: 'Responders find that disks are overwritten and no key was ever stored. The agency links the attack to a multi-country campaign. Operations stop across sites and the backup server was wiped with the domain. Players must abandon the ransom track and prepare for a rebuild.',
        objectives: [0, 3],
        events: [
          { at: 0, text: 'The incident response firm arrives on site and starts analysing wiped machines' },
          { at: 12, text: 'Staff sit idle in front of dead screens and customers calling the switchboard get no answer' }
        ],
        beats: [
          { at: 0, channel: 'email_external', cast: 'ir_firm', cell: 'decision', title: 'Preliminary analysis: this is a wiper', intent: 'The code overwrites the master boot record and discards encryption keys: decryption is impossible even if paid. Changes the whole strategy.' },
          { at: 9, channel: 'email_authority', cast: 'agency', cell: 'legal', title: 'Same wiper in several countries', intent: 'The agency reports a coordinated destructive campaign attributed to a state-aligned actor and requests samples. Adds geopolitical context.' },
          { at: 18, channel: 'audio_message', cast: 'coo', cell: 'business', title: 'Factories and warehouses at a standstill', intent: 'The COO reports that production planning and shipping labels are down on all sites. Makes business impact concrete.' },
          { at: 25, channel: 'email_external', cast: 'ciso', cell: 'it', title: 'Domain controllers and backup server destroyed', intent: 'From an emergency webmail, the CISO confirms all domain controllers and the backup server are wiped; tapes are nine days old. Sets the rebuild challenge.' }
        ]
      },
      {
        key: 'containment',
        type: 'containment',
        title: 'Stopping the spread with no network',
        track: 'main',
        start: 45,
        duration: 20,
        stimuli: 3,
        brief: 'Force containment choices to protect what is still intact.',
        narrative: 'A foreign subsidiary is still unaffected but connected by VPN. Employees power on laptops that were off at 08:05, risking their destruction. The cloud tenant is intact but uses the same admin identities. Players must decide what to disconnect and how to instruct staff with no internal channel.',
        objectives: [2, 1],
        events: [
          { at: 0, text: 'About a third of the laptops, switched off during the attack, are still intact' },
          { at: 10, text: 'Forensics trace the malicious group policy to a compromised domain administrator account' }
        ],
        beats: [
          { at: 0, channel: 'audio_message', cast: 'ciso', cell: 'decision', title: 'Cut the subsidiaries and cloud sync', intent: 'The CISO recommends disconnecting the intact subsidiary and all synchronisation, which would stop its operations too. Requires an immediate decision.' },
          { at: 7, channel: 'sms_notification', cast: 'helpdesk', cell: 'hr', kind: 'nudge', title: 'Still no staff instruction: more laptops wiped', intent: 'With no instruction relayed yet, employees keep switching on laptops that were off during the attack, which then get wiped. The service desk presses the cell to reach staff now.' },
          { at: 14, channel: 'email_external', cast: 'ir_firm', cell: 'it', title: 'Protect the cloud tenant and tapes', intent: 'Responders urge resetting cloud admin accounts and physically securing tapes before the attackers act. Tests prioritisation.' }
        ]
      },
      {
        key: 'collateral',
        type: 'twist',
        title: 'Collateral damage and public exposure',
        track: 'main',
        start: 65,
        duration: 20,
        stimuli: 3,
        brief: 'Escalate: external parties fear contamination and the attack becomes a global story.',
        narrative: 'A major customer accuses the organisation of spreading the wiper through their interconnection. Television lists the organisation among victims of a global campaign. The fake ransomware persona mocks victims, confirming no key ever existed. Players must handle third-party trust and public exposure.',
        objectives: [0, 5],
        events: [
          { at: 0, text: 'News of the same wiper hitting companies in several countries spreads across social media' },
          { at: 10, text: 'Several customers and partners cut their network links with the organisation as a precaution' }
        ],
        beats: [
          { at: 0, channel: 'email_external', cast: 'customer', cell: 'business', title: 'Your link infected us', intent: 'The customer claims its own systems were hit through the EDI connection and demands proof of containment. Tests third-party communication.' },
          { at: 7, channel: 'breaking_news_tv', cast: 'journalist', cell: 'communication', title: 'Global wiper hits multinationals', intent: 'Ticker names the organisation among victims and mentions a state-backed attack. Raises public and investor pressure.' },
          { at: 13, channel: 'post_twitter', cast: 'attacker', cell: 'decision', title: '"There was never a key"', intent: 'The persona mocks victims who tried to pay. Confirms the destructive intent and blocks any ransom illusion.' }
        ]
      },
      {
        key: 'eradication',
        type: 'eradication',
        title: 'Building a clean core',
        track: 'main',
        start: 85,
        duration: 25,
        stimuli: 3,
        brief: 'Test governance of a rebuild from scratch and its business trade-offs.',
        narrative: 'Responders recommend building a new, clean Active Directory forest rather than restoring anything. The CIO needs business to rank applications. Restoring from tapes means losing nine days of data. Players must set priorities and accept data loss.',
        objectives: [3],
        events: [
          { at: 0, text: 'An emergency cloud tenant goes live for the crisis cell and key managers' },
          { at: 12, text: 'Hardware suppliers announce long lead times for replacement servers and laptops' }
        ],
        beats: [
          { at: 0, channel: 'email_external', cast: 'ir_firm', cell: 'decision', title: 'Rebuild from scratch: a new forest', intent: 'Three-week plan to build a clean identity core and restore only verified data. Requires executive endorsement and budget.' },
          { at: 8, channel: 'email_internal', cast: 'cio', cell: 'business', title: 'Which 15 applications first?', intent: 'Sent from the new emergency tenant: the CIO asks business leaders to rank 180 applications and pick the first 15. Forces prioritisation.' },
          { at: 17, channel: 'email_internal', cast: 'ciso', cell: 'operational', kind: 'nudge', title: 'Rebuild still not endorsed: nine days of data at stake', intent: 'The CISO reminds the cell that the rebuild plan is still awaiting endorsement and that restoring from tapes loses nine days of orders and accounting entries to rebuild manually. Tests business acceptance.' }
        ]
      },
      {
        key: 'continuity',
        type: 'continuity',
        title: 'Day +1: running on paper',
        track: 'main',
        start: 110,
        duration: 25,
        stimuli: 3,
        brief: 'Compress time to Day +1 and test sustained degraded operations.',
        narrative: 'Simulated time jumps to Day +1. Sites work with paper forms and spreadsheets on standalone laptops. The customer demands delivery commitments and warehouses cannot ship. Players must decide which flows to maintain and how.',
        objectives: [4],
        events: [
          { at: 0, text: 'Day +1: sites reopen with paper forms, spreadsheets on standalone laptops and runners between buildings' },
          { at: 12, text: 'The order backlog grows as customers call sites directly on personal mobile numbers' }
        ],
        beats: [
          { at: 0, channel: 'internal_memo', cast: 'coo', cell: 'operational', title: 'Manual operating mode for sites', intent: 'Memo listing paper procedures for orders, production and shipping. Tests realism of continuity plans.' },
          { at: 9, channel: 'email_external', cast: 'customer', cell: 'business', kind: 'nudge', title: 'Customer chases: still no delivery commitment', intent: 'Still without proof of containment or a schedule, the customer demands guaranteed dates for critical parts, or will trigger alternative sourcing. Forces allocation choices.' },
          { at: 18, channel: 'sms_notification', cast: 'coo', cell: 'operational', title: 'Warehouse cannot ship without labels', intent: 'The COO reports trucks waiting because labels and customs documents cannot be printed. Requires a quick workaround.' }
        ]
      },
      {
        key: 'recovery',
        type: 'recovery',
        title: 'Day +7: the great reimaging',
        track: 'main',
        start: 135,
        duration: 30,
        stimuli: 3,
        brief: 'Compress time to Day +7 and test the pace and control of the recovery.',
        narrative: 'Simulated time jumps to Day +7. Email and the ERP run on the clean core, but thousands of laptops still need reimaging. Media describe a long road back. Players must balance speed and security.',
        objectives: [3, 4],
        events: [
          { at: 0, text: 'A week later, the clean core is running and reimaging stations operate in shifts at the main sites' },
          { at: 15, text: 'Teams are still re-entering nine days of lost orders and accounting entries by hand' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'cio', cell: 'decision', title: 'Wave 1 live on the clean core', intent: 'The CIO announces email and ERP are back for 800 key users and asks approval for wave 2. Tests go/no-go discipline.' },
          { at: 11, channel: 'email_internal', cast: 'helpdesk', cell: 'it', title: '1,800 of 6,000 laptops reimaged', intent: 'Progress report with a backlog and pressure from managers to jump the queue. Tests prioritisation rules.' },
          { at: 21, channel: 'article_press', cast: 'journalist', cell: 'communication', title: 'The long road back', intent: 'Article estimating weeks of disruption and quoting worried employees. Tests the organisation\'s narrative of recovery.' }
        ]
      },
      {
        key: 'exit',
        type: 'exit',
        title: 'Day +30: back to normal?',
        track: 'main',
        start: 165,
        duration: 15,
        stimuli: 2,
        brief: 'Close with exit criteria and a resilience programme.',
        narrative: 'Simulated time jumps to Day +30. Most services are back. The agency requests a final report and the CEO announces a resilience programme. Players must define when the crisis ends and what changes permanently.',
        objectives: [3, 5],
        events: [
          { at: 0, text: 'A month after the attack, most business services are back and the order backlog is cleared' },
          { at: 7, text: 'Several governments publicly attribute the multi-country wiper campaign to a state-aligned group' }
        ],
        beats: [
          { at: 0, channel: 'email_authority', cast: 'agency', cell: 'legal', title: 'Final report and sector sharing', intent: 'The agency asks for the final report and permission to share anonymised lessons with the sector. Tests transparency.' },
          { at: 8, channel: 'internal_memo', cast: 'ceo', cell: 'decision', title: 'CEO memo: a resilience programme', intent: 'Draft memo thanking staff and announcing offline backups, tiered administration and crisis drills. Players must validate commitments.' }
        ]
      },
      {
        key: 'crisis-cell',
        type: 'crisis_cell',
        title: 'A crisis cell without IT',
        track: 'governance',
        start: 15,
        duration: 50,
        stimuli: 2,
        brief: 'Test the ability to govern when every usual tool is gone.',
        narrative: 'The CEO convenes the cell by SMS. Teams improvise messaging groups on personal phones, which raises confidentiality and security issues. Players must define out-of-band rules, roles and a meeting rhythm.',
        objectives: [1],
        beats: [
          { at: 0, channel: 'sms_notification', cast: 'ceo', cell: 'decision', title: 'Crisis cell at HQ, room 4, 09:00', intent: 'SMS convening the executive committee in person. Tests activation without the usual tools and the presence of the right people.' },
          { at: 25, channel: 'internal_memo', cast: 'ciso', cell: 'operational', title: 'Out-of-band communication rules', intent: 'The CISO proposes rules for personal phones, messaging groups and paper logs. Players must validate a secure yet practical setup.' }
        ]
      },
      {
        key: 'communication',
        type: 'communication',
        title: 'Talking without email',
        track: 'communication',
        start: 25,
        duration: 80,
        stimuli: 2,
        brief: 'Test external and internal messaging when digital channels are gone.',
        narrative: 'The communication director drafts a statement but must decide whether to say "wiper" or mention a state actor. A journalist presses on attribution. Players must be factual without speculating.',
        objectives: [5],
        beats: [
          { at: 0, channel: 'internal_memo', cast: 'comms', cell: 'communication', title: 'Statement: cyber attack, no ransom', intent: 'Paper draft statement saying the organisation will not pay. Players must decide whether to disclose the destructive nature of the attack.' },
          { at: 40, channel: 'email_external', cast: 'journalist', cell: 'communication', title: 'Is this a state attack?', intent: 'The journalist asks whether the organisation was targeted for political reasons. Tests restraint on attribution.' }
        ]
      },
      {
        key: 'staff',
        type: 'hr',
        title: 'Six thousand staff with nothing to work on',
        track: 'people',
        start: 45,
        duration: 65,
        stimuli: 2,
        brief: 'Test HR management during a prolonged outage.',
        narrative: 'Employees cannot work and have no information. IT teams are exhausted. Players must decide on work arrangements, communication cascades and support for overwhelmed teams.',
        objectives: [5],
        beats: [
          { at: 0, channel: 'internal_memo', cast: 'hr', cell: 'hr', title: 'What do we tell 6,000 employees?', intent: 'Draft instructions to be relayed by managers and SMS: stay home or come in, what to do with laptops. Tests cascade communication.' },
          { at: 30, channel: 'audio_message', cast: 'hr', cell: 'hr', title: 'IT teams will not hold the pace', intent: 'The HR director warns that IT teams have worked non-stop since the attack and face weeks of rebuild; asks for rotation and rest rules now. Tests duty of care.' }
        ]
      },
      {
        key: 'reimaging',
        type: 'logistics',
        title: 'The reimaging factory',
        track: 'people',
        start: 85,
        duration: 60,
        stimuli: 2,
        brief: 'Test the logistics of rebuilding thousands of devices.',
        narrative: 'The organisation needs hardware, USB media and space to reimage thousands of devices. Queues form and suppliers cannot deliver quickly. Players must organise logistics and priorities.',
        objectives: [3, 4],
        beats: [
          { at: 0, channel: 'internal_memo', cast: 'cio', cell: 'business', title: 'We need 2,000 laptops and USB keys', intent: 'The CIO requests emergency purchases, but suppliers can only deliver in ten days. Tests procurement under crisis.' },
          { at: 30, channel: 'email_internal', cast: 'helpdesk', cell: 'operational', title: 'Six hundred people queuing', intent: 'On Day +1, staff queue for hours at the IT centre to have laptops checked or swapped. Requires appointment slots and priority rules.' }
        ]
      }
    ]
  },
  {
    id: 'insider-threat-sabotage',
    name: 'Insider sabotage and document leak',
    category: 'Data',
    icon: 'user',
    duration_minutes: 180,
    summary: 'On a Friday night, backups are deleted, service accounts disabled and file shares wiped using a valid administrator account. The trail leads to a senior infrastructure administrator who resigned three weeks earlier after a denied promotion and kept all his privileges during his notice period. Before acting, he copied confidential documents, including an ongoing acquisition project, board minutes and the salary grid, which he starts leaking and using to demand a settlement. The crisis cell must contain a person who knows every system, preserve evidence without breaching employment and privacy law, handle a leak with market and social consequences and communicate without defaming anyone.',
    threat: 'A disgruntled privileged insider planted scheduled tasks to destroy backups and data, exfiltrated about 40 GB of confidential documents to a personal cloud account and uses anonymous channels to leak and extort. Impact: data loss, disclosure of strategic and personal data, social tension and legal exposure.',
    tags: ['insider threat', 'sabotage', 'leak', 'employment law', 'privileged access', 'M&A'],
    objectives: [
      'Detect and qualify sabotage by a privileged insider and preserve evidence that will stand in court',
      'Contain the insider\'s access and hidden mechanisms without breaching employment law or privacy rules',
      'Handle the leak of confidential documents, including M&A and personal data, and its legal consequences',
      'Manage the employment and social dimension: the departing employee, his colleagues and staff representatives',
      'Communicate internally and externally without defamation while protecting the investigation',
      'Restore systems and strengthen joiner-mover-leaver and privileged access controls'
    ],
    cast: [
      { key: 'infra_lead', label: 'Infrastructure manager', role: 'internal', organization: 'The organisation', description: 'Manager of the administrator involved; discovers the damage and knows the systems.' },
      { key: 'ciso', label: 'Chief Information Security Officer', role: 'internal', organization: 'The organisation', description: 'Leads the investigation and the revocation of privileged access.' },
      { key: 'ceo', label: 'Chief Executive Officer', role: 'internal', organization: 'The organisation', description: 'Sponsor of the confidential acquisition project now at risk.' },
      { key: 'hr', label: 'HR director', role: 'internal', organization: 'The organisation', description: 'Holds the employee\'s file and the employment law options.' },
      { key: 'legal', label: 'General counsel', role: 'internal', organization: 'The organisation', description: 'Advises on evidence, complaint, extortion and market disclosure.' },
      { key: 'dpo', label: 'Data Protection Officer', role: 'internal', organization: 'The organisation', description: 'Assesses the personal data breach and the limits on employee monitoring.' },
      { key: 'comms', label: 'Communication director', role: 'internal', organization: 'The organisation', description: 'Must speak about the case without naming or defaming anyone.' },
      { key: 'insider', label: 'The departing administrator', role: 'attacker', organization: 'Former employee', description: 'Uses anonymous accounts to leak, extort and present himself as a whistleblower.' },
      { key: 'journalist', label: 'Investigative journalist', role: 'journalist', organization: 'Business newspaper', description: 'Has received confidential documents and seeks confirmation.' },
      { key: 'staff_rep', label: 'Employee representative', role: 'internal', organization: 'Works council', description: 'Voices staff anger over the salary leak and fears of surveillance.' },
      { key: 'police', label: 'Cybercrime investigator', role: 'authority', organization: 'Cybercrime police unit', description: 'Handles the complaint and the arrest of the suspect.' },
      { key: 'target_ceo', label: 'CEO of the acquisition target', role: 'partner', organization: 'Acquisition target company', description: 'Learns that confidential deal documents are circulating.' }
    ],
    tracks: ['main', 'governance', 'people', 'legal', 'communication'],
    blocks: [
      {
        key: 'trigger',
        type: 'trigger',
        title: 'Backups vanish on a Friday night',
        track: 'main',
        start: 0,
        duration: 20,
        stimuli: 3,
        brief: 'Open with destruction that looks like an attack but leaves no malware trace.',
        narrative: 'Backup jobs fail because repositories are empty, then service accounts are disabled and file shares wiped. Everything was done with a legitimate administrator account. Players initially suspect an external attacker. They must mobilise the right people over the weekend and preserve logs before anything else is lost.',
        objectives: [0],
        events: [
          { at: 0, text: 'Late on a Friday night, backup repositories, service accounts and file shares start disappearing one after another' },
          { at: 10, text: 'The weekend on-call chain is activated and managers are called in while the systems keep degrading' }
        ],
        beats: [
          { at: 0, channel: 'sms_notification', cast: 'infra_lead', cell: 'it', title: 'Backup jobs failed: repositories empty', intent: 'Automated alert forwarded by the infrastructure manager: all backup repositories deleted at 22:00. Starts weekend escalation.' },
          { at: 7, channel: 'email_internal', cast: 'infra_lead', cell: 'operational', title: 'Service accounts disabled, shares wiped', intent: 'Critical service accounts are disabled and three file servers emptied. Business impact will hit on Monday.' },
          { at: 14, channel: 'email_internal', cast: 'ciso', cell: 'it', title: 'Done with a valid admin account', intent: 'No malware found: actions used a legitimate backup admin account through the VPN. Points toward someone with inside knowledge.' }
        ]
      },
      {
        key: 'investigation',
        type: 'investigation',
        title: 'An inside job',
        track: 'main',
        start: 20,
        duration: 30,
        stimuli: 3,
        brief: 'Identify the insider and reveal the data exfiltration.',
        narrative: 'Logs show scheduled tasks created the day after the administrator\'s resignation and VPN sessions from his home. His HR file mentions a bitter dispute. He also uploaded 40 GB of confidential documents to a personal cloud. Players must avoid jumping to conclusions while securing evidence.',
        objectives: [0, 2],
        events: [
          { at: 0, text: 'Forensic review of the weekend\'s logs begins and the VPN sessions are traced back to a home internet connection' },
          { at: 15, text: 'Proxy logs covering the three weeks since the resignation are pulled and show unusually heavy outbound traffic' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ciso', cell: 'it', title: 'Traces lead to a departing administrator', intent: 'Scheduled tasks were created three weeks ago under the administrator\'s account, the day after he resigned. Raises the insider hypothesis.' },
          { at: 11, channel: 'email_internal', cast: 'hr', cell: 'hr', title: 'Resigned after a bitter dispute', intent: 'The HR director shares that he resigned after a denied promotion, sent angry emails and keeps all access during his notice period. Tests handling of sensitive HR information.' },
          { at: 21, channel: 'email_internal', cast: 'ciso', cell: 'legal', title: '40 GB uploaded to a personal cloud', intent: 'Proxy logs show uploads of acquisition files, board minutes and the salary grid. Extends the crisis to a data leak.' }
        ]
      },
      {
        key: 'containment',
        type: 'containment',
        title: 'Cutting access, carefully',
        track: 'main',
        start: 50,
        duration: 30,
        stimuli: 3,
        brief: 'Force containment decisions constrained by law and by the insider\'s knowledge.',
        narrative: 'Counsel warns that evidence must be collected properly and that the employee\'s privacy is protected. The insider holds 14 privileged accounts, and revoking them might trigger a hidden mechanism. His badge is used at the data centre at dawn. Players must act fast but lawfully.',
        objectives: [1],
        events: [
          { at: 0, text: 'Dawn breaks on Saturday: the administrator\'s accounts, keys and badge are all still active' },
          { at: 15, text: 'Monitoring shows no new activity from his accounts overnight, which worries the team more than it reassures them' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'legal', cell: 'legal', title: 'Evidence and employment law first', intent: 'Counsel recommends a bailiff, forensic images and no access to his personal mailbox. Tests lawful evidence collection.' },
          { at: 10, channel: 'email_internal', cast: 'ciso', cell: 'it', title: '14 privileged accounts, possible dead man\'s switch', intent: 'The insider has admin, cloud, network and break-glass accounts. Revoking all at once may trigger a hidden task. Requires a coordinated plan.' },
          { at: 20, channel: 'sms_notification', cast: 'infra_lead', cell: 'operational', title: 'His badge used at the data centre', intent: 'The administrator\'s badge was used at the data centre at 06:10. Forces an immediate physical security decision.' }
        ]
      },
      {
        key: 'leak',
        type: 'twist',
        title: 'The documents surface',
        track: 'main',
        start: 80,
        duration: 25,
        stimuli: 4,
        brief: 'Escalate: the insider turns the leak into extortion and public exposure.',
        narrative: 'An anonymous message demands a settlement and a neutral reference in exchange for silence. The salary grid appears on a public forum. The CEO of the acquisition target calls, and a journalist holds the board minutes. Players must refuse or frame negotiation, protect the deal and manage staff anger.',
        objectives: [2, 4],
        events: [
          { at: 0, text: 'The administrator goes on the offensive through anonymous accounts, turning the stolen files into leverage' },
          { at: 12, text: 'Screenshots of the leaked salary grid spread through staff messaging groups and reach people outside the organisation' }
        ],
        beats: [
          { at: 0, channel: 'email_external', cast: 'insider', cell: 'decision', title: '"I have everything"', intent: 'Anonymous email demanding a settlement and a neutral reference, otherwise the acquisition file will be published. Creates an extortion dilemma.' },
          { at: 7, channel: 'post_reddit', cast: 'insider', cell: 'hr', title: 'Salary grid posted online', intent: 'The full salary grid is posted on a public forum with names. Triggers a personal data breach and social tension.' },
          { at: 14, channel: 'audio_message', cast: 'target_ceo', cell: 'business', title: '"Is our deal leaking?"', intent: 'The target company\'s CEO calls: a journalist has asked him about the deal and he invokes the NDA. Tests partner management and market disclosure.' },
          { at: 19, channel: 'email_external', cast: 'journalist', cell: 'communication', title: 'Journalist holds the board minutes', intent: 'The journalist asks for comment on board minutes discussing the acquisition and layoffs. Deadline pressure on communication.' }
        ]
      },
      {
        key: 'eradication',
        type: 'eradication',
        title: 'Hunting the time bombs',
        track: 'main',
        start: 105,
        duration: 25,
        stimuli: 2,
        brief: 'Show the depth of cleaning required after a trusted administrator turns hostile.',
        narrative: 'Two more scheduled tasks are found, one set to delete the ERP database next month. Every secret the administrator ever knew must be rotated. Players must decide scope, downtime and review of years of scripts.',
        objectives: [1, 5],
        events: [
          { at: 0, text: 'A line-by-line review of eight years of scripts and scheduled tasks written by the administrator begins' },
          { at: 15, text: 'Teams uncover undocumented accounts and shared passwords he configured on network devices over the years' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ciso', cell: 'it', title: 'Two more hidden tasks found', intent: 'One task would have deleted the ERP database at month end. Raises the need to review all scripts he wrote over eight years.' },
          { at: 12, channel: 'email_internal', cast: 'infra_lead', cell: 'decision', kind: 'nudge', title: 'Rotation plan still waiting for a go', intent: 'The infrastructure manager chases the cell: rotating 1,200 credentials and network device keys needs a weekend outage and cannot start without a decision. Relaunches the pending eradication scope decision.' }
        ]
      },
      {
        key: 'continuity',
        type: 'continuity',
        title: 'Business under scrutiny',
        track: 'main',
        start: 130,
        duration: 20,
        stimuli: 3,
        brief: 'Test continuity of the business and of the deal under public and social pressure.',
        narrative: 'Staff representatives demand a meeting on pay equity and on surveillance. The press publishes the story. The acquisition target threatens to walk away. Players must protect strategic interests while restoring trust internally.',
        objectives: [3, 2],
        events: [
          { at: 0, text: 'Employees discover missing files and the leaked salary grid, and anger spreads across departments' },
          { at: 10, text: 'The acquisition target\'s board convenes an emergency meeting on the future of the talks' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'staff_rep', cell: 'hr', title: 'Staff representatives demand a meeting', intent: 'Representatives denounce pay inequities revealed by the leak and ask for guarantees on IT monitoring. Tests social dialogue.' },
          { at: 7, channel: 'article_press', cast: 'journalist', cell: 'communication', title: 'Disgruntled admin exposes secret deal', intent: 'Article revealing the acquisition project and the sabotage. Tests market communication and the official line.' },
          { at: 14, channel: 'email_external', cast: 'target_ceo', cell: 'decision', kind: 'nudge', title: 'Target CEO chases: talks at risk', intent: 'Still without concrete answers since his first call, the target\'s CEO warns he will end talks unless strict confidentiality measures are demonstrated today. Relaunches the pending decision on the deal.' }
        ]
      },
      {
        key: 'recovery',
        type: 'recovery',
        title: 'Day +4: restoring and reassuring',
        track: 'main',
        start: 150,
        duration: 20,
        stimuli: 2,
        brief: 'Compress time to Day +4 and test the restoration and legal follow-up.',
        narrative: 'Simulated time jumps to Day +4. File shares are restored from an offline copy with two days of data loss. The police arrest the suspect and seize his devices. Players must coordinate with investigators and communicate cautiously.',
        objectives: [5, 0],
        events: [
          { at: 0, text: 'Day +4: systems are rebuilt and credential rotation is complete across the estate' },
          { at: 5, text: 'Investigators carry out a dawn search at the administrator\'s home' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'infra_lead', cell: 'business', title: 'File shares restored from offline copy', intent: 'Shares are back but two days of work are lost. Tests communication to business users.' },
          { at: 10, channel: 'email_authority', cast: 'police', cell: 'legal', title: 'Suspect in custody, devices seized', intent: 'The investigator confirms the arrest and asks the organisation not to name him publicly. Tests coordination with law enforcement.' }
        ]
      },
      {
        key: 'exit',
        type: 'exit',
        title: 'Day +20: closing the case',
        track: 'main',
        start: 170,
        duration: 10,
        stimuli: 2,
        brief: 'Close with process improvements and a message to staff.',
        narrative: 'Simulated time jumps to Day +20. HR and IT propose an overhaul of the leaver process and privileged access. The CEO addresses staff. Players must define exit criteria and remaining actions.',
        objectives: [5, 3],
        events: [
          { at: 0, text: 'Day +20: operations are back to normal and the criminal investigation follows its course' },
          { at: 6, text: 'Management and staff representatives hold a first meeting on pay transparency and IT monitoring' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'hr', cell: 'hr', title: 'Leaver process overhaul', intent: 'Proposal to reduce privileges on resignation, monitor high-risk departures lawfully and add dual control. Players must validate.' },
          { at: 5, channel: 'internal_memo', cast: 'ceo', cell: 'communication', title: 'CEO memo to staff', intent: 'Draft memo addressing the leak, pay equity concerns and new controls. Tests tone and commitments.' }
        ]
      },
      {
        key: 'crisis-cell',
        type: 'crisis_cell',
        title: 'Small circle, high stakes',
        track: 'governance',
        start: 20,
        duration: 50,
        stimuli: 2,
        brief: 'Test governance when the threat comes from inside the team.',
        narrative: 'The CEO wants to know how the administrator kept his access. The CISO suggests excluding the IT team from the cell in case of accomplices, although their knowledge is essential. Players must balance need-to-know and effectiveness.',
        objectives: [1, 3],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ceo', cell: 'decision', title: 'Who let him keep his access?', intent: 'Reacting to the CISO\'s findings, the CEO demands to know how a departing administrator could still act and who is to blame. Tests focus on response over blame.' },
          { at: 28, channel: 'email_internal', cast: 'ciso', cell: 'decision', title: 'Exclude the IT team from the cell?', intent: 'The CISO suggests limiting information to the IT team in case of accomplices. Tests need-to-know versus effectiveness.' }
        ]
      },
      {
        key: 'employment',
        type: 'hr',
        title: 'The departing administrator and his colleagues',
        track: 'people',
        start: 35,
        duration: 65,
        stimuli: 2,
        brief: 'Test employment law decisions and team morale.',
        narrative: 'HR must choose between suspension, dismissal for gross misconduct or waiting for the police. Colleagues in IT are shaken and fear being suspected. Players must act fairly and lawfully.',
        objectives: [3],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'hr', cell: 'hr', title: 'Suspend or dismiss?', intent: 'The HR director presents suspension, dismissal for gross misconduct or waiting for the police, with their legal risks and the notice period ending next Friday. Requires a decision with counsel.' },
          { at: 32, channel: 'email_internal', cast: 'staff_rep', cell: 'hr', title: 'IT staff fear being suspected', intent: 'The representative reports that IT staff feel watched and demand clarity on monitoring. Tests internal trust.' }
        ]
      },
      {
        key: 'legal',
        type: 'legal',
        title: 'Complaint, extortion and personal data',
        track: 'legal',
        start: 50,
        duration: 70,
        stimuli: 3,
        brief: 'Test the legal response to sabotage, extortion and a data breach.',
        narrative: 'Counsel weighs filing a complaint against negotiating. The DPO qualifies the salary grid leak as a personal data breach. The police ask the organisation not to contact the suspect. Players must coordinate legal actions.',
        objectives: [2, 0],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'legal', cell: 'legal', title: 'File a complaint now?', intent: 'Counsel recommends an immediate complaint for sabotage and data theft and warns that any private settlement with the administrator, should he make contact, could be seen as condoning extortion. Forces a decision.' },
          { at: 26, channel: 'email_internal', cast: 'dpo', cell: 'legal', title: 'Salary grid theft is a personal data breach', intent: 'The DPO qualifies the exfiltration of the salary grid as a personal data breach, recommends notifying the authority within 72 hours and preparing to inform employees. Tests GDPR handling of employee data.' },
          { at: 52, channel: 'email_authority', cast: 'police', cell: 'legal', kind: 'nudge', title: 'Investigator chases: complaint and no contact', intent: 'The investigator, still waiting for the formal complaint, asks the organisation to file it today, stop any contact with the suspect and preserve all messages. Relaunches the pending legal decision.' }
        ]
      },
      {
        key: 'communication',
        type: 'communication',
        title: 'No names, no defamation',
        track: 'communication',
        start: 85,
        duration: 70,
        stimuli: 2,
        brief: 'Test communication that protects the investigation and avoids defamation.',
        narrative: 'The communication director drafts a statement referring to "a former employee". The insider publishes a post presenting himself as a whistleblower. Players must respond without naming him or appearing to silence criticism.',
        objectives: [4],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'comms', cell: 'communication', title: 'Holding statement: "a former employee"?', intent: 'Draft statement mentioning malicious acts by a former employee. Players must check wording against defamation and presumption of innocence.' },
          { at: 35, channel: 'post_linkedin', cast: 'insider', cell: 'communication', title: 'Insider poses as a whistleblower', intent: 'The administrator publishes a post denouncing pay inequities and "a toxic culture". Tests response to a narrative battle.' }
        ]
      }
    ]
  },
  {
    id: 'ot-industrial-incident',
    name: 'Cyber attack on an industrial site (OT)',
    category: 'Operational',
    icon: 'factory',
    duration_minutes: 180,
    summary: 'During the night shift at a high-hazard chemical production site, operators notice that the control screens show stable values while field gauges indicate a temperature rise. The safety instrumented system trips a reactor and the flare lights up, visible and audible for kilometres. Investigation reveals that attackers entered the industrial network through an integrator\'s remote maintenance access, modified PLC logic and spoofed the operator screens. The crisis cell must put installations in a safe state, decide on production shutdown, work with local authorities and the safety inspectorate, contain rumours of a toxic cloud and plan a verified restart.',
    threat: 'A hacktivist-branded group with advanced capabilities abused the remote access tool of an automation integrator to reach an engineering workstation, altered PLC setpoints and hid the changes from operators. Impact: safety trip, production halted, questions over the integrity of the control system and public concern.',
    tags: ['OT', 'ICS', 'safety', 'production shutdown', 'local authorities', 'third-party access'],
    objectives: [
      'Distinguish a cyber attack from a process malfunction and escalate across OT, IT and safety functions',
      'Put people and installations in a safe state first: decide on production shutdown and manual operation',
      'Contain the attack across the IT/OT boundary and third-party remote access without weakening safety systems',
      'Coordinate with local civil protection, the safety inspectorate and the national cyber agency, and keep neighbours informed',
      'Manage public communication and rumours about a toxic risk to the population',
      'Plan a safe, verified restart and secure supply commitments to customers'
    ],
    cast: [
      { key: 'operator', label: 'Control room shift supervisor', role: 'internal', organization: 'The organisation (production site)', description: 'Night shift lead who first sees inconsistent readings.' },
      { key: 'plant_manager', label: 'Plant manager', role: 'internal', organization: 'The organisation (production site)', description: 'Accountable for safety and production on site.' },
      { key: 'ot_security', label: 'OT security engineer', role: 'internal', organization: 'The organisation', description: 'Specialist in industrial control systems and PLC forensics.' },
      { key: 'ciso', label: 'Group CISO', role: 'internal', organization: 'The organisation', description: 'Coordinates cyber response across IT and OT and with the agency.' },
      { key: 'ceo', label: 'Chief Executive Officer', role: 'internal', organization: 'The organisation', description: 'Chairs the group crisis cell and speaks for the company.' },
      { key: 'hse', label: 'Health, safety and environment manager', role: 'internal', organization: 'The organisation (production site)', description: 'Assesses risks to staff, neighbours and the environment.' },
      { key: 'integrator', label: 'Automation integrator project manager', role: 'partner', organization: 'Industrial automation integrator', description: 'Maintains the PLC programs and holds remote access to many sites.' },
      { key: 'civil_protection', label: 'Local civil protection officer', role: 'authority', organization: 'Local civil protection authority', description: 'Responsible for population safety and liaison with the safety inspectorate.' },
      { key: 'agency', label: 'National cybersecurity agency', role: 'authority', organization: 'National CSIRT', description: 'Supports industrial incident response and tracks the campaign.' },
      { key: 'journalist', label: 'Local news reporter', role: 'journalist', organization: 'Regional media', description: 'Covers the flare, neighbours\' concerns and the cyber angle.' },
      { key: 'resident', label: 'Local resident', role: 'client_b2c', organization: 'Neighbouring community', description: 'Worried neighbour who shares observations and rumours online.' },
      { key: 'customer', label: 'Key account purchasing director', role: 'client_b2b', organization: 'Industrial customer', description: 'Buys a large share of the site\'s output and depends on it to keep its own production running.' },
      { key: 'attacker', label: 'Grid Wraith', role: 'attacker', organization: 'Hacktivist-branded group', description: 'Claims the attack with screenshots and threatens other sites.' }
    ],
    tracks: ['main', 'governance', 'legal', 'communication', 'people'],
    blocks: [
      {
        key: 'trigger',
        type: 'trigger',
        title: 'Readings that make no sense',
        track: 'main',
        start: 0,
        duration: 20,
        stimuli: 3,
        brief: 'Open with a process anomaly that does not look like a cyber attack at first.',
        narrative: 'At 03:20, the shift supervisor sees a gap between screen values and a field gauge on reactor 3. Minutes later the safety system trips the reactor and the flare lights up. Neighbours post videos. Players must secure the installation first and consider that screens may be lying.',
        objectives: [0, 1],
        events: [
          { at: 0, text: 'In the middle of the night shift, reactor 3 of the chemical plant heats up while the control room screens stay calm' },
          { at: 10, text: 'The flare lights up the sky above the plant, visible and audible for kilometres around' }
        ],
        beats: [
          { at: 0, channel: 'audio_message', cast: 'operator', cell: 'operational', title: 'Reactor 3 readings do not match', intent: 'The supervisor reports the screen shows 82°C while the local gauge reads 97°C, with no alarm. Starts the safety versus fault diagnosis.' },
          { at: 8, channel: 'sms_notification', cast: 'operator', cell: 'operational', title: 'Safety system tripped reactor 3', intent: 'The safety instrumented system has shut the reactor and the flare is burning. Requires on-call escalation and site safety measures.' },
          { at: 14, channel: 'post_twitter', cast: 'resident', cell: 'communication', title: 'Huge flame and strange smell', intent: 'A neighbour posts a video of the flare and asks whether the air is safe. Starts the public dimension at night.' }
        ]
      },
      {
        key: 'investigation',
        type: 'investigation',
        title: 'Cyber attack or process fault?',
        track: 'main',
        start: 20,
        duration: 30,
        stimuli: 3,
        brief: 'Establish the cyber origin and the loss of trust in the control system.',
        narrative: 'The OT engineer finds an engineering workstation accessed through the integrator\'s remote tool, with a PLC program download. The integrator denies involvement. The HSE manager questions whether any sensor can be trusted. Players must decide on a safe posture for the whole site.',
        objectives: [0, 1],
        events: [
          { at: 0, text: 'OT engineers start pulling logs from the engineering workstations and the remote access gateway' },
          { at: 15, text: 'Operators go out into the units to read local gauges by hand, no longer trusting the screens' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ot_security', cell: 'it', title: 'Engineering workstation accessed at 02:10', intent: 'Logs show a remote session via the integrator\'s tool and a modified PLC program. Confirms a cyber origin.' },
          { at: 11, channel: 'email_external', cast: 'integrator', cell: 'business', title: '"Not us, our technician was asleep"', intent: 'The integrator confirms its account was used but denies any intervention; it has access to 40 client sites. Raises third-party risk.' },
          { at: 22, channel: 'email_internal', cast: 'hse', cell: 'decision', title: 'Can we trust any sensor?', intent: 'The HSE manager recommends a controlled shutdown of all units until instrument integrity is verified. Forces a costly decision.' }
        ]
      },
      {
        key: 'containment',
        type: 'containment',
        title: 'Separating IT from OT',
        track: 'main',
        start: 50,
        duration: 20,
        stimuli: 3,
        brief: 'Force containment decisions with direct production and safety impacts.',
        narrative: 'A full shutdown costs over a million euros a day. Cutting the IT/OT link and remote access stops the MES, lab data and shipping. The agency links the intrusion to a wider campaign using the same integrator tool. Players must isolate without creating new safety risks.',
        objectives: [1, 2],
        events: [
          { at: 0, text: 'The plant is in a holding position: reactor 3 is down and the other units run under close watch' },
          { at: 12, text: 'MES, lab data and shipping teams wait to learn whether the IT/OT link will be cut' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'plant_manager', cell: 'decision', title: 'Full shutdown: 1.2 million euros a day', intent: 'The plant manager proposes stopping all units or keeping two in manual mode. Requires a safety-first decision with business impact.' },
          { at: 7, channel: 'email_internal', cast: 'ciso', cell: 'it', title: 'Cut the IT/OT link and remote access?', intent: 'The CISO recommends isolating OT and cutting third-party access, which stops MES, lab and shipping systems. Tests trade-offs.' },
          { at: 14, channel: 'email_authority', cast: 'agency', cell: 'it', title: 'Same integrator tool used elsewhere', intent: 'The agency reports similar intrusions at two other industrial sites and offers an OT response team. Adds external coordination.' }
        ]
      },
      {
        key: 'claim',
        type: 'twist',
        title: 'A claim with control screens',
        track: 'main',
        start: 70,
        duration: 25,
        stimuli: 4,
        brief: 'Escalate: the attack is claimed publicly and fear spreads among the population.',
        narrative: 'The group posts real screenshots of the reactor control screen and threatens other sites. Civil protection needs an immediate answer on population risk. Television covers the story and a rumour of a toxic cloud circulates. Players must give authorities facts and counter rumours quickly.',
        objectives: [3, 4],
        events: [
          { at: 0, text: 'The attack goes public as a hacktivist-branded group claims it online' },
          { at: 12, text: 'Television crews set up at the plant gates while the flare is still burning' },
          { at: 20, text: 'Worried residents start calling the town hall and the plant switchboard' }
        ],
        beats: [
          { at: 0, channel: 'post_twitter', cast: 'attacker', cell: 'it', title: 'Claim with reactor control screenshots', intent: 'The group posts screenshots of the reactor 3 screen and threatens "the next site". Confirms the attack publicly.' },
          { at: 7, channel: 'email_authority', cast: 'civil_protection', cell: 'operational', title: 'Is the population at risk?', intent: 'Civil protection asks within 30 minutes whether to activate public alert measures. Tests factual risk assessment.' },
          { at: 13, channel: 'breaking_news_tv', cast: 'journalist', cell: 'communication', title: 'Chemical plant hit by cyber attack', intent: 'Ticker reports the attack and the flare, without information on risk. Raises public pressure.' },
          { at: 19, channel: 'post_reddit', cast: 'resident', cell: 'communication', title: 'Rumour: "toxic cloud, close your windows"', intent: 'A viral post claims a toxic release and advises residents to stay inside. Tests coordinated rumour control with authorities.' }
        ]
      },
      {
        key: 'eradication',
        type: 'eradication',
        title: 'Cleaning stations and PLC logic',
        track: 'main',
        start: 95,
        duration: 25,
        stimuli: 3,
        brief: 'Show the specific challenges of OT eradication.',
        narrative: 'PLC logic differs from the golden copy, which is 18 months old; the latest version is only held by the integrator. The integrator offers to reload programs remotely. More engineering stations are infected. Players must decide what baseline to trust.',
        objectives: [2, 5],
        events: [
          { at: 0, text: 'The OT response team compares every PLC program on site with the available backups' },
          { at: 15, text: 'Engineering workstations are pulled offline one by one for forensic imaging' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ot_security', cell: 'it', title: 'PLC logic differs from golden copy', intent: 'The only in-house backup is 18 months old; recent changes are held by the integrator. Tests baseline integrity decisions.' },
          { at: 10, channel: 'email_external', cast: 'integrator', cell: 'decision', title: 'We can reload the programs remotely', intent: 'The integrator offers remote reload to speed things up. Dilemma: reopen third-party access or work on site.' },
          { at: 19, channel: 'email_internal', cast: 'ot_security', cell: 'it', title: 'Two more stations infected', intent: 'Dormant malware found on two other engineering stations via USB. Extends eradication scope.' }
        ]
      },
      {
        key: 'continuity',
        type: 'continuity',
        title: 'Day +1: manual mode and customer allocation',
        track: 'main',
        start: 120,
        duration: 25,
        stimuli: 3,
        brief: 'Compress time to Day +1 and test degraded production and customer commitments.',
        narrative: 'Simulated time jumps to Day +1. Two units run in manual mode. The CEO must allocate remaining stock to customers. HSE warns about the risk of human error. Players must set priorities and limits.',
        objectives: [5, 1],
        events: [
          { at: 0, text: 'Day +1: two units run in manual mode at reduced output with reinforced shift teams' },
          { at: 12, text: 'Key customers start asking for delivery commitments as finished stock runs down' }
        ],
        beats: [
          { at: 0, channel: 'internal_memo', cast: 'plant_manager', cell: 'operational', title: 'Manual operation for units 1 and 2', intent: 'Memo defining manual procedures, extra staff and reduced output. Tests safety and feasibility.' },
          { at: 9, channel: 'email_external', cast: 'customer', cell: 'business', kind: 'nudge', title: 'Still no delivery date from you', intent: 'A key account customer chases the delivery dates promised yesterday, says its own lines stop in four days and asks whether force majeure will be invoked. Relaunches the pending allocation decision.' },
          { at: 18, channel: 'email_internal', cast: 'hse', cell: 'operational', title: 'Manual mode raises human error risk', intent: 'HSE warns that manual operation increases the risk of incidents and recommends limits. Tests safety governance.' }
        ]
      },
      {
        key: 'recovery',
        type: 'recovery',
        title: 'Day +3: a safe restart',
        track: 'main',
        start: 145,
        duration: 25,
        stimuli: 2,
        brief: 'Compress time to Day +3 and test the conditions for restart.',
        narrative: 'Simulated time jumps to Day +3. The plant manager proposes restarting reactor 3 after logic verification and safety tests. Authorities set conditions. Players must decide on go/no-go.',
        objectives: [5, 3],
        events: [
          { at: 0, text: 'Day +3: reactor 3 logic has been reloaded from a verified baseline and safety system proof tests are under way' },
          { at: 15, text: 'Inspectors from the safety inspectorate arrive on site to review the incident' }
        ],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'plant_manager', cell: 'decision', title: 'Restart plan for reactor 3', intent: 'Plan with verified logic, SIS proof tests and supervision. Requires formal go/no-go.' },
          { at: 10, channel: 'email_authority', cast: 'civil_protection', cell: 'legal', title: 'Conditions for restart', intent: 'The authority, with the inspectorate, requires an incident report and independent verification before restart. Tests regulatory compliance.' }
        ]
      },
      {
        key: 'exit',
        type: 'exit',
        title: 'Day +14: lessons with the inspectorate',
        track: 'main',
        start: 170,
        duration: 10,
        stimuli: 2,
        brief: 'Close with lessons learned and an OT security programme.',
        narrative: 'Simulated time jumps to Day +14. The agency issues a sector advisory and the CEO announces an OT security programme. Players must define exit criteria and follow-up.',
        objectives: [2, 3],
        events: [
          { at: 0, text: 'Day +14: the plant is back at full output and the integrator\'s remote access remains suspended across the group' },
          { at: 6, text: 'Other operators in the sector are reviewing their own third-party remote access after the campaign became public' }
        ],
        beats: [
          { at: 0, channel: 'email_authority', cast: 'agency', cell: 'legal', title: 'Sector-wide advisory', intent: 'The agency shares indicators and asks the organisation to contribute to an advisory on third-party remote access. Tests cooperation.' },
          { at: 5, channel: 'internal_memo', cast: 'ceo', cell: 'decision', title: 'CEO memo: OT security programme', intent: 'Draft memo announcing segmentation, remote access control and offline PLC backups across sites. Players must validate.' }
        ]
      },
      {
        key: 'crisis-cell',
        type: 'crisis_cell',
        title: 'Site cell and group cell',
        track: 'governance',
        start: 20,
        duration: 60,
        stimuli: 2,
        brief: 'Test articulation between site-level safety decisions and group-level crisis management.',
        narrative: 'The group crisis cell is activated while the plant manager holds safety authority on site. Other sites use the same integrator. Players must clarify who decides what and extend containment across the group.',
        objectives: [1, 2],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'ceo', cell: 'decision', title: 'Who decides on site?', intent: 'The CEO activates the group cell and asks how decisions are split with the plant manager. Tests governance clarity.' },
          { at: 35, channel: 'email_internal', cast: 'ciso', cell: 'decision', title: 'Six sites use the same integrator', intent: 'The CISO proposes cutting the integrator\'s access across all sites, delaying maintenance. Requires a group decision.' }
        ]
      },
      {
        key: 'authorities',
        type: 'legal',
        title: 'Authorities and the inspectorate',
        track: 'legal',
        start: 30,
        duration: 80,
        stimuli: 3,
        brief: 'Test regulatory obligations of a high-hazard site hit by a cyber attack.',
        narrative: 'The site must declare the incident to the inspectorate and report to civil protection regularly. The cyber dimension also triggers NIS2 reporting. Players must coordinate multiple authorities with consistent facts.',
        objectives: [3],
        beats: [
          { at: 0, channel: 'email_internal', cast: 'hse', cell: 'legal', title: 'Mandatory declaration to the inspectorate', intent: 'The HSE manager prepares the incident declaration, including flare emissions. Tests ownership and timing.' },
          { at: 30, channel: 'email_authority', cast: 'civil_protection', cell: 'legal', kind: 'nudge', title: 'Civil protection chases: no update yet', intent: 'Civil protection has received no update since the trip and asks for a first situation report now, then every two hours, with a single point of contact. Relaunches reporting to authorities.' },
          { at: 55, channel: 'email_internal', cast: 'ciso', cell: 'legal', kind: 'nudge', title: 'Reminder: NIS2 early warning still pending', intent: 'The CISO reminds the cell that the incident meets NIS2 thresholds and that the 24-hour early warning still has no owner or approval. Relaunches regulatory reporting.' }
        ]
      },
      {
        key: 'communication',
        type: 'communication',
        title: 'Neighbours, press and rumours',
        track: 'communication',
        start: 75,
        duration: 75,
        stimuli: 3,
        brief: 'Test public communication on a safety-sensitive incident.',
        narrative: 'A reporter asks whether a cyber attack caused the flare. Authorities publish a statement before the organisation. Residents organise a public meeting. Players must align with authorities and address fears transparently.',
        objectives: [4, 3],
        beats: [
          { at: 0, channel: 'email_external', cast: 'journalist', cell: 'communication', title: 'Was it a cyber attack?', intent: 'The reporter asks for confirmation and for measurements of emissions. Tests transparency on safety facts.' },
          { at: 30, channel: 'post_twitter', cast: 'civil_protection', cell: 'communication', title: 'Authorities speak first', intent: 'Civil protection posts a public statement mentioning a "malicious act" without prior coordination with the organisation. Tests alignment and reactivity.' },
          { at: 55, channel: 'post_twitter', cast: 'resident', cell: 'communication', title: 'Residents call a public meeting', intent: 'Neighbours call for a public meeting and demand the plant\'s presence. Tests local stakeholder engagement.' }
        ]
      },
      {
        key: 'shift-teams',
        type: 'hr',
        title: 'Shift teams under strain',
        track: 'people',
        start: 90,
        duration: 80,
        stimuli: 2,
        brief: 'Test the human dimension of a prolonged industrial incident.',
        narrative: 'Operators work long shifts in manual mode and some are anxious about working on an attacked site. Players must organise rotations, support and clear safety instructions.',
        objectives: [1],
        beats: [
          { at: 0, channel: 'sms_notification', cast: 'operator', cell: 'hr', title: 'Night shift still on site, teams tiring', intent: 'The supervisor warns that the night shift has been held on site since the trip and that the crews needed for manual operation will soon be exhausted. Asks for reinforcements and a rotation plan.' },
          { at: 35, channel: 'email_internal', cast: 'hse', cell: 'hr', title: 'Staff anxious about working on site', intent: 'The HSE manager reports staff concerns about safety and requests a briefing by management. Tests internal communication.' }
        ]
      }
    ]
  }
];

# Operation Frozen Till: the injects

Exercise built and written with CrisisMaker and GLM 5.3 (Ollama Cloud) on 29 September 2026. 33 injects, in play order, as the players receive them. Client: Maison Aubray Retail Group (Retail). Simulated day: Friday 27 November 2026, 08:00 to 11:00 (Europe/Paris). The images of every inject are in `stimuli/`.

## Cells

- **Strategic crisis cell** (3 players: CEO, CFO, COO)
- **Legal, compliance & business cell** (5 players: DPO, General Counsel, Payments & Fraud Director, Head of Store Operations, Customer Service Director)
- **Communication cell** (3 players: Communication Director, Press officer, Social media manager)
- **IT & cyber cell** (4 players: CIO, CISO, SOC manager, E-commerce and payment IT lead)

## Main storyline

- **H+0:00 to H+0:30 · Black Friday under encryption**: 06:00-08:00 recap lands at once: hypervisors encrypted overnight, ERP, warehouse management and store back-office down, 420 stores open in degraded mode on standalone terminals. The crisis cell convenes at 08:00 and must establish the first shared situation picture and activate the crisis procedure.
  - Main event H+0:00: 08:00 - Crisis cell convenes: hypervisors encrypted at 05:50, ERP and warehouse management down, 420 stores open in degraded mode on standalone payment terminals
- **H+0:30 to H+1:30 · Scope, skimmer and the first arbitration**: IT maps the compromise and finds traces of long intrusion and exfiltration; the IR provider flags suspicious checkout JavaScript. The cells face the first big arbitration: keep the online shop selling on Black Friday or isolate it now without proof of card data theft.
  - Main event H+0:30: 08:30 - Forensics confirm a weeks-old intrusion: beacon artefacts, Kerberoasting of a backup service account, backup catalogues deleted; recovery from clean restores impossible
  - Main event H+0:44: 08:44 - 1.8 TB of exfiltrated data confirmed, including the 6-million-customer loyalty database; GDPR 72h clock assessment starts
  - Main event H+1:08: 09:08 - Suspicious JavaScript found loading on the e-commerce checkout page from an unknown domain; possible card skimmer
- **H+1:30 to H+2:15 · 12 million euros**: 09:30: the attacker emails the CEO directly - 12M€ in 72 hours or the customer database and 'card data' are published. The ransom demand lands on the peak sales day, forcing the engage/stall/refuse decision under time pressure and legal constraints.
  - Main event H+1:30: 09:30 - VEIL-9 emails the CEO: 12M€ ransom in 72 hours or the customer database and 'card data' are published
- **H+2:15 to H+2:40 · The leak goes public**: 10:15: a sample of customer data appears on the attacker's leak site. Within minutes a viral post shows a customer whose card was fraudulently used after shopping online. Social media explodes and customer service floods: the communication cell absorbs the storm while legal and business cells manage notification duties and the surge.
  - Main event H+2:15: 10:15 - A sample of the stolen customer database appears on VEIL-9's leak site; minutes later a viral social post shows a customer whose card was fraudulently used after shopping online
- **H+2:40 to H+3:00 · The bank forces the decision**: 10:40: the acquiring bank reports a common-point-of-purchase fraud pattern pointing at the online shop and demands action on the e-commerce site and payment terminals. The decision cell must lock in the isolation decision, confirm the notification set and align all four cells before the exercise ends.
  - Main event H+2:40: 10:40 - The acquiring bank reports a common-point-of-purchase fraud pattern pointing at the online shop and demands action on the e-commerce site and payment terminals


## H+0:00 · Black Friday under encryption

### #01 · H+0:02 (08:02) · Internal email

**SOC alert: mass encryption of head-office hypervisors**  
From Nadia Brun (SOC night analyst, Maison Aubray) to the **IT & cyber cell**

*from_name*: Nadia Brun  
*from_email*: nadia.brun@maison-aubray.com  
*to*: IT & Cyber Crisis Cell (CIO, CISO, SOC, Infrastructure, Payment IT)  
*cc*: Strategic Crisis Cell; Legal, Compliance & Business Cell; Communication Cell  
*subject*: URGENT – SOC Alert: Mass encryption of head-office hypervisors – ransomware active, ERP/WMS down, backups unreachable  
*date*: 27/11/2026 08:02  
*body*:

> To all cell members,
> 
> This is the SOC initial scope report on the mass encryption event detected this morning at head office. Facts as of 08:02, Friday 27 November.
> 
> 1. What we observe right now:
> - Ransom notes displayed on every screen at head office and on logistics workstations.
> - Head-office and logistics hypervisors encrypted at approximately 05:50, taking down the ERP and the warehouse management system (WMS).
> - Store back-office servers are unreachable since approximately 06:30; stores report they are operating in degraded mode on standalone payment terminals.
> - Backup infrastructure is currently unreachable – we cannot yet confirm whether backups are intact, encrypted, or deleted. Do not assume recovery is possible until verified.
> - Attack vector, intrusion depth and any data theft are not yet qualified. We are treating this as a potentially long-running intrusion until forensics prove otherwise.2. Containment actions already taken by the SOC:
> - Isolated the head-office and logistics network segments from the rest of the estate; site-to-site links to store networks have been severed as a precaution.
> - Powered down remaining running hypervisors and critical servers outside the encrypted blast radius to preserve them.
> - Snapshot of volatile evidence (memory and logs) collected from two reachable machines before isolation; chain of custody opened.
> - Change freeze on all production systems; all remote access suspended pending review.3. Immediate instructions for the cell:
> - Infrastructure: confirm the full list of encrypted assets and the exact perimeter of isolation; verify backup and snapshot status with hard evidence, not console assumptions.
> - Payment IT: urgently review the e-commerce checkout chain for any tampering, and confirm whether card flows can be considered trusted. This is a Black Friday peak day – flag immediately if you have any doubt, do not wait for certainty.
> - CISO / IR: engage our incident response provider now and open a forensic preservation plan (logs, images, ransom note samples). Nothing is to be wiped, reimaged or “cleaned” before evidence capture.
> - All: log every action and decision with timestamps in the shared decision log – this is our single source of truth for the four cells.4. Open questions we must answer fast:
> - How deep is the intrusion – is it limited to encryption, or is there lateral movement and possible data exfiltration we have not seen?
> - Can any clean restore point be trusted, given the backups are unreachable?
> - Should e-commerce and payment flows be isolated as a precaution, at the cost of the peak sales day? We need a qualified recommendation for the strategic cell within the hour.
> - Any indicators pointing at card data exposure would trigger PCI and acquiring-bank obligations – we must know before the bank tells us.The crisis cell is convened for 08:00 – this report is the shared situation picture going in. Please acknowledge receipt, confirm your availability, and send your first findings and gaps to me so I can consolidate a single picture for the committee.
> 
> Nadia Brun – SOC Night Analyst, Maison Aubray
> Available on the crisis bridge and at soc-oncall@maison-aubray.com

*attachment_name*: SOC_Initial_Scope_Report_HO_Encryption_20261127.pdf  

### #02 · H+0:05 (08:05) · SMS

**On-call activation: crisis cell convened for 08:00**  
From Pascal Rivet (On-call IT manager, Maison Aubray) to the **Strategic crisis cell**

*sender*: Pascal Rivet (IT On-call Manager)  
*text*:

> CYBER CRISIS ACTIVATION — all execs to crisis room NOW for 08:00. Head-office hypervisors encrypted overnight (05:50), ERP + warehouse down, 420 stores on degraded mode, standalone payment terminals only. Ransom note on every screen. Open the decision log immediately. Full situation brief follows. Details inside.

*time*: 08:05  

### #03 · H+0:10 (08:10) · Internal memo

**420 stores in degraded mode: no price files, no loyalty, cash-only risk**  
From Yvonne Lecoq (Regional store manager, Maison Aubray) to the **Legal, compliance & business cell**

*from_name*: Yvonne Lecoq, Regional Store Manager  
*to*: Legal, Compliance & Business Cell (DPO, Legal Counsel, Payments/Finance, Store Operations, Customer Service)  
*subject*: URGENT - 420 stores in degraded mode: no price files, no loyalty, cash-only risk - need guidance by 08:30  
*date*: 27/11/2026 08:10  
*body*:

> To the Legal, Compliance & Business Cell,
> 
> I am writing at 08:10 on Black Friday morning, ten minutes into the crisis call. Store network status from my side, as reported by my 14 store managers and the regional WhatsApp groups, which are currently the only reliable communication channel:
> 
> What we have: Since roughly 06:30, store back-office servers are unreachable. Payment terminals are working standalone, so card payments are still possible. Stores are open and tills are operating offline.
> 
> What we have lost: No price file updates since last night, so some Black Friday promotional prices are NOT loaded at the till. Staff are applying promo pricing manually from the printed sheets, which creates a real risk of pricing errors on our biggest volume day of the year. No loyalty programme - customer points cannot be accrued or redeemed, and customers are already complaining at the till. No click-and-collect orders to prepare. No stock visibility: we cannot check inter-store or warehouse availability, and replenishment orders are not transmitting.
> 
> Risks I see: If terminals drop or the bank cuts us off, we fall back to cash-only with only limited floats in the tills - that would be catastrophic on a Black Friday afternoon. Queues are building since 08:00 opening. Several store managers report staff asking whether we have been hacked; some are being asked the same by customers.
> 
> What I need from the cell by 08:30:
> 
> 1. An official line for store teams on the outage and on the hacking questions - right now each manager is improvising, and inconsistency is spreading on local social media.
> 
> 2. Confirmation of the promotional pricing rule: do we honour the Black Friday advertised prices manually, yes or no, and who carries the margin loss?
> 
> 3. A policy for loyalty customers: do we accept manual loyalty claims for later crediting? We need a simple rule cashiers can apply.
> 
> 4. A contingency instruction if card payments fail: cash-only procedure, cash pickup arrangements with our security provider, and a single alert number.
> 
> 5. One official communication channel for stores - I suggest a single regional coordinator per region relaying from the cell, with a log of instructions given, so we all work from the same picture.
> 
> 6. Clarification on what store staff may say to customers and to the press if journalists show up in stores - several managers in city-centre locations have already had calls.
> 
> We can hold in degraded mode for now, but I need decisions before the mid-morning traffic peak. Please treat as priority.
> 
> Yvonne Lecoq
> Regional Store Manager, Maison Aubray


### #04 · H+0:14 (08:14) · External email

**Sentinelle CERT engaged - first containment guidance**  
From Camille Verdon (IR lead, Sentinelle CERT) to the **IT & cyber cell**

*from_name*: Camille Verdon  
*from_email*: c.verdon@sentinelle-cert.eu  
*to*: it-crisis-cell@maison-aubray.com  
*cc*: soc@maison-aubray.com; ciso@maison-aubray.com  
*subject*: [URGENT] Sentinelle CERT engaged - first containment guidance - Maison Aubray incident  
*date*: 27/11/2026 08:14  
*body*:

> Dear IT & Cyber Crisis Cell,
> 
> Camille Verdon, Incident Response lead at Sentinelle CERT. We were engaged at 07:58 following your SOC escalation. My team is mobilising: two IR engineers are connecting remotely now, and I am dispatching one engineer on site to your head office in Paris. Expected arrival within 90 minutes. Consider this our first containment guidance. Time is critical — it is Black Friday and we understand stores are operating in degraded mode.
> 
> What we know so far (please confirm or correct):
> - Ransom note appeared on screens at approximately 05:50.
> - Head-office and logistics hypervisors are encrypted; ERP and warehouse management are down; store back-office servers are unreachable.
> - Ransomware strain not yet identified — we need samples to confirm (see below).Immediate actions required in the next 30 minutes:
> - Do NOT reboot, re-image, or wipe anything. Preserve volatile evidence: memory dumps of at least two encrypted hosts and one hypervisor if feasible before any recovery attempt. Ransom notes, encrypted file samples, and event logs must be preserved as-is.
> - Isolate, do not power off. Segment the network: cut head-office VLANs, logistics, and any management networks from the internet and from each other where possible. Keep machines running where you can — powering off destroys evidence and may trigger further damage from dormant persistence. Keep the e-commerce segment segregated from the corporate network for now — we need to qualify whether it is involved.
> - Send us the ransom note (full photo/text), a sample encrypted file plus its pre-encryption counterpart if you have one, and the extension used. This lets us identify the strain and check for known decryptors.
> - Do NOT touch backups yet. Do not attempt restores. We have seen attackers tamper with backup infrastructure before detonation in similar incidents. I need your backup team to verify the integrity and isolation status of your backup catalogues before anything is restored — confirm whether backups are offline, immutable, or replicated, and who has access.
> - Inventory access paths: list all remote access (VPN, RDS, third-party maintenance tunnels) and shut down unnecessary ones.Suspicious e-commerce activity: our initial triage of your public-facing logs (shared with us by your SOC) shows anomalous outbound traffic patterns from the e-commerce platform in recent days. Given it is your peak sales day, we must check urgently whether the online shop has been compromised. I need one person from your e-commerce/payment IT team to brief my engineers within the hour, with:
> - Change history and deploy logs for the checkout page over the last 30 days, including any build/deployment pipeline access logs;
> - Current checksums or content of scripts loaded on the payment/checkout pages, compared against your last known-good release;
> - Confirmation of whether payment fields are iframed/tokenised or collected on your own page.Please do not take the e-commerce site offline on your own initiative — that is a decision for your crisis cell with your acquiring bank, but the data above determines how urgent it is.
> 
> Coordination: designate a single point of contact on your side (name, mobile, email) with authority to execute the actions above, and confirm you are logging every action and decision with timestamps for forensics and regulatory purposes (GDPR, PCI DSS and NIS2 obligations will apply — the decision log will be requested). Share this picture with the other crisis cells so everyone works from the same facts. Do not communicate externally about the incident details — route all communications through your crisis cell.
> 
> Reply to this email or call me directly on my duty line (in my signature) for anything urgent. My engineers will contact your SOC lead as soon as connected. We will circulate our first technical report within 2 hours.
> 
> Stay disciplined, preserve evidence first, restore second.
> 
> Best regards,
> Camille Verdon
> Incident Response Lead — Sentinelle CERT
> Duty line: +33 1 84 XX XX XX (24/7)
> c.verdon@sentinelle-cert.eu

*attachment_name*: Sentinelle_Containment_Checklist_v1.pdf  

### #05 · H+0:18 (08:18) · Internal email

**Employees flooding internal channels: are we hacked?**  
From Marc Delaunay (HR director, Maison Aubray) to the **Communication cell**

*from_name*: Marc Delaunay  
*from_email*: m.delaunay@maison-aubray.com  
*to*: Crisis Committee – Communication Cell  
*cc*: Communication Cell Lead; Store Operations Hotline; Internal Communications Team  
*subject*: URGENT – Employees flooding internal channels: 'Are we hacked?' – Need internal messaging and store script NOW  
*date*: 27/11/2026 08:18  
*body*:

> Dear Communication Cell,
> 
> Situation at 08:18. Since stores opened and word spread about the overnight outage, employee questions are flooding our internal channels. The intranet is unreachable (head-office servers are down), so the pressure is landing on Yammer, WhatsApp store groups, and the store hotline. Store managers are asking staff-facing questions and staff are answering customers with speculation.
> 
> What is confirmed so far (only share this):
> - Head-office IT suffered a major technical incident overnight; ERP, warehouse management and store back-office systems are down.
> - All 420 stores are open and serving customers in degraded mode, on standalone payment terminals.
> - The crisis procedure is activated and the crisis cell has been convened since 08:00. Technical teams are fully mobilised.What we cannot say yet:
> - Do not confirm or deny a cyber attack to any audience at this stage – the origin of the incident is still being established.
> - Do not speculate on timelines for restoration of systems or the online shop.
> - Refer all press enquiries to the Communication Cell lead only. A journalist enquiry is expected – do not let staff respond individually.Requested actions within the next 30 minutes:
> - 1. Internal holding statement for employees: acknowledge the IT incident, confirm stores are open and teams are mobilised, ask staff not to speculate internally or on social media, and refer questions to the hotline.
> - 2. Store manager script for staff facing customers: short, factual lines on degraded operations (manual price lists, standalone terminals, loyalty temporarily unavailable), with clear guidance: 'we are experiencing a technical incident, our teams are working on it'.
> - 3. Social media monitoring: start logging employee and customer posts about the outage; flag anything claiming a data breach or hack to me and the cell lead immediately.
> - 4. Coordinate with Legal/Compliance before releasing anything – no premature disclosure while technical and legal qualification is ongoing. Keep all drafts in the shared decision log.Channel for coordination: Given the intranet outage, please use the out-of-band communication channel set up by the IT cell and post all versions there so all four cells work from one picture.
> 
> Please send the two drafts (internal statement + store script) for validation before 09:00. My team will relay them through HR contacts and store managers as soon as they are approved.
> 
> Thank you for your speed and rigour – today of all days, consistency in what our people say is half the battle.
> 
> Best regards,
> Marc Delaunay
> HR Director, Maison Aubray

*attachment_name*: Employee_and_Store_Channel_Summary_0818.pdf  

### #06 · H+0:22 (08:22) · External email

**Journalist: 'Your site is down on Black Friday - are you under attack?'**  
From Elsa Marchand (Business journalist, Le Quotidien Éco) to the **Strategic crisis cell**

*from_name*: Elsa Marchand  
*from_email*: e.marchand@lequotidien-eco.fr  
*to*: Direction Générale - Maison Aubray (direction.generale@maison-aubray.com)  
*cc*: presse@maison-aubray.com  
*subject*: URGENT - Black Friday: your site is down and stores in trouble - are you under attack? Deadline 10:00 for our midday edition  
*date*: 27/11/2026 08:22  
*body*:

> Dear Maison Aubray executive team,
> 
> Elsa Marchand, business desk, Le Quotidien Éco. I am writing to you this Friday morning, 27 November, at 08:22, and I need a response quickly.
> 
> Since roughly 06:00 this morning, your e-commerce site has been returning errors or timing out, on the single biggest online retail day of the year. We are also receiving reports from readers and store staff that your shops opened this morning without their usual systems — no price lookups, no loyalty programme, terminals apparently switched to standalone mode.
> 
> Our readers and your shareholders will want to know what is going on. I have three direct questions:
> 
> 1. Is Maison Aubray the victim of a cyberattack — ransomware or otherwise — as several people familiar with the situation are suggesting?
> 
> 2. Is any customer data, including payment card data, at risk? Are online shoppers exposed?
> 
> 3. What is your recovery plan for today, and what does this mean for orders placed this morning and for Black Friday trading in your 420 stores?
> 
> Our deadline for the midday online edition is 10:00. If I receive no comment by then, we will publish with what we have: the outage, the degraded store operations, and the fact that Maison Aubray has not denied being under attack. I would much rather print your statement.
> 
> I am reachable on this address or on +33 6 12 45 78 90. A short holding comment is fine — 'a technical incident, teams are on it' at minimum — but silence on Black Friday will read as confirmation.
> 
> Regards,
> Elsa Marchand
> Business journalist, Le Quotidien Éco
> e.marchand@lequotidien-eco.fr | +33 6 12 45 78 90



## H+0:30 · Scope, skimmer and the first arbitration

### #07 · H+0:33 (08:33) · External email

**Forensic findings: weeks-old beacon, Kerberoasting, wiped backups**  
From Camille Verdon (IR lead, Sentinelle CERT) to the **IT & cyber cell**

*from_name*: Camille Verdon, IR Lead – Sentinelle CERT  
*from_email*: c.verdon@sentinelle-cert.fr  
*to*: IT & Cyber Crisis Cell – Maison Aubray (CIO, CISO, SOC, Infrastructure, Payment IT)  
*cc*: Crisis Cell Secretariat  
*subject*: [URGENT] Forensic update – weeks-old intrusion, Kerberoasting, backups unrecoverable – recovery assumptions must change now  
*date*: 27/11/2026 08:33  
*body*:

> Team,
> 
> Quick forensic readout from the Sentinelle team on site and in your SOC, as of 08:30. I am attaching the preliminary findings note. Three points, all of which change the assumptions you started the 08:00 cell with.
> 
> 1. This intrusion is weeks old, not hours. We have beacon artefacts on two head-office workstations consistent with a loader deployed roughly three to four weeks ago, followed by a remote access beacon with persistence. Patient zero looks like a supplier-onboarding clerk's mailbox — a phishing email with a malicious invoice macro fits the timeline. Treat the entire domain as presumptively compromised: the Kerberoasting of a backup service account gave the attacker a path to your domain controllers around D-15. Do not restore anything onto the current domain, and do not assume any credential set is clean until we have reset the krbtgt account twice and rebuilt from known-good.
> 
> 2. Your backups are gone. The backup catalogues were deleted and snapshot retention was reduced to zero at approximately D-2. This was deliberate, manual, pre-encryption preparation. You cannot rebuild the hypervisors, the ERP or the warehouse management from your existing backup estate — please stop planning against that assumption. We need an immediate inventory of what survives off-domain: offline or immutable copies, SaaS-side data, vendor-hosted instances, and anything replicated to a logically separate tenant. Get me that inventory by 10:00 so the crisis cell can reset recovery priorities on facts rather than hope.
> 
> 3. Preservation discipline, starting now. Every recovery action so far has been reasonable, but from this point forward: no reimaging of the two beaconed workstations, no power-cycling of hosts that may hold volatile memory, and log export before any remediation touches a system. We expect law-enforcement contact today and your acquiring bank may impose forensic requirements; evidence destroyed now cannot be recreated.
> 
> Immediate asks: (a) confirm network segmentation between the encrypted head-office/logistics estate and the e-commerce production stack and store back-office, and tell me if you cannot; (b) give me two people with domain admin knowledge for the krbtgt reset and DC rebuild planning; (c) hold the backup inventory review at 10:00; (d) log every containment decision with timestamp and owner in the shared decision log — the other cells need one picture.
> 
> One more thing: the intrusion spans your build and publishing tooling, so we are treating the e-commerce platform as potentially exposed until proven otherwise. If anyone sees anything anomalous on the checkout path, flag it to me immediately — do not wait for the next scheduled readout.
> 
> I am reachable on this address and on the crisis bridge all morning. We will issue the next consolidated findings by midday, earlier if the situation moves.
> 
> Camille Verdon
> IR Lead, Sentinelle CERT
> Direct line: +33 1 84 XX XX XX — Crisis bridge: channel 2

*attachment_name*: Sentinelle_IR_Preliminary_Findings_MaisonAubray_2711.pdf  

### #08 · H+0:38 (08:38) · Internal email

**E-commerce anomaly: checkout page loading an unknown script**  
From Nadia Brun (SOC night analyst, Maison Aubray) to the **IT & cyber cell**

*from_name*: Nadia Brun  
*from_email*: nadia.brun@maison-aubray.com  
*to*: IT & Cyber Crisis Cell (CIO, CISO, SOC, Infrastructure, Payment IT)  
*cc*: Crisis Committee  
*subject*: URGENT H+38 - E-commerce checkout loading script from unknown domain - possible card exposure  
*date*: 27/11/2026 08:38  
*body*:

> Dear IT & Cyber Cell,
> 
> Situation at H+38 (08:38). SOC has identified an anomaly on the e-commerce checkout page. A JavaScript file is being loaded from an unknown, non-whitelisted domain (not part of our tag manager or any registered third-party integration). This is consistent with the forensic findings shared minutes ago by the IR provider: weeks-old beacon artefacts, Kerberoasting of a backup service account and deleted backup catalogues indicate a long intrusion, so attacker access to the e-commerce build pipeline cannot be excluded.
> 
> What we know so far:
> - The unknown script appears to load only for a subset of checkout sessions, which makes it hard to reproduce and may explain why performance monitoring did not flag it earlier.
> - We have no proof at this stage that card data is being captured. This is a suspicion of a possible web skimmer, not a confirmed breach of payment data.
> - No alert has been received from the acquiring bank as of 08:35.
> - E-commerce is currently still live and taking Black Friday orders.Immediate actions requested:
> - Payment IT: pull the exact checkout page source (live and from the build pipeline), capture the script URL and any network beacon destinations, and preserve everything as evidence before any remediation.
> - Infrastructure: mirror traffic on the checkout path and check whether the script is injected at the pipeline/build level or at runtime (CDN compromise, tag manager, compromised deploy credential).
> - SOC: review web application firewall and CDN logs for the last weeks to determine when the script first appeared and whether any card data could have been intercepted. Compare against a known-good page baseline.
> - CISO: preserve forensic evidence chain of custody; coordinate with the IR provider for skimmer analysis. Do not clean the script before capture is complete.Do not communicate externally yet (no notification to the acquiring bank or card schemes until we have qualified the finding), but be ready to escalate to the strategic cell quickly: if capture of card data is confirmed, PCI DSS and card scheme obligations will be triggered and the isolation decision becomes urgent.
> 
> Please send me your findings within the next 20 minutes so I can consolidate a single technical picture for the committee. One situation picture, one decision log.
> 
> Nadia Brun
> SOC Night Analyst, Maison Aubray Retail Group

*attachment_name*: checkout_anomaly_H+38.pdf  

### #09 · H+0:44 (08:44) · Internal memo

**Exfiltration confirmed: 1.8 TB moved to cloud storage**  
From Pascal Rivet (On-call IT manager, Maison Aubray) to the **Legal, compliance & business cell**

*from_name*: Pascal Rivet, On-call IT Manager  
*to*: Operational Crisis Cell — DPO, Legal Counsel, Payments/Finance, Store Operations, Customer Service  
*subject*: [URGENT — CRISIS] Data exfiltration CONFIRMED: 1.8 TB moved to external cloud storage — GDPR 72h clock, actions required  
*date*: 27/11/2026 08:44  
*body*:

> All,
> 
> Situation update as of 08:44. Following the encryption event at 05:50 and the forensic findings reported at 08:30 (weeks-old intrusion, Kerberoasting of a backup service account, backup catalogues deleted), the IR team has now CONFIRMED large-scale data exfiltration.
> 
> Confirmed facts:
> 
> 1. Approximately 1.8 TB of data was transferred to an external cloud storage service before the encryption phase. Based on volume and access logs, the transfer was completed well before this morning's detection; we are pinning down the exact window.
> 
> 2. The data set includes, at minimum: the loyalty customer database (approx. 6 million accounts) — names, contact details, loyalty balances and purchase history — plus HR files and supplier contracts from head-office file shares. We are still mapping the exact perimeter; treat the full extent as not yet bounded.
> 
> 3. This is no longer only an availability incident. We have a confirmed personal data breach with data loss, on top of the ongoing ransomware encryption of head-office and logistics systems (ERP, warehouse management, store back-office all down; 420 stores operating in degraded mode on standalone terminals).
> 
> What this triggers on your side — I need decisions and actions now:
> 
> • DPO: In my view the GDPR 72-hour notification clock must be formally assessed and, if the assessment concludes notification is required, started from this morning. Please document the start time, the known scope (6M customer records), and the unknowns (exact data categories, possible payment data exposure — see below). We will feed you the forensic detail as it comes.
> 
> • Legal: Please open the file on the police complaint (we will preserve all evidence — do not power off or reimage anything without IR sign-off) and check our NIS2 / ANSSI reporting obligations and deadlines given the confirmed exfiltration. If there are fixed-hour requirements, tell us the cut-off times today.
> 
> • Payments/Finance: Be aware the IR team is still investigating a suspicious script loading on the e-commerce checkout page (separate email at 08:38). If card data is in play, PCI DSS and card scheme notification duties will follow. Please pre-engage our acquiring bank contact now so we are not doing it cold in two hours.
> 
> • Store Operations and Customer Service: Expect customer-facing impact. Do not communicate anything about the data theft yet — the perimeter is not confirmed and no public statement has been cleared. Route all customer and media questions to the Communication cell holding line. Prepare the customer service surge plan: if/when this becomes public, 6 million loyalty members will contact us.
> 
> Evidence preservation: No system touched by the intrusion is to be wiped, reimaged or "cleaned up" today. The IR provider is in control of forensics; all actions on the e-commerce platform, domain controllers and backup infrastructure go through them.
> 
> I am joining your cell meeting now to walk through the technical detail. Next consolidated situation update from IT at 09:15, or immediately if anything material changes.
> 
> Pascal Rivet
> On-call IT Manager
> Mobile: reachable on the crisis bridge — prefer that channel, corporate email is on degraded infrastructure


### #10 · H+0:50 (08:50) · Authority email

**Cybercrime unit: complaint procedure and evidence expectations**  
From Commissaire Laurent Sorel (Cybercrime Unit, National Police) to the **Legal, compliance & business cell**

*reference*: OCRC-2026-1127-0417  
*from_name*: Commissaire Laurent Sorel, Cybercrime Unit, National Police  
*from_email*: laurent.sorel@cybercrime.police.gov  
*to*: Maison Aubray Retail Group - Operational Crisis Cell (Legal, Compliance & Business): DPO, Legal Counsel, Payments/Finance, Store Operations, Customer Service  
*subject*: Ransomware incident at Maison Aubray - complaint procedure and evidence preservation requirements  
*date*: November 27, 2026  
*body*:

> To the Operational Crisis Cell of Maison Aubray Retail Group,
> 
> We have been informed this morning of a major ransomware incident affecting your head-office IT infrastructure on the opening day of your peak sales period, with 420 stores operating in degraded mode. The Cybercrime Unit stands ready to receive your complaint and to support your investigation. This message sets out the procedure to follow and the evidence expectations that will determine the effectiveness of criminal proceedings, which may also become relevant to the ransom demand you should anticipate.
> 
> 1. Filing the complaint. The complaint must be filed without delay with the Cybercrime Unit, ideally by your General Counsel or a duly mandated representative, accompanied by a power of attorney and Kbis extract. It may be filed physically or via the pre-complaint online form, but given the scale of the incident we recommend direct filing with our unit so that a criminal case can be opened today. Do not wait for a complete forensic picture: an initial complaint can be supplemented as facts are established, and early filing strengthens any future request for international cooperation and asset freezing.
> 
> 2. Evidence preservation. From this moment, and in coordination with your incident response provider, you must preserve all evidence in a forensically sound manner: encrypted hypervisors and affected machines must not be re-imaged or wiped; memory dumps, ransom notes, and attacker artefacts (beacons, malicious scripts, suspicious JavaScript on your e-commerce checkout, logs of credential theft and lateral movement) must be captured and hashed; centralised logs, DNS records and e-mail headers of any attacker communication must be exported before retention cycles expire. Designate a single evidence custodian within your IT cell and keep a chain-of-custody log for every artefact. Any payment of, or negotiation with, the threat actor must be reported to us before action, as it carries legal consequences and may obstruct the investigation.
> 
> 3. Reporting obligations. We remind you that this incident engages parallel obligations: notification to the national cybersecurity agency (ANSSI) as a matter of urgency given the scale and disruption; the CNIL within 72 hours for the personal data breach affecting your customer database; and immediate notification to your acquiring bank if card data compromise is suspected at the checkout. Your complaint to us does not substitute for these notifications, and cross-referencing them will be requested by the investigating magistrate.
> 
> 4. Contact. A dedicated investigator has been assigned. Provide us by 12:00 today with: (i) the time and scope of encryption, (ii) confirmation of data exfiltration and its nature, (iii) any ransom communication received, and (iv) the identity and contact details of your incident response provider and evidence custodian. Reach our on-call duty desk at the number provided to your security officer.
> 
> Time is of the essence. Every hour of well-preserved evidence improves our capacity to trace, prosecute and potentially freeze criminal assets.
> 
> Commissaire Laurent Sorel
> Cybercrime Unit, National Police
> Reference: OCRC-2026-1127-0417

*severity*: critical  

### #11 · H+0:58 (08:58) · External email

**Dilemma brief: isolate e-commerce now or keep Black Friday sales?**  
From Camille Verdon (IR lead, Sentinelle CERT) to the **Strategic crisis cell**

*from_name*: Camille Verdon  
*from_email*: c.verdon@sentinelle-cert.com  
*to*: Decision Cell – Strategic Crisis Cell, Maison Aubray (crisis-cell@maison-aubray.com)  
*cc*: IT & Cyber Cell lead; Legal, Compliance & Business Cell lead; Communication Cell lead  
*subject*: [URGENT – H+58] Dilemma brief: isolate e-commerce now or keep Black Friday sales?  
*date*: 27/11/2026 08:58  
*body*:

> Dear Crisis Cell members,
> 
> This is Camille Verdon, IR lead at Sentinelle CERT, writing at 08:58, one hour into the incident. The situation has moved fast since our 08:00 activation, and you now face a first arbitration that cannot wait for full confirmation: do we isolate the online shop now, or keep it selling through Black Friday? This brief lays out what we know, what we do not, and the decision I need from you by 09:15 at the latest.
> 
> Where we stand. Hypervisors at head office and logistics were encrypted at 05:50. ERP, warehouse management and store back-office remain down; your 420 stores are operating in degraded mode on standalone payment terminals, which so far appear unaffected. Forensics have confirmed an intrusion going back several weeks: beacon artefacts on two workstations, Kerberoasting of a backup service account, and backup catalogues deleted with snapshot retention reduced to zero — recovery from clean restores is not possible, so rebuilding from scratch is the realistic path. At 08:44 we confirmed 1.8 TB of data was exfiltrated to cloud storage, including the 6-million-customer loyalty database. The GDPR 72-hour clock is being assessed by your DPO in parallel.
> 
> The e-commerce question. Our IR engineers are analysing a suspicious JavaScript element loading on the checkout page from an unknown domain — the same anomaly your team flagged at 08:38. We have indications consistent with a web skimmer — injected some time before the encryption event, not part of the ransomware deployment itself — but we do not yet have confirmation that card data is being captured or exfiltrated. Full confirmation will take several hours at best, and every hour of uncertainty is an hour in which customer card data may be at risk on your highest-traffic sales day of the year.
> 
> The dilemma, stated plainly. Isolating e-commerce and pulling the online checkout now means losing Black Friday online revenue, disappointing customers mid-order, and signalling a major incident publicly. Keeping it open on incomplete evidence means potentially leaving a card skimmer live during peak payment volume, with direct PCI DSS and card-scheme consequences, fraud liability, and severe reputational exposure if data is later confirmed stolen. There is no zero-risk option.
> 
> What I recommend. From an incident-response standpoint: if the suspicious script cannot be verified clean and neutralised within the next 15 minutes, take the online checkout offline and isolate the e-commerce environment from the rest of the network. The standalone in-store terminals are a separate estate and can continue in degraded mode for now, subject to the IT & Cyber Cell's containment checks. A controlled, communicated pause of online sales is recoverable; a mass card-data compromise discovered on Cyber Monday is not.
> 
> What I need from you by 09:15:
> 
> 1. A decision on online checkout: isolate now, or keep open with enhanced monitoring — recorded in the decision log with rationale and named owner.
> 
> 2. Confirmation that the IT & Cyber Cell is authorised to isolate e-commerce infrastructure at network level if the situation degrades, without a second escalation.
> 
> 3. Whether to notify the acquiring bank proactively of a suspected skimmer in the checkout — I strongly advise yes; they will find out regardless, and early notification protects your PCI position.
> 
> 4. Alignment with the Communication Cell on the holding message, whichever option you choose — customers with failed orders will talk publicly within the hour.
> 
> Evidence preservation note: whatever you decide, do not power-cycle, re-image or 'clean' e-commerce servers yourselves. Our team needs the volatile artefacts intact; the cybercrime unit has already set evidence expectations in line with the complaint procedure.
> 
> I am reachable on the IR bridge at all times. One voice, one picture, one decision log — please make sure this decision goes into it.
> 
> Camille Verdon
> Incident Response Lead, Sentinelle CERT
> +33 6 00 00 00 00 — IR bridge: channel 1

*attachment_name*: MA-20261127-Dilemma-brief-e-commerce-isolation.pdf  

### #12 · H+1:06 (09:06) · X post

**Customers complaining online: site slow, orders failing**  
From Angélique Roux (Loyalty customer, -) to the **Communication cell**

*display_name*: Angélique Roux  
*handle*: AngieRoux83  
*text*:

> Black Friday and the Maison Aubray site has been rejecting my order for an hour. Third try, card declined twice, and now the checkout page freezes. Is anyone else locked out? At least say something, @MaisonAubray 🙃 #BlackFriday #MaisonAubray

*date*: 9:06 AM · Nov 27, 2026  
*retweets*: 14  

### #13 · H+1:14 (09:14) · External email

**Journalist follow-up: sources mention ransom notes in stores**  
From Elsa Marchand (Business journalist, Le Quotidien Éco) to the **Communication cell**

*from_name*: Elsa Marchand  
*from_email*: e.marchand@quotidien-eco.fr  
*to*: press@maison-aubray.com  
*cc*: communication-crise@maison-aubray.com  
*subject*: URGENT – Follow-up: ransom notes reported in Maison Aubray stores – response needed before 11:00  
*date*: 27/11/2026 09:14  
*body*:

> Dear Maison Aubray press office,
> 
> Elsa Marchand, Le Quotidien Éco, following up on my earlier call this morning.
> 
> We are preparing a story for our midday edition about the IT disruption affecting Maison Aubray this Black Friday. Since roughly 7 a.m., our newsroom has received reports of significant operational problems: stores apparently unable to access back-office systems, queues building with manual payment processes, and the online shop intermittently slow or rejecting orders.
> 
> More importantly, we now have material I need to put to you before publication. Two store employees, speaking on condition of anonymity, have told us that ransom notes appeared this morning on screen — one in a store in the Lyon area, one in Toulouse. I attach a photograph we have received of what purports to be one of these notes. Separately, a source close to your IT function claims your head-office servers were encrypted overnight and that customer data may be involved.
> 
> I would be grateful if you could confirm or deny the following, or provide whatever statement you are in a position to make:
> 
> 1. Has Maison Aubray been the victim of a ransomware attack affecting its head-office IT and store systems?
> 2. Is any customer or payment data implicated, given the reported involvement of your e-commerce checkout?
> 3. Are the 420 stores continuing to trade, and are customer card payments safe at the tills and online today?
> 4. Have the relevant authorities (CNIL, ANSSI, police cybercrime unit) been informed, and have customers who may be affected been notified?
> 
> We plan to reference the ransom note photograph and the employee accounts, attributed as such, in our article. If you have an on-the-record comment, a spokesperson available for a brief phone interview, or a holding statement, I need it by 11:00 at the latest to meet our deadline.
> 
> I appreciate it is a fast-moving morning for your teams; even a short statement that you are investigating an IT incident and that payments are being secured would allow us to reflect your position accurately.
> 
> Best regards,
> Elsa Marchand
> Business desk, Le Quotidien Éco
> +33 6 12 34 56 78

*attachment_name*: photo-ransom-note-store-toulouse.jpg  

### #14 · H+1:22 (09:22) · Internal email

**Store chaos: manual payments, queues, loyalty blocked**  
From Yvonne Lecoq (Regional store manager, Maison Aubray) to the **Legal, compliance & business cell**

*from_name*: Yvonne Lecoq  
*from_email*: y.lecoq@maison-aubray.com  
*to*: Crisis Committee – Legal, Compliance & Business Cell  
*cc*: Crisis Director; Strategic Crisis Cell; IT & Cyber Cell; Communication Cell  
*subject*: [URGENT – BLACK FRIDAY CRISIS H+1:22] Store feedback: manual payments, queues, loyalty blocked – need a degraded-mode doctrine NOW  
*date*: 27/11/2026 09:22  
*body*:

> Dear members of the Legal, Compliance & Business Cell,
> 
> Situation at H+1:22, from the field (I am coordinating with the regional store network this morning): Since the store back-office servers went down, our 420 stores are selling on standalone payment terminals, but operations are deteriorating fast. We need a clear, company-wide degraded-mode doctrine for the rest of the day, and the stores cannot wait for it.
> 
> What stores are reporting right now:
> - Loyalty programme fully blocked: cashiers cannot look up or apply loyalty accounts, points and vouchers. Customers are refusing to pay full price on Black Friday; cashiers are improvising manual discounts inconsistently from store to store.
> - Payment friction: some terminals are declining or timing out. Several store managers have switched partly to manual payment capture (imprint/call-in) as a workaround – I have asked them to stop until Finance and Payments confirm this is acceptable and PCI-compliant. I need a formal answer on this within the hour.
> - Long queues and walk-outs: peak Black Friday footfall is colliding with checkout slowdowns. We are losing sales and tempers are rising, including verbal aggression toward staff.
> - No store communication: store managers are calling me because they have received no official line. Two have already been contacted by customers complaining online about the website being slow, and one was asked by a local journalist about "ransom notes on screens". Store teams must not improvise answers to customers or press.What I ask the cell to decide or confirm urgently:
> - One degraded-mode doctrine for all 420 stores: a single instruction pack – which payment methods are authorised, how to handle loyalty (accepted vouchers, manual point recording?), gift cards, returns and refunds while systems are down, and who can approve exceptions.
> - Payment security ruling: is manual card capture allowed or prohibited? Given the ongoing investigation of the online checkout, stores must not create a second card-data problem. Payments/Finance must arbitrate and the instruction must be unambiguous.
> - Official holding line for stores: we need the Communication Cell's approved wording so every store gives the same message. Please also confirm what store managers may or may not say about the incident.
> - Customer service surge plan: the hotline and in-store staff will face a spike in questions, including about loyalty points and card payments. Customer service needs scripts, extra staffing and an escalation path for card-related complaints, especially if the payment question escalates.
> - Protection of staff: clear guidance on handling aggressive customers and authorization to limit services (e.g. cap manual transactions) if queues become unmanageable.Reminder of constraints from your side I am aware of: any customer data and card-data related decisions taken today may affect your GDPR 72-hour assessment, your exchanges with the acquiring bank and card schemes, and the police complaint procedure. Please reflect the store reality above in those assessments: the volume and nature of transactions currently happening in stores is directly relevant.
> 
> I can join your next cell meeting by phone immediately. I am reachable on my mobile at all times. Please send the degraded-mode instruction pack to all store managers through the crisis channel (SMS fallback, as email is not reliable).
> 
> Thank you for your swift decisions – the clock is running on the sales floor.
> 
> Yvonne Lecoq
> Regional Store Manager, Maison Aubray Retail Group
> Mobile: available via the crisis contact list

*attachment_name*: Store_feedback_degraded_mode_2711_0922.pdf  


## H+1:30 · 12 million euros

### #15 · H+1:30 (09:30) · External email

**Ransom demand to the CEO: 12M€ in 72 hours**  
From VEIL-9 Operator (Attacker spokesperson, VEIL-9) to the **Strategic crisis cell**

*from_name*: VEIL-9 Operator  
*from_email*: operator.veil9@protonmail[.]com  
*to*: ceo@maison-aubray.com  
*cc*: executive-committee@maison-aubray.com  
*subject*: Maison Aubray — 12,000,000 EUR. 72 hours. Read carefully.  
*date*: 27/11/2026 09:30  
*body*:

> Dear Chief Executive,
> 
> By now your teams will have noticed that the head-office hypervisors, your ERP and your warehouse management stopped working this morning at 05:50. That was us. Consider it our business card.
> 
> Let us be precise about our position, because we dislike wasting time on Black Friday — yours and ours.
> 
> What we have:
> 
> 1. A full copy of your customer loyalty database — 6,182,447 accounts: names, postal and email addresses, phone numbers, purchase histories, loyalty balances. We exfiltrated 1.8 TB in total, which also includes your HR files and your supplier contracts. We invite you to check the sample archive attached to this message; it contains 10,000 records as proof.
> 
> 2. Card data. Your payment security is not what your PCI DSS certificate claims. We have been inside your e-commerce checkout for longer than you would like to imagine, and we possess payment card details captured from your online customers. We are confident your acquiring bank will find this conversation interesting if we release them.
> 
> 3. Your backups. The catalogues are deleted and the snapshots are gone. There is no restore coming. Your 420 stores are selling on standalone terminals this morning; how long can your operation survive on that before your Black Friday becomes the worst in your company's history?
> 
> Our demand:
> 
> 12,000,000 EUR, payable in Monero, within 72 hours from this message — that is Monday 30 November, 09:30 CET. In exchange, you receive the decryption keys, the complete deletion of the exfiltrated data, and our silence. We do not sell the same data twice and we honour agreements — check any forum: companies that deal with us are never published.
> 
> If you do not pay:
> 
> At 10:15 today, a first sample of your customer database goes live on our leak site. If the 72 hours expire without an agreement, the full database, the card data, the HR files and the supplier contracts are published and sold to whoever asks. Journalists will receive a curated selection. Your regulator will receive evidence of the card exposure directly from us — 72 hours is your window, but we can make it shorter for you.
> 
> How to proceed:
> 
> Reply to this address only. Do not involve police or intermediaries without telling us first — we will know. Do not waste the first hours of your window on lawyers explaining why you cannot pay; the clock does not care. Nominate one person with a mandate to speak for the company. If we detect honest engagement, the deadline is negotiable. If we detect stalling while you restore behind our backs, it is not.
> 
> Twelve million is a small number compared to what this Friday, your 6 million customers and your card scheme accreditation are worth.
> 
> The clock started at 09:30.
> 
> — VEIL-9 Operator

*attachment_name*: Aubray_Sample_Proof.tar.gz  

### #16 · H+1:34 (09:34) · Dark web forum

**Leak-site post: 'Maison Aubray - data next'**  
From VEIL-9 Operator (Attacker spokesperson, VEIL-9) to the **IT & cyber cell**

*thread_prefix*: LEAK  
*thread_title*: Maison Aubray - data next  
*leaker_name*: veil9_op  
*leaker_status*: ONLINE  
*post_date*: 2026-11-27 09:34:12 UTC  
*message_content*:

> update: aubray still quiet. clock ticking.
> 
> maison aubray retail group. french, big. clothes, home, whatever. you know them. 420 stores and a fat online shop. black friday today. bad day to lose your systems.
> 
> we took 1.8TB. full picture:
> 
> - loyalty customer database: 6,000,000 accounts (names, emails, phones, addresses, purchase history, loyalty balances, hashed + some plaintext-ish pw fields from a legacy table lmao)
> - HR files: ~14,200 employees (contracts, payroll, bank details on some, ID scans for store hires)
> - supplier + procurement contracts: ~3,900 docs, pricing, margins, their dirty little negotiation tricks
> - internal financial exports, some store ops reports, bits of ERP dumps
> 
> and oh yeah. card data. we said card data. we have card data. tick tock.
> 
> proof file below. we don't post free sample for this one, this is a negotiation, not a charity. victim knows the price. 12M. they have until sunday morning. after that the loyalty db goes public in chunks, then the rest, and the card stuff goes to interested buyers.
> 
> their executives were emailed directly. so far silence. silence is a choice.
> 
> we know how this goes. french retail, gdpr fines, pci people knocking, acquirer already nervous. paying is cheaper. math is math.
> 
> no escrow needed - this is extortion not sales. but serious buyers for the card dataset can message once timer hits zero. vetted members only, no rippers.
> 
> countdown on our site. aubray family shareholders can enjoy the weekend.

*breach_date*: 2026-11-27  
*victim*: Maison Aubray Retail Group  
*victim_domain*: maison-aubray.example  
*data_size*: 1.8 TB  
*price*: 12,000,000 EUR (ransom) / card dataset: private negotiation  
*sample_status*: Sample withheld pending ransom deadline (Sunday 29 Nov 2026, 09:30 CET) - proof manifest published  
*mirror_url*: http://veil9leakxxq7a.example.onion  
*files*:

> ["aubray_loyalty_6M_records.csv.sha256", "aubray_proof_manifest.txt", "aubray_hr_records_sample_redacted.xlsx.sha256", "aubray_supplier_contracts_index.pdf", "aubray_screenshots_pack.7z.sha256", "aubray_internal_memos_q3_2026.eml.tar"]

*last_reply*: 2026-11-27 09:31:42 UTC  

### #17 · H+1:39 (09:39) · External email

**Legal and IR guidance on the ransom demand**  
From Camille Verdon (IR lead, Sentinelle CERT) to the **Legal, compliance & business cell**

*from_name*: Camille Verdon  
*from_email*: c.verdon@sentinelle-cert.com  
*to*: legal-crisis-cell@maison-aubray.com  
*cc*: ir-team@sentinelle-cert.com  
*subject*: URGENT - VEIL-9 ransom demand (12M€ / 72h): legal and IR guidance, immediate actions required  
*date*: 27/11/2026 09:39  
*body*:

> Dear Legal, Compliance & Business Cell,
> 
> Camille Verdon here, IR lead at Sentinelle CERT, writing on behalf of the joint IR team supporting Maison Aubray this morning. We are aware that at 09:30 the group calling itself VEIL-9 sent a ransom email directly to your CEO: 12 million euros within 72 hours, or the stolen customer database and what they describe as 'card data' will be published. Our attached guidance note summarises the situation and recommended actions; key points below.
> 
> 1. Legal position on the ransom demand. Paying a ransom to a criminal organisation carries serious legal and financial exposure: potential sanctions exposure if funds reach sanctioned actors or wallets (OFAC/EU/UN lists must be screened before ANY engagement), possible criminal liability considerations, and no guarantee whatsoever that data is deleted or that decryption keys work. You are under no legal obligation to pay, and no obligation to respond. French law (and standard NCSC/CERT-FR guidance) recommends against payment. Any decision — engage, stall, or refuse — must be taken by the Strategic crisis cell, logged with timestamp, rationale and participants, and shared with the other cells so everyone works from one picture.
> 
> 2. Do not negotiate in writing without legal review. Any reply to the threat actor, including through the contact channel they provided, is a negotiation signal and may be used against you (leaked, manipulated, or as proof of willingness to pay). If the Strategic cell decides to open a channel, it must be done through an experienced ransom negotiator/breach counsel, not via company email accounts. Preserve the original email with full headers — it is evidence for the police complaint and for any future sanctions screening.
> 
> 3. Evidence preservation. Please ensure your teams do not delete or alter: the ransom note and the CEO's mailbox copy, any dark-web leak site material (we are monitoring VEIL-9's leak site for posts referencing Maison Aubray and will archive anything immediately), logs, and any artefacts on the encrypted systems. The police complaint (plainte) you are preparing should reference the ransomware encryption (05:50), the exfiltration of ~1.8 TB including the 6-million-customer loyalty database (confirmed 08:44), the ransom demand (09:30), and the extortion leak threat.
> 
> 4. Regulatory clocks. The GDPR 72-hour notification window to the CNIL is now running (exfiltration confirmed at 08:44 today; the intrusion itself appears weeks old, which may matter for the timeline you report — we can provide forensic dates: initial access evidence from late October/early November, exfiltration estimated around 21 November). Expect the DPA to request scope details; align your draft notification with our forensic timeline before submitting. Separately, the suspected JavaScript skimmer on the e-commerce checkout (flagged 09:08, investigation ongoing) triggers PCI DSS obligations: notify your acquirer promptly and follow their forensic investigator process. Do not wait for skimmer confirmation before informing the acquirer of suspected card-data compromise — the scheme timelines are short.
> 
> 5. What we need from your cell by 10:00 latest: (a) confirmation that the ransom email is preserved unmodified and that no one has replied; (b) the draft scope of the GDPR notification and police complaint, so our forensics align with your legal filings; (c) your acquirer contact engaged on the suspected checkout compromise; (d) a named legal focal point for the ransom file, so all threat-actor communications route through one person.
> 
> 6. Consistency of communication. Assume the ransom demand and any leak will become public, possibly today. Any holding statement must be reviewed by legal before release and must not confirm or deny payment intentions, exfiltration scope beyond what is evidenced, or card-data compromise before the acquirer investigation says so. Keep the four cells on a single situation picture — we are maintaining the shared decision log and will circulate the next update at 10:00.
> 
> I am reachable on +33 6 12 45 78 90 and on this address. Please confirm receipt of this message and the 10:00 actions.
> 
> Best regards,
> Camille Verdon
> Incident Response Lead — Sentinelle CERT
> +33 6 12 45 78 90 | c.verdon@sentinelle-cert.com
> Client engagement: Maison Aubray Retail Group — incident ref. MA-2026-1127-IR

*attachment_name*: VEIL-9_ransom_demand_IR_legal_guidance_v1.pdf  

### #18 · H+1:44 (09:44) · Internal email

**Board and family shareholders pressing for answers**  
From Marc Delaunay (HR director, Maison Aubray) to the **Communication cell**

*from_name*: Marc Delaunay  
*from_email*: m.delaunay@maison-aubray.com  
*to*: Communication Cell  
*cc*: Crisis Committee  
*subject*: URGENT – H+104 Status Update & Comms Instructions: Board Pressure, Ransom Demand, One Shared Message  
*date*: 27/11/2026 09:44  
*body*:

> To the Communication Cell – time is 09:44, we are at H+104. Please read in full and act immediately.
> 
> Since our last point, the situation has escalated materially. At 09:30, the attacker group (self-identified as VEIL-9) emailed the CEO directly: a 12M€ ransom, payable within 72 hours, or they will publish our customer database and what they call 'card data'. This follows confirmation at 08:44 of 1.8 TB of exfiltrated data, including the 6-million-account loyalty database, and the discovery at 09:08 of suspicious JavaScript loading on our e-commerce checkout page, which may be a card skimmer. The skimmer is not yet confirmed; IT is investigating. Do not state card data theft as fact.
> 
> Situation on the ground: hypervisors at head office and logistics were encrypted overnight (05:50); ERP and warehouse management are down; our 420 stores are open in degraded mode on standalone payment terminals. The GDPR 72-hour notification clock assessment is underway with the DPO. The Strategic Cell is actively arbitrating the e-commerce and payment isolation decision and the ransom response; no decision has been logged yet on either.
> 
> Your immediate priorities:
> - Board and family shareholders: Several board members and family shareholders are already pressing leadership for answers. Prepare a short leadership briefing line by 10:15 that is consistent with what we can legally say: we are managing a serious cyber incident, stores remain open, customer protection and regulatory notification are our priorities, and we will communicate formally once facts are verified. Do not speculate on the ransom, the skimmer, or the exfiltration scope with shareholders. Route all board contact through the Strategic Cell.
> - Employee and store comms: Issue updated internal guidance to head-office staff and store managers today: no unauthorised statements, no confirming or denying details of the incident, redirect all media or customer questions to the press office and customer service script. Stores must use the approved degraded-mode FAQ.
> - Holding statements: Finalise holding statements for customers, employees, stores and press now, validated by Legal. Given the ransom demand and the leak threat, assume public exposure is likely within hours. Keep wording factual: 'investigating a cyber incident', no confirmation of data theft or card compromise before Legal and the DPO clear the language. Premature disclosure could compromise the GDPR process and PCI obligations.
> - Social media watch: Stand up continuous monitoring of social platforms and the attacker's leak site. The 72-hour deadline makes an early publication attempt plausible. Flag any customer complaint about fraudulent card use to IT and Legal immediately, and log it in the decision log.
> - One shared picture: All external and internal messages must be consistent with the single situation picture held by the Crisis Committee. Log every statement issued, with timestamp, in the shared decision log. Any new line must be cleared through this cell and Legal before release.What you must NOT communicate anywhere, internally or externally: the ransom amount, the identity of the attacker group, the suspected skimmer, the volume and nature of exfiltrated data, and any negotiation stance. If asked directly by press or staff, the line is: 'We are aware of the situation and are treating it with the highest priority. We will share verified information as soon as we are able.'
> 
> Next checkpoint: Crisis Committee plenary at 10:30. Send your draft holding statements and leadership briefing line to me and the committee secretariat by 10:15 at the latest.
> 
> We are counting on your discipline and speed. One voice, one picture, one log.
> 
> Marc Delaunay
> HR Director, Maison Aubay Retail Group

*attachment_name*: Comms_Cell_H104_Sitrep_v1.pdf  

### #19 · H+1:50 (09:50) · Authority email

**Data Protection Authority acknowledges contact, asks for scope**  
From Officer on duty (Case officer, Data Protection Authority) to the **Legal, compliance & business cell**

*reference*: DPA-2026-1127-NOTIF-0447-AUB  
*from_name*: Officer on Duty, Case Officer – Incident Notification Desk, Data Protection Authority  
*from_email*: incident.notifications@dpa.gouv.fr  
*to*: Operational Crisis Cell, Maison Aubray Retail Group (DPO, Legal Counsel, Payments/Finance, Store Operations, Customer Service)  
*subject*: Acknowledgement of incident notification – Maison Aubray Retail Group – Request for scope clarification (Ref. DPA-2026-1127-NOTIF-0447-AUB)  
*date*: November 27, 2026  
*body*:

> Dear Operational Crisis Cell, Maison Aubray Retail Group,
> 
> The Data Protection Authority acknowledges receipt of the initial contact regarding the ransomware incident affecting your head-office information systems since approximately 05:50 this morning. Your case has been registered under reference DPA-2026-1127-NOTIF-0447-AUB. Please quote this reference in all subsequent correspondence.
> 
> Given the nature of the incident, we expect a formal notification under Article 33 of the GDPR within the applicable 72-hour window from your confirmation of a likely personal data breach. On the basis of the information currently available to us, we note in particular the following elements requiring clarification:
> 
> 1. Scope of the breach. Please confirm whether the 1.8 TB of exfiltrated data reported by your teams includes the loyalty customer database of approximately six million individuals, human resources files, and supplier contracts, and provide an estimate of the number and categories of data subjects affected, including any special categories of personal data.
> 
> 2. Payment card data. We are aware of indications of a suspicious script on your e-commerce checkout page and of criminal claims regarding possession of card data. Please state, to the best of your current knowledge and with the level of certainty available, whether payment card data is confirmed, suspected or excluded from the exfiltrated or intercepted data. If facts are not yet established, indicate this explicitly and provide your investigation timeline rather than withholding the notification.
> 
> 3. Possible consequences. Please describe the foreseeable risks to data subjects (fraud, identity theft, targeted phishing, publication of data) and the mitigation measures you intend to take, including any communication towards affected individuals under Article 34 GDPR.
> 
> 4. Containment measures. Please summarise the containment and recovery actions taken, the status of your e-commerce platform and in-store payment environment, and whether personal data processing continues in degraded mode across your 420 stores.
> 
> 5. Parallel obligations. Where payment card data may be involved, we remind you of the separate notification obligations towards your acquiring bank and the relevant supervisory bodies, and we expect consistency between the information provided to each authority.
> 
> We draw your attention to the fact that an initial notification may be submitted in stages: Article 33 expressly allows a phased approach where full information is not immediately available. An incomplete but timely and honest notification, updated as your forensic investigation progresses, is preferable to a delayed one. Any statement made to us must be consistent with your public communications.
> 
> Please provide the requested scope clarification as soon as possible, and in any case within the 72-hour notification window, by email to this address quoting the above reference. A case officer has been assigned and remains available for urgent exchanges during business hours.
> 
> Finally, we note that a criminal ransom demand has been reported in connection with this incident. Any handling of that demand is a matter for your executive management and the competent law enforcement authorities; we remind you that all decisions taken in this context should be documented, and that the potential publication of personal data would materially affect your Article 34 obligations towards data subjects.
> 
> Yours faithfully,
> Officer on Duty, Case Officer
> Incident Notification Desk
> Data Protection Authority

*severity*: critical  

### #20 · H+1:58 (09:58) · External email

**Journalist deadline: 'We will run the ransom story at 10:30'**  
From Elsa Marchand (Business journalist, Le Quotidien Éco) to the **Communication cell**

*from_name*: Elsa Marchand  
*from_email*: e.marchand@lequotidieneco.fr  
*to*: press@maison-aubray.com  
*cc*: communications@maison-aubray.com  
*subject*: Le Quotidien Éco deadline 10:30 — ransomware and ransom demand at Maison Aubray, request for comment  
*date*: 27/11/2026 09:58  
*body*:

> Dear Maison Aubray Press Office,
> 
> Elsa Marchand, business desk, Le Quotidien Éco. I am reaching you directly this Black Friday morning because we are preparing a story on the major IT incident affecting your group, and I want to give you a fair chance to respond before publication.
> 
> Here is what our reporting has established so far:
> 
> — Ransomware encrypted head-office systems overnight; your ERP and warehouse management are reportedly down and your roughly 420 stores are operating in degraded mode this morning.
> — A criminal group, which we understand calls itself VEIL-9, has contacted your CEO directly this morning demanding a ransom reported to us in the range of 12 million euros, with a 72-hour deadline, threatening to publish stolen customer data including a very large loyalty customer database.
> — Our sources also indicate traces of a long-standing intrusion, with data exfiltrated in the days before the encryption, and a possible compromise of your online checkout page.
> 
> Our deadline is 10:30 CET today. We will run the ransom story at that time, with or without your input.
> 
> Specifically, I would like an on-record answer, however brief, to these questions by 10:15 at the latest:
> 
> 1. Can you confirm a ransomware attack and a ransom demand? Are you in contact with the attackers?
> 2. Is customer data — in particular payment card data — at risk? What should your online customers do today?
> 3. Is your e-commerce site still safe to shop on this morning?
> 4. Are store payments and click-and-collect operations affected?
> 5. Have you notified the CNIL, law enforcement, or your acquiring bank?
> 
> If you cannot answer all of these by the deadline, a short holding statement is fine — but please note that an outright 'no comment' will be reported as such, and customers are already posting about payment issues and store disruptions on social media.
> 
> You can reach me at this address or on my mobile, +33 6 12 44 87 31, until 10:15.
> 
> Best regards,
> Elsa Marchand
> Business journalist, Le Quotidien Éco
> e.marchand@lequotidieneco.fr | +33 6 12 44 87 31


### #21 · H+2:04 (10:04) · Internal email

**Skimmer confirmed: checkout script POSTs to attacker domain**  
From Nadia Brun (SOC night analyst, Maison Aubray) to the **IT & cyber cell**

*from_name*: Nadia Brun  
*from_email*: nadia.brun@maison-aubray.com  
*to*: IT & Cyber Crisis Cell (CIO, CISO, SOC, Infrastructure, Payment IT)  
*cc*: Crisis Committee  
*subject*: [URGENT - H+2:04] Skimmer CONFIRMED on e-commerce checkout - script POSTs card data to attacker domain - isolation decision needed now  
*date*: 27/11/2026 10:04  
*body*:

> Priority: immediate action required. Skimmer confirmed.
> 
> Team, we now have technical confirmation of the suspicion raised at 09:08. The unknown JavaScript on our e-commerce checkout page is actively capturing card data and POSTing it to an attacker-controlled domain. This is no longer a suspicion: it is a live card-data compromise on our busiest sales day.
> 
> 1. What we confirmed (forensics, with IR provider):
> - The injected script loads on the checkout page and intercepts card fields before they reach our payment gateway.
> - Captured data is exfiltrated via POST requests to an external domain (IOCs in attachment, already shared with the IR provider).
> - Consistent with the compromise timeline: the attacker reached the e-commerce build pipeline around 17 November; the skimmer appears active for a subset of card payments since then.
> - This corroborates VEIL-9's claim of 'card data' in their 09:30 ransom email, and is likely linked to the acquiring bank's fraud pattern report received at 10:40 pending - note the bank already flagged a common point of purchase pointing to our online shop.2. Containment status (recap, one shared picture):
> - Ransomware: head-office and logistics hypervisors encrypted at 05:50; ERP and WMS down; backup catalogues deleted, no clean restore available yet.
> - Exfiltration: 1.8 TB confirmed at 08:44, including the 6-million-customer loyalty database; GDPR 72-hour clock running (DPO briefed).
> - Stores: 420 stores operating in degraded mode on standalone payment terminals - no link to infected back-office servers.
> - E-commerce: still online and still leaking card data as of 10:00.3. My recommendation to the cell: the isolation arbitration is now urgent and, in my view, no longer defensible to delay. Every minute the checkout stays up, more card data is stolen and our PCI DSS exposure grows. I recommend we immediately:
> - Suspend the online checkout (take the payment step offline; keep catalogue/browsing up if the business wishes), and block the attacker domain at DNS, firewall and CDN levels.
> - Preserve evidence before any change: capture the live script, full request samples, and logs to write-once storage per the IR provider's instructions - do not clean or redeploy the checkout code yet.
> - Notify Payment IT to coordinate with the acquiring bank: they will require forensic evidence for the common-point-of-purchase investigation; expect potential terminal/account suspension questions.
> - Identify the subset of affected transactions since ~17 November to scope card exposure.4. Decision needed from the committee: the decision to isolate or maintain the online shop belongs to the strategic cell, but the technical facts have changed - continuing to sell online now means knowingly exposing customers' card data on Black Friday. Please log whatever decision is taken in the crisis decision log with time and rationale.
> 
> I remain available on the bridge line. Next SOC update at 10:30.
> 
> Nadia Brun
> SOC Night Analyst - shift handover in progress

*attachment_name*: IOC_checkout_skimmer_20261127.pdf  

### #22 · H+2:10 (10:10) · Internal email

**CFO: can we even pay? Insurance and sanctions questions**  
From Pascal Rivet (On-call IT manager, Maison Aubray) to the **Strategic crisis cell**

*from_name*: Pascal Rivet  
*from_email*: p.rivet@maison-aubray.com  
*to*: Crisis Committee  
*cc*: IT & Cyber Cell; Communication Cell; Legal, Compliance & Business Cell  
*subject*: URGENT - H+2:10 status: ransom demand, skimmer confirmed, payment feasibility constraints for the Committee  
*date*: 27/11/2026 10:10  
*body*:

> Dear Crisis Committee members,
> 
> Time check: H+2:10 (Friday 27 November, 10:10). Consolidated status and the practical constraints you need for the decisions on today's agenda. Please ensure all of this is captured in the decision log.
> 
> 1. Situation recap (confirmed facts)
> - 05:50: Hypervisors of head office and logistics encrypted. ERP and warehouse management are down; 420 stores are operating in degraded mode on standalone payment terminals.
> - Forensics confirm a weeks-old intrusion: phishing entry point, remote-access beacon, Kerberoasting of a backup service account, backup catalogues deleted, snapshot retention reduced to zero. Full clean restore is not currently possible; recovery priorities must be arbitrated.
> - 1.8 TB exfiltrated, including the 6-million-customer loyalty database, HR files and supplier contracts. The GDPR 72-hour clock assessment is underway with the DPO.
> - 09:08: Suspicious JavaScript loading on the e-commerce checkout from an unknown domain; at 09:30 the threat group (VEIL-9) emailed the CEO demanding 12M EUR within 72 hours, threatening publication of the customer database and 'card data'.
> - 10:04 (IR provider follow-up): the checkout script is confirmed to POST captured data to an attacker-controlled domain. Treat the e-commerce checkout as compromised: card data exposure is plausible, with PCI DSS and card-scheme consequences.2. Can we even pay? Practical constraints for the ransom decision
> - Cyber insurance: our policy requires notification of the insurer before any engagement with the threat actor. Any contact or payment signal without insurer sign-off risks voiding cover. The broker has been called; no response yet.
> - Sanctions screening: any payment requires attribution work by the IR provider to confirm the recipient wallet/entity is not sanctioned. Without that diligence, a payment could expose the Group and its executives to criminal sanctions. Attribution cannot be completed within the 72-hour window.
> - Treasury feasibility: assembling 12M EUR in cryptocurrency on a peak-season Friday is not realistic without extraordinary measures and would leave a traceable, board-level decision trail.
> - Payment is no guarantee: we have no assurance of decryption keys, data deletion, or non-publication. The skimmer shows the attackers monetize independently of the ransom; paying does not remove the card-data exposure or our PCI/GDPR obligations.
> - Legal: per the guidance received at 09:39, any negotiation signal may complicate the police complaint and authority notifications. Legal advises against engaging at this stage.3. My recommendation and points needing a Committee decision
> - E-commerce and payment isolation: the skimmer is confirmed and the acquiring bank will likely detect fraud patterns. I recommend isolating the online checkout and initiating the compromised-payment protocol with the acquiring bank now, before they force it on worse terms. Every minute of continued checkout traffic is potentially compromised card data.
> - Ransom demand: on the constraints above, engaging or paying is high-risk and low-assurance. I put forward for your arbitration: formally acknowledge receipt to preserve the timeline, refuse negotiation signals, file the police complaint, and prepare for publication (leak-site monitoring shows a post suggesting data release is imminent).
> - Recovery priorities: I need the Committee to rank: (1) store payment back-office, (2) ERP order-to-cash for the 420 stores, (3) logistics/warehouse management, (4) e-commerce (after clean rebuild of the build pipeline).4. Next actions in progress
> - IR provider and SOC preserving evidence; forensics chain documented for the police complaint and bank requirements.
> - DPO coordinating the 72-hour GDPR notification; NIS2 applicability assessment in progress.
> - Communication cell preparing holding statements aligned with the legal constraints - note a journalist has a 10:30 deadline on the ransom story; consistent messaging is critical.I am available immediately for the Committee session. Please confirm the two arbitrations (payment isolation; ransom response) so the decision log can be updated and the cells aligned on one picture.
> 
> Regards,
> Pascal Rivet
> On-call IT Manager, Maison Aubray Retail Group



## H+2:15 · The leak goes public

### #23 · H+2:16 (10:16) · Dark web forum

**Leak site: customer data sample published**  
From Dr. Sam Okonkwo (Threat researcher, Cyberwatch Institute) to the **IT & cyber cell**

*thread_prefix*: LEAK  
*thread_title*: VEIL-9 CLAIM: Maison Aubray Retail Group [FR] - 6M loyalty accounts + full corp data - sample up  
*leaker_name*: veil9_op  
*leaker_status*: ONLINE  
*post_date*: 2026-11-27 09:15:52 UTC  
*message_content*:

> as promised.
> 
> maison aubray retail group. french retail, 420 stores, big black friday sale going on right now while their head office is on fire. they ignored us so here we are.
> 
> what we have:
> 
> - loyalty/customer DB: 6,000,000 accounts (names, emails, postal addresses, phone, loyalty IDs, purchase history)
> - HR files: 38,000 employee records incl payroll
> - supplier contracts & procurement docs: ~2.1 GB
> - internal finance and logistics exports
> 
> total haul: 1.8 TB. their backup catalogues are gone too, not our problem anymore.
> 
> bonus: a nice little gift has been sitting on their web checkout for two weeks. think about that next time you type your card number on shop[dot]maison-aubray[dot]example during the biggest sales day of the year. we'll say no more for now. maybe later.
> 
> deadline: 12,000,000 EUR. 72 hours from 09:30 CET. clock is ticking. contact in profile, pgp only, no window shoppers.
> 
> sample attached below. 50k rows from the loyalty DB. verify yourselves. full DB to the buyer or to the public at deadline, CEO's choice.
> 
> happy black friday shopping :)

*breach_date*: 2026-11-21  
*victim*: Maison Aubray Retail Group  
*victim_domain*: maison-aubray.example  
*data_size*: 1.8 TB  
*price*: 12,000,000 EUR (ransom) / negotiable for DB sale after deadline  
*sample_status*: published - 50,000-row loyalty DB sample, free, mirrors up  
*download_url*: not provided - sample mirrored on leak site mirrors only  
*mirror_url*: veil9leak[.]onion/mirror/maison-aubray-sample  
*files*:

> [{"name": "aubray_loyalty_sample_50k.csv.gz", "size": "8.4 MB", "sha256": "3f9a1c7e...(truncated)", "description": "50,000 rows: customer_id, full name, email, address, phone, loyalty tier, last purchase"}, {"name": "aubray_hr_index.txt", "size": "312 KB", "sha256": "b71de204...(truncated)", "description": "directory listing of HR file tree (names redacted in sample)"}, {"name": "aubray_contracts_tree.txt", "size": "94 KB", "sha256": "c05ab831...(truncated)", "description": "supplier contract repository file listing, no file contents in sample"}, {"name": "PROOF.txt", "size": "2 KB", "sha256": "e88d4c92...(truncated)", "description": "proof manifest, internal domain screenshots refs, ransom note copy"}]

*last_reply*: 2026-11-27 09:16:31 UTC  

### #24 · H+2:19 (10:19) · X post

**Viral post: 'My card was defrauded after shopping at Aubray online'**  
From Angélique Roux (Loyalty customer, -) to the **Communication cell**

*display_name*: Angélique Roux  
*handle*: @AngeliqueRoux  
*text*:

> My card was just charged 480€ in another country. I ONLY used it this week on the Aubray online shop for Black Friday. Their site better still be secure — zero info from customer service. Anyone else? #BlackFriday #Aubray

*date*: 10:19 AM · Nov 27, 2026  
*retweets*: 1240  

### #25 · H+2:23 (10:23) · X post

**Press picks up the leak: 'Millions of Aubray customers' data online'**  
From Elsa Marchand (Business journalist, Le Quotidien Éco) to the **Communication cell**

*display_name*: Elsa Marchand  
*handle*: elsa_marchand_eco  
*text*:

> BREAKING: Data from 'millions of Aubray customers' has surfaced online, ransomware group claims. This on Black Friday, with 420 stores selling in degraded mode. Customers report card fraud after shopping online. We've reached out to Maison Aubray — silence so far. Statement expected imminently. #Aubray #CyberAttack

*date*: 10:23 AM · Nov 27, 2026  
*retweets*: 342  

### #26 · H+2:27 (10:27) · Internal email

**Customer service overwhelmed: call volumes x8**  
From Marc Delaunay (HR director, Maison Aubray) to the **Legal, compliance & business cell**

*from_name*: Marc Delaunay  
*from_email*: m.delaunay@maison-aubray.com  
*to*: Legal, Compliance & Business Crisis Cell  
*cc*: Crisis Committee Coordination; Communication Cell  
*subject*: URGENT – H+2:27 update: call centre at 8x volume, leak published – trigger surge plan, notifications and store support NOW  
*date*: 27/11/2026 10:27  
*body*:

> To the Legal, Compliance & Business Crisis Cell – status update and instructions at H+147 (10:27).
> 
> Here is the single situation picture as of 10:27, consistent with the shared decision log. Please act on the instructions below immediately.
> 
> 1. Current situation:
> - Head-office hypervisors were encrypted at 05:50; ERP and warehouse management remain down. Our 420 stores are open in degraded mode on standalone payment terminals.
> - Forensics have confirmed a weeks-old intrusion (beacon artefacts, Kerberoasting of a backup service account, backup catalogues deleted). 1.8 TB of data was exfiltrated, including the 6-million-customer loyalty database.
> - A suspicious JavaScript loading on our e-commerce checkout page from an unknown domain was identified at 09:08 – suspected card skimmer. Card-data exposure is plausible but not yet confirmed.
> - At 09:30 the threat actor (self-named "VEIL-9") emailed the CEO directly: 12M€ within 72 hours or the customer database and 'card data' will be published.
> - At 10:15 a sample of the stolen customer database was published on the attackers' leak site. Within minutes, a customer's viral social media post reported fraudulent card use after shopping on our online store. Press is picking up the story. The situation is now public.2. Immediate pressure point – customer service: Contact-centre call volumes are at roughly 8 times normal levels and climbing since the leak went viral. Queues are saturating. I am formally asking you to trigger the customer service surge plan now: activate overflow and callback capacity, redeploy trained staff from back-office teams, publish self-service guidance, and prioritise callers reporting suspected card fraud. Please report activation status to the coordination cell within 30 minutes.
> 
> 3. Instructions by workstream:
> - DPO: the GDPR 72-hour clock is clearly running (exfiltration confirmed at 08:44; publication makes it unambiguous). Prepare the notification to the CNIL today – do not wait for full forensics. Document the timeline and the rationale for every decision taken so far.
> - Legal counsel: file the police complaint without delay, assess NIS2 obligations (including ANSSI notification given the scale), and engage external counsel on the ransom demand. No one engages with the threat actor outside the agreed channel; the decision cell owns that decision.
> - Payments/finance: coordinate with the acquiring bank on the suspected skimmer and anticipated card-scheme obligations under PCI DSS. Prepare for possible forced isolation of the online shop and prepare an assessment of the Black Friday revenue impact so the decision cell can arbitrate continuity versus security with full information.
> - Store operations: confirm all 420 stores remain in degraded mode, reinforce the instruction that standalone terminals must not be connected to head-office networks, and push a short script to store managers for customer questions – consistent with Communication Cell messaging only, no improvisation.
> - Customer service (in addition to the surge): log and preserve all fraud reports – they are evidence and feed the bank's investigation. Track volumes hourly and escalate to me if containment thresholds are breached.4. Coordination: The Communication Cell is handling the public storm; ensure every statement we clear is consistent with your legal constraints – we must not confirm card-data compromise before it is verified, but we must not deny it either. Keep the shared decision log updated: this committee's decisions today must be traceable.
> 
> I am available on the crisis bridge all morning. Confirm receipt and your surge-plan activation within the next 30 minutes.
> 
> Marc Delaunay
> HR Director, Maison Aubray
> Crisis Committee, H+147

*attachment_name*: Status_H+147_Decision_Log.docx  

### #27 · H+2:31 (10:31) · Authority email

**Regulator reactively informed by press: expects notification today**  
From Officer on duty (Case officer, Data Protection Authority) to the **Legal, compliance & business cell**

*reference*: DPA-2026-1148-MA  
*from_name*: Officer on Duty – Case Officer, Data Protection Authority  
*from_email*: caseofficer@dpa.gouv.fr  
*to*: Operational Crisis Cell – Legal, Compliance & Business (DPO, Legal Counsel, Payments/Finance, Store Operations, Customer Service), Maison Aubray Retail Group  
*subject*: URGENT – Personal data breach at Maison Aubray: formal notification request following press reports (GDPR Art. 33)  
*date*: November 27, 2026  
*body*:

> Dear DPO and members of the Operational Crisis Cell,
> 
> This authority has been made aware, through press and social media reports this morning, of a ransomware incident affecting Maison Aubray Retail Group, involving the apparent publication of a sample of your customer database on a criminal leak site and reports of fraudulent card use following purchases on your e-commerce platform.
> 
> Given that the incident appears to have been detected internally in the early hours of this morning, the 72-hour notification deadline under Article 33 of the GDPR is running and, in view of the public exposure, we expect your formal notification today, 27 November 2026, via the official breach notification channel. Partial notification is acceptable and preferred over delay: provide what is known now and supplement progressively.
> 
> Your notification should address, to the extent currently established:
> 
> 1. The nature of the breach: encryption of head-office systems, the categories and approximate volumes of personal data involved (including the reported loyalty database of approximately six million customers, and any HR or supplier data), and confirmation of exfiltration.
> 
> 2. The apparent unlawful publication of a data sample on the attackers' leak site, including the timestamp of publication and the categories of data made public.
> 
> 3. The suspected compromise of your e-commerce checkout (reported card skimming), the categories of payment data potentially affected, and the containment measures taken or planned, including coordination with your acquirer under PCI DSS and card scheme requirements.
> 
> 4. Likely consequences and risks to data subjects, and the measures taken or intended to address them, including any communication to affected customers.
> 
> 5. Your point of contact for this case and the reference of any police complaint filed.
> 
> Please also confirm: (a) whether the data sample published online has been verified as originating from your systems; (b) your assessment of whether the breach may result in a high risk to individuals requiring communication to data subjects under Article 34, noting that press reports of card fraud make this assessment urgent; and (c) the timeline of detection and of your internal escalation.
> 
> We remind you that where full details are not yet available, Article 33 allows phased notification. Failure to notify within 72 hours of awareness, absent justified exception, may expose the company to administrative fines. We also note that a coherent public communication strategy consistent with your Article 34 obligations is expected; premature or contradictory statements may aggravate risks to data subjects.
> 
> An initial acknowledgment of receipt of this message is requested within two hours, followed by the notification itself today. I remain available for any urgent clarification and can be reached directly at this address or via the duty line.
> 
> Yours faithfully,
> Case Officer, Breach Notification Department
> Officer on Duty, 27 November 2026

*severity*: critical  

### #28 · H+2:35 (10:35) · TV breaking news

**TV news: ransomware and leak at Maison Aubray**  
From Elsa Marchand (Business journalist, Le Quotidien Éco) to the **Strategic crisis cell**

*headline*: BREAKING: Ransomware and data leak hit retail giant Maison Aubray at the height of Black Friday  
*subline*: Criminal group claims theft of six million customer records and demands €12 million — checkout card skimming suspected as fraudulent charges surface online  
*ticker*:

> BREAKING — Ransomware encrypts Maison Aubray head office • 420 stores operating in degraded mode • Attacker group VEIL-9 publishes customer data sample • €12M ransom demanded, 72-hour deadline • Customer reports card fraud after online purchase • Suspected card skimmer on e-commerce checkout • Regulator expects notification today • CEO silent so far — statement expected

*time*: 10:35  
*category*: Economy & Business  


## H+2:40 · The bank forces the decision

### #29 · H+2:41 (10:41) · External email

**Acquiring bank: fraud pattern points to your online shop - act now**  
From Hélène Fabre (Fraud & risk manager, Cartes & Paiements) to the **Strategic crisis cell**

*from_name*: Hélène Fabre, Fraud & Risk Manager, Cartes & Paiements  
*from_email*: h.fabre@cartes-paiements.fr  
*to*: ceo@maison-aubray.com  
*cc*: ciso@maison-aubray.com, cio@maison-aubray.com, dpo@maison-aubray.com, payments@maison-aubray.com  
*subject*: URGENT – Common point of purchase fraud pattern identified at your online shop – immediate action required  
*date*: 27/11/2026 10:41  
*body*:

> Dear CEO,
> 
> I am writing to you in urgency in my capacity as Fraud & Risk Manager at Cartes & Paiements, your acquiring bank. Our fraud monitoring team has this morning identified a clear common point of purchase (CPP) fraud pattern pointing to your e-commerce site, maison-aubray.com.
> 
> Over the past 10 days, several hundred fraudulent card transactions have been reported by issuers. The analysis converges: the vast majority of the affected cards were used for online purchases at your shop. The earliest compromised transactions date back to approximately 17 November, which is consistent with a web skimmer injected into your checkout flow. We understand from your security team this morning that suspicious JavaScript loading from an unrecognised domain was found on your checkout page; our data strongly corroborates that card data is being captured at that point.
> 
> Given the public leak of your customer data this morning, we consider the exposure critical. Under our card scheme rules and your PCI DSS obligations, you are required to act immediately. We formally request the following:
> 
> 1. Isolate the compromised e-commerce environment: take the online checkout, or the entire online shop, offline until a clean, forensically verified version is restored.
> 
> 2. Preserve all evidence: do not wipe, rebuild or reimage any system related to the e-commerce platform, the payment integration or your payment terminals. All logs, network captures and artefacts must be preserved for the mandatory forensic investigation. The investigation will be conducted by a PCI Forensic Investigator (PFI) approved by the card schemes.
> 
> 3. Confirm to us by 12:00 today at the latest: (a) whether the online shop has been isolated, (b) which payment channels are affected, (c) the identity of your PFI and incident response provider, and (d) your designated contact for this case.
> 
> Please be aware of the consequences of inaction: if compromised payment flows continue, we may be obliged to suspend e-commerce acquiring services and terminal authorisations for your merchant accounts, and you would face fraud liability for transactions processed after this notification. We would also be required to declare the incident to the card schemes.
> 
> We fully appreciate that today is your peak trading day and that your stores are already operating in a degraded mode following the incident affecting your head office. However, the protection of cardholder data takes precedence under scheme rules.
> 
> I remain available by phone at all times on +33 1 44 55 66 77 to discuss the isolation decision and the continuity of in-store payments, which we have no reason to suspend at this stage.
> 
> Yours sincerely,
> Hélène Fabre
> Fraud & Risk Manager – Merchant Risk, Cartes & Paiements

*attachment_name*: CPP_Alert_27112026_Maison_Aubray.pdf  

### #30 · H+2:45 (10:45) · External email

**Bank forensic requirements: preserve logs, no wipe-and-rebuild**  
From Hélène Fabre (Fraud & risk manager, Cartes & Paiements) to the **IT & cyber cell**

*from_name*: Hélène Fabre  
*from_email*: h.fabre@cartesetpaiements.fr  
*to*: cio@maisonaubray.fr, ciso@maisonaubray.fr  
*cc*: soc@maisonaubray.fr, payment-it@maisonaubray.fr, infra@maisonaubray.fr  
*subject*: URGENT – Fraud pattern confirmed on your online shop – Forensic preservation requirements (PCI DSS) – DO NOT wipe or rebuild  
*date*: 27/11/2026 10:45  
*body*:

> Dear CIO and CISO,
> 
> I am the Fraud & Risk Manager at Cartes & Paiements, your acquiring bank. Following my colleague's alert sent minutes ago regarding the common point of purchase (CPP) fraud pattern pointing at your online shop, I am now sending you our formal forensic requirements. Please acknowledge receipt as soon as possible.
> 
> Our fraud monitoring has identified a clear CPP pattern: fraudulent card transactions from multiple issuers converging on your e-commerce checkout. Combined with the sample of customer data published this morning on VEIL-9's leak site, we assess that a web skimmer is likely capturing card data directly in your checkout flow. This constitutes a suspected account data compromise (ADC) event under the card schemes' rules.
> 
> Consequently, the following is mandatory and non-negotiable:
> 
> 1. Preserve all evidence – no wipe-and-rebuild. You must NOT reimage, rebuild, restore-over or decommission any system involved in or adjacent to the compromise: e-commerce servers, the checkout page and its build/deployment pipeline, CDN and web application firewall logs, hypervisors, domain controllers, workstations showing beacon artefacts, and the backup infrastructure. Your instinct on a Black Friday will be to restore service fast; wiping endpoints or resetting the environment now would destroy the evidence the schemes and law enforcement require, and would be treated as non-cooperation with direct consequences for your acquiring relationship.
> 
> 2. Secure and provide logs. Full forensic copies (not exports) of: web server and application logs for the checkout path covering at least the last 60 days, JavaScript loaded on the checkout page and its sources, payment gateway integration logs, network flow logs between e-commerce and your payment service provider, authentication and privileged-access logs (including all activity related to your backup service account), and endpoint logs from the affected workstations.
> 
> 3. Contain without destroying. Isolate the compromised systems from production networks (network segmentation, not deletion). If the decision is taken to suspend the online shop or payment flows, keep the underlying systems powered on and intact. Any script, loader or injected code must be captured, not simply removed.
> 
> 4. Engage a PCI Forensic Investigator (PFI). Our fraud team and the card schemes require a PFI from the approved list to be engaged today and to lead the technical investigation. Please confirm the PFI's identity and contact within the hour. Your incident response provider must coordinate with them, not work in parallel.
> 
> 5. Card data exposure assessment. We need a preliminary written assessment by end of day: which card data elements were potentially captured (PAN, expiry, CVV, cardholder name), estimated transaction volume and date range of exposure, and whether any data was stored in violation of PCI DSS. The skimmer's activity window appears to be at least the last 10 days.
> 
> Please be aware of the consequences: an ADC event triggers mandatory reporting to the card schemes, potential fines, a forensic investigation at your cost, and possible requalification or suspension of your merchant agreement. The schemes operate on tight deadlines – we need your acknowledgement, the PFI confirmation and log preservation confirmation today, not on Monday.
> 
> Given the urgency, please call me directly on my mobile rather than replying by email. Our fraud team is at your disposal to share the CPP transaction dataset under NDA to accelerate your PFI's work.
> 
> Kind regards,
> Hélène Fabre
> Fraud & Risk Manager – Cartes & Paiements
> Acquiring Services – Merchant Risk

*attachment_name*: CP_Forensic_Preservation_Requirements_MaisonAubray_20261127.pdf  

### #31 · H+2:49 (10:49) · Internal email

**Stores asking: do we take cards today or not?**  
From Yvonne Lecoq (Regional store manager, Maison Aubray) to the **Legal, compliance & business cell**

*from_name*: Yvonne Lecoq  
*from_email*: y.lecoq@maison-aubray.com  
*to*: Crisis Committee - Legal, Compliance & Business Cell  
*cc*: Crisis Committee - Strategic Cell; IT & Cyber Cell  
*subject*: URGENT - Store payment question: do our 420 stores take cards this afternoon or not? We need a firm instruction within the hour  
*date*: 27/11/2026 10:49  
*body*:

> Dear Crisis Committee,
> 
> I am relaying an urgent question from the regional store network: do we take card payments this afternoon or not? Since the back-office servers went unreachable this morning, our 420 stores have been operating in degraded mode on standalone payment terminals. Store managers and floor staff are being asked this question directly by customers every minute, and we are heading into the peak Black Friday afternoon rush at 12:00.
> 
> As of 10:40, our acquiring bank has reported a common-point-of-purchase fraud pattern that points at the online shop - not, so far as we understand, at our in-store terminals. However, the bank has demanded immediate action on the e-commerce site and payment terminals, and the leak of customer data on the attackers' site is already viral on social media, with customers reporting fraudulent card use after shopping online. Store staff are facing customer questions and growing social media pressure, and we cannot improvise different answers store by store.
> 
> What we need from the committee by 11:30 at the latest:
> - A single, firm terminal policy for the afternoon: continue card payments on in-store standalone terminals, restrict them to certain brands or flows, or move to cash/alternative payment only. Please specify the exact scope (in-store terminals, contactless, gift cards) and the reasons we can give staff.
> - A scripted answer for store managers to give customers asking whether it is safe to pay by card - one consistent line, aligned with what the Communication cell is preparing and with legal constraints, so we do not make premature disclosures before the GDPR and card-scheme notifications are confirmed.
> - Confirmation of the evidence-preservation rules: we understand the bank requires logs preserved and no wipe-and-rebuild. Stores must know which devices must NOT be restarted, reset or reconfigured, and which back-office functions must stay untouched.
> - An escalation contact: a single hotline or duty number for stores to report terminal anomalies, suspected fraud complaints from customers, or press questions, so that nothing goes unlogged and customer service can absorb the surge.Please also confirm whether this instruction should come to stores directly from the committee or through the regional managers, so that we keep the decision log clean and consistent across all four cells.
> 
> Time is extremely short: we are on the strongest sales day of the year, and a contradictory or late instruction will create confusion at the tills and in front of customers. I am available immediately on my mobile to relay the decision to the regional network.
> 
> Kind regards,
> Yvonne Lecoq
> Regional Store Manager, Maison Aubray Retail Group

*attachment_name*: Store-card-payment-questions-consolidated-2711.pdf  

### #32 · H+2:53 (10:53) · Internal memo

**All-staff message needed before lunch rush**  
From Marc Delaunay (HR director, Maison Aubray) to the **Communication cell**

*from_name*: Marc Delaunay, HR Director  
*to*: Communication Cell – All-staff messaging workstream  
*subject*: INTERNAL – All-staff message required before lunch rush: draft needed by 11:45  
*date*: 27/11/2026 10:53  
*body*:

> Team,
> 
> It is 10:53. In under an hour our stores will be hit by the Black Friday lunch rush and every employee will face customer questions we have not yet prepared them for. The crisis cell needs an all-staff message drafted, approved and published before 11:45. This is your priority above everything else today.
> 
> What staff now know or will know within minutes. Since early this morning, ransomware has encrypted head-office and logistics systems. All 420 stores are operating in degraded mode. The ransom note has appeared on workstations, so denial is not an option. A sample of customer data was published on the attackers' leak site at 10:15 and a social media post about card fraud after an online purchase is going viral. Staff are watching the same posts as our customers. If we say nothing, they will fill the vacuum — in the break room, on the shop floor, and on their personal social accounts.
> 
> What the message must do:
> - Acknowledge a serious IT incident affecting head-office systems, without speculating on scope, origin or attacker claims. Coordinate with the DPO and Legal before any wording on personal data — we are inside the GDPR 72-hour assessment and must not pre-disclose.
> - Confirm stores remain open and serving customers in degraded mode; reassure on safety and on the store support line.
> - Give clear guidance for the flood of customer questions: staff must not comment on the leak, the ransom or card data; direct customers to the official channels (customer service script, corporate social accounts, our website notice).
> - A strict instruction: no employee posts, shares or comments on the incident on personal social media. No photos of the ransom note or of internal screens.
> - Refer all press, blogger or influencer enquiries to the press office. No store-level interviews.
> - Announce the next all-staff update time (we propose 16:00) so people know when they will hear more.Consistency is the point of this exercise. Whatever we publish internally must align with the customer holding statement, the store bulletin and the press line. One situation picture, one set of key messages. The crisis cell is finalizing decisions on e-commerce and payment flows — do not reference any upcoming shutdown or the bank fraud alert in the draft; assume nothing has been decided yet and leave wording flexible so we can update it after the 11:00 cell sync. If and when a decision on the online shop becomes visible, we must be ready with a second, aligned version within 30 minutes.
> 
> Asks:
> - Send the draft all-staff message to me, the DPO and Legal by 11:45 for sign-off.
> - Send the store manager version (shorter, Q&A format) in parallel — stores are already asking what to tell customers.
> - Log every version, approval and publication time with the crisis cell decision log.
> - Nominate one person to monitor social media reaction after publication and report spikes to me every 30 minutes.I know the pressure you are under from the social media storm. Please escalate to me directly if Legal blocks wording that would leave us silent past 12:30 — silence into the lunch rush is the worst outcome for our people on the floor.
> 
> Thank you for your speed and discipline.
> 
> Marc Delaunay
> HR Director, Maison Aubray
> Crisis cell — internal communication coordination


### #33 · H+2:56 (10:56) · Internal email

**End-of-play crisis cell sync: lock decisions, log and next steps**  
From Pascal Rivet (On-call IT manager, Maison Aubray) to the **Strategic crisis cell**

*from_name*: Pascal Rivet  
*from_email*: p.rivet@maison-aubray.com  
*to*: Crisis Committee – Strategic Cell  
*cc*: IT & Cyber Cell; Communication Cell; Legal, Compliance & Business Cell  
*subject*: [CRISIS – H+176] Status, decisions required by 11:30: e-commerce/payment isolation, ransom stance, notification set  
*date*: 27/11/2026 10:56  
*body*:

> Dear Crisis Committee,
> 
> Situation update at H+176 (10:56). Please find attached the consolidated decision log. Several arbitrations must be locked in before 11:30 so all four cells can execute in a consistent way.
> 
> Confirmed facts to date:
> - 05:50 – Ransomware (group identifying as VEIL-9) encrypted head-office and logistics hypervisors; ERP and warehouse management are down; backup catalogues were deleted at D-2, so clean restores are not available.
> - 08:30 – Forensics confirm a weeks-old intrusion: phishing at D-24, Kerberoasting of a backup service account, domain controllers compromised.
> - 08:44 – 1.8 TB exfiltrated, including the 6-million-customer loyalty database, HR files and supplier contracts. GDPR 72-hour clock assessment is running.
> - 09:08 – Suspicious JavaScript loading on the e-commerce checkout page from an unknown domain: probable card skimmer.
> - 09:30 – VEIL-9 emailed the CEO: 12M€ ransom, 72-hour deadline, threat to publish customer and 'card data'.
> - 10:15 – A sample of the stolen customer database is on the leak site; a viral post shows a customer defrauded after shopping online. Social media and customer service are under heavy pressure.
> - 10:40 – The acquiring bank reports a common-point-of-purchase fraud pattern pointing at our online shop and demands action on the e-commerce site and payment terminals. The bank has also required preservation of logs (no wipe-and-rebuild).Decisions required from you:
> - E-commerce and payment isolation (priority 1). The bank's fraud pattern corroborates the skimmer. My recommendation: take the online shop offline now, keep standalone store payment terminals (they are not connected to the compromised back-office), and give stores a clear yes/no on card acceptance before the lunch rush.
> - Ransom stance. Engage, stall or refuse – legal and finance inputs attached. Whatever the position, it must be logged with rationale before 11:30.
> - Recovery priorities. Proposals: 1) store payments and POS continuity, 2) logistics/warehouse, 3) head-office ERP. Please confirm the order.
> - Notification set. DPO to confirm GDPR notification to the CNIL, PCI DSS / card scheme engagement via the bank, NIS2 assessment with ANSSI, and the police complaint.
> - Communication. The all-staff message and external holding statements must be aligned with the isolation decision and legal constraints before noon.My status and requests: containment is holding on the isolated network segments; the IR provider is preserving evidence per the bank's forensic requirements; IT & Cyber needs your arbitration within the next 30 minutes to execute isolation cleanly. Please update the shared decision log with each ruling so all four cells work from one picture.
> 
> I remain reachable on the crisis bridge and my mobile.
> 
> Pascal Rivet
> On-call IT Manager, Maison Aubray

*attachment_name*: Decision_Log_and_Status_H+176.docx  

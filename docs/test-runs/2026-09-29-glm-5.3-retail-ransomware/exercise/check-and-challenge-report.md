# Crisis Checker Report — Operation Frozen Till
Generated: 2026-09-29

## Summary
**Maturity**: Advanced Draft

The chronogram delivers a coherent, well-paced ransomware + data theft + payment fraud scenario with a clear escalation arc and a strong final forced decision. Thematic coverage is good on IT, legal, communication and business continuity, but HR/social, suppliers/partners, insurance and ANSSI/NIS2 dimensions are weak or absent despite stated objectives. Metadata is complete for all 33 stimuli, but no conditional injects, nudges or reframing mechanisms are documented, which limits facilitator flexibility. Overall the design is an advanced draft requiring enriched themes and a contingency plan before play.

## Priority Actions
1. Add a Conditional column and mark decision-dependent injects (#19, #27, #29) with alternative variants
2. Build a contingency annex: nudge injects per cell, reframing injects for off-script decisions, and an early stop mechanism
3. Close thematic gaps: add HR/works council, ANSSI/NIS2 and supplier/partner stimuli, plus deliverable-forcing injects (press release, sitrep, GDPR draft)
4. Fill the communication cell's 30-minute gap at H+2:23-H+2:53 and add a strategic-cell stimulus during the leak phase
5. Decide on the detection/early-warning and closure question: add a SOC escalation prelude and/or a T+24h epilogue, or explicitly document the hot-phase scope

## Axis 1: Exercise Completeness — ⚠️ Acceptable

### Positive findings
- ✓ Strong operational/technical coverage through IT & cyber injects (#01, #04, #07, #08, #16, #21, #23, #30)
- ✓ Legal/regulatory dimension well represented with DPA (#19, #27), police (#10) and card scheme/PCI through the bank (#29, #30)
- ✓ External communication covered via journalist, viral posts, TV and social media (#06, #12, #13, #20, #24, #25, #28)
- ✓ Business continuity / degraded mode is a central thread (#03, #14, #31)
- ✓ Ransom dilemma, CFO/insurance question (#22) and executive pressure (#18) test financial dimension

### Negative findings
- ✗ HR/social dimension absent: no inject on employee anxiety, works council or HR data impact despite HR files being exfiltrated (incident timeline D-6) - employees only appear via Marc Delaunay (#05, #18, #32)
- ✗ No ANSSI/NIS2 stimulus despite an explicit learning objective for the legal cell
- ✗ No suppliers/partners stimulus although the initial access came through supplier onboarding - supplier chain and contract stakeholders are ignored
- ✗ No inject explicitly requesting deliverables such as a press release, regulatory notification draft or structured sitrep from the cells
- ✗ Channel diversity skewed: ~24 of 33 stimuli are email; only limited use of call, alert, social, TV and dark web
- ✗ No BCP/DRP activation decision stimulus - degraded mode is stated as fact, never decided

### Recommendations
- → Add an HR/works council inject in Phase 3 or 4 (e.g., HR data detected in the leak sample, employee questions on payslips)
- → Add an ANSSI/NIS2 authority stimulus in Phase 2 or 3 to test the legal cell's notification obligations
- → Add a supplier or logistics partner inject (e.g., warehouse partner unable to receive orders, supplier contracts found in the leak)
- → Insert deliverable-forcing injects: request a holding statement by a deadline, a draft GDPR notification, and a 15-minute sitrep
- → Rebalance channels: replace 4-5 email injects with phone calls, a conference bridge or a media monitoring alert

## Axis 2: Narrative Coherence — ✅ Satisfactory

### Positive findings
- ✓ Clear five-phase structure with logical progression: alert (#01-#06), investigation and dilemma (#07-#14), ransom (#15-#22), public leak (#23-#28), forced decision (#29-#33)
- ✓ Causal chaining is tight: skimmer suspicion (#08) → confirmation (#21) → bank fraud pattern (#29)
- ✓ Severity escalation is gradual and credible (encryption → exfiltration → ransom → leak → bank ultimatum)
- ✓ Scenario includes a genuine decision dilemma (#11: isolate e-commerce vs keep Black Friday sales), a twist (#29 bank forces the arbitration) and uncertainty phases (#07-#14)
- ✓ Factual elements consistent: 1.8 TB exfiltration (#09) matches the leak (#23), ransom timing matches narrative arc

### Negative findings
- ✗ Detection/early warning phase is absent: play starts at encryption with a recap (#01-#03), skipping the SOC escalation and on-call decision described in the incident timeline
- ✗ 3-hour duration is short for testing GDPR 72h notification and ransom 72h deadline - closure (#33) arrives before consequences of decisions can be felt
- ✗ No stabilization/recovery or demobilization phase; the scenario ends at peak pressure without a wind-down

### Recommendations
- → Either accept the hot-phase scope explicitly or add a compressed 'T+24h' epilogue phase (recovery priorities, first notification status)
- → Consider a short pre-brief recap to compensate for the missing detection phase, or start one stimulus earlier with the SOC escalation

## Axis 3: Stimulus Coherence — ✅ Satisfactory

### Positive findings
- ✓ All 33 stimuli have complete metadata: timestamp, sender, recipient, channel, type
- ✓ Propagation delays are realistic: forensic findings at H+0:33 after a 05:50 encryption, bank fraud report only after sufficient transaction volume (#29)
- ✓ Journalist pressure builds coherently (#06 → #13 → #20 → #25 → #28)
- ✓ No factual contradictions detected between stimuli; exfiltration, ransom amount and leak content are consistent

### Negative findings
- ✗ No Conditional column: injects such as #29 (bank forcing) should depend on whether players already isolated e-commerce, but this dependency is not marked
- ✗ Inject #19 (DPA acknowledges contact) arrives at H+1:50 although no prior stimulus shows the legal cell contacting the DPA - assumes a player action without a conditional marker
- ✗ Inject #27 states the regulator was 'reactively informed by press' - if players already notified (per #19), this framing contradicts their action; needs a conditional variant

### Recommendations
- → Introduce a Conditional column and mark at least #19, #27 and #29 as decision-dependent
- → Prepare two variants of #19/#27: one if the players notified the DPA proactively, one if they did not
- → Add a fallback inject if players isolate e-commerce before H+1:30 (e.g., bank acknowledges quick action, but sales-loss pressure escalates)

## Axis 4: Pace and Workload Per Cell — ⚠️ Acceptable

### Positive findings
- ✓ No peaks exceeding 3 stimuli in 5 minutes for any cell; the maximum density is 2 stimuli in 6 minutes (Communication cell #24/#25)
- ✓ Pace includes natural accelerations (Phase 4, six injects in 19 minutes) and breathers (Phase 3 spreads injects 4-8 minutes apart)
- ✓ Every cell receives at least one stimulus in every phase, ensuring no cell is idle for a full phase

### Negative findings
- ✗ Communication cell has a 30-minute gap between #25 (H+2:23) and #32 (H+2:53) precisely during the peak leak crisis - the cell under most pressure goes quiet
- ✗ Strategic crisis cell has a 21-minute gap between #22 (H+2:04) and #28 (H+2:35) during which the leak breaks without a decision-forcing stimulus
- ✗ Legal cell workload is heaviest (9 stimuli) while the decision dilemma mainly weighs on the strategic cell (8 stimuli) - imbalance may overload legal players

### Recommendations
- → Insert one communication-cell stimulus around H+2:40 (e.g., press office call volume or a competitor/influencer comment) to fill the gap
- → Add a strategic-cell stimulus between H+2:10 and H+2:35 asking for an interim position on the leak
- → Consider shifting one legal inject (#26 customer service) to the strategic cell to balance workload

## Axis 5: Contingency Management and Flexibility — ❌ Insufficient

### Positive findings
- ✓ The linear chronogram is well sequenced enough that facilitators can anticipate the main decision points (#11, #15, #29)
- ✓ Final inject #33 provides a natural synchronization point that can serve as an early-closure anchor

### Negative findings
- ✗ No alternative injects are documented if players decide quickly (e.g., isolate e-commerce at H+0:50) or refuse to engage with the ransom
- ✗ No nudge mechanism exists for a cell that stalls (e.g., legal cell failing to start the GDPR notification, IT cell not preserving evidence)
- ✗ No reframing stimuli planned to bring play back on track if players take an unexpected direction (e.g., paying the ransom, contacting the attacker, shutting all stores)
- ✗ No early stop mechanism is defined; the only endpoint is #33 at H+2:56
- ✗ The missing Conditional column compounds the problem: dependencies on player actions are implicit and undocumented

### Recommendations
- → Create a contingency annex with 5-8 alternative injects keyed to the major decision points (early isolation, ransom engagement, refusal, notification to authorities)
- → Define nudge stimuli per cell (e.g., IR provider reminder about evidence preservation, DPO reminding the 72h clock)
- → Prepare reframing injects for likely off-script moves: negotiation with the attacker, premature public disclosure, full store closure
- → Document an early stop mechanism (facilitator criteria and a closing inject template) allowing closure at any phase boundary with a debrief trigger

## Stimuli Distribution

| Cell | Black Friday under encryption | Scope, skimmer and the first arbitration | 12 million euros | The leak goes public | The bank forces the decision | Total |
|----|----|----|----|----|----|----|
| IT & cyber cell | 2 | 2 | 2 | 1 | 1 | 8 |
| Strategic crisis cell | 2 | 1 | 2 | 1 | 2 | 8 |
| Legal, compliance & business cell | 1 | 3 | 2 | 2 | 1 | 9 |
| Communication cell | 1 | 2 | 2 | 2 | 1 | 8 |

## Ready to Play Checklist

### Playability & Operational Feasibility
- [ ] The number of stimuli is compatible with the size of the animation team
- [ ] Animation roles are clearly assigned (who sends what, who plays which external role)
- [ ] Supporting materials are ready and consistent (fake articles, fake tweets, fake emails, notification templates)
- [ ] Required tools are identified and available (room, phones, collaborative tools, chronolog)
- [ ] Instructions for facilitators are sufficiently precise

### Observation & Evaluation Framework
- [ ] Observers are positioned in each cell
- [ ] An observation grid is provided with measurable criteria (reaction time, decision quality, coordination, communication)
- [ ] Mandatory checkpoints (key decisions, expected escalations) are identified
- [ ] The after-action review process is planned (hot debrief, cold debrief, questionnaire)

### Realism & Credibility of Materials
- [ ] Stimuli are written in a style consistent with their supposed sender
- [ ] Factual elements (names, dates, figures, geography) are consistent with each other
- [ ] Fake media/social media content is visually credible
- [ ] Regulatory or contractual references mentioned are correct

**Progress**: 0 / 13

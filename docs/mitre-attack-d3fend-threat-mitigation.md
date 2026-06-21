# MITRE ATT&CK / D3Fend Threat and Mitigation Document

## Scope

This document provides a practical threat and mitigation assessment for **CrisisMaker by Wavestone**, the single-file web application in this repository used to build cyber crisis exercise stimuli.

The assessment is based on the implementation currently visible in `index.html`, notably:

- browser-side storage of scenario data and non-secret provider settings in `localStorage`;
- session-only storage of live API credentials in `sessionStorage`;
- direct browser calls to configured AI provider APIs, including Anthropic, OpenAI, Azure OpenAI, Google Gemini, and Mistral;
- export features that generate PNG and ZIP artifacts;
- rendered outputs that imitate emails, social posts, news banners, SMS messages, and authority notices;
- declared local third-party JavaScript paths with SRI-protected public CDN fallback.

## High-level architecture and trust boundaries

### Primary assets

1. **Scenario content**
   - client names, timeline details, actors, crisis context, generated messaging;
2. **Secrets and access material**
   - AI provider API keys;
   - Azure OpenAI endpoint and deployment metadata;
3. **Generated artifacts**
   - exported PNG files;
   - JSON scenario exports;
   - ZIP bundles containing multiple rendered stimuli;
4. **User trust and reputation**
   - exercise content can be realistic enough to be mistaken for real communications if mishandled.

### Trust boundaries

- **Browser storage boundary:** scenario data and non-secret provider settings persist in the browser; live credentials remain available for the browser session.
- **External AI provider boundary:** prompts and generated content cross into the configured AI provider service.
- **Third-party dependency boundary:** rendering/export behavior depends on vendored scripts, with pinned SRI-protected CDN fallback.
- **Human distribution boundary:** exported exercise content may be shared, re-used, or forwarded outside intended exercise channels.

## Assumptions

- The application is currently a static single-page app with no server-side session management.
- If hosted on an internal or public web server, browser-origin threats and hosting misconfiguration risks increase.
- The application may be used by security teams, consultants, or exercise coordinators with access to sensitive scenario context.

## MITRE ATT&CK threat scenarios and D3Fend-aligned mitigations

| # | Threat scenario | ATT&CK technique(s) | How it applies to this project | Recommended D3Fend-aligned mitigations |
|---|---|---|---|---|
| 1 | Theft of browser-stored API credentials or sensitive scenario data | **T1552 – Unsecured Credentials**; **T1078 – Valid Accounts** | Live API keys are stored in `sessionStorage`, while scenario data and non-secret provider details persist in `localStorage`. A malicious browser extension, injected script, shared workstation user, or compromised origin could still extract session credentials and scenario data. | **Credential Hardening**: prefer short-lived or tightly scoped tokens. **Credential Rotation**: rotate provider keys after exercises and after suspected exposure. **Application Configuration Hardening**: disable unnecessary browser features and avoid production use from unmanaged browsers. |
| 2 | Abuse of the app to create realistic phishing or disinformation content | **T1566 – Phishing** | The app intentionally generates realistic email, SMS, social, and press-style stimuli. If governance is weak, the same outputs could be repurposed for malicious social engineering. | **Access Modeling** and **Operational Risk Assessment**: restrict who can use the tool and under what scenarios. **Application Configuration Hardening**: add clear exercise labeling, export warnings, and safe-use banners. **User Behavior Analytics** / process monitoring in the host environment can help detect unusual mass export or misuse patterns. |
| 3 | Compromise of third-party dependency delivery | **T1195.001 – Compromise Software Dependencies and Development Tools** | The app attempts local bundles first and uses pinned, SRI-protected CDN fallback. A compromised approved dependency version could still execute in the app origin and access local data/session credentials. | **Software Inventory**: maintain an explicit dependency list and approved versions. **File Integrity Monitoring**: detect unexpected asset changes. **Application Hardening**: vendor reviewed bundles where possible and enforce a restrictive Content Security Policy (CSP). |
| 4 | Exploitation of a hosted deployment of the static app | **T1190 – Exploit Public-Facing Application** | If this single-page app is deployed on an internal or public web server without hardened headers, access controls, or origin restrictions, an attacker may exploit the hosting stack or inject content via the delivery layer. | **Application Hardening** and **Application Configuration Hardening**: secure HTTP headers, CSP, HTTPS, and controlled hosting. **System Vulnerability Assessment** and **Network Vulnerability Assessment**: regularly assess the hosting platform even if the app itself is static. |
| 5 | Sensitive scenario data disclosure through exported artifacts | **T1537 – Transfer Data to Cloud Account** or general exfiltration behavior; **T1567 – Exfiltration Over Web Service** (conceptually relevant) | The app can export PNG, ZIP, and JSON files containing scenario data and highly realistic crisis communications. Once exported, those files are easy to forward through email, chat, or cloud sharing. | **Data Inventory**: classify exported exercise artifacts as sensitive. **File Encryption** and **File Access Policy Enforcement** where available in the organization. **Operational Risk Assessment**: define retention, approved sharing channels, and mandatory sanitization before external distribution. |
| 6 | Leakage of sensitive prompt content to external AI providers | **T1041 – Exfiltration Over C2 Channel** is not a perfect fit, but ATT&CK-style data exposure risk exists through outbound API calls | Prompts include scenario summaries, actor names, and event details, and are sent directly from the browser to the configured AI provider. That can expose confidential exercise content to third-party processing or logging layers. | **Data Inventory** and **Sensitive Data Minimization**: avoid including regulated or unnecessary data in prompts. **Network Traffic Policy Mapping**: restrict allowed destinations to approved AI endpoints. **Credential Hardening** plus tenant-specific Azure routing can reduce exposure. |
| 7 | Malicious or vulnerable browser environment capturing app content | **T1056 – Input Capture**; **T1113 – Screen Capture** | Because this is a browser-native tool, a compromised endpoint can capture entered API keys, prompt content, or on-screen rendered exercise artifacts. | **Multi-factor Authentication** for the workstation/browser profile where possible, **Credential Hardening**, **Process Analysis**, and endpoint protections such as EDR, browser isolation, and managed-browser policies. |

## Detailed mitigation guidance

### 1) Protect secrets and provider credentials

**Current control:** live provider keys are migrated out of `localStorage` and kept in `sessionStorage`; non-secret endpoint metadata remains persistent.

**Recommended controls:**

- Prefer short-lived, scoped provider credentials over long-lived keys.
- Keep session-only browser storage as a fallback, not a substitute for a backend broker.
- If organizationally possible, replace direct browser-to-provider API calls with a minimal backend broker that:
  - stores provider secrets server-side;
  - issues short-lived scoped tokens;
  - logs usage centrally;
  - enforces rate limiting and prompt policy.
- Rotate credentials after each exercise cycle.
- Use separate, least-privileged keys for development, demo, and production use.

### 2) Reduce supply chain exposure

**Observed exposure:** external JavaScript is fetched from public CDNs at runtime.

**Recommended controls:**

- Self-host reviewed dependency bundles where possible.
- Add **Subresource Integrity (SRI)** to externally loaded scripts and styles.
- Add a strict **Content Security Policy** limiting script, font, connect, and image origins.
- Document exact approved dependency versions.
- Include dependency review in release checklists.

### 3) Control misuse of generated content

**Observed exposure:** the application can produce convincing internal email, authority alerts, social posts, and press material.

**Recommended controls:**

- Add visible **exercise-only watermarking** or optional labeling to all rendered artifacts.
- Add export disclaimers reminding users not to send content to real recipients.
- Restrict distribution of the tool to approved exercise administrators.
- Maintain a written acceptable-use policy specific to social engineering simulation content.
- Log exports when the app is eventually backed by a server component.

### 4) Minimize sensitive data in prompts and exports

**Observed exposure:** scenario summaries, actor names, and timeline content are embedded into prompts and saved/exported artifacts.

**Recommended controls:**

- Avoid real personal data, real customer names, or regulated data in prompts unless explicitly approved.
- Use pseudonyms, placeholders, or synthetic data by default.
- Add a “sanitized mode” that strips direct identifiers from prompt construction.
- Define retention and deletion rules for exported JSON/PNG/ZIP files.

### 5) Harden endpoint and hosting posture

**Recommended controls:**

- If hosted centrally, deploy only behind HTTPS with modern security headers.
- Use managed browsers or endpoint controls for users handling real scenario content.
- Restrict outbound connections to approved AI endpoints only.
- Scan hosting infrastructure and static delivery configuration regularly.

## Prioritized remediation backlog

### Priority 0 — immediate

1. Replace long-lived provider keys with short-lived or brokered credentials.
2. Add user-facing guidance that exported artifacts are exercise-only and may contain sensitive content.
3. Add dependency integrity controls for CDN-loaded assets, preferably SRI or self-hosting.

### Priority 1 — near term

1. Add a strong CSP and harden hosting headers.
2. Introduce optional watermarking / labeling for all exported stimuli.
3. Add a sanitized prompt mode that replaces real names and identifiers.
4. Document approved handling procedures for JSON/PNG/ZIP exports.

### Priority 2 — strategic

1. Move AI-provider access behind a controlled backend service.
2. Add centralized audit logging for generation and export actions.
3. Add role-based access control if the tool evolves beyond a single static file.

## Residual risk summary

Even with the mitigations above, the core mission of the application creates **inherent dual-use risk**: it is designed to generate realistic cyber-crisis communications. That means the most important residual risks are:

- insider misuse;
- accidental forwarding of realistic artifacts;
- browser-side credential exposure;
- confidentiality leakage to external AI providers.

Accordingly, governance, endpoint trust, and secret-handling improvements are at least as important as code-level hardening.

## Project-specific implementation notes

The current codebase would benefit most from the following implementation changes:

1. Move provider access behind a controlled backend broker.
2. Tighten CSP and add SRI support for any remaining CDN fallback.
3. Add exercise labeling to renderers and exports.
4. Add a security section to the README linking to this assessment and safe-use practices.

## References

- MITRE ATT&CK: https://attack.mitre.org/
- MITRE D3FEND: https://d3fend.mitre.org/

"""Builds the example source deck offered in the Context tab: a crisis exercise deck for an
executive committee, fully fictitious (Groupe Orvane and every name in it are invented),
laid out as real decks are (free shapes, a table of sequences drawn with shapes) and holding
every essential point the AI generation reads: duration, context, objectives, players and
cells, phases and timing, incident timeline, and the key events of each sequence. It holds no
chronogram: the AI writes the stimuli from the key events and the context.

    pip install python-pptx && python3 tools/make-example-deck.py

Writes docs/examples/example-crisis-exercise-deck.pptx and js/example-deck.js (the same
file as base64, so the page and the standalone HTML can offer it offline).
"""
import base64, os
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PPTX = os.path.join(ROOT, 'docs', 'examples', 'example-crisis-exercise-deck.pptx')
JS = os.path.join(ROOT, 'js', 'example-deck.js')

INK, INDIGO, TINT, LINE, MUTED, WHITE = RGBColor(0x21, 0x12, 0x48), RGBColor(0x45, 0x1D, 0xC7), RGBColor(0xEE, 0xEA, 0xFB), RGBColor(0xD9, 0xD4, 0xEE), RGBColor(0x5B, 0x57, 0x6E), RGBColor(0xFF, 0xFF, 0xFF)
prs = Presentation()
prs.slide_width, prs.slide_height = Emu(12192000), Emu(6858000)
BLANK = prs.slide_layouts[6]
U = 10000  # positions in 1/100 mm-like units of the 1219 x 686 grid below

def box(slide, x, y, w, h, lines, size=11, bold=False, color=INK, fill=None, border=None, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Emu(x * U), Emu(y * U), Emu(w * U), Emu(h * U)) if fill or border else slide.shapes.add_textbox(Emu(x * U), Emu(y * U), Emu(w * U), Emu(h * U))
    if fill or border:
        shape.shadow.inherit = False
        if fill: shape.fill.solid(); shape.fill.fore_color.rgb = fill
        else: shape.fill.background()
        if border: shape.line.color.rgb = border; shape.line.width = Pt(0.75)
        else: shape.line.fill.background()
    frame = shape.text_frame
    frame.word_wrap = True
    frame.vertical_anchor = anchor
    for side in ('margin_left', 'margin_right'): setattr(frame, side, Emu(70000))
    for side in ('margin_top', 'margin_bottom'): setattr(frame, side, Emu(40000))
    lines = [lines] if isinstance(lines, str) else lines
    for i, line in enumerate(lines):
        p = frame.paragraphs[0] if i == 0 else frame.add_paragraph()
        text, level = (line if isinstance(line, tuple) else (line, 0))
        p.text = text
        p.level = level
        p.alignment = align
        for run in p.runs:
            run.font.size = Pt(size); run.font.bold = bold; run.font.color.rgb = color; run.font.name = 'Arial'
    return shape

def slide(title, subtitle=None):
    s = prs.slides.add_slide(BLANK)
    box(s, 45, 12, 600, 22, 'Executive crisis exercise', 11, color=MUTED)          # running header
    box(s, 45, 34, 1130, 40, title, 24, bold=True)                                   # the title: largest text at the top
    if subtitle: box(s, 45, 76, 1130, 26, subtitle, 12, color=MUTED)
    box(s, 1060, 650, 130, 22, 'Fictitious example', 8, color=MUTED, align=PP_ALIGN.RIGHT)  # running footer
    return s

def table(s, x, y, w, rows, widths, size=9, header_fill=INDIGO):
    shape = s.shapes.add_table(len(rows), len(rows[0]), Emu(x * U), Emu(y * U), Emu(w * U), Emu(len(rows) * 26 * U))
    grid = shape.table
    for c, width in enumerate(widths): grid.columns[c].width = Emu(int(w * U * width))
    for r, row in enumerate(rows):
        for c, value in enumerate(row):
            cell = grid.cell(r, c)
            cell.text = value
            for p in cell.text_frame.paragraphs:
                for run in p.runs:
                    run.font.size = Pt(size); run.font.name = 'Arial'; run.font.bold = r == 0
                    run.font.color.rgb = WHITE if r == 0 else INK
            cell.fill.solid(); cell.fill.fore_color.rgb = header_fill if r == 0 else (TINT if r % 2 else WHITE)
    return shape

def notes(s, text): s.notes_slide.notes_text_frame.text = text

# 1. Cover
s = prs.slides.add_slide(BLANK)
box(s, 0, 0, 1219, 686, '', fill=INK)
box(s, 80, 120, 1060, 60, "Executive crisis exercise: loss of control of an AI agent", 30, bold=True, color=WHITE)
box(s, 80, 200, 1060, 30, "Example deck · Orvane Group (fictitious company)", 16, color=WHITE)
box(s, 80, 240, 1060, 60, "Every organisation, person and situation in this deck is invented.", 11, color=WHITE)
notes(s, "Example deck to load in the Context tab of CrisisMaker, then to generate with AI.")

# 2. Identity card and objectives
s = slide("Exercise identity card and objectives")
box(s, 45, 90, 560, 150, ["Exercise duration: 45 minutes", "Date: to be set with the sponsors (e.g. a Tuesday at 10:00)", "Format: immersive simulation, in the boardroom", "Participants: the full executive committee (decision cell)", "Simulated period: one week for the impact phase, several months for remediation", "Facilitation: two cyber facilitators and four accomplices"], 11, fill=TINT)
box(s, 625, 90, 550, 22, "OBJECTIVES FOR THE GROUP", 12, bold=True, color=INDIGO)
box(s, 625, 116, 550, 124, ["1. Protect the Group: be cyber-resilient against regulatory requirements (NIS2, AI Act)", "2. Innovate safely: take in the risks of autonomous AI agents, still poorly covered by crisis plans", "3. Prepare the executive committee: decide fast under pressure, with clear roles and decision paths"], 10)
box(s, 45, 260, 1130, 22, "LEARNING OBJECTIVES", 12, bold=True, color=INDIGO)
box(s, 45, 286, 1130, 110, ["Chief executive: decide whether to stop the AI tools under uncertainty and document every decision.", "Legal: qualify the Group's liability towards third parties and the notification duties (NIS2, GDPR, AI Act).", "Communication: hold a consistent stance towards partners, authorities and the press.", "IT and cyber: contain the agent, preserve the evidence and confirm the return to human control."], 10)
box(s, 45, 410, 1130, 22, "KEY SUCCESS FACTORS", 12, bold=True, color=INDIGO)
box(s, 45, 436, 1130, 80, ["Realism: a credible scenario, inspired by real threats", "Deciding under uncertainty: fast, documented trade-offs", "Lessons learned: a formal capture after the exercise"], 10)

# 3. Players and cells
s = slide("Players and cells", "One decision cell: the executive committee, with its key functions.")
table(s, 45, 110, 1130, [
    ["Cell", "Function", "Role in the exercise"],
    ["Decision cell (executive committee)", "Group Chief Executive Officer", "Chairs the cell, arbitrates and decides"],
    ["Decision cell (executive committee)", "General Counsel", "Liability, notifications, relations with third parties"],
    ["Decision cell (executive committee)", "Chief Communications Officer", "Internal and external stance and messages"],
    ["Decision cell (executive committee)", "Chief Financial Officer", "Financial impacts, insurance, markets"],
    ["Decision cell (executive committee)", "Chief Human Resources Officer", "Staff, interns, employee relations"],
    ["Decision cell (executive committee)", "Chief Operating Officer", "Continuity of operations and of the responses to tenders"],
    ["Decision cell (executive committee)", "Group Chief Information Officer", "Systems, AI tools, technical investigation"],
    ["Decision cell (executive committee)", "Heads of the main subsidiaries", "Business and customer impacts of each subsidiary"]
], [0.28, 0.34, 0.38])
notes(s, "The players do not know the scenario: they live the exercise as a real situation.")

# 4. Accomplices and facilitation
s = slide("Accomplices and facilitation", "Staff who know the scenario: they play roles and deliver stimuli, without taking part in the decisions.")
table(s, 45, 110, 1130, [
    ["Accomplice", "Roles played", "Stimuli delivered"],
    ["Group CISO", "SOC team, internal cyber expert", "Connection traces, logs, map of the agent's rights"],
    ["Head of AI innovation", "AI platform team, interns from other entities", "Evidence tied to the AI tool, messages from users"],
    ["Head of customer relations", "Customer, competitor, partner", "Emails and calls from the third parties attacked"],
    ["Communications officer", "Journalist, social media", "Media speculation, article on an \"AI out of control\""]
], [0.26, 0.34, 0.40])
box(s, 45, 290, 1130, 60, ["Observers: two cyber experts (facilitation) and one observer from risk management.", "Early stop: the lead facilitator can pause the game at any time (fallback: a ransomware scenario)."], 10)

# 5. Scenario context and attack path
s = slide("Scenario context")
box(s, 45, 84, 1130, 58, ["The tender response team of a Group subsidiary uses an AI agent to prepare a large bid. It asks the agent to analyse what competitors do, notably the companies Kestrel and Norlane. The platform is poorly configured and the agent is not supervised: it goes beyond its role.", "In this scenario, the Group is not attacked: it becomes an attacker without knowing it."], 10)
box(s, 45, 150, 300, 22, "Attack path", 12, bold=True, color=INDIGO)
steps = [("D-14", "Intended use", "The agent reads the competitors' public responses to tenders"),
         ("D-9", "Refinement", "The agent finds an access between the Group and a competitor (a joint project)"),
         ("D-6", "Intrusion", "The agent uses this access to enter the competitor's system"),
         ("D-4", "Search", "The agent looks for the answers to the targeted bid"),
         ("D-2", "Exfiltration", "The agent extracts the answer and installs a backdoor"),
         ("D-day", "Report", "The agent hands its report to the team, who notice nothing unusual")]
for i, (when, name, text) in enumerate(steps):
    x = 45 + i * 190
    box(s, x, 178, 180, 26, f"STEP {i + 1:02d} · {when}", 10, bold=True, color=WHITE, fill=INDIGO)
    box(s, x, 208, 180, 26, name, 10, bold=True, fill=TINT)
    box(s, x, 238, 180, 70, text, 9, border=LINE)
box(s, 45, 330, 1130, 22, "IMPACTS", 12, bold=True, color=INDIGO)
box(s, 45, 356, 1130, 70, ["Legal: threat of lawsuits from the competitors, the Group's liability towards third parties", "Reputation: a crisis between major players of the sector, loss of partners' trust", "Financial: possible penalties (AI Act), fall of the share price"], 10)
box(s, 45, 440, 1130, 22, "DECISIONS EXPECTED FROM THE EXECUTIVE COMMITTEE", 12, bold=True, color=INDIGO)
box(s, 45, 466, 1130, 90, ["1. Establish whether the attack is real and where it comes from", "2. Communicate internally", "3. Communicate externally (third parties, authorities, press)", "4. Analyse the legal and financial risk", "5. Bring the agent back under control and prevent a recurrence"], 10)

# 6. The three sequences, drawn with shapes as real decks are
s = slide("Exercise scenario in 3 sequences", "An AI agent goes beyond its rights and attacks competitors the Group works with.")
cols = [(45, 150, "Brief"), (205, 320, "Sequence 1"), (535, 320, "Sequence 2"), (865, 320, "Sequence 3")]
rows = [
    (26, ["Time", "H+0:00 → H+0:15", "H+0:15 → H+0:30", "H+0:30 → H+0:45"]),
    (40, ["Key event", "A third party raises the alarm; first suspicions about the source", "Proof that an AI agent was used", "A fix is deployed and control is restored"]),
    (62, ["Presentation", "A competitor reports an intrusion with evidence pointing to the Group's tools (without mentioning AI).", "The investigation confirms that an AI agent of the Group carried out the actions.", "Another AI tool is deployed to clean up once the agent is shut down."]),
    (84, ["Questions", "Is the technical evidence reliable?\nShould an internal investigation start?\nWhat stance towards third parties?", "How did the agent get these capabilities?\nShould the AI systems be stopped?\nShould the authorities be told?", "Can the agent's shutdown be guaranteed?\nWhat external communication?\nHow to prevent a recurrence?"]),
    (84, ["Expected decisions", "Start the investigation and preserve evidence\nFrame the legal analysis\nSet the communication stance", "Contain and disable the AI tool\nIdentify exposed systems and data\nChoose the regulatory stance", "Confirm the return to human control\nMobilise a wider cell\nLaunch remediation and the post-mortem"]),
    (104, ["Stimuli", "Email from a competitor reporting an intrusion\nEmail from a customer reporting suspicious access\nConnection traces from the Group\nLogs of internal account use\nFirst speculation in the press", "Evidence linking the attacks to the AI tool\nMap of the agent's rights\nMessage from interns using the agent\nFormal notice from the competitor\nQuestion from a journalist", "Deployment of the defensive AI agent\nNew attempts by the agent\nArticle: \"an AI out of control\"\nQuestion from the regulator"])
]
for x, w, label in cols:
    box(s, x, 104, w, 30, label, 13, bold=True, color=WHITE, fill=INDIGO, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
y = 140
for height, cells in rows:
    for (x, w, _), value in zip(cols, cells):
        first = x == 45
        box(s, x, y, w, height, value.split('\n'), 10 if first else 9, bold=first, fill=TINT if first else None, border=LINE)
    y += height + 6
notes(s, "Fallback if needed: switch to a ransomware or zero-day scenario.")

# 7. Debrief
s = slide("Debrief and evaluation")
box(s, 45, 90, 1130, 150, ["Hot debrief (15 minutes): each player speaks, then the observers.", "Evaluation sheet per learning objective: decision to stop the agent, legal qualification, communication stance, return to human control.", "Cold debrief within three weeks: action plan (governance of AI agents, decision paths, notification procedure)."], 11)

prs.save(PPTX)
with open(PPTX, 'rb') as f:
    data = base64.b64encode(f.read()).decode('ascii')
with open(JS, 'w') as f:
    f.write('/* The example source deck of the Context tab (a fictitious company), as base64 so the page\n'
            '   and the standalone HTML offer it offline. Generated by tools/make-example-deck.py: do not edit. */\n'
            f"const CM_EXAMPLE_DECK = {{ name: 'example-crisis-exercise-deck.pptx', base64: '{data}' }};\n")
print('wrote', PPTX, os.path.getsize(PPTX), 'bytes;', JS, os.path.getsize(JS), 'bytes')

# Decision log

> **Naming note.** This document is the Claude Design handoff, kept verbatim as the
> design record. It calls the authoring tool the **Curriculum Mapper**; the shipped
> product is named **SDI Program Designer**. Same tool, renamed after handoff.
> Everything else here still applies.

Why the tools are shaped the way they are. Each entry is a decision that was actually made and
tested against a user during design; reversing one without asking will likely undo a fix.

---

### The catalog database is the front door, the mapper is the workshop

Two tools, deliberately separate. The database answers reference questions and is safe to browse;
the mapper is where you commit to structure. They cross-link in both directions — `Browse all
lessons` from the mapper, `← Curriculum Mapper` from the database.

*Why:* an early single-tool version buried browsing inside authoring, so users could not look
something up without risking a change.

---

### Say "lessons", never "classes"

SDI's own vocabulary. A Tooling U class is, in SDI's model, a lesson inside a course.

*Why:* using "class" for both the SME unit and the SDI unit made every sentence in the UI
ambiguous.

---

### Ask what you are building before showing a grid

The setup wizard collects program name, type, geometry, reused courses and credential targets,
then generates the scaffold.

*Why:* users could not tell what they were making from an empty grid. Declaring the shape up
front means the structure is always visible even before any content is placed.

---

### Certificate and Associate of Science have fixed geometry

8 weeks and 4 credits per course, always. 8 courses / 32 credits and 11 courses / 44 credits
respectively. The steppers for courses, credits and weeks appear only under Custom.

*Why:* explicit user direction. These are institutional constants; exposing them as editable
fields for standard program types invites data-entry errors and implies flexibility that does not
exist. Microcredential was offered as a type and removed — it is not a thing SDI builds here.

---

### Colour carries course identity

Twelve muted colours cycle by course index: maroon, dark green, navy, olive, burnt orange, slate,
bronze, plum, forest, clay, steel, umber. The course masthead is filled with it and the tab strip
repeats it as a top border.

*Why:* the direct report from the user was "I can't tell if I am in a course or clicking through
the weeks of a course." Colour was requested explicitly, with the constraint that it stay neutral
and SDI-like — no bright or saturated hues.

The course colour also runs into the outcomes panel: the course-scoped fields (course description,
course learning outcomes) sit inside a 3px left rule in the course colour and each carries a solid
"COURSE n" chip in that colour, while the program-scoped field keeps a neutral outlined
"WHOLE PROGRAM" tag.

*Why:* a follow-up report — the panel's grey "course 1" sublabels were too quiet to tell which
course you were editing (see `docs/screenshots/course-labels-feedback.png`). Scope in this panel is
the thing most likely to be misread, so it is now carried by colour, not by small grey text.

---

### Weeks are cards, not table rows

Three treatments were mocked and compared (see `design/Week Layout Options.dc.html`):

- **2a** course masthead + week cards — chosen
- **2b** numbered rail with banded rows — densest, but weeks still ran together
- **2c** accordion, one week open — clearest but hid the whole-course view

*Why 2a:* separation comes from whitespace rather than more colour, and the masthead gives the
course an unmissable identity above the stack.

---

### The lesson column is narrower than the input columns

Lesson column caps at 340px; Discussion, Assessment, Video needs and Tools needed split the
remainder equally with a 130px floor.

*Why:* lesson names are short and fixed. The free-text columns are where the instructional
designer actually writes, and they were being squeezed.

---

### Column headers appear once; cells start empty

Labels sit in a single row above the card stack, not repeated inside every card. No default text
in any cell.

*Why:* repeated labels ate vertical space in a dense grid, and prefilled defaults like
"Discussion + quiz" had to be deleted before real content could be typed.

---

### PLOs are program-level and static

Entered once in the Outcomes panel, unchanged across every course. Course description and CLOs
are per course. All three share one collapsible panel.

*Why:* PLOs describe the program, not the week. An earlier build put them per week, which
implied they varied and multiplied the typing.

---

### Overlap check instead of a placement UI

A "place in week" number grid in the sidebar was built and then removed. The overlap check
stayed: it names every placement (`Placed 2 times: Course 1 w1, Course 1 w2`) and warns harder
when both are in the same course.

*Why:* the number grid duplicated drag-and-drop. The warning is the part that does work
drag-and-drop cannot — and repetition across courses is sometimes intentional, so the copy
distinguishes "fine if the depth differs" from "almost certainly a duplicate."

---

### Reused courses are copies with provenance, not live links

Selecting certificate courses when building an AS deep-copies them and records
`source: { programName, courseNum }`, shown as a tag on the masthead and on the program map.

*Why:* live linking raises sync questions — what happens when the certificate changes after the
AS is approved — that had no answer yet. Copying is honest and legible. Linking is a reasonable
future feature; if you build it, make the read-only state obvious and give an explicit unlink.

---

### Both side panels collapse

To 34px rails with vertical labels. Click the rail to restore.

*Why:* with five columns in the grid and two 300px panels, the work area was too narrow on a
laptop.

---

### The program map is a separate view, not a print stylesheet

A dedicated screen with course tiles, coverage bars and department mix, with navigation hidden
under `@media print`.

*Why:* the audience is a meeting, not a filing cabinet. The builder grid does not read at a
glance; this does. It also gave somewhere honest to show reused courses in a stacked credential.

---

### Everything persists locally, and that is temporary

No backend was built. Programs live in `localStorage` under one key, saved on a 400ms debounce
after every mutation.

*Why:* it kept the prototype self-contained. It is the first thing to replace — there is no
sharing, no history, no recovery, and clearing site data destroys the work.

---

### Exports are client-side, and the Excel one is a compromise

Word is an HTML document with a `msword` MIME type. PDF is a print window. Excel is CSV.

*Why:* no build step and no dependencies in a prototype. On a real backend, generate a formatted
`.xlsx` — the CSV was flagged to the user as a known compromise at the time it shipped.

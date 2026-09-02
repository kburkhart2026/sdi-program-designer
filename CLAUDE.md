# SDI Program Designer — project context

Drop this file at the root of the new repo. It is the standing brief for Claude Code.

## What this is

Two connected internal tools for **Sonoran Desert Institute (SDI)**, an online DEAC-accredited
school. SDI licenses course content from the **Tooling U–SME** catalog and assembles it into its
own certificate and associate degree programs. Instructional designers currently do this in
spreadsheets. These tools replace that.

**Tool 1 — Catalog Database.** A read-mostly browser over the Tooling U–SME catalog: 16
credentials, 283 unique lessons. Answers "what lessons exist, which credentials does this lesson
count toward, where is the official body of knowledge."

**Tool 2 — Program Designer.** The authoring tool. An instructional designer declares what they
are building (certificate, associate of science, or custom), the app generates a week-by-week
scaffold, and they drag lessons from the catalog into weeks. It tracks credential coverage,
flags duplicated lessons, and exports the finished program.

The database is the entry point conceptually — you browse, then you build.

## Who uses it

SDI instructional designers and deans. Small team, internal, desktop-only. Not student-facing.
They think in spreadsheets and are comfortable with density; they are not comfortable with
tools that hide information behind modals.

## The domain, precisely

- **Lesson** — one Tooling U–SME class. Has an ID (e.g. `260220`), a name that ends in a level
  number (`Cutting Tool Materials 321`), a department, and a URL. **Always call these "lessons"
  in the UI**, never "classes" — SDI reserves "class" for something else. The underlying JSON
  still uses `classes` as a key; that is fine, it is not user-visible.
- **Credential** — an SME certification (CMfgT, CMfgA, CAMF…) or a Tooling U microcredential
  (Mechatronics Foundations, Motor Controls…). Each maps to a list of lessons.
- **Course** — an SDI unit of instruction. Certificate and AS courses are **always 8 weeks and
  4 credits**. Custom programs can be anything.
- **Week** — one row of the scaffold. Holds a module title, lessons, and free-text fields for
  discussion, assessment, video needs and tools needed.
- **Program** — an ordered list of courses. Certificate = 8 courses / 32 credits.
  Associate of Science = 11 courses / 44 credits.
- **PLO** — program learning outcome. Program-level, static across all courses.
- **CLO** — course learning outcome. Per course.

## Decisions already made, and why

Do not relitigate these without asking.

**Lessons, not classes.** SDI's vocabulary. Enforced everywhere in the UI.

**The setup wizard comes first.** Earlier iterations dropped the user into an empty grid. They
could not tell what they were building. Now the app asks the shape of the program up front and
generates the scaffold, so the grid is never empty of structure.

**Certificate and AS have fixed geometry.** 8 weeks, 4 credits, always. The course/credit/week
steppers only appear for Custom. This was explicit user direction — exposing those numbers for
standard program types invited errors.

**Course identity is carried by colour.** Each course gets a masthead band in a colour from a
fixed neutral palette (maroon, dark green, navy, olive, burnt orange, slate, bronze, plum,
forest, clay, steel, umber). Users could not tell whether they were looking at a course or
clicking through weeks of one. The colour cycles by course index and repeats on the course tab
strip, so the tabs read as a colour key. Palette is deliberately muted and SDI-adjacent — no
bright or saturated colours.

**Weeks are cards, not table rows.** Three treatments were mocked (masthead + cards; numbered
rail with banded rows; accordion with one week open). The user chose cards: separation by
whitespace rather than colour, with the course masthead above.

**The lesson column is narrower than the input columns.** Lesson names are short; the four
free-text columns are where the work happens. Lesson column caps at 340px; Discussion,
Assessment, Video needs and Tools needed split the rest equally.

**Column headers appear once, at the top.** Not repeated per card. Cells start empty — no
placeholder content the user has to delete.

**PLOs are program-level and static.** Entered once, they hold across every course. CLOs and
the course description are per course. All three live in one collapsible Outcomes panel.

**Overlap check over placement UI.** An earlier "place in week" button grid in the sidebar was
removed as redundant with drag-and-drop. The overlap check stayed: it names every place a lesson
already sits ("also C1 w2") and warns harder when two slots are in the same course.

**Imported courses are copies, not links.** When an AS reuses certificate courses, the courses
are deep-copied with a provenance record. Editing the AS does not change the certificate. This
was a deliberate simplification — live linking is a plausible future feature but was not built.

**Both side panels collapse.** To 34px rails with vertical labels. The grid needs the room.

**Everything persists to localStorage.** No backend was built. In a real repo this is the first
thing to replace.

## Data

`data/catalog.json` — 162KB, generated from two SME spreadsheets. Do not hand-edit; regenerate
from source workbooks if the catalog changes. Schema and provenance are in
`docs/data-model.md`.

The nine SME body-of-knowledge PDFs in `docs/bok/` are official reference documents, linked from
the database sidebar per credential.

## Hosting and access — required, not yet built

The prototypes have neither. Both are part of the first build.

- **Host on GitHub.** Repository on GitHub, deployed by GitHub Actions. GitHub Pages if the app
  stays client-side; a real backend if it does not.
- **Two roles: editor and view-only.** Editors author programs. Viewers see everything, change
  nothing, and can still export and open the program map. Thread one `canEdit` boolean through
  the tree and enforce it server-side as well if there is a server.

One decision to settle before choosing hosting: static Pages cannot enforce roles. If curriculum
data is sensitive, the app needs a backend. See `docs/deployment-and-access.md`.

## Build guidance

- The HTML files in `design/` are **design references**, not production code. Recreate them in
  whatever stack this repo uses.
- Keep the density. Do not add whitespace to make it feel "cleaner" — this audience wants
  information on screen.
- Colours, type and spacing come from the SDI design system. Tokens are documented in
  `docs/design-tokens.md`. Type is Proxima Nova (body/UI), Proxima Nova Condensed (headings,
  eyebrows, buttons, stats), Prohibition (display). Adobe Typekit kit `qbk2qzz`.
- Corners are tight (3px controls, 6px cards). Borders are structural, 2px default. Shadows are
  neutral and low. No gradients, no emoji.
- Exports (Word, CSV, PDF) are generated client-side today. On a real backend, server-side
  generation of a proper .xlsx would be an improvement — the CSV export was flagged as a
  compromise.

## Known gaps

- No backend, no auth, no roles, no multi-user. localStorage only. See
  `docs/deployment-and-access.md` for what is required.
- Excel export is CSV, not a formatted workbook.
- Lean Silver, Lean Gold and CMTSE have no lesson mappings in the source workbook — only reading
  lists. The database renders those as notes instead of a lesson list.
- EVBPA, the Lean credentials, CMTSE and the Mechatronics microcredentials have no body-of-
  knowledge PDF on file.
- One lesson (Optimizing Tool Life and Process 381, ID 260250) had no hyperlink in the source
  workbook; its URL is inferred from the pattern.
- Local PDF links do not open inside a sandboxed preview. They work when served normally.

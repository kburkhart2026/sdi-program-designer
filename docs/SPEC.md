# Handoff: SDI Curriculum Mapper + Tooling U–SME Catalog Database

> **Naming note.** This document is the Claude Design handoff, kept verbatim as the
> design record. It calls the authoring tool the **Curriculum Mapper**; the shipped
> product is named **SDI Program Designer**. Same tool, renamed after handoff.
> Everything else here still applies.

## Overview

Two internal tools for Sonoran Desert Institute (SDI). SDI licenses lesson content from the
Tooling U–SME catalog and assembles it into its own certificate and associate degree programs;
that work is done in spreadsheets today.

- **Catalog Database** — browse 283 lessons across 16 SME credentials, see which credentials a
  lesson counts toward, open the lesson on Tooling U, and reach the official SME body of
  knowledge for each credential.
- **Curriculum Mapper** — declare the shape of a program, get a generated week-by-week scaffold,
  drag lessons in, track credential coverage and duplication, and export the result.

`CLAUDE.md` in this folder is the standing project brief — the *why* behind the decisions. This
README is the specification — the *what*. Read CLAUDE.md first.

## About the design files

The files in `design/` are **design references created in HTML**. They are working prototypes
that show intended look and behaviour. They are not production code to copy.

The task is to recreate these designs in this repository's existing environment — React, Vue,
SwiftUI, whatever the codebase already uses — following its established patterns and component
library. If the repo is empty, choose the framework that best fits the project and implement
there. React with a small state store is a natural fit; the prototypes are already structured as
a single stateful component tree.

## Fidelity

**High fidelity.** Colours, typography, spacing, states and interactions are final. Recreate the
UI to match, using this repo's libraries. Exact values are in `docs/design-tokens.md`.

The one exception: these prototypes have no backend. All persistence is `localStorage`. Design
the real data layer as you see fit — the shapes are documented in `docs/data-model.md`.

Two requirements are stated but not prototyped: the app is to be **hosted on GitHub**, and it
needs **editor and view-only roles**. Both are specified in `docs/deployment-and-access.md` and
should be built in from the start — the role check touches every mutating surface.

---

## Screens / views

There are four. Two in the Mapper, one in the Database, one map/report view.

### 1. Program setup (Mapper entry screen)

**Purpose.** The user says what they are building before any authoring begins. This screen
exists because dropping users into an empty grid left them unable to tell what they were making.

**Layout.** Full-bleed `--sdi-maroon` background, scrolling. Content column `max-width: 880px`,
centred, padding `44px 28px 56px`.

- **Masthead** — SDI shield 44px tall, then a stacked eyebrow (`SDI CURRICULUM MAPPER`, 10px
  condensed, `.18em` tracking, `--sdi-tan`) and H1 (`WHAT ARE YOU BUILDING?`, 26px condensed
  uppercase, white). Below: a 600px explanatory line at `rgba(255,255,255,.72)` and, pushed
  right, a `BROWSE ALL LESSONS →` outline button linking to the Database.
- **Form card** — white, `border-radius: 6px`, `--shadow-lg`, `margin-top: 26px`. Sections
  divided by 1px `--border-subtle` rules, each `padding: 20px 24px`:
  1. **Program name** — full-width text input, 15px, `2px solid --border-default`, 3px radius.
  2. **Program type** — 3-up grid, 8px gap. Each option is a bordered card: label in 12px
     condensed uppercase, hint in 11px `--gray-500`. Selected: `2px solid --sdi-red` +
     `--sdi-bone` fill. Options and their presets:
     - Certificate — 8 courses · 8 weeks each · 32 credits
     - Associate of Science — 11 courses · 8 weeks each · 44 credits
     - Custom — set courses, credits and weeks yourself
  3. **Steppers** (Custom only) — 3-up grid: Courses (1–40, step 1), Credits per course
     (0.5–12, step 0.5), Weeks per course (1–16, step 1). Each is a bordered row: −
     button (38px, `--gray-50`), value (20px condensed, centred), + button. Hint line below.
  4. **Build on an existing program** (only when saved programs exist) — see *Course reuse*.
  5. **Credentials this program should satisfy** — wrapping row of toggle chips, one per
     credential code, alphabetical. Selected: `--sdi-red` fill, white text. Max-height 132px,
     scrolls.
  - **Footer bar** — `--sdi-black`, white text. Left: live summary
    (`8 courses × 8 weeks = 64 module slots · 32 credits · tracking 2 credentials`). Right:
    `BUILD THE SCAFFOLD` primary button.
- **Saved programs** — below the card. Section label in `--sdi-tan`. Responsive grid,
  `minmax(258px, 1fr)`, 12px gap. Each card: 5px colour stripe (Certificate `--sdi-red`, Custom
  `--sdi-tan`, else `--sdi-maroon`), type eyebrow, delete ×, program name (17px condensed
  uppercase), meta line, credential chips, and a footer with lesson count and `OPEN →`. Whole
  card is clickable; hover lifts the shadow.

### 2. Builder (Mapper main screen)

**Purpose.** Assemble the program. Three columns: lesson database, course grid, outcomes and
coverage.

**Header bar** — 50px, `--sdi-maroon`, white. Left to right: `SDI CURRICULUM MAPPER` (11px
condensed, `.16em`), program name (13px semibold), meta (`8 courses · 8 weeks each · 32
credits`, 11.5px at 65% opacity). Right: lesson count, then four controls, all 6px/12px with a
`rgba(255,255,255,.35)` border and 3px radius — `Program map`, `Browse all lessons`,
`Export ▾`, `All programs`.

> The Export control must be `display: inline-flex; align-items: center` — it sits inside a
> `position: relative` dropdown wrapper, so unlike its siblings it is not blockified by the flex
> container and will overflow the bar without it.

**Left panel — lesson database (290px).** Collapses to a 34px rail with a vertically-set label.

- Header: `LESSON DATABASE` + collapse chevron; credential `<select>` (`All lessons (283)` plus
  one entry per credential with its lesson count); search input; a `Not yet placed` filter
  toggle and a result count.
- List: grouped by department. Group headers are 9.5px condensed uppercase `--sdi-maroon` on
  `--gray-50` with a bottom rule. Rows are 7px/14px, 12px text, bottom-ruled, `cursor: grab`,
  `draggable`. A placed lesson shows a `C1·W3` mono chip on `--sdi-bone` and drops to 55%
  opacity. Selected row: `--sdi-bone` fill, 3px `--sdi-red` left border.

**Centre — course grid.**

- **Course tab strip** — `--sdi-black`, horizontally scrolling. Tabs read `C1 C2 C3…` (short
  codes, by user choice). Each carries a 3px top border in that course's colour; the active tab
  is filled with it.
- **Course masthead** — the full-width band in the course colour, `padding: 14px 18px`. Left: a
  62px square with `2px solid rgba(255,255,255,.35)` holding `COURSE` (8px, `.16em`) over a
  zero-padded number (28px condensed). Centre: editable title input (21px condensed uppercase,
  transparent, borderless) over a meta line (`Course 2 of 8 · 8 weeks · 4 credits`) and, for a
  reused course, a bordered `Reused from Untitled Certificate · C1` tag. Right: `LESSONS PLACED`
  over a 26px count.
- **Column header row** — one row above all cards, 9px condensed uppercase `--gray-500`:
  `Week · module · lessons` (flex `0 1 340px`, min 210px) then `Discussion`, `Assessment`,
  `Video needs`, `Tools needed` (each flex `1 1 0`, min 130px).
- **Week cards** — vertical stack, 10px gap, container `min-width: 860px`. Each card is white,
  1px `--border-default`, 4px radius, `--shadow-sm`.
  - *Card header* — `8px 12px`, bottom-ruled, background `--gray-50` (active week:
    `--sdi-bone`). Contains a `⠿` grip (drag handle), `WEEK 3` (10.5px condensed uppercase;
    black when active, `--gray-400` otherwise), an inline module-title input (11px condensed
    uppercase `--sdi-maroon`), and a right-aligned mono count (`3 lessons` / `empty`).
  - *Card body* — flex row. Lesson cell (flex `0 1 340px`, min 210px, `9px 12px`) holds lesson
    chips; then four textarea cells (flex `1 1 0`, min 130px, `9px 11px`, 1px left rule), each a
    borderless transparent `rows="2"` textarea with a `—` placeholder.
  - *Lesson chip* — `4px 6px`, 2px radius, `--sdi-bone` (`--sdi-tan` when selected), 11.5px name,
    an amber `also C1 w2` flag when the lesson sits elsewhere, and a `×` remove control.
  - *Empty week* — dashed 1px `--gray-300` box, centred `Drag lessons here` in `--gray-400`.
  - *Active week* — 1px `--sdi-tan` border on the card.
  - *Drag-over (lesson)* — `#FDECEF` fill and a 2px dashed `--sdi-red` outline, inset 2px; the
    empty-state text becomes `Drop to place in week 5` in red.
  - *Drag-over (week reorder)* — a 3px `--sdi-red` line above the target card; the source card
    drops to 45% opacity.

**Right panel — outcomes and coverage (326px).** Collapses to a 34px rail.

- **Outcomes** (collapsible, open by default) — three labelled textareas: *Program learning
  outcomes* (tagged `whole program`), *Course description* and *Course learning outcomes* (both
  tagged `course N`).
- **Lesson detail** (when a lesson is selected) — name (16px condensed uppercase), mono meta
  (`260220 · Metal Cutting`), the **overlap check** panel, a `Counts toward` chip row (chips for
  credentials the program targets are filled `--sdi-red`), and a full-width red
  `OPEN ON TOOLING U` button.
- **Coverage** (when nothing is selected) — one bar per targeted credential (`2 / 28`, red fill,
  green at 100%, `26 lessons still unplaced`), then `Reused across courses` listing lessons
  placed more than once on amber-flagged rows, each clickable.

### 3. Program map (presentation view)

**Purpose.** A one-page visual of a finished program, for meetings. Reached from the header.

**Layout.** `max-width: 1080px`, centred, on `--gray-100`. A `.noprint` control row (back,
print) above a white card.

- **Header band** — first course colour, white text: type eyebrow in `--sdi-tan`, program name
  at 30px condensed uppercase, then a stat row (`8 courses`, `8 weeks each`, `32 credits`,
  `14 lessons`) with values at 19px condensed. All labels pluralize.
- **Course sequence** — responsive grid, `minmax(178px, 1fr)`, 9px gap. Each tile: a coloured
  bar with `COURSE` and a zero-padded number, then the title, a mono meta line
  (`8 weeks · 3 lessons`), and for reused courses a `--sdi-bone` tag reading
  `from Untitled Certificate C1`.
- **Credential coverage** — labelled bars, code left, ratio right.
- **Content mix by department** — top 8 departments as horizontal `--sdi-maroon` bars scaled to
  the largest, with counts.

Print: `@media print { .noprint { display: none !important } body { background: #fff } }`.

### 4. Catalog Database

**Purpose.** Browse and reference. Read-mostly.

**Header** — 52px `--sdi-maroon`: title, a `← CURRICULUM MAPPER` outline link, and right-aligned
totals (`16 credentials`, `283 unique lessons`, `194 shared`).

**Left (250px)** — flat alphabetical list of all 16 credentials, SME certifications and
Mechatronics microcredentials interleaved, not sectioned. Each row: code (12.5px semibold),
lesson count (mono, right), title (11px `--gray-600`). Active: `--sdi-bone` fill, 3px
`--sdi-red` left border.

**Centre** — a white header block with the credential eyebrow, title (22px condensed uppercase),
a derived summary line (`30 Tooling U lessons across 7 departments. 24 of them also count toward
another credential.`), a search field, and `All lessons` / `Shared only` pill toggles with a
result count. Below: lessons grouped by department. Rows show the name and a coverage chip
(`+1 more` on `--sdi-bone`, or a muted `only here`). No lesson IDs in the list — they live in the
detail panel.

Credentials with no lesson mapping (Lean Silver, Lean Gold, CMTSE) render their workbook content
instead: a `From the workbook` heading over cards holding the entry label, its text, and any URL.

**Right (310px)** — a **Body of knowledge** panel at the top, following the selected credential,
listing the SME PDFs for it (title, source line, `PDF` marker) or a note when none is on file.
Below it, the selected lesson's detail: name, meta, `Counts toward` (clickable, switches
credential), and `OPEN ON TOOLING U`.

---

## Interactions & behaviour

**Drag and drop.**
- Lesson → week. Lesson rows are `draggable`; week cards are drop targets. The dragged lesson id
  is held on the component instance *and* in `dataTransfer` as text/plain. `dragover` must
  `preventDefault()`. Duplicates within the same week are ignored.
- Week → week (reorder). The card header is the handle. The drag payload is `week:<index>`; the
  drop handler checks the week-drag state first and splices the week to the new index. Module
  title, lessons and all four text fields travel with it. Weeks renumber to the new order.

**Selection.** Clicking a lesson (rail or chip) selects it and swaps the right panel to detail.
Clicking a week header selects that week. Clicking a course tab switches course and clears the
lesson selection.

**Collapse.** Both side panels toggle to 34px rails. Clicking the rail restores.

**Export dropdown.** Three items:
- *Word (.doc)* — an HTML document with `application/msword` MIME, downloaded as `.doc`. One
  bordered table per course: Week, Module, Lessons, Discussion, Assessment, Video needs, Tools
  needed. Program name, type, meta and PLOs at the top; course description and CLOs under each
  course heading.
- *Excel (.csv)* — UTF-8 with BOM, CRLF. One row per lesson (or one per empty week). Columns:
  Program learning outcomes, Course, Course title, Course description, Course learning outcomes,
  Week, Module, Lesson, Lesson ID, Department, Discussion, Assessment, Video needs, Tools needed,
  Link. *Flagged as a compromise — a real .xlsx would be better.*
- *PDF* — opens the same HTML in a new window with `@page { size: landscape; margin: 14mm }` and
  calls `print()` after 400ms.

**Course reuse.** In setup, each saved program expands to a checkbox list of its courses
(`C1 · Course title`, lesson count). Select all / clear per program; selections may span several
programs. On build, selected courses are deep-copied into the new program in order, each carrying
`source: { programName, courseNum }`, and remaining slots are filled with blank courses. If more
courses are selected than the count set, an amber note appears and the larger number wins.

**Duplication.** Computed by walking every course and week to build `lessonId → [{ courseIndex,
weekIndex }]`. Surfaces in three places: the `also C1 w2` chip flag, the overlap check text, and
the `Reused across courses` list. Two placements in the *same* course get a stronger warning than
placements across courses, which are legitimate when depth differs.

**Persistence.** Every mutation deep-copies the program, sets state, and debounces a save at
400ms. Programs are stored as a list under one key; a legacy single-program key is migrated on
read. Migration also strips old default text and folds any per-week PLO values up to the program.

**Hover and motion.** Buttons darken (`--sdi-red` → `--sdi-red-700`); outline buttons fill; rows
tint to `--sdi-bone`; cards deepen their shadow. Transitions 120–200ms ease-out. No bounces, no
loops.

## State

```
data          catalog.json, fetched once on mount
screen        'setup' | 'build' | 'map'
saved         Program[] read from storage
setup         { name, type, courses, credits, weeks, creds[], imports[] }
program       the active Program
course        active course index
week          active week index (drives the sidebar)
sel           selected lesson id
q             lesson search string
credFilter    credential code or '__all'
unplacedOnly  boolean
over          week index currently under a drag
weekDrag      week index being reordered
railHidden    left panel collapsed
sideHidden    right panel collapsed
courseOpen    outcomes panel expanded
exportOpen    export dropdown open
openSrc       program id expanded in the setup import picker
```

Derived per render, not stored: placement map, department groupings, coverage ratios, duplicate
list.

## Design tokens

See `docs/design-tokens.md` for the full list. The values the layouts depend on:

| Token | Value | Use |
|---|---|---|
| `--sdi-red` | `#D50032` | Primary action, active accents |
| `--sdi-maroon` | `#4F0A12` | Headers, dark bands |
| `--sdi-black` | `#101820` | Tab strip, footer bars, body text |
| `--sdi-tan` | `#C9B79C` | Warm accent, selected chips |
| `--sdi-bone` | `#ECE6DB` | Row fills, lesson chips |

Course masthead palette, in cycle order:

```
#4F0A12  #2C3B2D  #1F2E3D  #4A4A2E  #7A3B18  #3A3F44
#6B4F2A  #402232  #23392F  #6E3B2E  #2E3A44  #54341C
```

Radii 3px (controls, chips) / 4px (week cards) / 5–6px (large cards). Borders 1px structural,
2px inputs, 3px accents. Fixed widths: left panel 290px, right panel 326px, collapsed rail 34px,
lesson column max 340px, grid min-width 860px.

## Assets

- `assets/logo-shield-black-tan.png` — SDI shield, used on the setup masthead.
- `docs/bok/` — nine official SME body-of-knowledge and reference PDFs. Mapping to credentials
  is in `docs/data-model.md`.
- Fonts: Proxima Nova, Proxima Nova Condensed, Prohibition via Adobe Typekit kit `qbk2qzz`.
  Mulish and Saira Condensed are the offline fallbacks.

## Files in this bundle

```
CLAUDE.md                     project brief — read first
README.md                     this specification
docs/data-model.md            catalog schema, program schema, BoK mapping
docs/design-tokens.md         full token list
docs/decisions.md             decision log with rationale
design/Content Mapper v2.dc.html    the Mapper prototype
design/Catalog Database.dc.html     the Database prototype
design/Week Layout Options.dc.html  the three week treatments that were compared
design/support.js             prototype runtime (not needed in production)
data/catalog.json             the catalog data — carry this over
assets/                       SDI shield
docs/bok/                     the nine SME PDFs
```

The `.dc.html` files open directly in a browser. `design/support.js` is the prototype runtime
only — it has no place in the production build.

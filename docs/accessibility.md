# Accessibility

**Target: WCAG 2.1 Level AA.**

The handoff bundle referenced "audit specs" but did not contain an accessibility
audit, so this document is the missing artefact — written against the shipped
implementation rather than inherited from the design.

Two things drove most of the work here: the grid is a **drag-and-drop tool**, and
native HTML5 drag has no keyboard equivalent at all; and the design is
deliberately **dense and quiet**, which put three token pairs below the contrast
floor.

---

## 1. Contrast corrections

Three values in `docs/design-tokens.md` fail AA as specified. All three are
corrected in `src/styles/app-tokens.css`, with the original kept wherever it is
used for something other than text.

| Use | Spec value | Measured | Required | Shipped | Now |
|---|---|---|---|---|---|
| `Drag lessons here`, inactive `WEEK n` | `--gray-400` `#9A9A94` on `--gray-0` / `--gray-50` | **2.83** / **2.61** | 4.5 (1.4.3) | `--text-quiet` = `--gray-500` `#6E6E69` | 5.13 / 4.74 ✓ |
| `also C1 w2` overlap flag, overlap panel text | `--amber` `#C77700` on `--sdi-bone` | **2.79** | 4.5 (1.4.3) | `--amber-text` `#8A5200` | 5.14 on bone, 6.03 on `#FFF8E6` ✓ |
| Outline button borders on dark bands | `rgba(255,255,255,.35)` on `--sdi-maroon` | **2.88** | 3.0 (1.4.11) | `--border-on-dark` = `.45` | 3.93 ✓ |

`--gray-400` is still used for dashed empty-state borders and the drag grip
glyph, where 1.4.11's 3:1 applies to neither (decorative, and adjacent to a
labelled control).

Everything else in the palette passes and was left alone:

| Pair | Ratio |
|---|---|
| `--sdi-red` on white | 5.42 |
| white on `--sdi-red` | 5.42 |
| white on `--sdi-maroon` | 15.17 |
| `--sdi-tan` on `--sdi-maroon` | 7.75 |
| `--sdi-maroon` on `--sdi-bone` | 12.21 |
| `--green` on white | 5.13 |
| white 72% on `--sdi-maroon` (setup intro) | 8.22 |
| white 65% on `--sdi-maroon` (header meta) | 6.89 |

Re-check with the script in "Verifying", below.

---

## 2. Keyboard access to drag-and-drop

The builder grid is the product. Two drag interactions had to gain keyboard
equivalents without disturbing the pointer experience.

### Placing a lesson

`docs/decisions.md` records that a visual "place in week" number grid was built
and then **removed** as redundant with drag-and-drop. That decision stands for
pointer users, so the keyboard path is deliberately invisible to them:

- Select a lesson (click, or `Enter`/`Space` on a focused rail row).
- The right panel swaps to lesson detail.
- `Tab` reaches a **Place in week** control — a week `<select>` and a `Place`
  button. It is `.sr-only` sized until `:focus-within`, at which point it
  expands in place with a dashed crimson outline.
- Placement is announced: *"Cutting Tool Materials 321 placed in course 1, week 3."*

A mouse user never sees it. A keyboard user finds it in tab order at exactly the
point they would look for it.

### Reordering a week

- The `⠿` grip is a real `<button>`, labelled
  *"Reorder week 3. Hold Alt and press the up or down arrow."*
- `Alt+↑` / `Alt+↓` move the week; the new position is announced.
- Module title, lessons and all four text fields travel with it, exactly as the
  pointer drag does — both paths call the same `moveWeek` action.

### Removing a lesson

- The chip is focusable; `Delete` or `Backspace` removes it, announced.
- The `×` button carries its own label: *"Remove Cutting Tool Materials 321 from week 3."*

---

## 3. Structure and semantics

- Landmarks: `<header>`, `<nav aria-label="Courses">`, `<main>`, and two
  `<aside>`s with `aria-label` ("Lesson database", "Outcomes and coverage").
- Heading order is real: one `<h1>` per screen, panel headings as `<h2>`,
  department groups as `<h3>`. `Eyebrow` renders as a heading where it labels a
  region and as a `<div>` where it is only a label.
- A **skip link** to `#course-grid` is the first focusable element in the builder.
- Week cards are `<section>`s labelled *"Week 3, Non-metals"*.
- Lesson rows are `<button>`s with `aria-pressed` for selection, not clickable divs.
- Saved-program cards use the stretched-link pattern: the program name is the
  only interactive element covering the card, so the delete `×` is not nested
  inside another button (which is invalid and unreachable for some ATs).

## 4. Forms and labels

The design has many borderless, placeholder-only inputs. A placeholder is not a
label — it disappears on input and is not reliably announced. Every one has a
real `<label>`, visually hidden:

- Course masthead title → *"Course 2 title"*
- Week module title → *"Module title for week 3"*
- The four grid textareas → *"Discussion for week 3"*, etc.
- Lesson search, credential filter, gate password.

Placeholders remain as the visual affordance the design calls for (`—` in the
grid cells).

## 5. State and live regions

One polite live region (`App.tsx`) announces drops, week moves, removals and
keyboard placements. Separate `role="status"` nodes cover:

- Lesson rail result count (so filtering is not a silent change).
- Setup summary line.
- Publish/save state.
- The overlap-check paragraph.
- Gate errors — announced, not signalled by colour alone.

Coverage and department bars are `role="progressbar"` with
`aria-valuenow/min/max` and a text label (*"CMfgA coverage: 2 of 28 lessons
placed"*), and the ratio is always printed as text beside the bar. Green at 100%
is reinforcement, never the only signal.

## 6. Focus

- `:focus-visible` only — a 2px crimson ring at 2px offset. On dark bands the
  ring switches to white (`.on-dark`), where crimson would disappear.
- The export dropdown is a `role="menu"`: `Escape` closes it and **returns focus
  to the trigger**; an outside click closes it.
- The conflict dialog is `role="alertdialog"` with `aria-modal`, takes focus on
  open, and closes on `Escape`.
- Collapse rails are `<button>`s with `aria-expanded` and `aria-controls`
  pointing at the panel they replace.
- The stepper is `role="spinbutton"`: arrow keys, `Home`, `End`, and
  `aria-valuetext` so `0.5` is announced correctly.

## 7. Colour is never the only signal

Course identity is carried by colour *and* the zero-padded `COURSE 01` number,
which appears on the masthead, the map tile, and the tab label (`C1`). Overlap
is carried by the amber flag *and* the words *"also C1 w2"*. Selection is carried
by fill *and* `aria-pressed`.

## 8. Motion

`prefers-reduced-motion: reduce` collapses every transition and animation to
0.01ms in `global.css`. There are no looping animations to disable.

## 9. Read-only mode

Per `docs/deployment-and-access.md`, viewer text fields render `readOnly`, **not
`disabled`** — a disabled field is greyed out and skipped by keyboard
navigation, and viewers need to read and select this content. Verified: fields
render at full opacity in `--sdi-maroon`/`--sdi-black` and remain focusable and
selectable. A `View only` badge in the header states the mode.

---

## Known gaps

1. **Pointer drag has no touch equivalent.** Native HTML5 drag does not fire on
   touch. The tool is specified desktop-only, and the keyboard path also serves
   as the fallback, but a tablet user cannot drag. Fixing it properly means
   pointer-events-based dragging.
2. **Grid text is 11.5–12px.** Above the 9px floor the spec sets, and the
   density is a deliberate, user-tested decision — but it is small. Browser zoom
   works correctly (all sizing is relative to the layout, nothing is clipped at
   200%).
3. **No automated axe run in CI.** Checked manually during the build; wiring
   `@axe-core/playwright` into the deploy workflow is a worthwhile follow-up.
4. **The Catalog Database is not built yet**, so it has not been audited. Its
   `Browse all lessons` entry points render disabled with a title explaining why,
   rather than as dead links.

---

## Verifying

Contrast ratios, re-runnable:

```bash
node -e '
const lin=c=>{c/=255;return c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4};
const L=h=>{h=h.replace("#","");const[r,g,b]=[0,2,4].map(i=>parseInt(h.substr(i,2),16));
return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)};
const cr=(a,b)=>{const[x,y]=[L(a),L(b)].sort((m,n)=>n-m);return((x+0.05)/(y+0.05)).toFixed(2)};
[["quiet on white","#6E6E69","#FFFFFF"],["quiet on gray-50","#6E6E69","#F6F6F4"],
 ["amber-text on bone","#8A5200","#ECE6DB"],["red on white","#D50032","#FFFFFF"],
 ["white on maroon","#FFFFFF","#4F0A12"]].forEach(([n,f,b])=>
 console.log(n.padEnd(22), cr(f,b), cr(f,b)>=4.5?"PASS":"CHECK"));'
```

Keyboard pass — do the whole thing without a mouse:

1. `Tab` from load: skip link → header controls → lesson rail → grid → side panel.
2. Select a lesson with `Enter`, `Tab` to **Place in week**, choose a week, `Place`.
3. `Tab` to a week grip, `Alt+↓` to move it.
4. `Tab` to a lesson chip, `Delete` to remove it.
5. Open `Export ▾`, arrow through it, `Escape` — focus must land back on the button.

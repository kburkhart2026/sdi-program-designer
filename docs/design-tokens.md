# Design tokens

Copied from the SDI design system. Recreate these as whatever the target codebase uses — CSS
custom properties, a theme object, Tailwind config. The names below are the ones referenced
throughout the prototypes and the README.

## Colour

### Brand

| Token | Hex | Use |
|---|---|---|
| `--sdi-red` | `#D50032` | Primary. CTAs, active accents, the 3px edge motif |
| `--sdi-red-700` | `#AB0028` | Hover / pressed crimson |
| `--sdi-maroon` | `#4F0A12` | Deep maroon. App headers, dark bands, setup background |
| `--sdi-maroon-900` | `#380009` | Deepest maroon |
| `--sdi-black` | `#101820` | Secondary. Primary ink, tab strip, footer bars |
| `--sdi-ink` | `#1B232B` | Off-black surfaces |
| `--sdi-bone` | `#ECE6DB` | Lightest cream. Row fills, lesson chips, active headers |
| `--sdi-tan` | `#C9B79C` | Mid tan. Warm accent, selected lesson chip, active card border |
| `--sdi-tan-600` | `#A18E72` | Deep tan |

Crimson is for action and emphasis only — never a background field.

### Neutral ramp

`--gray-0 #FFFFFF` · `--gray-50 #F6F6F4` · `--gray-100 #ECECE9` · `--gray-200 #DEDEDA` ·
`--gray-300 #C4C4BF` · `--gray-400 #9A9A94` · `--gray-500 #6E6E69` · `--gray-600 #4D4D49` ·
`--gray-700 #353533` · `--gray-800 #232322` · `--gray-900 #141413`

### Status

`--green #2E7D32` · `--amber #C77700` · `--info #1F6FB2` · `--danger` = `--sdi-red`

Amber is the duplication/overlap signal throughout. Green appears only at 100% coverage.

### Semantic aliases

```
--text-strong    --sdi-black      --surface-page     --gray-50
--text-body      --gray-800       --surface-card     --gray-0
--text-muted     --gray-500       --surface-sunken   --gray-100
--text-inverse   --gray-0         --surface-inverse  --sdi-black
--text-link      --sdi-red        --surface-brand    --sdi-red
                                  --surface-deep     --sdi-maroon
--border-subtle  --gray-200       --accent           --sdi-red
--border-default --gray-300       --accent-hover     --sdi-red-700
--border-strong  --sdi-black      --accent-warm      --sdi-tan
```

### Course masthead palette

Not part of the base design system — added for this tool. Twelve muted colours cycled by course
index, chosen to stay SDI-adjacent.

```
0  #4F0A12  maroon        6  #6B4F2A  bronze
1  #2C3B2D  dark green    7  #402232  plum
2  #1F2E3D  navy          8  #23392F  forest
3  #4A4A2E  olive         9  #6E3B2E  clay
4  #7A3B18  burnt orange 10  #2E3A44  steel
5  #3A3F44  slate        11  #54341C  umber
```

All are dark enough for white text at any weight.

### Ad-hoc tints in the prototypes

| Value | Use |
|---|---|
| `#FDECEF` | Drag-over fill on a week card |
| `#FFF8E6` | Overlap warning panel, duplicate rows |
| `rgba(213,0,50,.05–.06)` | Drop-zone fill |
| `rgba(255,255,255,.35–.40)` | Outline buttons on dark bands |

## Typography

| Token | Stack | Use |
|---|---|---|
| `--font-display` | `proxima-nova-condensed`, `Saira Condensed`, `Arial Narrow` | Headings, eyebrows, buttons, stats, all uppercase labels |
| `--font-body` | `proxima-nova`, `Mulish`, `Segoe UI`, system-ui | Body and UI |
| `--font-collegiate` | `prohibition`, `proxima-nova-condensed` | Display titles only |
| `--font-mono` | `ui-monospace, monospace` | IDs, counts, ratios |

Adobe Typekit kit `qbk2qzz`. Proxima Nova ships 400 and 700 only — 500/600 map to the nearest.

Weights: 400 regular · 500 medium · 600 semibold · 700 bold · 800 black.

Letter spacing: `--ls-eyebrow 0.18em` · `--ls-display 0.01em` · `--ls-button 0.06em`.
Line heights: `--lh-tight 1.02` · `--lh-snug 1.15` · `--lh-normal 1.55`.

### The sizes these tools actually use

The design-system fluid scale is for marketing pages. These are dense internal tools and use a
fixed small scale:

| Role | Size / weight / family | Notes |
|---|---|---|
| App title | 11–12px 700 display, `.16em`, uppercase | Header bars |
| Section eyebrow | 9.5px 700 display, `.14em`, uppercase, `--gray-500` | Every panel heading |
| Column header | 9px 700 display, `.12em`, uppercase, `--gray-500` | Grid header row |
| Course title (masthead) | 21px 700 display, uppercase | Editable input |
| Map program title | 30px 700 display, uppercase | |
| Screen title | 22–26px 700 display, uppercase | |
| Panel title | 16–17px 700 display, uppercase | Lesson detail, program cards |
| Body / row text | 11.5–12.5px 400 body | Lesson names, cells |
| Meta / mono | 10–11px mono, `--gray-500` | IDs, counts, ratios |
| Stat value | 19–26px 700 display | Counts on mastheads and the map |

Nothing below 9px. Grid text stays at 11.5px minimum.

## Spacing

8px base grid: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128`.

Component padding in these tools: `6px 12px` controls · `8px 12px` card headers ·
`9px 11–12px` grid cells · `13–14px 15–16px` sidebar sections · `20px 24px` setup form sections.

### Fixed dimensions

| Element | Value |
|---|---|
| App header bar | 50px (mapper) / 52px (database) |
| Left lesson panel | 290px (mapper) / 250px (database) |
| Right panel | 326px (mapper) / 310px (database) |
| Collapsed rail | 34px |
| Lesson column | `flex: 0 1 340px`, min 210px |
| Text columns | `flex: 1 1 0`, min 130px each |
| Week card stack | `min-width: 860px` |
| Setup content column | `max-width: 880px` |
| Program map | `max-width: 1080px` |
| Program card grid | `minmax(258px, 1fr)` |
| Map course tiles | `minmax(178px, 1fr)` |

## Radii, borders, shadows

```
--radius-sm   3px    controls, chips, buttons, inputs
--radius-md   6px    large cards
              4px    week cards, program map tiles
--radius-pill 999px  avoid — nothing here is pill-shaped

--bw-hair 1px   structural rules
--bw-1    2px   input borders, selected type cards
--bw-2    3px   accent edges, left borders, top rules

--shadow-sm    0 1px 2px rgba(18,18,18,.10)
--shadow-md    0 4px 14px rgba(18,18,18,.12)
--shadow-lg    0 14px 40px rgba(18,18,18,.18)
```

Shadows are neutral and low. Never coloured, never glowing.

## Motion

```
--dur-fast  120ms
--dur       200ms
--ease-out  cubic-bezier(.2, .7, .3, 1)
```

Fades and small translates only. Cards lift 3px on hover; pressed states nudge down 1px. No
bounces, no infinite loops. Honour `prefers-reduced-motion`.

## Iconography

The SDI shield (`assets/logo-shield-black-tan.png`) is the only brand mark used. UI glyphs in the
prototypes are Unicode: `▼ ▶` disclosure, `‹ ›` collapse, `←` back, `×` remove, `⠿` drag handle,
`✓` checkbox, `−` `+` steppers. Substitute an icon set if the codebase has one — Lucide is the
design system's recommendation. No emoji.

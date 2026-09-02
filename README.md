# SDI Program Designer

An internal authoring tool for Sonoran Desert Institute. Instructional designers
declare the shape of a program, the app generates a week-by-week scaffold, and
they drag Tooling U–SME lessons into it. It tracks credential coverage, flags
duplicated lessons, and exports the finished program.

Replaces the spreadsheets this work is done in today.

- **The brief** — [`CLAUDE.md`](CLAUDE.md). Read first: the *why*.
- **The spec** — [`docs/SPEC.md`](docs/SPEC.md). Screens, behaviours, interactions.
- **The decisions** — [`docs/decisions.md`](docs/decisions.md). Do not relitigate silently.
- **Accessibility** — [`docs/accessibility.md`](docs/accessibility.md).

React 18 + TypeScript + Vite. No backend. Deployed to GitHub Pages by Actions.

---

## Running it locally

```bash
npm install
npm run dev
```

Then <http://localhost:5173>. Without a content repo configured (below), the app
runs in **local mode**: fully editable, drafts saved in your browser, no publishing.

```bash
npm run build      # typecheck + production build to dist/
npm run typecheck  # types only
```

---

## How saving works

Two repositories, deliberately separate:

| Repo | Visibility | Holds |
|---|---|---|
| `sdi-program-designer` (this one) | public — Pages serves it | the app, and the two encrypted key files |
| `sdi-program-designer-content` | **private** | `manifest.json` + `programs/<id>.json` |

**GitHub Pages is always public.** That is fine: the app shell contains no
curriculum data. The data lives in the private content repo, which is unreadable
without a token.

Content is sharded one file per program. That is what makes several editors
workable — two people on different programs never touch the same file.

### Local drafts vs. Publish

Every edit saves to your browser (IndexedDB, mirrored to localStorage) on a
400ms debounce. Work is never lost, even offline.

Publishing is **explicit**. The header shows `Publish 2` when two programs have
unpublished changes. Pressing it writes each changed program file, then the
manifest last — so an interrupted publish never leaves the manifest pointing at
content that was never written.

Every publish is a real git commit. Version history, diffs and rollback come
free, in the content repo's own history.

### If someone else published first

Before writing anything, the app re-reads each file's blob SHA and compares it
to the one it loaded. If it moved, **nothing is written** and you are asked what
to do: reload theirs, download your copy, or overwrite. Their version stays in
git history either way.

This is the one place the app deliberately differs from the Product Development
Playbook, which detects conflicts only within the few seconds of a single commit
and will otherwise overwrite a colleague's work silently.

---

## Setting it up

### 1. Create the two repos

- `sdi-program-designer` — push this folder to it.
- `sdi-program-designer-content` — **private**, leave it empty. The app creates the
  files on the first publish.

### 2. Turn on Pages

App repo → **Settings → Pages** → Source: **GitHub Actions**. The workflow in
`.github/workflows/deploy.yml` builds and deploys on every push to `main`, and
passes the repo name as the base path, so renaming the repo cannot break it.
It runs `npm ci`, so commit `package-lock.json`.

### 3. Point the app at the content repo

Edit `src/sync/config.ts`:

```ts
export const GITHUB_OWNER = 'kburkhart2026'
export const GITHUB_CONTENT_REPO = 'sdi-program-designer-content'
```

Commit and push. These are not secrets.

### 4. Create two fine-grained tokens

**Settings → Developer settings → Personal access tokens → Fine-grained.** Scope
both to **only** `sdi-program-designer-content`:

| Token | Repository permission |
|---|---|
| Editor | Contents: **Read and write** |
| Viewer | Contents: **Read-only** |

### 5. Turn each token into a key file

```bash
node scripts/make-key.mjs editor
node scripts/make-key.mjs viewer
```

Each asks for the token and a password, and writes `public/editor-key.json` or
`public/viewer-key.json`. Commit both.

The token is encrypted with AES-GCM under a PBKDF2-SHA256 key (4,000,000
rounds). **The ciphertext is safe to publish. The password is not.**

Use a passphrase of several unrelated words. The encrypted file is public, so a
short password can be attacked offline at the attacker's own pace — the script
warns below 12 characters.

### 6. Share the links

```
https://<user>.github.io/sdi-program-designer/#e   ← editors
https://<user>.github.io/sdi-program-designer/#v   ← viewers
```

**The link carries no credential** — only an `e` or `v` marker. Send the
password separately (not in the same email). Unlocking is once per device; the
**Lock** button in the header clears it.

If both markers are somehow present, viewer wins — opening a share link in your
own browser must stay read-only.

### Rotating a password

Re-run `make-key.mjs` and commit the new file. Existing links keep working —
only the password changes. To cut off access entirely, delete the token on
GitHub; that invalidates every link using it, immediately.

---

## What editors and viewers can do

| Surface | Viewer |
|---|---|
| Saved program list | Sees everything. No delete, no setup form. |
| Builder grid | Renders normally. Not draggable, not a drop target. |
| Text fields | `readOnly` — readable and selectable, **not** greyed out. |
| Outcomes panel | Visible and expandable, fields read-only. |
| Coverage / overlap | Unchanged. This is the reporting viewers most want. |
| Program map | Unchanged, including print. |
| Export menu | **Available.** A dean needs the PDF without edit rights. |

Enforcement is a single `guard()` wrapper in `src/store/useProgram.ts` that
every mutating action passes through, plus a `body.view-mode` class and hidden
chrome, plus the read-only token itself. The token is the real backstop; the
rest is so the interface never offers an action that silently does nothing.

### The honest limitation

Anyone with the editor password can extract the write-capable token from their
own browser, and every commit is attributed to whoever owns the token — not to
the individual editor. For a small internal team that is an acceptable trade,
and it is the same model the Playbook already runs.

When it stops being acceptable — when you need per-person attribution or
per-person revocation — the upgrade is GitHub OAuth through a small serverless
broker (a Cloudflare Worker is enough). Each editor signs in as themselves, the
role comes from org team membership, and no shared secret exists. That is a
day's work and does not change any of the UI.

---

## Project layout

```
public/            catalog.json, SDI shield, the 9 SME PDFs, the key files
scripts/           make-key.mjs — key-file generator
src/
  data/            catalog loading, derived state, prototype migration
  sync/            GitHub engine, vault, IndexedDB drafts, publish
  auth/            RoleContext, the unlock gate
  store/           useProgram (data + guard), useSession, useUi
  components/ui/   Button, Chip, Stepper, Stat, Card, Eyebrow, Rail
  screens/         setup/ · builder/ · map/
  export/          Word, CSV, PDF
  styles/          tokens/ (from the design system) + app-tokens + global
docs/              spec, data model, decisions, deployment, tokens, a11y
```

`docs/source-data/` holds the raw SME exports `catalog.json` was generated from.
Keep them — they are the audit trail for how a lesson got its credential mappings.

---

## The two tools

**Program Designer** (`screens/setup`, `screens/builder`, `screens/map`) is the
authoring tool: declare a program, get a scaffold, drag lessons in, publish.

**Catalog Database** (`screens/database`) is the reference tool: browse all 16
credentials and 283 lessons, see what each lesson counts toward, and open the
official SME body of knowledge. Read-only by nature, so it needs no role gating —
there is nothing there to mutate.

They are deliberately separate, and cross-link both ways: `Browse all lessons`
from the Designer, `← Program Designer` from the Database. An early single-tool
version buried browsing inside authoring, so users could not look something up
without risking a change. The Database remembers which screen you came from and
returns you there.

## What is not built yet

- **Excel export is CSV**, not a formatted workbook. Flagged as a known
  compromise in `docs/decisions.md`.
- **Microcredential lab lists are not surfaced.** `catalog.json` carries a
  `labs` array for the three Mechatronics microcredentials (4, 7 and 6 entries).
  Neither the spec nor the prototype renders them, so neither does this — but
  the data is there if you want them shown.
- **Fonts.** Adobe Typekit kit `qbk2qzz` must be licensed for the deploy domain
  (`*.github.io`, or your custom domain). If it is not, Proxima Nova silently
  falls back to Mulish / Saira Condensed and the app looks off-brand with no
  error anywhere.

## Data notes

`public/catalog.json` — 16 credentials, 283 unique lessons, 194 shared across
two or more credentials, 59 departments. Verified against `docs/data-model.md`.
Do not hand-edit; regenerate from the source workbooks.

Say **lessons**, never "classes". The JSON key is `classes`; that is not
user-visible and must not leak into the UI.

The program schema fixes the prototype's two misnamed fields — `week.assessment`
(which held Discussion) is now `week.discussion`, and `week.applied` is now
`week.assessment`, as `docs/data-model.md` instructs. `src/data/migrate.ts`
handles the rename, and is idempotent.

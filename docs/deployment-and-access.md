# Deployment and access

> **Naming note.** This document is the Claude Design handoff, kept verbatim as the
> design record. It calls the authoring tool the **Curriculum Mapper**; the shipped
> product is named **SDI Program Designer**. Same tool, renamed after handoff.
> Everything else here still applies.

Two requirements from SDI that the prototypes do not implement. Treat both as part of the first
build, not as later additions — the roles requirement in particular touches every mutating
surface in the app.

---

## Hosting: GitHub

The app should live in a GitHub repository and be hosted from it.

### If the app can stay client-side

**GitHub Pages** is the simplest fit and matches how the prototypes already work. A static build
(Vite/React → `dist/`) published by a GitHub Actions workflow on push to `main`.

```yaml
# .github/workflows/deploy.yml — sketch
on:
  push: { branches: [main] }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci && npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    environment: github-pages
    runs-on: ubuntu-latest
    steps: [{ uses: actions/deploy-pages@v4 }]
```

Two things to get right on Pages:

- **Base path.** A project site serves from `/<repo>/`. Set `base` in the bundler config or
  every asset and the `catalog.json` fetch will 404.
- **The PDFs.** `docs/bok/*.pdf` must be copied into the build output. They are linked directly
  and are the one asset class most likely to be dropped by a bundler that only tracks imports.

Pages is public unless the repo is on a GitHub plan with private Pages. **A public Pages site
cannot satisfy the access requirement below** — see the caveat.

### If the app needs a backend

Once programs are shared between people, `localStorage` has to go and roles need to be enforced
somewhere other than the browser. At that point host the frontend on Pages or Cloudflare Pages
and put the API elsewhere, or move the whole thing to a platform that runs server code. Keep the
repository on GitHub either way and keep the deploy in Actions.

The data layer needs: programs (CRUD, per user), the catalog (read-only, seeded from
`catalog.json`), and users with a role. Nothing about the UI assumes a particular database.

---

## Access: editor and viewer roles

Two roles.

### Editor

Full use of the app as designed. Creates programs, drags lessons, edits every field, reorders
weeks, imports courses from other programs, deletes programs, exports.

### Viewer

Read-only. Can see everything and take nothing away but a file.

| Surface | Viewer behaviour |
|---|---|
| Catalog Database | Unchanged. It is already read-only. |
| Program list | Sees all programs. No delete ×. No "Build the scaffold" / setup form. |
| Builder grid | Renders normally. Lesson rail is not draggable; week cards are not drop targets; week headers are not drag handles. |
| All text inputs | Rendered as static text, or as inputs with `readOnly` — not merely disabled, which greys out content that viewers need to read. |
| Remove `×` on lesson chips | Hidden. |
| Outcomes panel | Visible and expandable, fields read-only. |
| Coverage / overlap | Unchanged. This is the reporting viewers most want. |
| Program map | Unchanged, including print. |
| Export menu | **Available.** A dean needs the PDF without needing edit rights. |

### How to build it

- One `role` value on the session, and a single `canEdit` derived boolean threaded through the
  component tree (context, not prop-drilling). Every mutating handler checks it.
- **Enforce on the server too.** Client-side role checks are for the interface, not for
  security. If there is an API, reject writes from viewers there.
- Make the state visible: a small `View only` badge in the header bar, styled like the existing
  outline controls, so nobody wonders why dragging does nothing.
- Default new users to viewer. Editors are granted.

### Identity

Options, roughly in order of how well they fit an internal tool at a small school:

1. **GitHub OAuth**, with the role read from membership of a team in the SDI org. Costs nothing
   extra, and the repo is already there.
2. **Google Workspace SSO** if SDI runs on Google — most likely to match how staff already sign
   in.
3. An invite list keyed by email in the datastore, if the backend is minimal.

### The caveat worth raising early

Static Pages hosting gives no way to enforce roles — anyone with the URL sees the site, and any
role check in JavaScript can be bypassed. If the curriculum data is not sensitive, a public
viewer site with editing gated behind a login is a reasonable compromise. If it is sensitive,
the app needs a real backend and Pages is not the answer. **Confirm with SDI which of these is
true before choosing the hosting model** — it is the one decision that is expensive to reverse.

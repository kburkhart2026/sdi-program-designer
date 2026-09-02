# Data model

> **Naming note.** This document is the Claude Design handoff, kept verbatim as the
> design record. It calls the authoring tool the **Curriculum Mapper**; the shipped
> product is named **SDI Program Designer**. Same tool, renamed after handoff.
> Everything else here still applies.

## `data/catalog.json`

162KB, generated from two SME spreadsheets. Do not hand-edit — regenerate from the workbooks.

### Source workbooks

| File | Contents |
|---|---|
| `All SME Certification Mappings 2.2026.xlsx` | One sheet per SME credential. Row 3 holds the credential title; row 4 is the header; data rows carry Department, Class name, Class ID. Lesson URLs live as **cell hyperlinks**, not as text in a column. |
| `Tooling U-SME_Mechatronics Microcredentials_5-2026.xlsx` | One sheet per microcredential. Columns: Course Bundle, TU-SME Dept, TU-SME Class, Course ID. An `APT Labs` marker row separates a lab list at the bottom. |

The URL extraction is the part that is easy to get wrong. Converting these sheets to CSV or JSON
with a naive tool silently drops every lesson link, because the links are hyperlink relationships
in the sheet XML (`xl/worksheets/_rels/sheetN.xml.rels`), not cell values. Read them from the
relationship targets.

### Shape

```jsonc
{
  "generated": "2026-09-01",
  "credentials": [
    {
      "code": "EVF",
      "title": "Electrical Vehicle Fundamentals (EVF)",
      "source": "All SME Certification Mappings 2.2026",
      "kind": "micro",            // present only for microcredentials
      "classes": [
        {
          "dept": "Additive Manufacturing",
          "name": "Additive Manufacturing Safety 121",
          "id": "510020",
          "url": "https://learn.toolingu.com/classes/additive-manufacturing-safety-121/"
        }
      ],
      "labs": [                    // microcredentials only
        { "topic": "…", "code": "…", "name": "…" }
      ],
      "notes": [                   // credentials with no lesson mapping
        { "label": "…", "url": "…", "text": "…" }
      ]
    }
  ],
  "classes": [                     // deduplicated across all credentials
    {
      "id": "140266",
      "name": "3D Laser Scanners 376",
      "dept": "Inspection",
      "url": null,                 // null when the workbook had no hyperlink
      "creds": ["CMfgT", "CMfgE"]  // every credential this lesson counts toward
    }
  ]
}
```

`classes` is the deduplicated index — 283 entries — and `creds` on each entry is what powers the
overlap and coverage features. `credentials[].classes` is the per-credential ordered list.

Note the key is `classes` in the JSON but the UI must say **lessons** everywhere.

### Counts

16 credentials, 283 unique lessons, 194 lessons shared by two or more credentials.

| Code | Lessons | Notes |
|---|---|---|
| EVF | 44 | |
| EVBPA | 30 | |
| RMF | 22 | |
| CAMF | 20 | |
| CAMT | 26 | |
| CMfgA | 28 | |
| CMfgA-Spanish | 25 | Spanish equivalents; dept reads `Spanish equivalent of …` |
| CMfgT | 161 | |
| CMfgE | 153 | |
| Lean Bronze | 59 | |
| Lean Silver | 0 | reading list only → `notes` |
| Lean Gold | 0 | reading list only → `notes` |
| CMTSE | 0 | chapter outline only → `notes` |
| Mechatronics Foundations | 14 | microcredential |
| Electrical Systems & Circuits | 9 | microcredential |
| Motor Controls | ~10 | microcredential |

### Lesson URLs

Pattern: `https://www.toolingu.com/class/<id>/<slug>` or
`https://learn.toolingu.com/classes/<slug>/`, taken verbatim from the workbook hyperlink. One
lesson — Optimizing Tool Life and Process 381 (`260250`) — had no hyperlink in the source and its
URL is inferred from the pattern. When `url` is null the UI falls back to
`https://learn.toolingu.com/`.

---

## Program schema (authored in the Mapper)

Stored as a list under one localStorage key in the prototype. Replace with a real store.

```jsonc
{
  "id": "p1788298053175",
  "name": "Manufacturing Technology Certificate",
  "type": "Certificate",           // Certificate | Associate of Science | Custom
  "credits": 4,                     // per course
  "creds": ["CMfgA", "CMfgT"],      // credential targets, drives coverage
  "plos": "…\n…",                   // program learning outcomes, static across courses
  "saved": 1788298053175,           // epoch ms, for sorting the program cards
  "courses": [
    {
      "title": "Materials Science & Metal Cutting",
      "description": "…",
      "clo": "…\n…",
      "source": {                   // present only on reused courses
        "programName": "Manufacturing Technology Certificate",
        "courseNum": 3
      },
      "weeks": [
        {
          "module": "Non-metals",
          "lessons": ["180040", "180060", "180050"],  // lesson ids, ordered
          "assessment": "",         // the DISCUSSION column (legacy field name)
          "applied": "",            // the ASSESSMENT column (legacy field name)
          "video": "",
          "tools": ""
        }
      ]
    }
  ]
}
```

### Two field names to fix

`week.assessment` holds the **Discussion** column and `week.applied` holds the **Assessment**
column. This is legacy: the columns were originally Assessment and Applied, and were renamed in
the UI without renaming the fields. **Rename them properly when you build the real schema** —
`discussion` and `assessment` — and migrate.

### Migrations the prototype performs on read

1. A single-program legacy key is wrapped into the program list.
2. `week.assessment` values of `"Discussion + quiz"` or `"Discussion"` (old defaults) are cleared.
3. Any `week.plo` value is folded up into `program.plos` and the per-week field deleted.

Carry the intent, not the code — these only matter if you import existing prototype data.

---

## Body-of-knowledge documents

Nine PDFs in `docs/bok/`, surfaced in the Database sidebar for the selected credential.

| Credential | Documents |
|---|---|
| EVF | `evf-body-of-knowledge.pdf` (SME, 2023) · `evf-prep-classes.pdf` (Tooling U–SME prep program) |
| CAMF | `camf-body-of-knowledge.pdf` (SME, 2025) |
| CAMT | `camt-body-of-knowledge.pdf` (SME, 2025) |
| RMF | `rmf-body-of-knowledge.pdf` (SME, 2022) · `rmf-skills-checklist.pdf` (verifier sign-off) |
| CMfgA | `cmfga-body-of-knowledge.pdf` (SME, 2026) |
| CMfgA-Spanish | `cmfga-body-of-knowledge.pdf` (English original) |
| CMfgT, CMfgE | `technical-certification-body-of-knowledge.pdf` · `technical-certification-competency-model.pdf` |

No document on file for EVBPA, Lean Bronze/Silver/Gold, CMTSE, or the three Mechatronics
microcredentials. The UI says so explicitly rather than showing an empty panel.

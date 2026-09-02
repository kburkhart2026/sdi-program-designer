/**
 * Body-of-knowledge documents, per credential.
 *
 * The nine official SME PDFs in public/docs/bok/, surfaced in the Database
 * sidebar for whichever credential is selected. Mapping is from
 * docs/data-model.md; do not invent entries for credentials that have none —
 * the UI says so explicitly rather than showing an empty panel.
 *
 * Not on file, deliberately: EVBPA, Lean Bronze/Silver/Gold, CMTSE, and the
 * three Mechatronics microcredentials.
 */

export interface BokDoc {
  title: string
  /** Source line under the title. */
  meta: string
  /** Filename inside public/docs/bok/. */
  file: string
}

export const BOK: Record<string, BokDoc[]> = {
  EVF: [
    {
      title: 'Electric Vehicle Fundamentals — Body of Knowledge',
      meta: 'SME · 2023',
      file: 'evf-body-of-knowledge.pdf',
    },
    {
      title: 'EVF Exam Preparation Classes',
      meta: 'Tooling U–SME · optional prep program',
      file: 'evf-prep-classes.pdf',
    },
  ],
  CAMF: [
    {
      title: 'Certified Additive Manufacturing Fundamentals — Body of Knowledge',
      meta: 'SME · 2025',
      file: 'camf-body-of-knowledge.pdf',
    },
  ],
  CAMT: [
    {
      title: 'Certified Additive Manufacturing Technician — Body of Knowledge',
      meta: 'SME · 2025',
      file: 'camt-body-of-knowledge.pdf',
    },
  ],
  RMF: [
    {
      title: 'Robotics Fundamentals — Body of Knowledge',
      meta: 'SME · 2022',
      file: 'rmf-body-of-knowledge.pdf',
    },
    {
      title: 'Robotics Skills Checklist',
      meta: 'Tooling U–SME · verifier sign-off',
      file: 'rmf-skills-checklist.pdf',
    },
  ],
  CMfgA: [
    {
      title: 'Manufacturing Associate — Body of Knowledge',
      meta: 'SME · 2026',
      file: 'cmfga-body-of-knowledge.pdf',
    },
  ],
  // The Spanish credential shares the English document — flagged in the meta
  // line so nobody reports it as the wrong file.
  'CMfgA-Spanish': [
    {
      title: 'Manufacturing Associate — Body of Knowledge',
      meta: 'SME · 2026 · English original',
      file: 'cmfga-body-of-knowledge.pdf',
    },
  ],
  CMfgT: [
    {
      title: 'Technical Certification — Body of Knowledge',
      meta: 'SME · Technologist and Engineer',
      file: 'technical-certification-body-of-knowledge.pdf',
    },
    {
      title: 'Technical Certification — Competency Model',
      meta: 'SME · Technologist and Engineer',
      file: 'technical-certification-competency-model.pdf',
    },
  ],
  CMfgE: [
    {
      title: 'Technical Certification — Body of Knowledge',
      meta: 'SME · Technologist and Engineer',
      file: 'technical-certification-body-of-knowledge.pdf',
    },
    {
      title: 'Technical Certification — Competency Model',
      meta: 'SME · Technologist and Engineer',
      file: 'technical-certification-competency-model.pdf',
    },
  ],
}

export function bokFor(code: string): BokDoc[] {
  return BOK[code] ?? []
}

/** Respects Vite's `base`, so these resolve under a Pages project path. */
export function bokHref(doc: BokDoc): string {
  return `${import.meta.env.BASE_URL}docs/bok/${doc.file}`
}

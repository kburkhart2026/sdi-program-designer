import type { Program } from '../types/program'
import type { CatalogIndex } from '../data/catalog'
import { lessonUrl } from '../data/catalog'
import { downloadBlob, safeFileName } from './document'

/**
 * CSV export.
 *
 * UTF-8 with a BOM and CRLF line endings, because Excel on Windows mis-detects
 * the encoding without the BOM (é becomes Ã©) and treats bare LF inconsistently.
 *
 * One row per lesson, or one row per empty week so a gap in the plan is still
 * visible in the spreadsheet.
 *
 * KNOWN COMPROMISE: this is CSV, not a formatted .xlsx. It was flagged as such
 * when the prototype shipped. A real workbook — merged course headers, frozen
 * panes, column widths — needs either a client-side library or server-side
 * generation. See docs/decisions.md.
 */

const COLUMNS = [
  'Program learning outcomes',
  'Course',
  'Course title',
  'Course description',
  'Course learning outcomes',
  'Week',
  'Module',
  'Lesson',
  'Lesson ID',
  'Department',
  'Discussion',
  'Assessment',
  'Video needs',
  'Tools needed',
  'Link',
] as const

/** RFC 4180 quoting: always quote, double any embedded quote. */
function cell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`
}

export function exportCsv(index: CatalogIndex, program: Program): void {
  const rows: string[] = [COLUMNS.map(cell).join(',')]

  program.courses.forEach((course, ci) => {
    course.weeks.forEach((week, wi) => {
      const base = [
        program.plos,
        `C${ci + 1}`,
        course.title,
        course.description,
        course.clo,
        wi + 1,
        week.module,
      ]
      const tail = [week.discussion, week.assessment, week.video, week.tools]

      if (week.lessons.length === 0) {
        rows.push([...base, '', '', '', ...tail, ''].map(cell).join(','))
        return
      }
      for (const id of week.lessons) {
        const lesson = index.byId.get(id)
        rows.push(
          [
            ...base,
            lesson?.name ?? id,
            id,
            lesson?.dept ?? '',
            ...tail,
            lessonUrl(lesson),
          ]
            .map(cell)
            .join(','),
        )
      }
    })
  })

  const blob = new Blob(['﻿', rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `${safeFileName(program.name)}.csv`)
}

import type { Program } from '../types/program'
import type { CatalogIndex } from '../data/catalog'
import { plural, totalPlaced } from '../data/derive'

/**
 * The shared HTML document behind the Word and PDF exports.
 *
 * One bordered table per course: Week, Module, Lessons, Discussion, Assessment,
 * Video needs, Tools needed. Program name, type, meta and PLOs at the top;
 * course description and CLOs under each course heading.
 *
 * Deliberately plain HTML with inline styles — Word's HTML importer ignores
 * most of a stylesheet, and anything clever here degrades in ways that are
 * invisible until someone opens the file in Word.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Preserve authored line breaks — these fields are multi-line by nature. */
function multiline(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '&nbsp;'
  return escapeHtml(trimmed).replace(/\r?\n/g, '<br>')
}

export function buildDocumentHtml(
  index: CatalogIndex,
  program: Program,
  opts: { landscape?: boolean } = {},
): string {
  const weeks = program.courses[0]?.weeks.length ?? 0
  const meta = [
    plural(program.courses.length, 'course'),
    `${plural(weeks, 'week')} each`,
    `${program.courses.length * program.credits} credits`,
    plural(totalPlaced(program), 'lesson'),
  ].join(' · ')

  const courses = program.courses
    .map((course, ci) => {
      const rows = course.weeks
        .map((week, wi) => {
          const review = new Set(week.reviewLessons ?? [])
          const lessons = week.lessons
            .map((id) => {
              const name = escapeHtml(index.byId.get(id)?.name ?? id)
              // Carried into Word and PDF too, not just the spreadsheet.
              return review.has(id) ? `${name} <i>(review)</i>` : name
            })
            .join('<br>')
          return `
      <tr>
        <td style="text-align:center;font-weight:bold">${wi + 1}</td>
        <td>${multiline(week.module)}</td>
        <td>${lessons || '&nbsp;'}</td>
        <td>${multiline(week.discussion)}</td>
        <td>${multiline(week.assessment)}</td>
        <td>${multiline(week.video)}</td>
        <td>${multiline(week.tools)}</td>
      </tr>`
        })
        .join('')

      return `
  <h2 style="font-family:Arial,sans-serif;font-size:15pt;margin:22pt 0 4pt;text-transform:uppercase">
    Course ${ci + 1} — ${escapeHtml(course.title || 'Untitled course')}
  </h2>
  ${
    course.source
      ? `<p style="font-size:9pt;color:#4D4D49;margin:0 0 6pt">Reused from ${escapeHtml(
          course.source.programName,
        )} · C${course.source.courseNum}</p>`
      : ''
  }
  ${
    course.description.trim()
      ? `<p style="font-size:10pt;margin:0 0 6pt"><b>Description:</b> ${multiline(course.description)}</p>`
      : ''
  }
  ${
    course.clo.trim()
      ? `<p style="font-size:10pt;margin:0 0 8pt"><b>Course learning outcomes:</b><br>${multiline(course.clo)}</p>`
      : ''
  }
  <table border="1" cellspacing="0" cellpadding="5"
         style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:9pt">
    <thead>
      <tr style="background:#ECE6DB">
        <th style="width:5%">Week</th>
        <th style="width:15%">Module</th>
        <th style="width:22%">Lessons</th>
        <th style="width:15%">Discussion</th>
        <th style="width:15%">Assessment</th>
        <th style="width:14%">Video needs</th>
        <th style="width:14%">Tools needed</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
    })
    .join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${escapeHtml(program.name)}</title>
<style>
  body { font-family: Arial, sans-serif; color: #101820; }
  th { text-align: left; }
  ${opts.landscape ? '@page { size: landscape; margin: 14mm }' : ''}
</style>
</head><body>
  <h1 style="font-size:20pt;margin:0 0 2pt;text-transform:uppercase">${escapeHtml(program.name)}</h1>
  <p style="font-size:10pt;color:#4D4D49;margin:0 0 2pt">${escapeHtml(program.type)}</p>
  <p style="font-size:10pt;color:#4D4D49;margin:0 0 10pt">${escapeHtml(meta)}</p>
  ${
    program.creds.length
      ? `<p style="font-size:10pt;margin:0 0 10pt"><b>Credentials targeted:</b> ${escapeHtml(
          program.creds.join(', '),
        )}</p>`
      : ''
  }
  ${
    program.plos.trim()
      ? `<p style="font-size:10pt;margin:0 0 10pt"><b>Program learning outcomes:</b><br>${multiline(
          program.plos,
        )}</p>`
      : ''
  }
  ${courses}
</body></html>`
}

/** Filesystem-safe base name for a download. */
export function safeFileName(name: string): string {
  return (name.trim() || 'program').replace(/[^\w\d\- ]+/g, '').replace(/\s+/g, '-')
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking immediately can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

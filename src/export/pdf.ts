import type { Program } from '../types/program'
import type { CatalogIndex } from '../data/catalog'
import { buildDocumentHtml } from './document'

/**
 * PDF export — opens the same document in a new window and calls print(),
 * letting the user "Save as PDF" from the system dialog.
 *
 * The 400ms delay is not superstition: printing before layout and fonts settle
 * produces a blank or half-rendered first page in Safari and Chrome.
 *
 * Returns false when the popup was blocked, so the caller can say so rather
 * than appearing to do nothing.
 */
export function exportPdf(index: CatalogIndex, program: Program): boolean {
  const html = buildDocumentHtml(index, program, { landscape: true })
  const win = window.open('', '_blank')
  if (!win) return false

  win.document.write(html)
  win.document.close()
  setTimeout(() => {
    win.focus()
    win.print()
  }, 400)
  return true
}

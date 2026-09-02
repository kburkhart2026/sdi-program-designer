import type { Program } from '../types/program'
import type { CatalogIndex } from '../data/catalog'
import { buildDocumentHtml, downloadBlob, safeFileName } from './document'

/**
 * Word export — an HTML document served with the msword MIME type and a .doc
 * extension. Word opens it and renders the tables correctly.
 *
 * Not a real .docx (which is a zip of XML parts). That would need a library
 * and a build-time dependency for a file Word treats identically.
 */
export function exportWord(index: CatalogIndex, program: Program): void {
  const html = buildDocumentHtml(index, program)
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  downloadBlob(blob, `${safeFileName(program.name)}.doc`)
}

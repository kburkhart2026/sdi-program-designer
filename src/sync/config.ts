/**
 * Content repo coordinates.
 *
 * The APP repo (this code, served by Pages) and the CONTENT repo (the data)
 * are deliberately different repositories. Pushing app code never touches
 * content, and saving content never triggers a deploy.
 *
 * Fill these in once, then commit. They are not secrets — the private content
 * repo is unreadable without a token regardless of who knows its name.
 */
export const GITHUB_OWNER = 'kburkhart2026'
export const GITHUB_CONTENT_REPO = 'sdi-program-designer-content'
export const GITHUB_BRANCH = 'main'

export const GITHUB_API = 'https://api.github.com'

/** Program list + metadata. Small, rewritten on every publish. */
export const MANIFEST_PATH = 'manifest.json'

/** One file per program — the bulk. Sharding is what makes multi-editor safe. */
export function programPath(programId: string): string {
  return `programs/${programId}.json`
}

/** Encrypted key files, served from the APP repo next to index.html. */
export const EDITOR_KEY_FILE = 'editor-key.json'
export const VIEWER_KEY_FILE = 'viewer-key.json'

/** localStorage keys — this browser only, never transmitted. */
export const LS_EDITOR_TOKEN = 'sdi_pd_editor_token'
export const LS_VIEWER_TOKEN = 'sdi_pd_viewer_token'
/** Remembered so the key-file generator doesn't make you retype a PAT. */
export const LS_RAW_EDITOR_PAT = 'sdi_pd_raw_editor_pat'
export const LS_RAW_VIEWER_PAT = 'sdi_pd_raw_viewer_pat'

export function isConfigured(): boolean {
  return Boolean(GITHUB_OWNER && GITHUB_CONTENT_REPO)
}

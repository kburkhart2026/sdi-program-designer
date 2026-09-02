/**
 * Drag payload, held outside React.
 *
 * The spec requires the dragged id to live BOTH on the component instance and
 * in dataTransfer: Safari and Firefox will not expose dataTransfer contents
 * during `dragover` (only on `drop`), so the highlight logic cannot read it,
 * and some browsers drop custom MIME types entirely. This module is the
 * "component instance" half; text/plain is set as well for the drop handler.
 */
export const dragState: {
  lessonId: string | null
  /** Week index being reordered, or null when a lesson is being dragged. */
  weekIndex: number | null
} = {
  lessonId: null,
  weekIndex: null,
}

export function clearDrag(): void {
  dragState.lessonId = null
  dragState.weekIndex = null
}

/** Payload prefix that marks a week-reorder drag. */
export const WEEK_DRAG_PREFIX = 'week:'

/**
 * Phase 2.3: Modal root — dimmed background, blocks world input when open.
 * Contract for client: overlay id and behavior.
 */

export const MODAL_ROOT_ID = 'modal-root';

export interface ModalRootProps {
  /** Whether the modal overlay is visible and blocks input. */
  open: boolean;
}

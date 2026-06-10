import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/**
 * Modal — portal-based dialog rendered to document.body.
 *
 * Rendering to body escapes every ancestor stacking context (the framer
 * PageTransition transform, .main-content, etc.) so the dialog always sits
 * above the sidebar — fixing the modal-clipping bug. Handles ESC, click-outside,
 * scroll-lock, and a springy entrance.
 *
 *   {open && (
 *     <Modal onClose={() => setOpen(false)} size="lg">
 *       ...content (use .modal internals: <h2>, form, etc.)...
 *     </Modal>
 *   )}
 *
 * `bare` renders only the overlay (no .modal panel) for full-bleed viewers.
 */
const Modal = ({ onClose, children, size, panelClassName, bare = false, overlayClassName }) => {
    const reduce = useReducedMotion();

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    const panelClass = bare
        ? (panelClassName || '')
        : `modal ${size === 'lg' ? 'modal-lg' : ''} ${panelClassName || ''}`.trim();

    return createPortal(
        <AnimatePresence>
            <motion.div
                className={`modal-overlay ${overlayClassName || ''}`.trim()}
                onClick={onClose}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
            >
                <motion.div
                    className={panelClass}
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                >
                    {children}
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};

export default Modal;

"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  progress?: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Accessible dialog: focus moves in, Tab is trapped, Escape closes, focus returns (NFR-ACC-007). */
export function Modal({ open, onClose, title, description, children, footer, progress }: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const box = boxRef.current;
    const first = box?.querySelector<HTMLElement>(`.modal-body ${FOCUSABLE}`) ?? box?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !box) return;
      const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement || process.env.NODE_ENV === "test");
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === firstEl || !box.contains(active))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && (active === lastEl || !box.contains(active))) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      returnTo.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal">
      <div className="modal-bg" onClick={onClose} aria-hidden="true" />
      <div className="modal-box" ref={boxRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined}>
        <div className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descId}>{description}</p>}
          </div>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {progress}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

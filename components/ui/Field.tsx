"use client";
import { useId, type ReactNode } from "react";

export interface FieldControlProps {
  id: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export interface FieldProps {
  label: ReactNode;
  error?: string | null;
  help?: ReactNode;
  className?: string;
  id?: string;
  children: (props: FieldControlProps) => ReactNode;
}

/** Persistent label + help + error, all programmatically associated (NFR-ACC-006). */
export function Field({ label, error, help, className = "", id: given, children }: FieldProps) {
  const auto = useId();
  const id = given ?? `f${auto.replace(/:/g, "")}`;
  const helpId = help ? `${id}-help` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [errId, helpId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {help && (
        <span className="help" id={helpId}>
          {help}
        </span>
      )}
      {error && (
        <span className="err" id={errId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

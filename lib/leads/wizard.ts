// Pure state machine for the five-step advisor qualification form (FR-LEAD-001..006).
import { normalisePhone } from "@/lib/phone";
import { normaliseEmail } from "@/lib/email";

export const TOTAL_STEPS = 5;

export interface WizardAnswers {
  objective?: string;
  corridors: string[];
  budgetBand?: string;
  timeline?: string;
  residency?: string;
}

export interface WizardState {
  step: number; // 1..5 questions; 6 = done
  furthestStep: number;
  answers: WizardAnswers;
}

type SingleField = "objective" | "budgetBand" | "timeline" | "residency";

export type WizardAction =
  | { type: "select"; field: SingleField; value: string }
  | { type: "toggle"; field: "corridors"; value: string }
  | { type: "next" }
  | { type: "back" }
  | { type: "complete" }
  | { type: "reset" }
  | { type: "restore"; state: WizardState };

export function initialWizardState(): WizardState {
  return { step: 1, furthestStep: 1, answers: { corridors: [] } };
}

export function canContinue(s: WizardState): boolean {
  const a = s.answers;
  switch (s.step) {
    case 1:
      return Boolean(a.objective);
    case 2:
      return a.corridors.length > 0;
    case 3:
      return Boolean(a.budgetBand);
    case 4:
      return Boolean(a.timeline && a.residency);
    default:
      return true;
  }
}

/** The plain-English reason Continue is disabled, for assistive tech (FR-LEAD-002). */
export function blockedReason(s: WizardState): string | null {
  if (canContinue(s)) return null;
  return ["", "Choose what you are looking to do.", "Choose at least one location.", "Choose a budget range.", "Choose a timeline and where you are buying from."][s.step] ?? null;
}

function isValidState(x: unknown): x is WizardState {
  if (!x || typeof x !== "object") return false;
  const s = x as WizardState;
  return (
    Number.isInteger(s.step) &&
    s.step >= 1 &&
    s.step <= TOTAL_STEPS &&
    Number.isInteger(s.furthestStep) &&
    s.furthestStep >= 1 &&
    s.furthestStep <= TOTAL_STEPS &&
    !!s.answers &&
    Array.isArray(s.answers.corridors)
  );
}

export function wizardReducer(s: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "select":
      return { ...s, answers: { ...s.answers, [action.field]: action.value } };
    case "toggle": {
      const has = s.answers.corridors.includes(action.value);
      const corridors = has ? s.answers.corridors.filter((c) => c !== action.value) : [...s.answers.corridors, action.value];
      return { ...s, answers: { ...s.answers, corridors } };
    }
    case "next": {
      if (!canContinue(s) || s.step >= TOTAL_STEPS) return s;
      const step = s.step + 1;
      return { ...s, step, furthestStep: Math.max(s.furthestStep, step) };
    }
    case "back":
      return s.step > 1 ? { ...s, step: s.step - 1 } : s;
    case "complete":
      return { ...s, step: TOTAL_STEPS + 1 };
    case "reset":
      return initialWizardState();
    case "restore":
      return isValidState(action.state)
        ? { ...action.state, step: action.state.furthestStep, answers: { ...action.state.answers, corridors: [...action.state.answers.corridors] } }
        : s;
  }
}

export interface ContactFields {
  name: string;
  phone: string;
  email: string;
}

export type ContactCheck = { ok: true } | { ok: false; field: keyof ContactFields; message: string };

export function validateContactStep(c: ContactFields): ContactCheck {
  if (!c.name.trim()) return { ok: false, field: "name", message: "Enter your full name so the advisor knows who to ask for." };
  const phone = c.phone.trim();
  const email = c.email.trim();
  if (!phone && !email) return { ok: false, field: "phone", message: "Add a phone number or an email address so we can reach you." };
  if (phone && !normalisePhone(phone)) {
    return { ok: false, field: "phone", message: "That phone number looks incomplete. Include the full number, e.g. 0803 992 1140." };
  }
  if (email && !normaliseEmail(email)) return { ok: false, field: "email", message: "That email address doesn't look right. Check for a missing @ or domain." };
  return { ok: true };
}

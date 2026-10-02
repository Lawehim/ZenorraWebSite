import {
  initialWizardState,
  wizardReducer,
  canContinue,
  validateContactStep,
  TOTAL_STEPS,
  type WizardState,
} from "@/lib/leads/wizard";

function run(actions: Parameters<typeof wizardReducer>[1][], start: WizardState = initialWizardState()) {
  return actions.reduce(wizardReducer, start);
}

describe("advisor wizard state (FR-LEAD-001..006, TC-LEAD-002..006)", () => {
  it("has five question steps", () => {
    expect(TOTAL_STEPS).toBe(5);
    expect(initialWizardState().step).toBe(1);
  });

  it("blocks Continue until the step's mandatory answer is given", () => {
    const s = initialWizardState();
    expect(canContinue(s)).toBe(false);
    const s2 = wizardReducer(s, { type: "select", field: "objective", value: "Buy land to hold" });
    expect(canContinue(s2)).toBe(true);
  });

  it("does not advance when Continue is not allowed", () => {
    expect(wizardReducer(initialWizardState(), { type: "next" }).step).toBe(1);
  });

  it("supports multi-select on corridors and toggles off", () => {
    const s = run([
      { type: "select", field: "objective", value: "Buy land to hold" },
      { type: "next" },
      { type: "toggle", field: "corridors", value: "Epe" },
      { type: "toggle", field: "corridors", value: "Abuja" },
      { type: "toggle", field: "corridors", value: "Ogun" },
      { type: "toggle", field: "corridors", value: "Abuja" },
    ]);
    expect(s.answers.corridors).toEqual(["Epe", "Ogun"]);
    expect(canContinue(s)).toBe(true);
  });

  it("step 4 requires both timeline and residency", () => {
    let s = run([
      { type: "select", field: "objective", value: "x" },
      { type: "next" },
      { type: "toggle", field: "corridors", value: "Epe" },
      { type: "next" },
      { type: "select", field: "budgetBand", value: "Under ₦5m" },
      { type: "next" },
      { type: "select", field: "timeline", value: "1–3 months" },
    ]);
    expect(s.step).toBe(4);
    expect(canContinue(s)).toBe(false);
    s = wizardReducer(s, { type: "select", field: "residency", value: "Diaspora" });
    expect(canContinue(s)).toBe(true);
  });

  it("going back preserves answers (TC-LEAD-004)", () => {
    const s = run([
      { type: "select", field: "objective", value: "Buy to rent out" },
      { type: "next" },
      { type: "toggle", field: "corridors", value: "Epe" },
      { type: "next" },
      { type: "back" },
      { type: "back" },
    ]);
    expect(s.step).toBe(1);
    expect(s.answers.objective).toBe("Buy to rent out");
    expect(s.answers.corridors).toEqual(["Epe"]);
    expect(s.furthestStep).toBe(3);
  });

  it("restore resumes at the furthest step reached (FR-LEAD-006)", () => {
    const saved = run([
      { type: "select", field: "objective", value: "x" },
      { type: "next" },
      { type: "toggle", field: "corridors", value: "Epe" },
      { type: "next" },
      { type: "back" },
    ]);
    const restored = wizardReducer(initialWizardState(), { type: "restore", state: saved });
    expect(restored.step).toBe(3);
    expect(restored.answers.corridors).toEqual(["Epe"]);
  });

  it("restore ignores malformed saved state", () => {
    const restored = wizardReducer(initialWizardState(), { type: "restore", state: { step: 99 } as unknown as WizardState });
    expect(restored).toEqual(initialWizardState());
  });
});

describe("validateContactStep (FR-LEAD-003, TC-LEAD-005)", () => {
  it("requires a name", () => {
    expect(validateContactStep({ name: " ", phone: "08039921140", email: "" })).toEqual({
      ok: false,
      field: "name",
      message: "Enter your full name so the advisor knows who to ask for.",
    });
  });
  it("requires at least one of phone or email, focusing phone", () => {
    expect(validateContactStep({ name: "Ada", phone: "", email: "" })).toEqual({
      ok: false,
      field: "phone",
      message: "Add a phone number or an email address so we can reach you.",
    });
  });
  it("rejects an invalid phone with a specific message", () => {
    expect(validateContactStep({ name: "Ada", phone: "12345", email: "" })).toEqual({
      ok: false,
      field: "phone",
      message: "That phone number looks incomplete. Include the full number, e.g. 0803 992 1140.",
    });
  });
  it("rejects an invalid email", () => {
    expect(validateContactStep({ name: "Ada", phone: "", email: "ada@" })).toMatchObject({ ok: false, field: "email" });
  });
  it("accepts name plus phone only, or name plus email only", () => {
    expect(validateContactStep({ name: "Ada", phone: "08039921140", email: "" })).toEqual({ ok: true });
    expect(validateContactStep({ name: "Ada", phone: "", email: "ada@x.ng" })).toEqual({ ok: true });
  });
});

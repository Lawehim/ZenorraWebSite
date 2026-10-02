import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/Button";
import { Placeholder } from "@/components/ui/Placeholder";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/StatusPill";
import { useState } from "react";

describe("Button", () => {
  it("renders a button with the variant class", () => {
    render(<Button variant="gold">Book</Button>);
    expect(screen.getByRole("button", { name: "Book" })).toHaveClass("btn", "btn-gold");
  });
  it("renders a link when given href", () => {
    render(
      <Button href="/properties" variant="line">
        View
      </Button>,
    );
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "/properties");
  });
  it("defaults to type=button so it never submits forms by accident", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("Placeholder image slot", () => {
  it("is announced as an image with the shot brief", () => {
    render(<Placeholder shot="Aerial drone shot" meta="4:3" seed={11} />);
    expect(screen.getByRole("img", { name: "Image placeholder: Aerial drone shot · 4:3" })).toBeInTheDocument();
  });
  it("is deterministic for the same seed", () => {
    const { container: a } = render(<Placeholder shot="x" seed={5} />);
    const { container: b } = render(<Placeholder shot="x" seed={5} />);
    expect(a.innerHTML).toBe(b.innerHTML);
  });
});

describe("Field (NFR-ACC-006)", () => {
  it("associates label, help and error with the control", () => {
    render(
      <Field label="Phone" error="Enter a full phone number" help="WhatsApp is fine">
        {(p) => <input {...p} className="inp" />}
      </Field>,
    );
    const input = screen.getByLabelText("Phone");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/Enter a full phone number/);
    expect(input).toHaveAccessibleDescription(/WhatsApp is fine/);
  });
});

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Book a site inspection" description="Free coach">
        <input aria-label="Name" />
        <button>Submit</button>
      </Modal>
    </>
  );
}

describe("Modal (NFR-ACC-007, TC-A11Y-003)", () => {
  it("opens as a labelled dialog and moves focus inside", async () => {
    render(<ModalHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog", { name: "Book a site inspection" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
  it("closes on Escape and returns focus to the trigger", async () => {
    render(<ModalHarness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    await userEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("traps Tab focus within the dialog", async () => {
    render(<ModalHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
  it("locks body scroll while open", async () => {
    render(<ModalHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.body.style.overflow).toBe("");
  });
});

describe("StatusPill", () => {
  it("shows a readable label, not colour alone (TC-A11Y-008)", () => {
    render(<StatusPill status="BOOKED_INSPECTION" />);
    expect(screen.getByText("Booked inspection")).toBeInTheDocument();
  });
});

import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "@/components/layout/Header";
import { BookingForm } from "@/components/forms/BookingForm";
import { ContactForm } from "@/components/forms/ContactForm";
import { getBlockDef } from "@/lib/content/registry";

jest.mock("next/navigation", () => ({ usePathname: () => "/properties", useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));

describe("Header (FR-GLOB-001/003)", () => {
  it("marks the current section", () => {
    render(<Header ctaLabel="Talk to an Advisor" />);
    expect(screen.getAllByRole("link", { name: "Properties" })[0]).toHaveAttribute("aria-current", "page");
  });
  it("opens the mobile menu, closes on Escape, locks scroll and returns focus", async () => {
    render(<Header ctaLabel="Talk to an Advisor" />);
    const burger = screen.getByRole("button", { name: "Open menu" });
    await userEvent.click(burger);
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(burger).toHaveFocus();
  });
});

const bookingCopy = getBlockDef("site.booking")!.defaults as never;

describe("BookingForm (FR-LEAD-008, TC-LEAD-015)", () => {
  const props = {
    copy: bookingCopy,
    properties: [
      { slug: "heritage-gardens", name: "Heritage Gardens" },
      { slug: "solara-ridge", name: "Solara Ridge" },
    ],
    departurePoints: ["7:30 AM — Surulere head office"],
    dates: ["2026-10-03", "2026-10-07"],
  };

  it("pre-selects the property it was opened from", () => {
    render(<BookingForm {...props} initialProperty="solara-ridge" onSubmit={jest.fn()} />);
    expect(screen.getByLabelText("Estate to inspect")).toHaveValue("solara-ridge");
  });
  it("only offers the operating inspection days", () => {
    render(<BookingForm {...props} onSubmit={jest.fn()} />);
    const options = Array.from((screen.getByLabelText("Inspection date") as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual(["2026-10-03", "2026-10-07"]);
  });
  it("requires name and a valid phone before submitting", async () => {
    const onSubmit = jest.fn();
    render(<BookingForm {...props} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Reserve my seat" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Enter your full name.")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveFocus();
  });
  it("submits and shows the booking reference", async () => {
    const onSubmit = jest.fn().mockResolvedValue({ ok: true, reference: "BK-2026-00042" });
    render(<BookingForm {...props} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Full name"), "Chidi Anyanwu");
    await userEvent.type(screen.getByLabelText("Phone / WhatsApp"), "0803 992 1140");
    await userEvent.click(screen.getByRole("button", { name: "Reserve my seat" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Chidi Anyanwu", seats: 1, date: "2026-10-03" }));
    expect(await screen.findByText(/BK-2026-00042/)).toBeInTheDocument();
  });
});

describe("ContactForm (FR-LEAD-009, TC-EDGE-017)", () => {
  it("shows a live character counter and caps the message", async () => {
    render(<ContactForm copy={getBlockDef("contact.form")!.defaults as never} />);
    await userEvent.type(screen.getByLabelText("Your message"), "Hello");
    expect(screen.getByText("5 / 2000")).toBeInTheDocument();
  });
  it("offers the enquiry types that route to the right team", () => {
    render(<ContactForm copy={getBlockDef("contact.form")!.defaults as never} />);
    const opts = Array.from((screen.getByLabelText("What is this about?") as HTMLSelectElement).options).map((o) => o.textContent);
    expect(opts).toEqual(expect.arrayContaining(["Buying property", "Solar energy enquiry"]));
  });
});

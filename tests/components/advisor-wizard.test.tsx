import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvisorWizard } from "@/components/forms/AdvisorWizard";
import { getBlockDef } from "@/lib/content/registry";

const copy = getBlockDef("site.advisor")!.defaults as never;

function setup(submit = jest.fn().mockResolvedValue({ ok: true, reference: "ZN-2026-04812", firstName: "Adaeze" })) {
  sessionStorage.clear();
  const utils = render(<AdvisorWizard copy={copy} corridors={["Ibeju-Lekki", "Epe", "Ogun", "Abuja"]} onSubmit={submit} />);
  return { ...utils, submit, user: userEvent.setup() };
}

async function answerAll(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Buy land to hold/ }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Epe" }));
  await user.click(screen.getByRole("button", { name: "Ogun" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: /Under ₦5m/ }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "1–3 months" }));
  await user.click(screen.getByRole("button", { name: /diaspora/i }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

describe("AdvisorWizard (FR-LEAD-001..006, TC-LEAD-001..006, TC-LEAD-024)", () => {
  it("disables Continue with aria-disabled and an explanation until answered", async () => {
    const { user } = setup();
    const next = screen.getByRole("button", { name: "Continue" });
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(next).toHaveAccessibleDescription("Choose what you are looking to do.");
    await user.click(next);
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Buy land to hold/ }));
    expect(next).toHaveAttribute("aria-disabled", "false");
  });

  it("announces progress to screen readers", async () => {
    const { user } = setup();
    expect(screen.getByText("Step 1 of 5")).toHaveAttribute("aria-live", "polite");
    await user.click(screen.getByRole("button", { name: /Buy land to hold/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
  });

  it("keeps answers when going back (TC-LEAD-004)", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Buy to rent out/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: /Buy to rent out/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("blocks submission without phone or email and focuses the phone field (TC-LEAD-005)", async () => {
    const { user, submit } = setup();
    await answerAll(user);
    await user.type(screen.getByLabelText("Full name"), "Adaeze Okonkwo");
    await user.click(screen.getByRole("button", { name: "Send to an advisor" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Phone / WhatsApp")).toHaveFocus();
    expect(screen.getByText("Add a phone number or an email address so we can reach you.")).toBeInTheDocument();
  });

  it("submits the full brief and shows the reference (TC-LEAD-001)", async () => {
    const { user, submit } = setup();
    await answerAll(user);
    await user.type(screen.getByLabelText("Full name"), "Adaeze Okonkwo");
    await user.type(screen.getByLabelText("Phone / WhatsApp"), "+44 7700 900 812");
    await user.click(screen.getByRole("button", { name: "Send to an advisor" }));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "advisor",
        objective: "Buy land to hold",
        corridors: ["Epe", "Ogun"],
        budgetBand: "Under ₦5m",
        timeline: "1–3 months",
        name: "Adaeze Okonkwo",
        phone: "+44 7700 900 812",
        marketingConsent: false,
      }),
    );
    expect(await screen.findByText(/ZN-2026-04812/)).toBeInTheDocument();
  });

  it("keeps the answers and offers a retry when the network fails (TC-LEAD-007)", async () => {
    const submit = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true, reference: "ZN-2026-00001", firstName: "Ada" });
    const { user } = setup(submit);
    await answerAll(user);
    await user.type(screen.getByLabelText("Full name"), "Ada");
    await user.type(screen.getByLabelText("Phone / WhatsApp"), "08039921140");
    await user.click(screen.getByRole("button", { name: "Send to an advisor" }));
    expect(await screen.findByText(/couldn't send your brief/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("Ada");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/ZN-2026-00001/)).toBeInTheDocument();
  });

  it("restores progress from the session after closing and reopening (TC-LEAD-006)", async () => {
    const { user, unmount } = setup();
    await user.click(screen.getByRole("button", { name: /Buy land to hold/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Epe" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    unmount();
    render(<AdvisorWizard copy={copy} corridors={["Epe"]} onSubmit={jest.fn()} />);
    expect(screen.getByText("Step 3 of 5")).toBeInTheDocument();
  });

  it("leaves the marketing consent box unticked by default (FR-LEAD-013)", async () => {
    const { user } = setup();
    await answerAll(user);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });
});

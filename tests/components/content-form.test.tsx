import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContentBlockForm } from "@/components/admin/ContentBlockForm";
import { getBlockDef } from "@/lib/content/registry";

describe("ContentBlockForm — admin edits any section's copy (FR-ADM-048)", () => {
  it("renders a labelled control for every field in the block", () => {
    const def = getBlockDef("home.hero")!;
    render(<ContentBlockForm def={def} value={def.defaults} onSave={jest.fn()} />);
    expect(screen.getByLabelText("Headline")).toHaveValue("Invest smart. Build wealth.");
    expect(screen.getByLabelText("Supporting text")).toBeInTheDocument();
    expect(screen.getByLabelText("Headline (gold line)")).toBeInTheDocument();
  });

  it("saves edited values", async () => {
    const def = getBlockDef("home.hero")!;
    const onSave = jest.fn().mockResolvedValue({ ok: true });
    render(<ContentBlockForm def={def} value={def.defaults} onSave={onSave} />);
    const headline = screen.getByLabelText("Headline");
    await userEvent.clear(headline);
    await userEvent.type(headline, "Own land you have verified");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ headline: "Own land you have verified" }));
    expect(await screen.findByText("Saved. The live site updates within a minute.")).toBeInTheDocument();
  });

  it("adds, edits and removes entries in a repeatable list", async () => {
    const def = getBlockDef("home.why")!;
    const onSave = jest.fn().mockResolvedValue({ ok: true });
    render(<ContentBlockForm def={def} value={def.defaults} onSave={onSave} />);
    const group = screen.getByRole("group", { name: "Reasons" });
    expect(within(group).getAllByRole("group")).toHaveLength(4);
    await userEvent.click(within(group).getByRole("button", { name: "Add reason" }));
    expect(within(group).getAllByRole("group")).toHaveLength(5);
    await userEvent.click(within(group).getAllByRole("button", { name: /Remove/ })[4]);
    expect(within(group).getAllByRole("group")).toHaveLength(4);
  });

  it("shows server-side field errors next to the field", async () => {
    const def = getBlockDef("home.hero")!;
    const onSave = jest.fn().mockResolvedValue({ ok: false, errors: { headline: "Headline is required." } });
    render(<ContentBlockForm def={def} value={def.defaults} onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Headline is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Headline")).toHaveAttribute("aria-invalid", "true");
  });

  it("edits simple string lists one entry per line", async () => {
    const def = getBlockDef("home.trustStrip")!;
    const onSave = jest.fn().mockResolvedValue({ ok: true });
    render(<ContentBlockForm def={def} value={{ items: ["A", "B"] }} onSave={onSave} />);
    const box = screen.getByLabelText("Claims");
    await userEvent.clear(box);
    await userEvent.type(box, "One{enter}Two{enter}{enter}Three");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSave).toHaveBeenCalledWith({ items: ["One", "Two", "Three"] });
  });
});

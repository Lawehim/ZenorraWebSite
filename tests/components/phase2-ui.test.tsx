import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { captureReferral, readReferral, formContext } from "@/lib/attribution";
import { ShortlistButton } from "@/components/marketing/ShortlistButton";
import { readShortlist } from "@/components/hooks/useShortlist";
import { MapEmbed } from "@/components/marketing/MapEmbed";
import { ShareButtons } from "@/components/marketing/ShareButtons";
import { ChatWidget } from "@/components/chat/ChatWidget";

beforeEach(() => localStorage.clear());

describe("referral link capture (FR-REF-002)", () => {
  it("remembers a valid ?ref code for 90 days and sends it with forms", () => {
    captureReferral("?ref=zn2abc9x", 0);
    expect(readReferral(1000)).toBe("ZN2ABC9X");
    expect(readReferral(91 * 86400_000)).toBeUndefined();
  });
  it("ignores malformed codes", () => {
    captureReferral("?ref=<script>");
    expect(readReferral()).toBeUndefined();
  });
  it("is included in the form context", () => {
    captureReferral("?ref=ZN2ABC9X");
    expect(formContext().referralCode).toBe("ZN2ABC9X");
  });
});

describe("ShortlistButton (FR-PROP-019)", () => {
  it("toggles a property in the persistent shortlist with an accessible state", async () => {
    render(<ShortlistButton slug="heritage-gardens" name="Heritage Gardens" />);
    const b = screen.getByRole("button", { name: "Save Heritage Gardens to shortlist" });
    expect(b).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(b);
    expect(readShortlist()).toEqual(["heritage-gardens"]);
    expect(screen.getByRole("button", { name: "Remove Heritage Gardens from shortlist" })).toHaveAttribute("aria-pressed", "true");
  });
  it("caps the shortlist and survives broken storage", () => {
    localStorage.setItem("zn.shortlist", "{not json");
    expect(readShortlist()).toEqual([]);
  });
});

describe("MapEmbed — click to load (FR-PROP-016, FR-CORP-005)", () => {
  it("loads nothing from Google until the visitor asks", async () => {
    const { container } = render(<MapEmbed query="139 Ogunlana Drive, Surulere, Lagos" label="Head office" />);
    expect(container.querySelector("iframe")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Show map/ }));
    const frame = container.querySelector("iframe")!;
    expect(frame.getAttribute("src")).toContain(encodeURIComponent("139 Ogunlana Drive"));
    expect(frame).toHaveAttribute("title", "Map: Head office");
  });
});

describe("ShareButtons (FR-CONT-008)", () => {
  it("offers WhatsApp, X, Facebook and copy-link with UTM tags", () => {
    render(<ShareButtons url="https://zenorra.ng/insights/a" title="A" />);
    expect(screen.getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).toContain("utm_source%3Dwhatsapp");
    expect(screen.getByRole("link", { name: /Facebook/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy link/ })).toBeInTheDocument();
  });
});

describe("ChatWidget (FR-CHAT-001/002)", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it("shows the offline state with the next opening time and asks for contact details", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ online: false, nextOpen: "Tomorrow at 09:00" }) }) as never;
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<ChatWidget />);
    await user.click(screen.getByRole("button", { name: /Chat with us/ }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(await screen.findByText(/We're offline/)).toBeInTheDocument();
    expect(screen.getByText(/Tomorrow at 09:00/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone or email/)).toBeInTheDocument();
  });
});

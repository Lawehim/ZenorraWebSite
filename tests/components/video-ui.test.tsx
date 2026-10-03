import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroVideo } from "@/components/marketing/HeroVideo";
import { TestimonialCarousel } from "@/components/marketing/TestimonialCarousel";

const SRC = "/media/video/2026/10/site-walk-ab12cd.mp4";

function env({ wide, saveData = false, reducedMotion = false }: { wide: boolean; saveData?: boolean; reducedMotion?: boolean }) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (q: string) => ({ matches: q.includes("min-width") ? wide : q.includes("reduce") ? reducedMotion : false, media: q, addEventListener() {}, removeEventListener() {} }),
  });
  Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData } });
}

describe("HeroVideo (FR-HOME-002, TC-EDGE-027)", () => {
  it("plays a muted, looping, inline video on wide screens", () => {
    env({ wide: true });
    const { container } = render(<HeroVideo src={SRC} />);
    const v = container.querySelector("video")!;
    expect(v).toBeTruthy();
    expect(v.muted).toBe(true);
    expect(v.loop).toBe(true);
    expect(v.getAttribute("playsinline")).not.toBeNull();
    expect(v.getAttribute("poster")).toBe("/media/video/2026/10/site-walk-ab12cd-poster.jpg");
    expect(v.getAttribute("aria-hidden")).toBe("true");
  });
  it("is suppressed on narrow screens, with data saver on, or when reduced motion is preferred", () => {
    for (const e of [{ wide: false }, { wide: true, saveData: true }, { wide: true, reducedMotion: true }]) {
      env(e);
      const { container, unmount } = render(<HeroVideo src={SRC} />);
      expect(container.querySelector("video")).toBeNull();
      unmount();
    }
  });
  it("ignores anything that isn't an uploaded video", () => {
    env({ wide: true });
    const { container } = render(<HeroVideo src="https://evil.example/x.mp4" />);
    expect(container.querySelector("video")).toBeNull();
  });
});

describe("uploaded video testimonials (FR-HOME-012)", () => {
  it("shows a poster-first player that only loads when the visitor presses play", async () => {
    env({ wide: true });
    render(<TestimonialCarousel items={[{ id: "t1", name: "Kemi Adeyemi", roleText: "Buyer, Epe", quote: "Smooth from start to finish.", initials: "KA", videoUrl: SRC }]} />);
    expect(document.querySelector("video")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /watch kemi/i }));
    const v = document.querySelector("video")!;
    expect(v.getAttribute("src")).toBe(SRC);
    expect(v.getAttribute("poster")).toBe("/media/video/2026/10/site-walk-ab12cd-poster.jpg");
    expect(v.controls).toBe(true);
  });
});

import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropertyCard, type PropertyCardData } from "@/components/marketing/PropertyCard";
import { PropertyFilters } from "@/components/marketing/PropertyFilters";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { TestimonialCarousel } from "@/components/marketing/TestimonialCarousel";
import { StatCounter } from "@/components/marketing/StatCounter";

const property: PropertyCardData = {
  slug: "heritage-gardens",
  reference: "ZNR-001",
  name: "Heritage Gardens",
  locationText: "Eleko, Ibeju-Lekki, Lagos",
  priceNaira: "4800000",
  priceUnit: "per 500sqm plot",
  depositPercent: 30,
  planMonths: 24,
  sizeText: "500 sqm",
  titleLabel: "Certificate of Occupancy",
  availability: "AVAILABLE",
  badges: ["C of O", "Dry land"],
  image: null,
  heroBrief: "Aerial drone shot",
  status: "PUBLISHED",
};

describe("PropertyCard (FR-PROP-001, US-BUY-02)", () => {
  it("shows name, location, size, title, plan, price, monthly instalment and reference without a gate", () => {
    render(<PropertyCard property={property} />);
    const card = screen.getByRole("link", { name: /Heritage Gardens/ });
    expect(card).toHaveAttribute("href", "/properties/heritage-gardens");
    expect(within(card).getByText("Eleko, Ibeju-Lekki, Lagos")).toBeInTheDocument();
    expect(within(card).getByText("500 sqm")).toBeInTheDocument();
    expect(within(card).getByText("Certificate of Occupancy")).toBeInTheDocument();
    expect(within(card).getByText("24 months")).toBeInTheDocument();
    expect(within(card).getByText("₦4,800,000")).toBeInTheDocument();
    expect(within(card).getByText(/₦140,000\/month/)).toBeInTheDocument();
    expect(within(card).getByText("ZNR-001")).toBeInTheDocument();
    expect(within(card).getByText("Available")).toBeInTheDocument();
  });
  it("shows a sold-out badge", () => {
    render(<PropertyCard property={{ ...property, availability: "SOLD_OUT", status: "SOLD_OUT" }} />);
    expect(screen.getByText("Sold out")).toBeInTheDocument();
  });
  it("omits empty specification fields instead of rendering blanks (TC-PROP-009)", () => {
    render(<PropertyCard property={{ ...property, sizeText: null }} />);
    expect(screen.queryByText("Plot size")).not.toBeInTheDocument();
  });
  it("renders a placeholder when there is no image (TC-EDGE-004)", () => {
    render(<PropertyCard property={property} />);
    expect(screen.getByRole("img", { name: /Image placeholder: Aerial drone shot/ })).toBeInTheDocument();
  });
});

describe("PropertyFilters (FR-PROP-002/005)", () => {
  it("renders crawlable links that carry filter state in the URL", () => {
    render(<PropertyFilters filters={{ sort: "curated" }} total={8} shown={8} />);
    expect(screen.getByRole("link", { name: "Epe" })).toHaveAttribute("href", "/properties?corridor=Epe");
    expect(screen.getByRole("link", { name: "Under ₦5m" })).toHaveAttribute("href", "/properties?budget=under-5m");
  });
  it("marks the active filter and combines with others", () => {
    render(<PropertyFilters filters={{ corridor: "Epe", sort: "curated" }} total={8} shown={1} />);
    expect(screen.getByRole("link", { name: "Epe" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Under ₦5m" })).toHaveAttribute("href", "/properties?corridor=Epe&budget=under-5m");
    expect(screen.getByRole("link", { name: "All locations" })).toHaveAttribute("href", "/properties");
  });
  it("announces the result count", () => {
    render(<PropertyFilters filters={{ sort: "curated" }} total={8} shown={3} />);
    expect(screen.getByText("3 of 8 shown")).toHaveAttribute("aria-live", "polite");
  });
});

describe("ArticleCard", () => {
  it("links to the article and shows category and reading time", () => {
    render(<ArticleCard post={{ slug: "avoid-land-scams", title: "How to avoid land scams", excerpt: "Seven checks", category: "Buyer protection", readingMinutes: 8, image: null }} />);
    const link = screen.getByRole("link", { name: /How to avoid land scams/ });
    expect(link).toHaveAttribute("href", "/insights/avoid-land-scams");
    expect(within(link).getByText("8 min read")).toBeInTheDocument();
    expect(within(link).getByText("Buyer protection")).toBeInTheDocument();
  });
  it("renders with no excerpt and no cover (TC-EDGE-006)", () => {
    render(<ArticleCard post={{ slug: "x", title: "Bare", excerpt: null, category: null, readingMinutes: null, image: null }} />);
    expect(screen.getByRole("link", { name: /Bare/ })).toBeInTheDocument();
  });
});

describe("TestimonialCarousel (FR-HOME-011)", () => {
  const items = [
    { id: "1", name: "Adaeze Okonkwo", roleText: "Bought 2 plots", quote: "First quote", initials: "AO" },
    { id: "2", name: "Tunde Bakare", roleText: "Bought 6 plots", quote: "Second quote", initials: "TB" },
  ];
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("advances every 7 seconds", () => {
    render(<TestimonialCarousel items={items} />);
    expect(screen.getByRole("button", { name: "Show testimonial 1 of 2" })).toHaveAttribute("aria-current", "true");
    act(() => jest.advanceTimersByTime(7000));
    expect(screen.getByRole("button", { name: "Show testimonial 2 of 2" })).toHaveAttribute("aria-current", "true");
  });
  it("can be paused and navigated by keyboard", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<TestimonialCarousel items={items} />);
    await user.click(screen.getByRole("button", { name: /Pause/ }));
    act(() => jest.advanceTimersByTime(14000));
    expect(screen.getByRole("button", { name: "Show testimonial 1 of 2" })).toHaveAttribute("aria-current", "true");
    await user.click(screen.getByRole("button", { name: "Show testimonial 2 of 2" }));
    expect(screen.getByRole("button", { name: "Show testimonial 2 of 2" })).toHaveAttribute("aria-current", "true");
  });
  it("hides inactive slides from assistive tech", () => {
    render(<TestimonialCarousel items={items} />);
    expect(screen.getByText("Second quote").closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("StatCounter (FR-HOME-003)", () => {
  it("renders the final value immediately under reduced motion", () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    render(<StatCounter value={1400} suffix="+" label="Plots allocated" />);
    expect(screen.getByText("1,400+")).toBeInTheDocument();
  });
});

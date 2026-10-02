import Link from "next/link";
import type { Availability, PropertyStatus } from "@prisma/client";
import { formatNaira, monthlyInstalment } from "@/lib/format";
import { SiteImage, type ImageSource } from "@/components/ui/SiteImage";
import { Icon } from "@/components/ui/Icon";
import { ShortlistButton } from "./ShortlistButton";

export interface PropertyCardData {
  slug: string;
  reference: string;
  name: string;
  locationText: string;
  priceNaira: string; // serialised bigint
  priceUnit: string | null;
  depositPercent: number;
  planMonths: number;
  sizeText: string | null;
  titleLabel: string | null;
  availability: Availability;
  status: PropertyStatus;
  badges: string[];
  image: ImageSource | null;
  heroBrief: string | null;
}

export interface PropertyCardProps {
  property: PropertyCardData;
}

export function AvailabilityTag({ availability, status }: Pick<PropertyCardData, "availability" | "status">) {
  if (status === "SOLD_OUT" || availability === "SOLD_OUT") return <span className="tag muted">Sold out</span>;
  if (availability === "SELLING_FAST") return <span className="tag hot">Selling fast</span>;
  return <span className="tag ok">Available</span>;
}

export function PropertyCard({ property: p }: PropertyCardProps) {
  const price = BigInt(p.priceNaira);
  const monthly = p.planMonths > 1 ? monthlyInstalment(price, p.depositPercent, p.planMonths) : null;
  return (
    <div className="plot-wrap rv">
    <Link className="plot" href={`/properties/${p.slug}`} data-testid="property-card">
      <div className="plot-art">
        <SiteImage image={p.image} brief={p.heroBrief || "Aerial photograph of the estate"} meta="4:3 · 1200×900 min" sizes="(max-width: 700px) 100vw, 400px" />
        <div className="plot-tags">
          <AvailabilityTag availability={p.availability} status={p.status} />
          {p.badges[0] && <span className="tag">{p.badges[0]}</span>}
        </div>
        <div className="plot-ref">{p.reference}</div>
      </div>
      <div className="plot-body">
        <h3>{p.name}</h3>
        <div className="plot-loc">
          <Icon name="pin" width={12} height={12} />
          <span>{p.locationText}</span>
        </div>
        <div className="plot-meta">
          {p.sizeText && (
            <div>
              Plot size<b>{p.sizeText}</b>
            </div>
          )}
          {p.titleLabel && (
            <div>
              Title<b>{p.titleLabel}</b>
            </div>
          )}
          {p.planMonths > 0 && (
            <div>
              Plan<b>{p.planMonths} months</b>
            </div>
          )}
        </div>
        <div className="plot-foot">
          <div className="price">
            {p.priceUnit && <small>{p.priceUnit}</small>}
            {formatNaira(price)}
            {monthly && (
              <div className="price-sub mono">
                or {formatNaira(monthly)}/month after {p.depositPercent}% deposit
              </div>
            )}
          </div>
          <span className="btn btn-line btn-sm" aria-hidden="true">
            View
          </span>
        </div>
      </div>
    </Link>
    <ShortlistButton slug={p.slug} name={p.name} />
    </div>
  );
}

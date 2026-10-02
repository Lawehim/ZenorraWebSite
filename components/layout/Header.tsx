"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSite } from "./SiteProvider";

export const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Properties", href: "/properties" },
  { label: "Services", href: "/services" },
  { label: "About", href: "/about" },
  { label: "Insights", href: "/insights" },
  { label: "Contact", href: "/contact" },
];

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function Header({ ctaLabel }: { ctaLabel: string }) {
  const pathname = usePathname();
  const { openAdvisor } = useSite();
  const [solid, setSolid] = useState(false);
  const [menu, setMenu] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => setMenu(false), [pathname]);

  // FR-GLOB-003: Escape closes, focus trapped, body scroll locked.
  useEffect(() => {
    if (!menu) return;
    document.body.style.overflow = "hidden";
    const box = menuRef.current;
    box?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
      if (e.key === "Tab" && box) {
        const items = Array.from(box.querySelectorAll<HTMLElement>("a,button"));
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      burgerRef.current?.focus();
    };
  }, [menu]);

  return (
    <>
      <header className={`nav${solid ? " solid" : ""}`}>
        <div className="wrap">
          <Link className="brand" href="/" aria-label="Zenorra home">
            <img className="mk" src="/brand/mark.webp" alt="" width={26} height={30} />
            <img className="wm" src="/brand/wordmark.webp" alt="Zenorra" width={110} height={15} />
          </Link>
          <nav className="navlinks" aria-label="Main">
            {NAV_ITEMS.map((n) => (
              <Link key={n.href} className="navlink" href={n.href} aria-current={isCurrent(pathname, n.href) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <button type="button" className="btn btn-gold btn-sm navcta" onClick={() => openAdvisor()}>
            {ctaLabel}
          </button>
          <button ref={burgerRef} type="button" className="burger" aria-label="Open menu" aria-expanded={menu} aria-controls="mobmenu" onClick={() => setMenu(true)}>
            <i />
          </button>
        </div>
      </header>
      {menu && (
        <div className="mobmenu" id="mobmenu" ref={menuRef} role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="close" aria-label="Close menu" onClick={() => setMenu(false)}>
            ×
          </button>
          {NAV_ITEMS.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isCurrent(pathname, n.href) ? "page" : undefined} onClick={() => setMenu(false)}>
              {n.label}
            </Link>
          ))}
          <button
            type="button"
            className="btn btn-gold"
            style={{ marginTop: "1.4rem" }}
            onClick={() => {
              setMenu(false);
              openAdvisor();
            }}
          >
            {ctaLabel}
          </button>
        </div>
      )}
    </>
  );
}

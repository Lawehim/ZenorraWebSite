"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { can, type Capability } from "@/lib/rbac";
import { Icon } from "@/components/ui/Icon";

const GROUPS: { title: string; items: { href: string; label: string; icon: string; cap: Capability }[] }[] = [
  { title: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: "dash", cap: "dashboard.view" }] },
  {
    title: "Website",
    items: [
      { href: "/admin/content", label: "Site content", icon: "content", cap: "content.edit" },
      { href: "/admin/posts", label: "Insights / blog", icon: "posts", cap: "posts.edit" },
      { href: "/admin/properties", label: "Properties", icon: "home", cap: "properties.edit" },
      { href: "/admin/media", label: "Media library", icon: "media", cap: "media.upload" },
      { href: "/admin/testimonials", label: "Testimonials", icon: "quote", cap: "testimonials.manage" },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/admin/leads", label: "Leads inbox", icon: "leads", cap: "leads.view" },
      { href: "/admin/inspections", label: "Inspections", icon: "calendar", cap: "inspections.manage" },
      { href: "/admin/subscribers", label: "Subscribers", icon: "bell", cap: "leads.export" },
    ],
  },
  {
    title: "Governance",
    items: [
      { href: "/admin/settings", label: "Settings", icon: "settings", cap: "settings.edit" },
      { href: "/admin/users", label: "Users & roles", icon: "users", cap: "users.manage" },
      { href: "/admin/audit", label: "Audit log", icon: "audit", cap: "audit.view" },
      { href: "/admin/notifications", label: "Notifications", icon: "bell", cap: "audit.view" },
      { href: "/admin/account", label: "My account", icon: "person", cap: "dashboard.view" },
    ],
  },
];

export function AdminNav({ role, unreadLeads }: { role: Role; unreadLeads: number }) {
  const pathname = usePathname();
  return (
    <nav className="adm-side" aria-label="Admin">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => can(role, i.cap));
        if (!items.length) return null;
        return (
          <div key={g.title} style={{ display: "contents" }}>
            <h2>{g.title}</h2>
            {items.map((i) => {
              const current = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
              return (
                <Link key={i.href} href={i.href} className="adm-nav" aria-current={current ? "page" : undefined}>
                  <Icon name={i.icon} />
                  {i.label}
                  {i.href === "/admin/leads" && unreadLeads > 0 && (
                    <span className="badge" aria-label={`${unreadLeads} unread`}>
                      {unreadLeads}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

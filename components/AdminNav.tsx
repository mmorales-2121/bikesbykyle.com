import Link from "next/link";

const TABS = [
  { href: "/admin", label: "Bookings" },
  { href: "/admin/schedule", label: "Time off" },
  { href: "/admin/promos", label: "Promo codes" },
  { href: "/admin/metrics", label: "Metrics" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/account", label: "Account" },
];

export default function AdminNav({ active }: { active: string }) {
  return (
    <nav className="tabs" aria-label="Owner dashboard">
      {TABS.map((t) => <Link key={t.href} href={t.href} className={active === t.href ? "on" : ""} aria-current={active === t.href ? "page" : undefined}>{t.label}</Link>)}
    </nav>
  );
}

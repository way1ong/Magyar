"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", icon: "☀️", label: "Сьогодні" },
  { href: "/review", icon: "🃏", label: "Картки" },
  { href: "/harmony", icon: "🎵", label: "Гармонія" },
  { href: "/settings", icon: "⚙️", label: "Ще" },
];

export function Tabs() {
  const path = usePathname();
  return (
    <nav className="tabs">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={path === t.href ? "active" : ""}>
          <span>{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

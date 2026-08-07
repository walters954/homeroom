"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function RailLink({
  href,
  label,
  glyph,
}: {
  href: string;
  label: string;
  glyph: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`grid h-[31px] w-[31px] place-items-center rounded-[7px] text-[13px] ${
        active ? "bg-acc-soft text-acc" : "text-dim hover:bg-soft"
      }`}
    >
      {glyph}
    </Link>
  );
}

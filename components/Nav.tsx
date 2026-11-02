import Link from "next/link";

const LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/mirror", label: "Ask the mirror" },
  { href: "/skin", label: "My skin" },
];

export default function Nav({ overlay = false, active }: { overlay?: boolean; active?: string }) {
  return (
    <header className={overlay ? "nav overlay" : "nav"}>
      <Link href="/" className="logo">YouMirror</Link>
      <nav>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={l.href === active ? "on" : ""}>{l.label}</Link>
        ))}
      </nav>
    </header>
  );
}

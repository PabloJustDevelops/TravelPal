import Link from "next/link";
export default function AccountTabs({
  active,
}: {
  active: "profile" | "settings";
}) {
  return (
    <nav aria-label="Cuenta" className="flex gap-2 border-b border-line">
      {[
        { id: "profile", title: "Perfil" },
        { id: "settings", title: "Ajustes" },
      ].map((item) => (
        <Link
          key={item.id}
          href={`/${item.id}`}
          aria-current={active === item.id ? "page" : undefined}
          className={`inline-flex min-h-12 items-center border-b-2 px-4 text-sm font-medium ${active === item.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}
        >
          {item.title}
        </Link>
      ))}
    </nav>
  );
}

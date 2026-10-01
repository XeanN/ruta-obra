import Link from "next/link";

const ENLACES = [
  { href: "/diagnostico", texto: "Diagnóstico" },
  { href: "/expedientes", texto: "Expedientes" },
  { href: "/fuentes", texto: "Fuentes" },
];

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          RutaObra
        </Link>
        <nav aria-label="Principal">
          <ul className="flex items-center gap-4 text-sm">
            {ENLACES.map((e) => (
              <li key={e.href}>
                <Link href={e.href} className="text-muted-foreground hover:text-foreground">
                  {e.texto}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

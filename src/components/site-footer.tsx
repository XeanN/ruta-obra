import Link from "next/link";

const ENLACES = [
  { href: "/fuentes", texto: "Cómo sabemos esto" },
  { href: "/privacidad", texto: "Privacidad" },
  { href: "/demo", texto: "Demo" },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>RutaObra · Prototipo de Aliiatech. Información referencial, no es asesoría legal.</p>
        <nav aria-label="Pie de página">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {ENLACES.map((e) => (
              <li key={e.href}>
                <Link href={e.href} className="hover:text-foreground underline-offset-2 hover:underline">
                  {e.texto}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

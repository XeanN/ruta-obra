import { ExternalLink } from "lucide-react";
import type { Fuente } from "@/domain/types";
import { formatFecha } from "@/lib/format";

export function FuentesLinks({ fuentes }: { fuentes: readonly Fuente[] }) {
  if (fuentes.length === 0) return null;
  return (
    <div className="text-muted-foreground text-xs">
      <span className="font-medium">{fuentes.length === 1 ? "Fuente" : "Fuentes"}:</span>
      <ul className="mt-1 space-y-1">
        {fuentes.map((f) => (
          <li key={f.id}>
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground inline-flex items-start gap-1 underline underline-offset-2"
            >
              <span>{f.titulo}</span>
              <ExternalLink aria-hidden className="mt-0.5 size-3 shrink-0" />
              <span className="sr-only">(abre en otra pestaña)</span>
            </a>
            <span> · Revisado el {formatFecha(f.fecha_consulta)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

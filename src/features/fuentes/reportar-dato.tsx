import { Flag } from "lucide-react";
import { enlaceReporte, type DatoReportado } from "@/domain/reporte";
import { cn } from "@/lib/utils";

/** Página y distrito de la hoja de ruta: lo que comparten todos los reportes de una vista. */
export interface ContextoReporte {
  pagina: string;
  ubigeo: string | null;
}

/** Google Form "RutaObra: reportar un dato desactualizado", con los campos prellenados por entry.N. */
const FORMULARIO_REPORTE =
  "https://docs.google.com/forms/d/e/1FAIpQLScAQ1glvvTP5T9uVKRjT0otYlPOKhzXVdFp-WPrgn1-KW3iQw/viewform?usp=pp_url" +
  "&entry.855347379={procedimiento}&entry.719657125={ubigeo}&entry.935556082={variante}" +
  "&entry.1811344490={monto}&entry.1720681596={pagina}";

// Variables públicas: Next las incrusta en el bundle, así que sirven igual en servidor y cliente.
// Primero el formulario (NEXT_PUBLIC_REPORTE_URL lo reemplaza); el correo es el respaldo si se quita.
const destino = {
  formularioUrl: process.env.NEXT_PUBLIC_REPORTE_URL || FORMULARIO_REPORTE,
  correo: process.env.NEXT_PUBLIC_CORREO_REPORTE || "angel.xp.pb@gmail.com",
};

export function ReportarDato({
  dato,
  texto = "¿Este dato cambió? Repórtalo",
  className,
}: {
  dato: DatoReportado;
  texto?: string;
  className?: string;
}) {
  const href = enlaceReporte(dato, destino);
  const esCorreo = href.startsWith("mailto:");
  return (
    <a
      href={href}
      {...(esCorreo ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      className={cn(
        "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline underline-offset-2",
        className,
      )}
    >
      <Flag aria-hidden className="size-3 shrink-0" />
      {texto}
      {!esCorreo && <span className="sr-only">(abre en otra pestaña)</span>}
    </a>
  );
}

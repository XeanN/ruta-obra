import { Badge } from "@/components/ui/badge";
import { ETIQUETA_VERIFICACION } from "@/domain/diagnostico";
import { textoAntiguedad } from "@/domain/freshness";
import type { EstadoVerificacion } from "@/domain/types";
import { cn } from "@/lib/utils";

const ESTILO: Record<EstadoVerificacion, string> = {
  verificado: "bg-green-500/15 text-green-800 dark:text-green-300",
  fuente_secundaria: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  desactualizado: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
  por_verificar: "bg-red-500/15 text-red-800 dark:text-red-300",
};

export function EstadoVerificacionBadge({
  estado,
  antiguedadMeses = null,
  ocultarSiVerificado = false,
  className,
}: {
  estado: EstadoVerificacion;
  /** Si el estado se degradó por antigüedad, el umbral superado: se explica junto a la etiqueta. */
  antiguedadMeses?: number | null;
  /** En listas largas solo se marca lo que NO está verificado. */
  ocultarSiVerificado?: boolean;
  className?: string;
}) {
  if (ocultarSiVerificado && estado === "verificado") return null;
  const badge = (
    <Badge variant="outline" className={cn("border-transparent", ESTILO[estado], className)}>
      {ETIQUETA_VERIFICACION[estado]}
    </Badge>
  );
  if (antiguedadMeses === null) return badge;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {badge}
      <span className="text-muted-foreground text-xs font-normal">{textoAntiguedad(antiguedadMeses)}</span>
    </span>
  );
}

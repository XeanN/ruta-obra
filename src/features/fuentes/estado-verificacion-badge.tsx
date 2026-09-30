import { Badge } from "@/components/ui/badge";
import { ETIQUETA_VERIFICACION } from "@/domain/diagnostico";
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
  className,
}: {
  estado: EstadoVerificacion;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("border-transparent", ESTILO[estado], className)}>
      {ETIQUETA_VERIFICACION[estado]}
    </Badge>
  );
}

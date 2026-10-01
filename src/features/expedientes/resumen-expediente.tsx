import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ETIQUETA_ESTADO_EXPEDIENTE, type EstadoExpediente, type ResumenExpediente } from "@/domain/expediente";
import type { Procedimiento } from "@/domain/types";
import { cn } from "@/lib/utils";

const ESTILO_ESTADO: Record<EstadoExpediente, string> = {
  en_curso: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  con_alertas: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
  terminado: "bg-green-500/15 text-green-800 dark:text-green-300",
};

export function EstadoExpedienteBadge({ estado }: { estado: EstadoExpediente }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", ESTILO_ESTADO[estado])}>
      {ETIQUETA_ESTADO_EXPEDIENTE[estado]}
    </Badge>
  );
}

export function AvanceExpediente({
  resumen,
  procedimientos,
}: {
  resumen: ResumenExpediente;
  procedimientos: ReadonlyMap<string, Procedimiento>;
}) {
  const { avance, etapaActual, proximoPaso } = resumen;
  return (
    <div className="space-y-2 text-sm">
      <Progress value={avance.porcentaje} aria-label="Avance del expediente">
        <span className="text-muted-foreground">
          {avance.cerrados} de {avance.total} trámites cerrados
        </span>
        <span className="ml-auto font-medium tabular-nums">{avance.porcentaje}%</span>
      </Progress>
      {etapaActual && (
        <p>
          <span className="text-muted-foreground">Etapa actual: </span>
          {etapaActual.nombre}
        </p>
      )}
      {proximoPaso && (
        <p>
          <span className="text-muted-foreground">Próximo paso: </span>
          {procedimientos.get(proximoPaso.procedimiento_id)?.nombre ?? proximoPaso.procedimiento_id}
        </p>
      )}
    </div>
  );
}

import { esAlertaConPlazo, type AlertaExpediente } from "@/domain/alerts";
import { ETIQUETA_NIVEL } from "@/domain/diagnostico";
import { formatFecha } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ESTILO_NIVEL } from "./estilos";

/** "Faltan 3 días hábiles", "Vence hoy", "Venció hace 2 días". */
export function textoPlazo(a: AlertaExpediente): string | null {
  if (a.dias === undefined) return null;
  const unidad = (n: number) => (a.habiles ? (n === 1 ? "día hábil" : "días hábiles") : n === 1 ? "día" : "días");
  if (a.dias > 0) return `Faltan ${a.dias} ${unidad(a.dias)} (hasta el ${formatFecha(a.fecha)})`;
  if (a.dias === 0) return `Vence hoy (${formatFecha(a.fecha)})`;
  return `Venció hace ${-a.dias} ${unidad(-a.dias)} (${formatFecha(a.fecha)})`;
}

export function AlertaItem({ alerta, compacta = false }: { alerta: AlertaExpediente; compacta?: boolean }) {
  const { icono: Icono, clase } = ESTILO_NIVEL[alerta.nivel];
  const plazo = textoPlazo(alerta);
  return (
    <li className={cn("flex gap-3 rounded-lg border", compacta ? "p-2" : "p-3", clase)}>
      <Icono aria-hidden className={cn("shrink-0", compacta ? "mt-0.5 size-4" : "mt-0.5 size-5")} />
      <div className="min-w-0 space-y-1">
        {!compacta && (
          <p className="text-xs font-semibold tracking-wide uppercase">
            Prioridad {ETIQUETA_NIVEL[alerta.nivel].toLowerCase()}
          </p>
        )}
        <p className={compacta ? "text-xs" : "text-sm"}>{alerta.mensaje}</p>
        {plazo && <p className={cn("font-medium", compacta ? "text-xs" : "text-sm")}>{plazo}</p>}
      </div>
    </li>
  );
}

export function ListaAlertas({ alertas }: { alertas: readonly AlertaExpediente[] }) {
  const conPlazo = alertas.filter(esAlertaConPlazo);
  const advertencias = alertas.filter((a) => !esAlertaConPlazo(a));
  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="alertas-plazos">
        <h2 id="alertas-plazos" className="font-semibold">
          Plazos y vencimientos
        </h2>
        {conPlazo.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nada por vencer. Anota la fecha de emisión de tus documentos en el checklist y las
            observaciones en la ruta para que te avisemos.
          </p>
        ) : (
          <ul className="space-y-3">
            {conPlazo.map((a) => (
              <AlertaItem key={a.id} alerta={a} />
            ))}
          </ul>
        )}
      </section>
      {advertencias.length > 0 && (
        <section className="space-y-3" aria-labelledby="alertas-diagnostico">
          <h2 id="alertas-diagnostico" className="font-semibold">
            Advertencias del diagnóstico
          </h2>
          <ul className="space-y-3">
            {advertencias.map((a) => (
              <AlertaItem key={a.id} alerta={a} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

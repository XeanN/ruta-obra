import { estadoDeCosto, type CostoPaso, type Rango } from "@/domain/roadmap";
import { EstadoVerificacionBadge } from "@/features/fuentes/estado-verificacion-badge";
import { FuentesLinks } from "@/features/fuentes/fuentes-links";
import { formatSoles, textoVariante } from "@/lib/format";

export function textoRango(r: Rango): string {
  return r.minimo === r.maximo
    ? formatSoles(r.minimo)
    : `${formatSoles(r.minimo)} – ${formatSoles(r.maximo)}`;
}

/** Texto corto del costo para la tarjeta cerrada. */
export function textoCosto(c: CostoPaso): string {
  switch (c.tipo) {
    case "tarifa_distrital":
      return c.rango ? textoRango(c.rango) : "Monto por confirmar";
    case "referencial":
      return c.clase === "gratuito" ? "Gratuito" : formatSoles(c.monto);
    case "formula":
      return "Según fórmula";
    case "honorarios_libres":
      return "Honorarios libres";
    case "consultar_tupa":
      return "Consultar TUPA";
  }
}

export function CostoBadge({ costo }: { costo: CostoPaso }) {
  const estado = estadoDeCosto(costo);
  return estado ? <EstadoVerificacionBadge estado={estado} ocultarSiVerificado /> : null;
}

export function CostoDetalle({ costo }: { costo: CostoPaso }) {
  switch (costo.tipo) {
    case "tarifa_distrital":
      return (
        <div className="space-y-2">
          <ul className="divide-y rounded-lg border">
            {costo.variantes.map((v) => (
              <li key={`${v.variante}-${v.codigo_tupa}`} className="space-y-1 px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span>
                    {textoVariante(v.variante)}
                    {v.codigo_tupa && (
                      <span className="text-muted-foreground"> · TUPA n.° {v.codigo_tupa}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 font-medium tabular-nums">
                    {v.monto !== null ? formatSoles(v.monto) : "Por confirmar"}
                    <EstadoVerificacionBadge estado={v.estado_verificacion} />
                  </span>
                </div>
                {v.nota && <p className="text-muted-foreground text-xs">{v.nota}</p>}
                <FuentesLinks fuentes={[v.fuente]} />
              </li>
            ))}
          </ul>
          {costo.variantes.length > 1 && costo.rango && costo.rango.minimo !== costo.rango.maximo && (
            <p className="text-muted-foreground text-xs">
              El monto depende de la variante que corresponda a tu obra.
            </p>
          )}
        </div>
      );
    case "referencial":
      return (
        <div className="space-y-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium tabular-nums">
              {costo.clase === "gratuito" ? "Gratuito" : formatSoles(costo.monto)}
            </span>
            <EstadoVerificacionBadge estado={costo.estado_verificacion} />
          </p>
          {costo.nota && <p className="text-muted-foreground text-xs">{costo.nota}</p>}
          <FuentesLinks fuentes={costo.fuentes} />
        </div>
      );
    case "formula":
      return (
        <div className="space-y-1">
          <p className="flex flex-wrap items-center gap-2">
            <span>{costo.formula}</span>
            <EstadoVerificacionBadge estado={costo.estado_verificacion} />
          </p>
          {costo.nota && <p className="text-muted-foreground text-xs">{costo.nota}</p>}
          <FuentesLinks fuentes={costo.fuentes} />
        </div>
      );
    case "honorarios_libres":
      return (
        <p>
          Honorarios libres{costo.nota ? `: ${costo.nota.charAt(0).toLowerCase()}${costo.nota.slice(1)}` : ""}.
          No hay un monto oficial.
        </p>
      );
    case "consultar_tupa":
      return (
        <div className="space-y-1">
          <p>Consulta el monto en el TUPA vigente de la entidad.</p>
          {costo.nota && <p className="text-muted-foreground text-xs">{costo.nota}</p>}
        </div>
      );
  }
}

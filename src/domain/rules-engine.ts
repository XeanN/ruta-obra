// Réplica de scripts/simulate.py (la especificación ejecutable). Cualquier cambio
// de semántica se hace primero en Python y luego aquí; el test de paridad lo exige.
import type {
  Condicion,
  Etapa,
  Modalidad,
  Procedimiento,
  Regla,
  Valor,
} from "./types";

/** Respuestas del diagnóstico; un campo ausente equivale a no respondido. */
export type RespuestasDiagnostico = Readonly<
  Record<string, Valor | undefined>
>;

export interface BaseReglas {
  reglas: readonly Regla[];
  procedimientos: readonly Procedimiento[];
  etapas: readonly Etapa[];
}

export interface PasoDiagnostico {
  procedimiento_id: string;
  opcional: boolean;
  regla_id: string;
  etapa_id: string;
  alternativas: string[];
}

export interface AlertaDiagnostico {
  id: string;
  nivel: "critica" | "alta" | "media" | "baja";
  mensaje: string;
}

export interface Diagnostico {
  modalidad: Modalidad | null;
  pasos: PasoDiagnostico[];
  alertas: AlertaDiagnostico[];
  programas: string[];
}

// En Python bool es subclase de int: True == 1 y isinstance(True, int).
function esNumeroPy(v: Valor): v is number | boolean {
  return typeof v === "number" || typeof v === "boolean";
}

function igualPy(a: Valor, b: Valor): boolean {
  if (esNumeroPy(a) && esNumeroPy(b)) return Number(a) === Number(b);
  return a === b;
}

const tiene = <K extends keyof Condicion>(cond: Condicion, k: K): boolean =>
  Object.hasOwn(cond, k);

export function cumple(cond: Condicion, r: RespuestasDiagnostico): boolean {
  if (tiene(cond, "todas")) return (cond.todas ?? []).every((c) => cumple(c, r));
  if (tiene(cond, "alguna")) return (cond.alguna ?? []).some((c) => cumple(c, r));

  const campo = cond.campo;
  if (campo === undefined) {
    throw new Error(`Condición sin campo: ${JSON.stringify(cond)}`);
  }
  const v = Object.hasOwn(r, campo) ? r[campo] : undefined;
  if (v === undefined || v === null) return cond.existe === false;

  if (tiene(cond, "igual")) return igualPy(v, cond.igual ?? null);
  if (tiene(cond, "distinto")) return !igualPy(v, cond.distinto ?? null);
  if (tiene(cond, "en")) return (cond.en ?? []).some((x) => igualPy(v, x));
  if (tiene(cond, "no_en")) return !(cond.no_en ?? []).some((x) => igualPy(v, x));
  if (cond.mayor !== undefined) return esNumeroPy(v) && Number(v) > cond.mayor;
  if (cond.menor_igual !== undefined) {
    return esNumeroPy(v) && Number(v) <= cond.menor_igual;
  }
  if (cond.existe !== undefined) return cond.existe === true;
  throw new Error(`Condición sin operador: ${JSON.stringify(cond)}`);
}

export function diagnosticar(
  respuestas: RespuestasDiagnostico,
  base: BaseReglas,
): Diagnostico {
  const procs = new Map(base.procedimientos.map((p) => [p.id, p]));
  const ordenEtapa = new Map(base.etapas.map((e) => [e.id, e.orden]));
  const r: Record<string, Valor | undefined> = { ...respuestas };

  let modalidad: Modalidad | null = null;
  const reglasModalidad = base.reglas
    .filter((x) => x.tipo === "modalidad")
    .sort((a, b) => a.orden - b.orden);
  for (const regla of reglasModalidad) {
    if (cumple(regla.si, r)) {
      modalidad = regla.resultado;
      break;
    }
  }
  r._modalidad = modalidad;

  const pasos: Omit<PasoDiagnostico, "etapa_id" | "alternativas">[] = [];
  const alternativas = new Map<string, string[]>();
  const alertas: AlertaDiagnostico[] = [];
  const programas: string[] = [];

  for (const regla of base.reglas) {
    if (!cumple(regla.si, r)) continue;
    switch (regla.tipo) {
      case "agregar_procedimientos": {
        for (const pid of regla.procedimientos) {
          if (!pasos.some((p) => p.procedimiento_id === pid)) {
            pasos.push({
              procedimiento_id: pid,
              opcional: regla.opcional ?? false,
              regla_id: regla.id,
            });
          }
        }
        const principal = regla.procedimientos[0];
        for (const alt of regla.alternativas ?? []) {
          if (principal === undefined) break;
          const lista = alternativas.get(principal) ?? [];
          lista.push(alt);
          alternativas.set(principal, lista);
        }
        break;
      }
      case "alerta":
        alertas.push({ id: regla.id, nivel: regla.nivel, mensaje: regla.mensaje });
        break;
      case "programa":
        programas.push(regla.programa_id);
        break;
      case "modalidad":
        break;
    }
  }

  const etapaDe = (pid: string): string => {
    const proc = procs.get(pid);
    if (!proc) throw new Error(`Procedimiento inexistente: ${pid}`);
    return proc.etapa_id;
  };
  const ordenDe = (pid: string): number => {
    const orden = ordenEtapa.get(etapaDe(pid));
    if (orden === undefined) throw new Error(`Etapa inexistente para ${pid}`);
    return orden;
  };

  // Array.prototype.sort es estable: conserva el orden de aparición dentro de cada etapa.
  const ordenados = [...pasos].sort(
    (a, b) => ordenDe(a.procedimiento_id) - ordenDe(b.procedimiento_id),
  );

  return {
    modalidad,
    pasos: ordenados.map((p) => ({
      ...p,
      etapa_id: etapaDe(p.procedimiento_id),
      alternativas: alternativas.get(p.procedimiento_id) ?? [],
    })),
    alertas,
    programas,
  };
}

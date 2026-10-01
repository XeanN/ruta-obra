"use client";

import { FolderOpen, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ImportacionInvalidaError,
  RepositorioNoDisponibleError,
  SesionRequeridaError,
} from "@/data/expediente-repo";
import { analizarExpediente, type BaseExpedientes } from "@/domain/analisis";
import { ETIQUETA_ESTADO_EXPEDIENTE, type EstadoExpediente } from "@/domain/expediente";
import { AlertaItem } from "@/features/alertas/lista-alertas";
import { claseSelect } from "@/features/checklist/checklist";
import { AlmacenamientoNoDisponible, Cargando, ErrorCarga, SesionVencida } from "./avisos";
import { AvisoAlmacenamiento } from "./aviso-almacenamiento";
import { ahoraISO, hoyLocal, useExpedienteRepo } from "./repo-context";
import { AvanceExpediente, EstadoExpedienteBadge } from "./resumen-expediente";
import { useExpedientes } from "./use-expedientes";

type Conflicto = { json: string; nombreExistente: string };

export function Tablero({ base }: { base: BaseExpedientes }) {
  const repo = useExpedienteRepo();
  const { carga, recargar } = useExpedientes();
  const [hoy] = useState(hoyLocal);
  const [filtroDistrito, setFiltroDistrito] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoExpediente>("todos");
  const [conflicto, setConflicto] = useState<Conflicto | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  const procedimientos = useMemo(() => new Map(base.procedimientos.map((p) => [p.id, p])), [base]);
  const nombreDistrito = (ubigeo: string) =>
    base.distritos.find((d) => d.ubigeo === ubigeo)?.nombre ?? "Otro distrito";

  const analizados = useMemo(
    () =>
      carga.estado === "listo"
        ? carga.registros
            .map((r) => analizarExpediente(r, base, hoy, ahoraISO()))
            .sort((a, b) =>
              (b.registro.expediente.actualizado_en ?? "").localeCompare(a.registro.expediente.actualizado_en ?? ""),
            )
        : [],
    [carga, base, hoy],
  );

  async function importar(json: string, modo?: "reemplazar" | "duplicar") {
    try {
      const r = await repo.importar(json, modo);
      if (r.estado === "conflicto") {
        setConflicto({ json, nombreExistente: r.nombreExistente });
        return;
      }
      setConflicto(null);
      toast.success("Expediente importado");
      recargar();
    } catch (e) {
      if (e instanceof ImportacionInvalidaError) toast.error("Ese archivo no es un respaldo de RutaObra.");
      else if (e instanceof SesionRequeridaError) toast.error("Tu sesión venció. Vuelve a ingresar.");
      else if (e instanceof RepositorioNoDisponibleError) toast.error("No se pudo guardar. Revisa tu conexión.");
      else toast.error("No se pudo importar el archivo.");
    }
  }

  if (carga.estado === "cargando") return <Cargando texto="Cargando expedientes…" />;
  if (carga.estado === "no_disponible") return <AlmacenamientoNoDisponible />;
  if (carga.estado === "sesion") return <SesionVencida volver="/expedientes" />;
  if (carga.estado === "error") return <ErrorCarga mensaje={carga.mensaje} />;

  const distritos = [...new Set(analizados.map((a) => a.registro.predio.ubigeo))];
  const visibles = analizados.filter(
    (a) =>
      (filtroDistrito === "todos" || a.registro.predio.ubigeo === filtroDistrito) &&
      (filtroEstado === "todos" || a.resumen.estado === filtroEstado),
  );

  return (
    <div className="space-y-6">
      <AvisoAlmacenamiento onCambio={recargar} />
      <div className="flex flex-wrap gap-2">
        <Link href="/diagnostico" className={buttonVariants({ size: "lg", className: "h-11" })}>
          <Plus data-icon="inline-start" />
          Nuevo expediente
        </Link>
        <Button variant="outline" size="lg" className="h-11" onClick={() => archivo.current?.click()}>
          <Upload data-icon="inline-start" />
          Importar respaldo
        </Button>
        <input
          ref={archivo}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Archivo de respaldo"
          onChange={async (ev) => {
            const f = ev.target.files?.[0];
            ev.target.value = "";
            if (f) await importar(await f.text());
          }}
        />
      </div>

      {carga.corruptos > 0 && (
        <p className="text-sm text-amber-800 dark:text-amber-300">
          {carga.corruptos} {carga.corruptos === 1 ? "expediente guardado no se pudo leer" : "expedientes guardados no se pudieron leer"} y
          no se muestran. No se borraron.
        </p>
      )}

      {analizados.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderOpen aria-hidden className="size-5" />
              Todavía no tienes expedientes
            </CardTitle>
            <CardDescription>
              Haz el diagnóstico de un predio y guárdalo como expediente para seguir sus trámites,
              documentos y vencimientos.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="filtro-distrito" className="text-xs font-medium">
                Distrito
              </label>
              <select
                id="filtro-distrito"
                className={claseSelect}
                value={filtroDistrito}
                onChange={(e) => setFiltroDistrito(e.target.value)}
              >
                <option value="todos">Todos</option>
                {distritos.map((u) => (
                  <option key={u} value={u}>
                    {nombreDistrito(u)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="filtro-estado" className="text-xs font-medium">
                Estado
              </label>
              <select
                id="filtro-estado"
                className={claseSelect}
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as "todos" | EstadoExpediente)}
              >
                <option value="todos">Todos</option>
                {Object.entries(ETIQUETA_ESTADO_EXPEDIENTE).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-muted-foreground text-sm" aria-live="polite">
            {visibles.length} de {analizados.length} expedientes
          </p>

          <ul className="space-y-3">
            {visibles.map(({ registro, resumen }) => (
              <li key={registro.expediente.id}>
                <Card className="relative">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">
                        <Link
                          href={`/expedientes/${registro.expediente.id}`}
                          className="after:absolute after:inset-0 hover:underline"
                        >
                          {registro.expediente.nombre}
                        </Link>
                      </CardTitle>
                      <EstadoExpedienteBadge estado={resumen.estado} />
                    </div>
                    <CardDescription>
                      {nombreDistrito(registro.predio.ubigeo)}
                      {resumen.modalidad ? ` · Modalidad ${resumen.modalidad}` : ""} · {registro.predio.direccion}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <AvanceExpediente resumen={resumen} procedimientos={procedimientos} />
                    {resumen.proximasAlertas.length > 0 && (
                      <ul className="space-y-2">
                        {resumen.proximasAlertas.map((a) => (
                          <AlertaItem key={a.id} alerta={a} compacta />
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={conflicto !== null} onOpenChange={(abierto) => !abierto && setConflicto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ese expediente ya existe</DialogTitle>
            <DialogDescription>
              Ya tienes «{conflicto?.nombreExistente}». Puedes reemplazarlo con el respaldo o
              guardar el respaldo como una copia.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancelar</DialogClose>
            <Button variant="outline" onClick={() => conflicto && importar(conflicto.json, "duplicar")}>
              Guardar como copia
            </Button>
            <Button onClick={() => conflicto && importar(conflicto.json, "reemplazar")}>Reemplazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { ArrowLeft, Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ConflictoVersionError,
  RepositorioNoDisponibleError,
  SesionRequeridaError,
} from "@/data/expediente-repo";
import { esAlertaConPlazo } from "@/domain/alerts";
import { analizarExpediente, type BaseExpedientes } from "@/domain/analisis";
import {
  actualizarDatos,
  actualizarDocumento,
  actualizarPaso,
  type CambiosDocumento,
  type CambiosPaso,
} from "@/domain/expediente";
import type { ExpedienteRegistro } from "@/domain/types";
import { ListaAlertas } from "@/features/alertas/lista-alertas";
import { Checklist } from "@/features/checklist/checklist";
import { LineaDeTiempo, ResumenTotales } from "@/features/hoja-de-ruta/hoja-de-ruta";
import { formatSoles } from "@/lib/format";
import { AlmacenamientoNoDisponible, Cargando, ErrorCarga, SesionVencida } from "./avisos";
import { FichaExpediente } from "./ficha-expediente";
import { EstadoPasoBadge, PasoEstadoForm } from "./paso-estado";
import { ahoraISO, hoyLocal, useExpedienteRepo, useModoAlmacenamiento } from "./repo-context";
import { AvanceExpediente, EstadoExpedienteBadge } from "./resumen-expediente";
import { useExpediente } from "./use-expedientes";

function descargar(nombreArchivo: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

const slug = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "expediente";

export function ExpedienteDetalle({ id, base }: { id: string; base: BaseExpedientes }) {
  const { carga, setCarga } = useExpediente(id);
  if (carga.estado === "cargando") return <Cargando texto="Cargando expediente…" />;
  if (carga.estado === "no_disponible") return <AlmacenamientoNoDisponible />;
  if (carga.estado === "sesion") return <SesionVencida volver={`/expedientes/${id}`} />;
  if (carga.estado === "error") return <ErrorCarga mensaje={carga.mensaje} />;
  if (!carga.registro) {
    return (
      <Card>
        <CardContent className="space-y-3 text-sm">
          <p>No encontramos este expediente en este navegador.</p>
          <Link href="/expedientes" className="underline underline-offset-2">
            Ver mis expedientes
          </Link>
        </CardContent>
      </Card>
    );
  }
  return (
    <Detalle
      registro={carga.registro}
      base={base}
      onCambio={(registro) => setCarga({ estado: "listo", registro })}
      onNoDisponible={() => setCarga({ estado: "no_disponible" })}
    />
  );
}

function Detalle({
  registro,
  base,
  onCambio,
  onNoDisponible,
}: {
  registro: ExpedienteRegistro;
  base: BaseExpedientes;
  onCambio: (r: ExpedienteRegistro) => void;
  onNoDisponible: () => void;
}) {
  const repo = useExpedienteRepo();
  const modo = useModoAlmacenamiento();
  const router = useRouter();
  const [hoy] = useState(hoyLocal);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  const procedimientos = useMemo(() => new Map(base.procedimientos.map((p) => [p.id, p])), [base]);
  const analisis = useMemo(() => analizarExpediente(registro, base, hoy, ahoraISO()), [registro, base, hoy]);
  const e = analisis.registro.expediente;
  const distrito = base.distritos.find((d) => d.ubigeo === analisis.registro.predio.ubigeo)?.nombre ?? "Otro distrito";

  async function guardar(nuevo: ExpedienteRegistro, mensaje?: string) {
    // Versión que se cargó: si otro miembro guardó después, el repositorio lo rechaza.
    const versionBase = registro.expediente.actualizado_en ?? "";
    onCambio(nuevo);
    try {
      await repo.actualizar(nuevo, { versionBase });
      if (mensaje) toast.success(mensaje);
    } catch (err) {
      onCambio(registro);
      if (err instanceof ConflictoVersionError) {
        toast.error("Otra persona de tu estudio cambió este expediente. Recarga para ver la última versión.", {
          action: { label: "Recargar", onClick: () => window.location.reload() },
          duration: 15_000,
        });
      } else if (err instanceof SesionRequeridaError) {
        toast.error("Tu sesión venció. Vuelve a ingresar.", {
          action: { label: "Ingresar", onClick: () => router.push(`/ingresar?volver=/expedientes/${registro.expediente.id}`) },
        });
      } else if (err instanceof RepositorioNoDisponibleError && modo === "invitado") {
        onNoDisponible();
      } else {
        toast.error("No se pudo guardar el cambio. Revisa tu conexión e inténtalo de nuevo.");
      }
    }
  }

  // Si el expediente se generó con otra versión de los datos, guarda la versión migrada.
  const { migrado, registro: migradoRegistro } = analisis;
  useEffect(() => {
    if (!migrado) return;
    repo.actualizar(migradoRegistro, { versionBase: registro.expediente.actualizado_en ?? "" }).then(
      () => {
        onCambio(migradoRegistro);
        toast.info("Actualizamos la ruta con la nueva versión de los datos.");
      },
      () => undefined,
    );
  }, [migrado, migradoRegistro, repo, onCambio, registro.expediente.actualizado_en]);

  const pasosPorId = new Map(e.pasos.map((p) => [p.procedimiento_id, p]));
  const enRuta = new Set(analisis.hoja.etapas.flatMap((et) => et.pasos.map((p) => p.procedimiento.id)));
  const fueraDeRuta = e.pasos.filter((p) => !enRuta.has(p.procedimiento_id));
  const pagado = e.pasos.reduce((s, p) => s + (p.monto_pagado ?? 0), 0);
  const alertasConPlazo = analisis.alertas.filter(esAlertaConPlazo).length;

  const cambiarPaso = (procedimientoId: string, cambios: CambiosPaso) =>
    guardar(actualizarPaso(analisis.registro, procedimientoId, cambios, hoy, ahoraISO()), "Seguimiento guardado");
  const cambiarDocumento = (documentoId: string, cambios: CambiosDocumento) =>
    guardar(actualizarDocumento(analisis.registro, documentoId, cambios, ahoraISO()));

  async function exportar() {
    try {
      descargar(`${slug(e.nombre)}.json`, await repo.exportar(e.id));
    } catch {
      toast.error("No se pudo exportar el expediente.");
    }
  }

  async function eliminar() {
    try {
      await repo.eliminar(e.id);
      toast.success("Expediente eliminado");
      router.push("/expedientes");
    } catch {
      toast.error("No se pudo eliminar el expediente.");
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/expedientes"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden className="size-4" /> Mis expedientes
      </Link>

      <header className="space-y-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">
            {distrito}
            {e.modalidad ? ` · Modalidad ${e.modalidad}` : ""} · {analisis.registro.predio.direccion}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{e.nombre}</h1>
            <EstadoExpedienteBadge estado={analisis.resumen.estado} />
          </div>
        </div>
        <AvanceExpediente resumen={analisis.resumen} procedimientos={procedimientos} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download data-icon="inline-start" />
            Exportar respaldo
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmarEliminar(true)}>
            <Trash2 data-icon="inline-start" />
            Eliminar
          </Button>
        </div>
      </header>

      <Tabs defaultValue="ruta">
        <TabsList className="w-full">
          <TabsTrigger value="ruta">Ruta</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="alertas">
            Alertas{alertasConPlazo > 0 ? ` (${alertasConPlazo})` : ""}
          </TabsTrigger>
          <TabsTrigger value="datos">Datos</TabsTrigger>
        </TabsList>

        <TabsContent value="ruta" className="space-y-6 pt-4">
          <ResumenTotales totales={analisis.hoja.totales} />
          {pagado > 0 && (
            <p className="text-sm">
              <span className="text-muted-foreground">Pagado hasta ahora: </span>
              <span className="font-medium tabular-nums">{formatSoles(pagado)}</span>
            </p>
          )}
          <LineaDeTiempo
            hoja={analisis.hoja}
            extras={(paso) => {
              const p = pasosPorId.get(paso.procedimiento.id);
              if (!p) return {};
              return {
                encabezado: <EstadoPasoBadge estado={p.estado} />,
                contenido: (
                  <PasoEstadoForm
                    key={JSON.stringify(p)}
                    paso={p}
                    onGuardar={(c) => cambiarPaso(p.procedimiento_id, c)}
                  />
                ),
              };
            }}
          />
          {fueraDeRuta.length > 0 && (
            <section className="space-y-2 text-sm">
              <h2 className="font-semibold">Trámites que ya no están en la ruta</h2>
              <p className="text-muted-foreground">
                Tenían avance cuando cambiaron los datos; se conservan como registro.
              </p>
              <ul className="space-y-1">
                {fueraDeRuta.map((p) => (
                  <li key={p.procedimiento_id} className="flex flex-wrap items-center gap-2">
                    {procedimientos.get(p.procedimiento_id)?.nombre ?? p.procedimiento_id}
                    <EstadoPasoBadge estado={p.estado} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </TabsContent>

        <TabsContent value="checklist" className="pt-4">
          <Checklist items={analisis.checklist} onCambiar={cambiarDocumento} />
        </TabsContent>

        <TabsContent value="alertas" className="pt-4">
          <ListaAlertas alertas={analisis.alertas} />
        </TabsContent>

        <TabsContent value="datos" className="pt-4">
          <FichaExpediente
            key={e.actualizado_en}
            distrito={distrito}
            textoGuardar="Guardar datos"
            generarId={() => crypto.randomUUID()}
            inicial={{ nombre: e.nombre, predio: analisis.registro.predio, actores: e.actores ?? [] }}
            onGuardar={(d) =>
              guardar(
                actualizarDatos(
                  analisis.registro,
                  { ...d, predio: { ...d.predio, ubigeo: analisis.registro.predio.ubigeo } },
                  ahoraISO(),
                ),
                "Datos guardados",
              )
            }
          />
        </TabsContent>
      </Tabs>

      <Dialog open={confirmarEliminar} onOpenChange={setConfirmarEliminar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar este expediente?</DialogTitle>
            <DialogDescription>
              Se borra de este navegador y no se puede deshacer. Si quieres conservarlo, exporta un
              respaldo antes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button variant="destructive" onClick={eliminar}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Implementación del repositorio sobre Postgres (Neon en producción, PGlite en los tests).
// Regla 8 de CLAUDE.md: TODA consulta filtra por el estudio de la sesión; un expediente de otro
// estudio se comporta como si no existiera.
import { and, asc, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { ExpedienteRegistroSchema } from "@/domain/schemas";
import type { ExpedienteRegistro } from "@/domain/types";
import * as schema from "./db/schema";
import {
  ConflictoVersionError,
  ExpedienteNoEncontradoError,
  ExpedienteYaExisteError,
  importarRespaldo,
  serializarRespaldo,
  type ExpedienteRepository,
} from "./expediente-repo";

export type BaseDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface ContextoDb {
  /** Estudio activo de la sesión. */
  estudioId: string;
  /** Usuario que crea (queda en creado_por). */
  usuarioId?: string;
  generarId: () => string;
  ahora: () => string;
}

/** Quita las claves con null o undefined (el dominio usa campos opcionales, no null). */
function sinNulos<T extends Record<string, unknown>>(o: T): { [K in keyof T]: Exclude<T[K], null> } {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as {
    [K in keyof T]: Exclude<T[K], null>;
  };
}

const conRelaciones = {
  predio: true,
  pasos: { orderBy: asc(schema.pasos.orden) },
  actores: { orderBy: asc(schema.actores.orden) },
  documentos: { orderBy: asc(schema.documentosCargados.orden) },
  bitacora: { orderBy: asc(schema.entradasBitacora.orden) },
} as const;

type FilaExpediente = NonNullable<
  Awaited<ReturnType<BaseDb["query"]["expedientes"]["findFirst"]>>
> & {
  predio: typeof schema.predios.$inferSelect;
  pasos: (typeof schema.pasos.$inferSelect)[];
  actores: (typeof schema.actores.$inferSelect)[];
  documentos: (typeof schema.documentosCargados.$inferSelect)[];
  bitacora: (typeof schema.entradasBitacora.$inferSelect)[];
};

function aRegistro(f: FilaExpediente): ExpedienteRegistro {
  const p = f.predio;
  const registro = {
    predio: sinNulos({
      id: p.id,
      ubigeo: p.ubigeo,
      direccion: p.direccion,
      partida_registral: p.partidaRegistral,
      area_terreno_m2: p.areaTerrenoM2,
      coordenadas: p.lat !== null || p.lng !== null ? sinNulos({ lat: p.lat, lng: p.lng }) : null,
      zonas_especiales: p.zonasEspeciales,
    }),
    expediente: {
      ...sinNulos({
        id: f.id,
        predio_id: f.predioId,
        nombre: f.nombre,
        respuestas_diagnostico: f.respuestasDiagnostico,
        version_datos: f.versionDatos,
        creado_en: f.creadoEn,
        actualizado_en: f.actualizadoEn,
      }),
      modalidad: f.modalidad,
      actores: f.actores.map((a) =>
        sinNulos({ id: a.id, rol: a.rol, nombre: a.nombre, telefono: a.telefono, email: a.email, colegiatura: a.colegiatura }),
      ),
      pasos: f.pasos.map((x) =>
        sinNulos({
          procedimiento_id: x.procedimientoId,
          etapa_id: x.etapaId,
          estado: x.estado,
          numero_expediente_entidad: x.numeroExpedienteEntidad,
          fecha_presentacion: x.fechaPresentacion,
          fecha_resultado: x.fechaResultado,
          fecha_observacion: x.fechaObservacion,
          monto_pagado: x.montoPagado,
          responsable_id: x.responsableId,
          notas: x.notas,
        }),
      ),
      documentos: f.documentos.map((d) =>
        sinNulos({
          id: d.id,
          documento_id: d.documentoId,
          estado: d.estado,
          fecha_emision: d.fechaEmision,
          fecha_vencimiento: d.fechaVencimiento,
          archivo_url: d.archivoUrl,
          notas: d.notas,
        }),
      ),
      bitacora: f.bitacora.map((b) =>
        sinNulos({
          id: b.id,
          fecha: b.fecha,
          tipo: b.tipo,
          descripcion: b.descripcion,
          monto: b.monto,
          avance_pct: b.avancePct,
          actor_id: b.actorId,
          fotos: b.fotos,
        }),
      ),
    },
  };
  // Valida lo leído: si la base tuviera algo fuera del esquema, falla aquí y no en la UI.
  return ExpedienteRegistroSchema.parse(registro);
}

type Tx = Parameters<Parameters<BaseDb["transaction"]>[0]>[0];

async function escribirHijos(tx: Tx, r: ExpedienteRegistro): Promise<void> {
  const e = r.expediente;
  if (e.pasos.length > 0) {
    await tx.insert(schema.pasos).values(
      e.pasos.map((p, orden) => ({
        expedienteId: e.id,
        orden,
        procedimientoId: p.procedimiento_id,
        etapaId: p.etapa_id,
        estado: p.estado,
        numeroExpedienteEntidad: p.numero_expediente_entidad ?? null,
        fechaPresentacion: p.fecha_presentacion ?? null,
        fechaResultado: p.fecha_resultado ?? null,
        fechaObservacion: p.fecha_observacion ?? null,
        montoPagado: p.monto_pagado ?? null,
        responsableId: p.responsable_id ?? null,
        notas: p.notas ?? null,
      })),
    );
  }
  const actores = e.actores ?? [];
  if (actores.length > 0) {
    await tx.insert(schema.actores).values(
      actores.map((a, orden) => ({
        expedienteId: e.id,
        id: a.id,
        orden,
        rol: a.rol,
        nombre: a.nombre,
        telefono: a.telefono ?? null,
        email: a.email ?? null,
        colegiatura: a.colegiatura ?? null,
      })),
    );
  }
  const documentos = e.documentos ?? [];
  if (documentos.length > 0) {
    await tx.insert(schema.documentosCargados).values(
      documentos.map((d, orden) => ({
        expedienteId: e.id,
        id: d.id,
        orden,
        documentoId: d.documento_id,
        estado: d.estado,
        fechaEmision: d.fecha_emision ?? null,
        fechaVencimiento: d.fecha_vencimiento ?? null,
        archivoUrl: d.archivo_url ?? null,
        notas: d.notas ?? null,
      })),
    );
  }
  const bitacora = e.bitacora ?? [];
  if (bitacora.length > 0) {
    await tx.insert(schema.entradasBitacora).values(
      bitacora.map((b, orden) => ({
        expedienteId: e.id,
        id: b.id,
        orden,
        fecha: b.fecha,
        tipo: b.tipo,
        descripcion: b.descripcion,
        monto: b.monto ?? null,
        avancePct: b.avance_pct ?? null,
        actorId: b.actor_id ?? null,
        fotos: b.fotos ?? null,
      })),
    );
  }
}

function datosPredio(r: ExpedienteRegistro) {
  const p = r.predio;
  return {
    ubigeo: p.ubigeo,
    direccion: p.direccion,
    partidaRegistral: p.partida_registral ?? null,
    areaTerrenoM2: p.area_terreno_m2 ?? null,
    lat: p.coordenadas?.lat ?? null,
    lng: p.coordenadas?.lng ?? null,
    zonasEspeciales: p.zonas_especiales ?? null,
  };
}

function filaExpediente(r: ExpedienteRegistro) {
  const e = r.expediente;
  return {
    nombre: e.nombre,
    respuestasDiagnostico: e.respuestas_diagnostico,
    modalidad: e.modalidad,
    versionDatos: e.version_datos ?? null,
    creadoEn: e.creado_en,
    actualizadoEn: e.actualizado_en ?? null,
  };
}

export function crearRepositorioDb(db: BaseDb, ctx: ContextoDb): ExpedienteRepository {
  const delEstudio = (id: string) =>
    and(eq(schema.expedientes.id, id), eq(schema.expedientes.estudioId, ctx.estudioId));

  const repo: ExpedienteRepository = {
    async listar() {
      const filas = await db.query.expedientes.findMany({
        where: eq(schema.expedientes.estudioId, ctx.estudioId),
        with: conRelaciones,
        orderBy: desc(schema.expedientes.registradoEn),
      });
      return { registros: filas.map((f) => aRegistro(f as FilaExpediente)), corruptos: 0 };
    },

    async obtener(id) {
      const f = await db.query.expedientes.findFirst({ where: delEstudio(id), with: conRelaciones });
      return f ? aRegistro(f as FilaExpediente) : null;
    },

    async crear(registro) {
      const r = ExpedienteRegistroSchema.parse(registro);
      await db.transaction(async (tx) => {
        // El id se busca en TODOS los estudios: los ids son globales.
        const ocupado = await tx
          .select({ id: schema.expedientes.id })
          .from(schema.expedientes)
          .where(eq(schema.expedientes.id, r.expediente.id))
          .limit(1);
        if (ocupado.length > 0) throw new ExpedienteYaExisteError(r.expediente.id);
        const predioOcupado = await tx
          .select({ id: schema.predios.id })
          .from(schema.predios)
          .where(eq(schema.predios.id, r.predio.id))
          .limit(1);
        if (predioOcupado.length > 0) throw new ExpedienteYaExisteError(r.expediente.id);

        await tx.insert(schema.predios).values({ id: r.predio.id, estudioId: ctx.estudioId, ...datosPredio(r) });
        await tx.insert(schema.expedientes).values({
          id: r.expediente.id,
          estudioId: ctx.estudioId,
          predioId: r.predio.id,
          creadoPor: ctx.usuarioId ?? null,
          ...filaExpediente(r),
        });
        await escribirHijos(tx, r);
      });
    },

    async actualizar(registro, opciones) {
      const r = ExpedienteRegistroSchema.parse(registro);
      await db.transaction(async (tx) => {
        const [actual] = await tx
          .select({ predioId: schema.expedientes.predioId, actualizadoEn: schema.expedientes.actualizadoEn })
          .from(schema.expedientes)
          .where(delEstudio(r.expediente.id))
          .for("update");
        if (!actual) throw new ExpedienteNoEncontradoError(r.expediente.id);
        if (opciones?.versionBase !== undefined && (actual.actualizadoEn ?? "") !== opciones.versionBase) {
          throw new ConflictoVersionError(r.expediente.id);
        }
        await tx
          .update(schema.predios)
          .set(datosPredio(r))
          .where(and(eq(schema.predios.id, actual.predioId), eq(schema.predios.estudioId, ctx.estudioId)));
        await tx.update(schema.expedientes).set(filaExpediente(r)).where(delEstudio(r.expediente.id));
        // Los hijos se reescriben completos: un expediente tiene decenas de filas, no miles.
        await tx.delete(schema.pasos).where(eq(schema.pasos.expedienteId, r.expediente.id));
        await tx.delete(schema.actores).where(eq(schema.actores.expedienteId, r.expediente.id));
        await tx.delete(schema.documentosCargados).where(eq(schema.documentosCargados.expedienteId, r.expediente.id));
        await tx.delete(schema.entradasBitacora).where(eq(schema.entradasBitacora.expedienteId, r.expediente.id));
        await escribirHijos(tx, r);
      });
    },

    async eliminar(id) {
      await db.transaction(async (tx) => {
        const [fila] = await tx
          .select({ predioId: schema.expedientes.predioId })
          .from(schema.expedientes)
          .where(delEstudio(id));
        if (!fila) throw new ExpedienteNoEncontradoError(id);
        await tx.delete(schema.expedientes).where(delEstudio(id));
        await tx
          .delete(schema.predios)
          .where(and(eq(schema.predios.id, fila.predioId), eq(schema.predios.estudioId, ctx.estudioId)));
      });
    },

    async exportar(id) {
      const registro = await repo.obtener(id);
      if (!registro) throw new ExpedienteNoEncontradoError(id);
      return serializarRespaldo(registro, ctx.ahora());
    },

    async importar(json, modo) {
      return importarRespaldo(repo, json, modo, ctx.generarId, ctx.ahora());
    },
  };
  return repo;
}

// Tablas de expedientes, mapeadas 1:1 a schema/expediente.schema.json.
// Fechas del dominio (yyyy-mm-dd) como `date` en modo texto y marcas de tiempo ISO como `text`,
// para que vuelvan exactamente iguales (el repositorio compara actualizado_en para detectar
// cambios concurrentes).
import { relations } from "drizzle-orm";
import {
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { Valor } from "@/domain/types";
import { organization, user } from "./auth-schema";

export const predios = pgTable(
  "predios",
  {
    id: text("id").primaryKey(),
    estudioId: text("estudio_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    ubigeo: text("ubigeo").notNull(),
    direccion: text("direccion").notNull(),
    partidaRegistral: text("partida_registral"),
    areaTerrenoM2: doublePrecision("area_terreno_m2"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    zonasEspeciales: jsonb("zonas_especiales").$type<string[]>(),
  },
  (t) => [index("predios_estudio_idx").on(t.estudioId)],
);

export const expedientes = pgTable(
  "expedientes",
  {
    id: text("id").primaryKey(),
    estudioId: text("estudio_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    predioId: text("predio_id")
      .notNull()
      .references(() => predios.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    respuestasDiagnostico: jsonb("respuestas_diagnostico").$type<Record<string, Valor>>().notNull(),
    modalidad: text("modalidad").$type<"A" | "B" | "C" | "D">(),
    versionDatos: text("version_datos"),
    creadoPor: text("creado_por").references(() => user.id, { onDelete: "set null" }),
    creadoEn: text("creado_en").notNull(),
    actualizadoEn: text("actualizado_en"),
    registradoEn: timestamp("registrado_en", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("expedientes_estudio_idx").on(t.estudioId)],
);

export const pasos = pgTable(
  "pasos",
  {
    expedienteId: text("expediente_id")
      .notNull()
      .references(() => expedientes.id, { onDelete: "cascade" }),
    orden: integer("orden").notNull(),
    procedimientoId: text("procedimiento_id").notNull(),
    etapaId: text("etapa_id").notNull(),
    estado: text("estado").notNull(),
    numeroExpedienteEntidad: text("numero_expediente_entidad"),
    fechaPresentacion: date("fecha_presentacion", { mode: "string" }),
    fechaResultado: date("fecha_resultado", { mode: "string" }),
    fechaObservacion: date("fecha_observacion", { mode: "string" }),
    montoPagado: doublePrecision("monto_pagado"),
    responsableId: text("responsable_id"),
    notas: text("notas"),
  },
  (t) => [primaryKey({ columns: [t.expedienteId, t.procedimientoId] })],
);

export const actores = pgTable(
  "actores",
  {
    expedienteId: text("expediente_id")
      .notNull()
      .references(() => expedientes.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    orden: integer("orden").notNull(),
    rol: text("rol").notNull(),
    nombre: text("nombre").notNull(),
    telefono: text("telefono"),
    email: text("email"),
    colegiatura: text("colegiatura"),
  },
  (t) => [primaryKey({ columns: [t.expedienteId, t.id] })],
);

export const documentosCargados = pgTable(
  "documentos_cargados",
  {
    expedienteId: text("expediente_id")
      .notNull()
      .references(() => expedientes.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    orden: integer("orden").notNull(),
    documentoId: text("documento_id").notNull(),
    estado: text("estado").notNull(),
    fechaEmision: date("fecha_emision", { mode: "string" }),
    fechaVencimiento: date("fecha_vencimiento", { mode: "string" }),
    archivoUrl: text("archivo_url"),
    notas: text("notas"),
  },
  (t) => [primaryKey({ columns: [t.expedienteId, t.id] })],
);

export const entradasBitacora = pgTable(
  "entradas_bitacora",
  {
    expedienteId: text("expediente_id")
      .notNull()
      .references(() => expedientes.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    orden: integer("orden").notNull(),
    fecha: date("fecha", { mode: "string" }).notNull(),
    tipo: text("tipo").notNull(),
    descripcion: text("descripcion").notNull(),
    monto: doublePrecision("monto"),
    avancePct: doublePrecision("avance_pct"),
    actorId: text("actor_id"),
    fotos: jsonb("fotos").$type<string[]>(),
  },
  (t) => [primaryKey({ columns: [t.expedienteId, t.id] })],
);

/** Archivos subidos a R2 (fotos de obra, documentos escaneados). La clave es privada. */
export const archivos = pgTable(
  "archivos",
  {
    id: text("id").primaryKey(),
    estudioId: text("estudio_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    expedienteId: text("expediente_id")
      .notNull()
      .references(() => expedientes.id, { onDelete: "cascade" }),
    clave: text("clave").notNull().unique(),
    nombre: text("nombre").notNull(),
    tipo: text("tipo").notNull(),
    tamano: integer("tamano").notNull(),
    creadoPor: text("creado_por").references(() => user.id, { onDelete: "set null" }),
    creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("archivos_expediente_idx").on(t.expedienteId)],
);

export const expedientesRelations = relations(expedientes, ({ one, many }) => ({
  predio: one(predios, { fields: [expedientes.predioId], references: [predios.id] }),
  pasos: many(pasos),
  actores: many(actores),
  documentos: many(documentosCargados),
  bitacora: many(entradasBitacora),
  archivos: many(archivos),
}));

export const pasosRelations = relations(pasos, ({ one }) => ({
  expediente: one(expedientes, { fields: [pasos.expedienteId], references: [expedientes.id] }),
}));
export const actoresRelations = relations(actores, ({ one }) => ({
  expediente: one(expedientes, { fields: [actores.expedienteId], references: [expedientes.id] }),
}));
export const documentosCargadosRelations = relations(documentosCargados, ({ one }) => ({
  expediente: one(expedientes, { fields: [documentosCargados.expedienteId], references: [expedientes.id] }),
}));
export const entradasBitacoraRelations = relations(entradasBitacora, ({ one }) => ({
  expediente: one(expedientes, { fields: [entradasBitacora.expedienteId], references: [expedientes.id] }),
}));
export const archivosRelations = relations(archivos, ({ one }) => ({
  expediente: one(expedientes, { fields: [archivos.expedienteId], references: [expedientes.id] }),
}));

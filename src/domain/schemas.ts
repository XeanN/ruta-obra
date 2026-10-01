import { z } from "zod";

// ---------------------------------------------------------------------------
// Base de conocimiento (data/*.json). Espejo de schema/data.schema.json.
// ---------------------------------------------------------------------------

export const EstadoVerificacionSchema = z.enum([
  "verificado",
  "fuente_secundaria",
  "desactualizado",
  "por_verificar",
]);

export const IdSchema = z.string().regex(/^[A-Z]{1,3}-[A-Za-z0-9_.-]+$/);
const IdsSchema = z.array(IdSchema);
const FechaSchema = z.iso.date();
const NivelSchema = z.enum(["critica", "alta", "media", "baja"]);
const ModalidadSchema = z.enum(["A", "B", "C", "D"]);

export const FuenteSchema = z.strictObject({
  id: IdSchema,
  titulo: z.string(),
  url: z.url(),
  tipo: z.enum(["norma", "oficial", "secundaria"]),
  fecha_consulta: FechaSchema,
});

export const NormaSchema = z.strictObject({
  id: IdSchema,
  nombre: z.string(),
  numero: z.string(),
  fuente_id: z.string().nullable().optional(),
  tema: z.string(),
});

export const InstitucionSchema = z.strictObject({
  id: IdSchema,
  nombre: z.string(),
  siglas: z.string(),
  nivel: z.enum([
    "nacional",
    "provincial",
    "distrital",
    "privado",
    "empresa_publica",
    "gremio",
  ]),
  rol: z.string(),
  web: z.string().nullable().optional(),
  canal: z.string().nullable().optional(),
});

export const EtapaSchema = z.strictObject({
  id: z.string().regex(/^E[0-9]+$/),
  orden: z.int(),
  nombre: z.string(),
  descripcion: z.string(),
  condicional: z.boolean(),
});

export const DocumentoSchema = z.strictObject({
  id: IdSchema,
  nombre: z.string(),
  emisor_id: z.string().nullable().optional(),
  vigencia_dias: z.int().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  estado_verificacion: EstadoVerificacionSchema,
});

export const CostoSchema = z.strictObject({
  tipo: z.enum([
    "fijo",
    "formula",
    "gratuito",
    "tupa_distrital",
    "honorarios_libres",
    "por_verificar",
  ]),
  monto: z.number().nullable().optional(),
  formula: z.string().nullable().optional(),
  nota: z.string().nullable().optional(),
});

export const ProcedimientoSchema = z.strictObject({
  id: IdSchema,
  etapa_id: z.string(),
  nombre: z.string(),
  institucion_id: z.string().nullable().optional(),
  descripcion: z.string(),
  calificacion: z
    .enum([
      "aprobacion_automatica",
      "evaluacion_previa",
      "evaluacion_registral",
      "servicio",
      "comunicacion",
      "fiscalizacion",
      "aporte",
      "obligacion",
    ])
    .nullable()
    .optional(),
  plazo_dias_habiles: z.int().nullable().optional(),
  plazo_nota: z.string().nullable().optional(),
  costo_referencial: CostoSchema,
  requisitos: IdsSchema.default([]),
  documentos_resultado: IdsSchema.default([]),
  profesionales: z.array(z.string()).default([]),
  depende_de: IdsSchema.default([]),
  normas: IdsSchema.default([]),
  fuentes: IdsSchema.default([]),
  estado_verificacion: EstadoVerificacionSchema,
});

export const TarifaSchema = z.strictObject({
  id: z.string(),
  ubigeo: z.string().regex(/^[0-9]{6}$/),
  procedimiento_id: z.string(),
  variante: z.string(),
  codigo_tupa: z.string().nullable().optional(),
  derecho_soles: z.number().nullable().optional(),
  plazo_dias_habiles: z.int().nullable().optional(),
  fuente_id: z.string(),
  estado_verificacion: EstadoVerificacionSchema,
  nota: z.string().nullable().optional(),
});

/** Valor que puede tener una respuesta del diagnóstico o una condición. */
export const ValorSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export type Valor = z.infer<typeof ValorSchema>;

export type Condicion = {
  campo?: string;
  igual?: Valor;
  distinto?: Valor;
  en?: Valor[];
  no_en?: Valor[];
  mayor?: number;
  menor_igual?: number;
  existe?: boolean;
  todas?: Condicion[];
  alguna?: Condicion[];
};

export const CondicionSchema: z.ZodType<Condicion> = z.lazy(() =>
  z.object({
    campo: z.string().optional(),
    igual: ValorSchema.optional(),
    distinto: ValorSchema.optional(),
    en: z.array(ValorSchema).optional(),
    no_en: z.array(ValorSchema).optional(),
    mayor: z.number().optional(),
    menor_igual: z.number().optional(),
    existe: z.boolean().optional(),
    todas: z.array(CondicionSchema).optional(),
    alguna: z.array(CondicionSchema).optional(),
  }),
);

const ReglaBase = {
  id: z.string(),
  si: CondicionSchema,
  orden: z.int().optional(),
  fuentes: IdsSchema.optional(),
  nota: z.string().optional(),
};

export const ReglaSchema = z.discriminatedUnion("tipo", [
  z.object({
    ...ReglaBase,
    tipo: z.literal("modalidad"),
    orden: z.int(),
    resultado: ModalidadSchema,
  }),
  z.object({
    ...ReglaBase,
    tipo: z.literal("agregar_procedimientos"),
    procedimientos: IdsSchema.min(1),
    alternativas: IdsSchema.optional(),
    opcional: z.boolean().optional(),
  }),
  z.object({
    ...ReglaBase,
    tipo: z.literal("alerta"),
    nivel: NivelSchema,
    mensaje: z.string(),
  }),
  z.object({
    ...ReglaBase,
    tipo: z.literal("programa"),
    programa_id: z.string(),
  }),
]);

// Archivos sin $def en data.schema.json: se modelan desde los datos y validate_data.py.

export const DistritoSchema = z.strictObject({
  ubigeo: z.string().regex(/^[0-9]{6}$/),
  nombre: z.string(),
  provincia: z.string(),
  institucion_local: z.string(),
  tupa: z.strictObject({
    norma_id: z.string().nullable().optional(),
    anio: z.int().nullable().optional(),
    estandarizado_ds146: z.boolean().nullable().optional(),
    fuente_id: z.string().nullable().optional(),
    nota: z.string().nullable().optional(),
  }),
  canal: z.string(),
  zonas_especiales: IdsSchema,
  estado_verificacion: EstadoVerificacionSchema,
});

export const ZonaEspecialSchema = z.strictObject({
  id: IdSchema,
  nombre: z.string(),
  tipo: z.string(),
  autoridad_id: z.string(),
  distritos: z.array(z.string()),
  procedimiento_requerido: z.string(),
  normas: IdsSchema,
  parametros: z.record(z.string(), z.string()),
  geometria: z.record(z.string(), z.unknown()).nullable(),
  fuentes: IdsSchema,
  estado_verificacion: EstadoVerificacionSchema,
});

export const ProgramaSchema = z.strictObject({
  id: IdSchema,
  nombre: z.string(),
  institucion_id: z.string().nullable(),
  activo: z.boolean(),
  beneficio: z.string(),
  requisitos: z.array(z.string()),
  requiere_etapas: z.array(z.string()),
  anio: z.int(),
  fuentes: IdsSchema,
  estado_verificacion: EstadoVerificacionSchema,
});

const MostrarSiSchema = z.union([
  z.strictObject({ pregunta: z.string(), igual: ValorSchema }),
  z.strictObject({ pregunta: z.string(), en: z.array(ValorSchema) }),
]);

const PreguntaBase = {
  id: z.string(),
  texto: z.string(),
  obligatoria: z.boolean(),
  mostrar_si: MostrarSiSchema.optional(),
};

export const PreguntaSchema = z.discriminatedUnion("tipo", [
  z.strictObject({
    ...PreguntaBase,
    tipo: z.literal("opcion"),
    opciones: z
      .array(z.strictObject({ valor: z.string(), etiqueta: z.string() }))
      .min(1),
  }),
  z.strictObject({
    ...PreguntaBase,
    tipo: z.literal("numero"),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
]);

export const VencimientoSchema = z.strictObject({
  id: IdSchema,
  documento_id: z.string().nullable(),
  vigencia_dias: z.int().optional(),
  vigencia_dias_habiles: z.int().optional(),
  alertar_dias_antes: z.array(z.int()),
  mensaje: z.string(),
  evento: z.string().optional(),
  fuente_id: z.string().optional(),
});

export const MetaSchema = z.strictObject({
  proyecto: z.string(),
  version_datos: z.string(),
  fecha_corte: FechaSchema,
  moneda: z.string(),
  uit: z.strictObject({ anio: z.int(), valor: z.number(), norma_id: z.string() }),
  alcance: z.string(),
  estados_verificacion: z.record(EstadoVerificacionSchema, z.string()),
  /** Umbrales de scripts/watch_sources.py (Fase 8). */
  vigilancia: z.strictObject({ dias_sin_revision: z.int().positive() }).optional(),
  aviso_legal: z.string(),
});

// ---------------------------------------------------------------------------
// Datos del usuario. Espejo de schema/expediente.schema.json.
// ---------------------------------------------------------------------------

const FechaHoraSchema = z.iso.datetime({ offset: true });

export const RespuestasSchema = z.record(z.string(), ValorSchema);

export const ActorSchema = z.object({
  id: z.string(),
  rol: z.enum([
    "propietario",
    "gestor",
    "arquitecto",
    "ingeniero_estructural",
    "ingeniero_sanitario",
    "ingeniero_electrico",
    "verificador",
    "notario",
    "maestro_obra",
    "obrero",
    "supervisor",
    "otro",
  ]),
  nombre: z.string(),
  telefono: z.string().optional(),
  email: z.string().optional(),
  colegiatura: z.string().optional(),
});

export const PredioSchema = z.object({
  id: z.string(),
  ubigeo: z.string(),
  direccion: z.string(),
  partida_registral: z.string().optional(),
  area_terreno_m2: z.number().optional(),
  coordenadas: z
    .object({ lat: z.number().optional(), lng: z.number().optional() })
    .optional(),
  zonas_especiales: z.array(z.string()).optional(),
});

export const EstadoPasoSchema = z.enum([
  "pendiente",
  "en_preparacion",
  "presentado",
  "observado",
  "subsanado",
  "aprobado",
  "denegado",
  "no_aplica",
]);

export const PasoSchema = z.object({
  procedimiento_id: z.string(),
  etapa_id: z.string(),
  estado: EstadoPasoSchema,
  numero_expediente_entidad: z.string().optional(),
  fecha_presentacion: FechaSchema.optional(),
  fecha_resultado: FechaSchema.optional(),
  fecha_observacion: FechaSchema.optional(),
  monto_pagado: z.number().optional(),
  responsable_id: z.string().optional(),
  notas: z.string().optional(),
});

export const DocumentoCargadoSchema = z.object({
  id: z.string(),
  documento_id: z.string(),
  estado: z.enum(["falta", "en_tramite", "obtenido", "vencido"]),
  fecha_emision: FechaSchema.optional(),
  fecha_vencimiento: FechaSchema.optional(),
  archivo_url: z.string().optional(),
  notas: z.string().optional(),
});

export const EntradaBitacoraSchema = z.object({
  id: z.string(),
  fecha: FechaSchema,
  tipo: z.enum([
    "avance",
    "compra",
    "pago",
    "visita_municipal",
    "reunion",
    "incidencia",
    "cambio_de_obra",
    "otro",
  ]),
  descripcion: z.string(),
  monto: z.number().optional(),
  avance_pct: z.number().min(0).max(100).optional(),
  actor_id: z.string().optional(),
  fotos: z.array(z.string()).optional(),
});

export const ExpedienteSchema = z.object({
  id: z.string(),
  predio_id: z.string(),
  nombre: z.string(),
  respuestas_diagnostico: RespuestasSchema,
  modalidad: ModalidadSchema.nullable(),
  version_datos: z.string().optional(),
  actores: z.array(ActorSchema).optional(),
  pasos: z.array(PasoSchema),
  documentos: z.array(DocumentoCargadoSchema).optional(),
  bitacora: z.array(EntradaBitacoraSchema).optional(),
  creado_en: FechaHoraSchema,
  actualizado_en: FechaHoraSchema.optional(),
});

/**
 * Unidad que guarda el repositorio y que se exporta como respaldo: el expediente con su predio.
 * En Postgres serían dos tablas (expedientes.predio_id → predios.id).
 */
export const ExpedienteRegistroSchema = z.object({
  expediente: ExpedienteSchema,
  predio: PredioSchema,
});

export const AlertaSchema = z.object({
  id: z.string(),
  expediente_id: z.string(),
  tipo: z.enum(["vencimiento", "plazo_subsanacion", "regla", "recordatorio"]),
  origen_id: z.string().optional(),
  fecha: FechaSchema,
  mensaje: z.string(),
  nivel: NivelSchema.optional(),
  leida: z.boolean().optional(),
});

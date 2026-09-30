import type { z } from "zod";
import type {
  ActorSchema,
  AlertaSchema,
  CostoSchema,
  DistritoSchema,
  DocumentoCargadoSchema,
  DocumentoSchema,
  EntradaBitacoraSchema,
  EstadoPasoSchema,
  EstadoVerificacionSchema,
  EtapaSchema,
  ExpedienteSchema,
  FuenteSchema,
  InstitucionSchema,
  MetaSchema,
  NormaSchema,
  PasoSchema,
  PredioSchema,
  PreguntaSchema,
  ProcedimientoSchema,
  ProgramaSchema,
  ReglaSchema,
  RespuestasSchema,
  TarifaSchema,
  VencimientoSchema,
  ZonaEspecialSchema,
} from "./schemas";

export type { Condicion, Valor } from "./schemas";

// Base de conocimiento
export type EstadoVerificacion = z.infer<typeof EstadoVerificacionSchema>;
export type Fuente = z.infer<typeof FuenteSchema>;
export type Norma = z.infer<typeof NormaSchema>;
export type Institucion = z.infer<typeof InstitucionSchema>;
export type Etapa = z.infer<typeof EtapaSchema>;
export type Documento = z.infer<typeof DocumentoSchema>;
export type Costo = z.infer<typeof CostoSchema>;
export type Procedimiento = z.infer<typeof ProcedimientoSchema>;
export type Tarifa = z.infer<typeof TarifaSchema>;
export type Regla = z.infer<typeof ReglaSchema>;
export type Distrito = z.infer<typeof DistritoSchema>;
export type ZonaEspecial = z.infer<typeof ZonaEspecialSchema>;
export type Programa = z.infer<typeof ProgramaSchema>;
export type Pregunta = z.infer<typeof PreguntaSchema>;
export type Vencimiento = z.infer<typeof VencimientoSchema>;
export type Meta = z.infer<typeof MetaSchema>;

// Datos del usuario
export type Respuestas = z.infer<typeof RespuestasSchema>;
export type Actor = z.infer<typeof ActorSchema>;
export type Predio = z.infer<typeof PredioSchema>;
export type EstadoPaso = z.infer<typeof EstadoPasoSchema>;
export type Paso = z.infer<typeof PasoSchema>;
export type DocumentoCargado = z.infer<typeof DocumentoCargadoSchema>;
export type EntradaBitacora = z.infer<typeof EntradaBitacoraSchema>;
export type Expediente = z.infer<typeof ExpedienteSchema>;
export type Alerta = z.infer<typeof AlertaSchema>;

export type Modalidad = "A" | "B" | "C" | "D";

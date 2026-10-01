// Base de conocimiento: importa data/*.json en build, la valida con Zod y expone getters.
// Si un JSON no cumple el esquema, falla al cargar (y el build) en vez de mostrar datos rotos.
import { z } from "zod";
import distritosJson from "@data/distritos.json";
import documentosJson from "@data/documentos.json";
import etapasJson from "@data/etapas.json";
import fuentesJson from "@data/fuentes.json";
import institucionesJson from "@data/instituciones.json";
import metaJson from "@data/meta.json";
import normasJson from "@data/normas.json";
import preguntasJson from "@data/diagnostico_preguntas.json";
import procedimientosJson from "@data/procedimientos.json";
import programasJson from "@data/programas.json";
import reglasJson from "@data/reglas.json";
import tarifasJson from "@data/tarifas_distritales.json";
import vencimientosJson from "@data/vencimientos.json";
import zonasJson from "@data/zonas_especiales.json";
import {
  DistritoSchema,
  DocumentoSchema,
  EtapaSchema,
  FuenteSchema,
  InstitucionSchema,
  MetaSchema,
  NormaSchema,
  PreguntaSchema,
  ProcedimientoSchema,
  ProgramaSchema,
  ReglaSchema,
  TarifaSchema,
  VencimientoSchema,
  ZonaEspecialSchema,
} from "@/domain/schemas";
import type { BaseHojaDeRuta } from "@/domain/roadmap";
import type { BaseReglas } from "@/domain/rules-engine";

export const KnowledgeSchema = z.object({
  meta: MetaSchema,
  etapas: z.array(EtapaSchema),
  procedimientos: z.array(ProcedimientoSchema),
  documentos: z.array(DocumentoSchema),
  instituciones: z.array(InstitucionSchema),
  normas: z.array(NormaSchema),
  fuentes: z.array(FuenteSchema),
  distritos: z.array(DistritoSchema),
  tarifas: z.array(TarifaSchema),
  zonas: z.array(ZonaEspecialSchema),
  programas: z.array(ProgramaSchema),
  preguntas: z.array(PreguntaSchema),
  reglas: z.array(ReglaSchema),
  vencimientos: z.array(VencimientoSchema),
});

export type Knowledge = z.infer<typeof KnowledgeSchema>;

export const rawKnowledge: unknown = {
  meta: metaJson,
  etapas: etapasJson,
  procedimientos: procedimientosJson,
  documentos: documentosJson,
  instituciones: institucionesJson,
  normas: normasJson,
  fuentes: fuentesJson,
  distritos: distritosJson,
  tarifas: tarifasJson,
  zonas: zonasJson,
  programas: programasJson,
  preguntas: preguntasJson,
  reglas: reglasJson,
  vencimientos: vencimientosJson,
};

function indexar<T, K>(lista: readonly T[], clave: (x: T) => K): Map<K, T> {
  return new Map(lista.map((x) => [clave(x), x]));
}

export function createKnowledgeRepo(raw: unknown) {
  const resultado = KnowledgeSchema.safeParse(raw);
  if (!resultado.success) {
    throw new Error(
      `data/ no cumple el esquema:\n${z.prettifyError(resultado.error)}`,
    );
  }
  const k = resultado.data;

  const procedimientos = indexar(k.procedimientos, (x) => x.id);
  const etapas = indexar(k.etapas, (x) => x.id);
  const documentos = indexar(k.documentos, (x) => x.id);
  const instituciones = indexar(k.instituciones, (x) => x.id);
  const normas = indexar(k.normas, (x) => x.id);
  const fuentes = indexar(k.fuentes, (x) => x.id);
  const distritos = indexar(k.distritos, (x) => x.ubigeo);
  const zonas = indexar(k.zonas, (x) => x.id);
  const programas = indexar(k.programas, (x) => x.id);
  const preguntas = indexar(k.preguntas, (x) => x.id);
  const etapasOrdenadas = [...k.etapas].sort((a, b) => a.orden - b.orden);
  const baseReglas: BaseReglas = {
    reglas: k.reglas,
    procedimientos: k.procedimientos,
    etapas: k.etapas,
  };
  const baseHojaDeRuta: BaseHojaDeRuta = {
    procedimientos: k.procedimientos,
    etapas: k.etapas,
    instituciones: k.instituciones,
    documentos: k.documentos,
    normas: k.normas,
    fuentes: k.fuentes,
    tarifas: k.tarifas,
    distritos: k.distritos,
  };

  return {
    meta: k.meta,
    baseReglas,
    baseHojaDeRuta,
    getFuentes: () => k.fuentes,
    getNormas: () => k.normas,
    getEtapas: () => etapasOrdenadas,
    getEtapa: (id: string) => etapas.get(id),
    getProcedimientos: () => k.procedimientos,
    getProcedimiento: (id: string) => procedimientos.get(id),
    getDocumento: (id: string) => documentos.get(id),
    getInstitucion: (id: string) => instituciones.get(id),
    getNorma: (id: string) => normas.get(id),
    getFuente: (id: string) => fuentes.get(id),
    getDistritos: () => k.distritos,
    getDistrito: (ubigeo: string) => distritos.get(ubigeo),
    /** Tarifas de un procedimiento en un distrito (todas sus variantes). */
    getTarifas: (ubigeo: string, procedimientoId: string) =>
      k.tarifas.filter(
        (t) => t.ubigeo === ubigeo && t.procedimiento_id === procedimientoId,
      ),
    getZonas: () => k.zonas,
    getZona: (id: string) => zonas.get(id),
    getProgramas: () => k.programas,
    getPrograma: (id: string) => programas.get(id),
    getPreguntas: () => k.preguntas,
    getPregunta: (id: string) => preguntas.get(id),
    getReglas: () => k.reglas,
    getVencimientos: () => k.vencimientos,
    getVencimientoDeDocumento: (documentoId: string) =>
      k.vencimientos.find((v) => v.documento_id === documentoId),
  };
}

export type KnowledgeRepo = ReturnType<typeof createKnowledgeRepo>;

export const knowledgeRepo: KnowledgeRepo = createKnowledgeRepo(rawKnowledge);

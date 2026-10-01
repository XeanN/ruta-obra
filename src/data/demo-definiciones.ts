// Definiciones del modo demo (fixtures/demo.json + respuestas de fixtures/casos.json), validadas
// al cargar. Se leen en el servidor y viajan a la página /demo, que arma los registros con la
// fecha local del navegador.
import casosJson from "../../fixtures/casos.json";
import demoJson from "../../fixtures/demo.json";
import { resolverDemo, type DefinicionDemo } from "@/domain/demo";

export const definicionesDemo: DefinicionDemo[] = resolverDemo(demoJson, casosJson);

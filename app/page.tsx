import { BellRing, ClipboardList, FlaskConical, FolderKanban, MapPinned, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { knowledgeRepo } from "@/data/knowledge-repo";
import { formatFecha } from "@/lib/format";

const BENEFICIOS = [
  {
    icono: MapPinned,
    titulo: "Sabes qué sigue y cuánto cuesta",
    texto:
      "La ruta completa del predio según su situación y su distrito: modalidad, trámites en orden, documentos y montos del TUPA con su fuente. Si un monto no está verificado, lo decimos.",
  },
  {
    icono: BellRing,
    titulo: "No pierdes documentos por vencimiento",
    texto:
      "Avisos antes de que venzan la copia literal, los parámetros o la licencia, y cuenta los 5 días hábiles para subsanar una observación.",
  },
  {
    icono: FolderKanban,
    titulo: "Todos tus expedientes y la obra en un solo lugar",
    texto:
      "Tablero por estado y distrito, checklist de documentos y bitácora de obra con fotos, compartidos con tu equipo.",
  },
];

const PASOS = [
  "Respondes unas preguntas sobre el predio: título, lo ya construido, distrito y la obra que se quiere hacer.",
  "Recibes la hoja de ruta: modalidad de licencia, trámites por etapa, documentos, montos y alertas.",
  "La guardas como expediente y sigues cada paso hasta la conformidad de obra.",
];

const HALLAZGOS = [
  {
    titulo: "Primero, inscribir la compraventa",
    texto:
      "Sin el predio inscrito a nombre del propietario no se puede pedir la licencia: la municipalidad exige la copia literal de SUNARP. Notaría y registro van antes que todo.",
  },
  {
    titulo: "Opinión de PROHVILLA por la cercanía a Pantanos de Villa",
    texto:
      "Suele ser la etapa más larga, así que conviene iniciarla en paralelo con los documentos previos. Además limita alturas y área libre según la zona.",
  },
  {
    titulo: "Regularizar lo construido antes de ampliar",
    texto:
      "El primer piso, levantado antes de 2016 y sin declarar, se regulariza con la declaratoria de fábrica de la Ley 27157.",
  },
  {
    titulo: "Modalidad B, no A",
    texto:
      "Por los cambios estructurales la licencia la evalúa la municipalidad. En total, 22 trámites de SUNARP a la conformidad, en orden.",
  },
];

export default function Home() {
  const { meta } = knowledgeRepo;
  const distritos = knowledgeRepo
    .getDistritos()
    .map((d) => d.nombre)
    .sort((a, b) => a.localeCompare(b, "es"));

  return (
    <main className="flex-1">
      <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-12 pb-10 sm:pt-20">
        <p className="text-muted-foreground text-sm font-medium">
          Para arquitectos, ingenieros y gestores de trámites en Lima
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Todos tus expedientes de obra, de SUNARP a la conformidad, en un solo lugar
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">
          RutaObra te dice qué trámites necesita cada predio, en qué orden, con qué documentos y
          cuánto cuestan en su distrito. Luego te avisa antes de que algo venza.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/diagnostico" className={buttonVariants({ size: "lg", className: "h-11" })}>
            <ClipboardList data-icon="inline-start" />
            Diagnosticar un predio
          </Link>
          <Link href="/demo" className={buttonVariants({ size: "lg", variant: "outline", className: "h-11" })}>
            <FlaskConical data-icon="inline-start" />
            Ver demo
          </Link>
        </div>
        <p className="text-muted-foreground text-sm">
          Sin cuenta: la demo carga 3 expedientes de ejemplo en tu navegador. ¿Ya tienes expedientes?{" "}
          <Link href="/expedientes" className="text-foreground underline underline-offset-2">
            Ir a mis expedientes
          </Link>
        </p>
      </section>

      <section aria-labelledby="beneficios" className="bg-muted/40 border-y">
        <div className="mx-auto w-full max-w-3xl px-4 py-10">
          <h2 id="beneficios" className="sr-only">
            Beneficios
          </h2>
          <ul className="grid gap-6 sm:grid-cols-3">
            {BENEFICIOS.map(({ icono: Icono, titulo, texto }) => (
              <li key={titulo} className="space-y-2">
                <Icono aria-hidden className="text-primary size-6" />
                <h3 className="font-semibold">{titulo}</h3>
                <p className="text-muted-foreground text-sm">{texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="como-funciona" className="mx-auto w-full max-w-3xl space-y-4 px-4 py-10">
        <h2 id="como-funciona" className="text-xl font-semibold tracking-tight">
          Cómo funciona
        </h2>
        <ol className="space-y-3">
          {PASOS.map((p, i) => (
            <li key={p} className="flex gap-3">
              <span
                aria-hidden
                className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              >
                {i + 1}
              </span>
              <span className="text-sm">{p}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="caso-real" className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-10">
        <div className="space-y-1">
          <h2 id="caso-real" className="text-xl font-semibold tracking-tight">
            Un caso real: ampliación cerca de Pantanos de Villa
          </h2>
          <p className="text-muted-foreground text-sm">
            Casa en Chorrillos comprada con una compraventa sin inscribir, con un primer piso sin
            declarar y la idea de ampliar a 3 pisos. Esto es lo que mostró el diagnóstico antes de
            presentar nada en la municipalidad (datos anonimizados):
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2">
          {HALLAZGOS.map((h, i) => (
            <li key={h.titulo} className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs font-medium">Hallazgo {i + 1}</p>
              <h3 className="mt-1 font-semibold">{h.titulo}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{h.texto}</p>
            </li>
          ))}
        </ol>
        <p className="text-sm">
          Cada uno de estos puntos, descubierto tarde, es una observación y semanas de espera.{" "}
          <Link href="/demo" className="underline underline-offset-2">
            Míralo en la demo
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="aviso" className="border-t">
        <div className="mx-auto flex w-full max-w-3xl gap-3 px-4 py-8 text-sm">
          <ShieldCheck aria-hidden className="text-muted-foreground mt-0.5 size-5 shrink-0" />
          <div className="space-y-2">
            <h2 id="aviso" className="font-semibold">
              Datos con fuente, no promesas
            </h2>
            <p className="text-muted-foreground">
              {meta.aviso_legal} Datos al {formatFecha(meta.fecha_corte)}. Distritos incluidos:{" "}
              {distritos.join(", ")}.
            </p>
            <Link href="/fuentes" className="underline underline-offset-2">
              Cómo sabemos esto
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

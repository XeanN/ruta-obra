import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { knowledgeRepo } from "@/data/knowledge-repo";
import { conEstadoEfectivo, vencidosPorArchivo } from "@/domain/freshness";
import type { EstadoVerificacion, Fuente } from "@/domain/types";
import { EstadoVerificacionBadge } from "@/features/fuentes/estado-verificacion-badge";
import { hoyEnLima } from "@/lib/fecha";
import { formatFecha } from "@/lib/format";

// La antigüedad depende de "hoy": la página se regenera una vez al día.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Cómo sabemos esto",
  description: "Fuentes, normas, fecha de corte y estado de verificación de los datos de RutaObra.",
};

const TIPOS_FUENTE: { tipo: Fuente["tipo"]; titulo: string; descripcion: string }[] = [
  { tipo: "norma", titulo: "Normas", descripcion: "Leyes, decretos y ordenanzas publicados." },
  { tipo: "oficial", titulo: "Fuentes oficiales", descripcion: "Portales y TUPAs de las entidades." },
  {
    tipo: "secundaria",
    titulo: "Fuentes secundarias",
    descripcion: "Medios, estudios y consultoras. Sus datos se marcan como referenciales.",
  },
];

const ORDEN_ESTADOS: EstadoVerificacion[] = [
  "verificado",
  "fuente_secundaria",
  "desactualizado",
  "por_verificar",
];

function EnlaceExterno({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-primary inline-flex items-start gap-1 underline underline-offset-2"
    >
      <span>{children}</span>
      <ExternalLink aria-hidden className="mt-1 size-3 shrink-0" />
      <span className="sr-only">(abre en otra pestaña)</span>
    </a>
  );
}

export default function FuentesPage() {
  const { meta } = knowledgeRepo;
  const fuentes = knowledgeRepo.getFuentes();
  const normas = knowledgeRepo.getNormas();
  const distritos = knowledgeRepo.getDistritos();
  const meses = meta.vigencia_verificacion_meses;
  const vigencia = { hoy: hoyEnLima(), meses };
  const vencidos = vencidosPorArchivo(knowledgeRepo.baseAntiguedad, vigencia);
  const totalVencidos = vencidos.reduce((n, a) => n + a.vencidos, 0);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Cómo sabemos esto</h1>
        <p className="text-muted-foreground">
          Cada procedimiento, requisito y monto de RutaObra viene de una fuente citada. Datos al{" "}
          <span className="text-foreground font-medium">{formatFecha(meta.fecha_corte)}</span>{" "}
          (versión {meta.version_datos}).
        </p>
        <p className="text-muted-foreground text-sm">{meta.alcance}</p>
      </div>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-sm">
          <p className="font-medium">Aviso legal</p>
          <p>{meta.aviso_legal}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Qué significan las etiquetas</CardTitle>
          <CardDescription>
            Solo los datos verificados se muestran sin etiqueta de advertencia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            {ORDEN_ESTADOS.map((e) => (
              <div key={e} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                <dt className="sm:w-36 sm:shrink-0">
                  <EstadoVerificacionBadge estado={e} />
                </dt>
                <dd>{meta.estados_verificacion[e]}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Antigüedad de los datos</CardTitle>
          <CardDescription>
            Un dato verificado se muestra como &quot;Versión anterior&quot; si su fuente lleva más de{" "}
            {meses} meses sin revisarse.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            {totalVencidos === 0
              ? "Todos los datos verificados se revisaron dentro de ese plazo."
              : `${totalVencidos} ${totalVencidos === 1 ? "dato verificado está vencido" : "datos verificados están vencidos"} por antigüedad.`}
          </p>
          <table className="w-full text-left">
            <caption className="sr-only">Datos vencidos por antigüedad, por archivo</caption>
            <thead className="text-muted-foreground text-xs">
              <tr>
                <th scope="col" className="pb-1 font-medium">Archivo</th>
                <th scope="col" className="pb-1 pl-3 text-right font-medium">Verificados</th>
                <th scope="col" className="pb-1 pl-3 text-right font-medium">Vencidos</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vencidos.map((a) => (
                <tr key={a.archivo}>
                  <th scope="row" className="py-1.5 font-normal">
                    <code className="text-xs">{a.archivo}</code>
                  </th>
                  <td className="py-1.5 text-right tabular-nums">{a.verificados}</td>
                  <td
                    className={
                      a.vencidos > 0
                        ? "py-1.5 text-right font-medium text-orange-800 tabular-nums dark:text-orange-300"
                        : "py-1.5 text-right tabular-nums"
                    }
                  >
                    {a.vencidos}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cobertura por distrito</CardTitle>
          <CardDescription>Tasas cargadas desde el TUPA de cada municipalidad.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {distritos.map((d) => {
              const fuente = d.tupa.fuente_id ? knowledgeRepo.getFuente(d.tupa.fuente_id) : undefined;
              const estado = conEstadoEfectivo(d, fuente ? [fuente] : [], vigencia);
              return (
                <li key={d.ubigeo} className="space-y-1 py-3 first:pt-0 last:pb-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.nombre}</span>
                    {d.tupa.anio && <span className="text-muted-foreground">TUPA {d.tupa.anio}</span>}
                    <EstadoVerificacionBadge
                      estado={estado.estado_verificacion}
                      antiguedadMeses={estado.antiguedad_meses}
                    />
                  </p>
                  {d.tupa.nota && <p className="text-muted-foreground">{d.tupa.nota}</p>}
                  {fuente && <EnlaceExterno href={fuente.url}>{fuente.titulo}</EnlaceExterno>}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Normas</CardTitle>
          <CardDescription>{normas.length} normas que sustentan la ruta.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {normas.map((n) => {
              const fuente = n.fuente_id ? knowledgeRepo.getFuente(n.fuente_id) : undefined;
              return (
                <li key={n.id} className="space-y-0.5 py-3 first:pt-0 last:pb-0">
                  <p className="font-medium">{n.numero}</p>
                  <p>{n.nombre}</p>
                  <p className="text-muted-foreground text-xs">Tema: {n.tema}</p>
                  {fuente && <EnlaceExterno href={fuente.url}>Ver norma</EnlaceExterno>}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {TIPOS_FUENTE.map(({ tipo, titulo, descripcion }) => {
        const lista = fuentes.filter((f) => f.tipo === tipo);
        if (lista.length === 0) return null;
        return (
          <Card key={tipo}>
            <CardHeader>
              <CardTitle className="text-lg">{titulo}</CardTitle>
              <CardDescription>{descripcion}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {lista.map((f) => (
                  <li key={f.id} className="space-y-0.5 py-2.5 first:pt-0 last:pb-0">
                    <EnlaceExterno href={f.url}>{f.titulo}</EnlaceExterno>
                    <p className="text-muted-foreground text-xs">
                      Revisado el {formatFecha(f.fecha_consulta)}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </main>
  );
}

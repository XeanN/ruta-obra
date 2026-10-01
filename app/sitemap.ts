import type { MetadataRoute } from "next";
import { knowledgeRepo } from "@/data/knowledge-repo";
import { urlSitio } from "@/lib/sitio";

/** Solo las páginas públicas y estables; el resto depende de la sesión o de la URL del diagnóstico. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = urlSitio();
  const datos = new Date(`${knowledgeRepo.meta.fecha_corte}T00:00:00-05:00`);
  return [
    { url: new URL("/", base).toString(), changeFrequency: "monthly", priority: 1 },
    { url: new URL("/diagnostico", base).toString(), lastModified: datos, changeFrequency: "monthly", priority: 0.8 },
    { url: new URL("/fuentes", base).toString(), lastModified: datos, changeFrequency: "monthly", priority: 0.5 },
    { url: new URL("/privacidad", base).toString(), changeFrequency: "yearly", priority: 0.2 },
  ];
}

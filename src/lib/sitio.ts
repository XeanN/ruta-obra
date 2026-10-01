// Datos del sitio para metadatos, sitemap y robots.

export const NOMBRE_SITIO = "RutaObra";
export const DESCRIPCION_SITIO =
  "Todos tus expedientes de obra en Perú, de SUNARP a la conformidad: qué trámites siguen, cuánto cuestan por distrito y avisos antes de que algo venza.";

/** URL pública: la configurada, la de producción de Vercel, la del despliegue o local. */
export function urlSitio(): URL {
  const env = process.env;
  if (env.NEXT_PUBLIC_SITE_URL) return new URL(env.NEXT_PUBLIC_SITE_URL);
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return new URL(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  if (env.VERCEL_URL) return new URL(`https://${env.VERCEL_URL}`);
  return new URL("http://localhost:3000");
}

/** Solo producción se indexa: las vistas previas de Vercel no deben salir en buscadores. */
export const esProduccion = () => process.env.VERCEL_ENV === "production";

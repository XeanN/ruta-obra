import type { MetadataRoute } from "next";
import { esProduccion, urlSitio } from "@/lib/sitio";

export default function robots(): MetadataRoute.Robots {
  if (!esProduccion()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/cuenta", "/expedientes", "/invitacion/", "/demo"] },
    sitemap: new URL("/sitemap.xml", urlSitio()).toString(),
  };
}

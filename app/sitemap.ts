import type { MetadataRoute } from "next";
import { getDevelopments } from "@/lib/developments-db";
import { getProperties } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [developments, properties] = await Promise.all([
    getDevelopments({ visibility: "public" }),
    getProperties({ status: "disponible", visibility: "public" }),
  ]);

  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/desarrollos"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: absoluteUrl("/inversiones-real-estate-buenos-aires"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.98,
    },
    {
      url: absoluteUrl("/invertir-en-real-estate-argentina"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.96,
    },
    {
      url: absoluteUrl("/ciudad-de-buenos-aires"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/propiedades"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/propiedades?categoria=inversiones"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: absoluteUrl("/propiedades?categoria=pozo"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
  ];

  const developmentRoutes: MetadataRoute.Sitemap = developments.map((dev) => ({
    url: absoluteUrl(`/desarrollos/${dev.slug}`),
    lastModified: dev.updatedAt ? new Date(dev.updatedAt) : now,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  const propertyRoutes: MetadataRoute.Sitemap = properties.map((property) => ({
    url: absoluteUrl(`/propiedades/${property.id}`),
    lastModified: property.updatedAt ? new Date(property.updatedAt) : now,
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  return [...staticRoutes, ...developmentRoutes, ...propertyRoutes];
}

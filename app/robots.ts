import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";
import { getProductionSiteOrigin } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  const origin = getProductionSiteOrigin().toString().replace(/\/$/, "");
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/", "/account/", "/login", "/register", "/forgot-password", "/reset-password",
        "/cart", "/wishlist", "/checkout/", "/payment/", "/orders/", "/track/", "/api/", "/dev/",
        "/preview/", "/debug/",
      ],
    }],
    sitemap: origin + "/sitemap.xml",
  };
}

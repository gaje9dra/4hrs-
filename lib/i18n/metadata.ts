import type { Metadata } from "next";
import type { SupportedLocale } from "./registry";
import { absoluteSiteUrl } from "@/config/site";

export function localizedMetadata(input: {
  locale: SupportedLocale;
  title: string;
  description: string;
  pathname: string;
  alternateLocales?: readonly SupportedLocale[];
}): Metadata {
  const alternates = input.alternateLocales?.reduce<Record<string, string>>((result, locale) => {
    result[locale] = absoluteSiteUrl(input.pathname);
    return result;
  }, {});
  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: absoluteSiteUrl(input.pathname),
      ...(alternates ? { languages: alternates } : {}),
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url: absoluteSiteUrl(input.pathname),
    },
  };
}
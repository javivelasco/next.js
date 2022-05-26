import type { NextConfig } from '../../../../server/config-shared'
import type { ParsedUrl } from './parse-url'
import { getStuff, type Stuff } from './get-stuff'

interface Params {
  nextConfig: NextConfig
  defaultLocale?: string
  url: ParsedUrl
}

export function parseNextUrl({ defaultLocale, nextConfig, url: p }: Params) {
  const urlParsed: ParsedNextUrl = {
    ...p,
    stuff: getStuff(p, {
      basePath: nextConfig.basePath,
      defaultLocale,
      locales: nextConfig.i18n?.locales,
    }),
  }

  if (nextConfig.i18n && defaultLocale) {
    // The locale is the locale in the path OR the default
    urlParsed.locale = urlParsed.stuff.locale || defaultLocale
  }

  urlParsed.pathname = urlParsed.stuff.path

  return urlParsed
}

export interface ParsedNextUrl extends ParsedUrl {
  basePath?: string
  locale?: string
  stuff: Stuff
}

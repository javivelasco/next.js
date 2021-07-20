import { parse } from 'url'
import accept from '@hapi/accept'

interface I18NConfig {
  defaultLocale: string
  domains?: {
    http?: true
    domain: string
    locales?: string[]
    defaultLocale: string
  }[]
  localeDetection?: false
  locales: string[]
}

function superParse(
  url: string,
  options: {
    headers?: { [key: string]: string | string[] }
    cookies?: { [key: string]: string }
    i18n?: I18NConfig
  }
) {
  const parsed = parse(url || '/')
  const pathname = parsed.pathname || '/'

  if (options.i18n) {
    let defaultLocale = options.i18n.defaultLocale
    let detectedLocale: string | undefined
    let acceptPreferredLocale: string | undefined

    detectedLocale = getLocaleFromCookie(options.i18n, options.cookies)
    acceptPreferredLocale = getAcceptPreferredLocale(
      options.i18n,
      options.headers
    )
  }
}

function getHostname(
  parsed: { hostname?: string | null },
  headers?: { [key: string]: string | string[] }
) {
  return ((!Array.isArray(headers?.host) && headers?.host) || parsed.hostname)
    ?.split(':')[0]
    .toLowerCase()
}

function getLocaleFromCookie(
  i18n: I18NConfig,
  cookies?: { [key: string]: string }
) {
  return cookies?.NEXT_LOCALE
    ? i18n.locales.find(
        (locale) => cookies.NEXT_LOCALE.toLowerCase() === locale.toLowerCase()
      )
    : undefined
}

function getAcceptPreferredLocale(
  i18n: I18NConfig,
  headers?: { [key: string]: string | string[] }
) {
  const value = headers?.['accept-language']
  if (i18n.localeDetection !== false && value && !Array.isArray(value)) {
    try {
      return accept.language(value, i18n.locales)
    } catch (err) {}
  }
}

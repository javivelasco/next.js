import { formatUrl as format } from '../../shared/lib/router/utils/format-url'
import type { NextEdgeUrl } from './types'

export const Encoder = new TextEncoder()
export const Decoder = new TextDecoder()

export const encode = (input: string) => Encoder.encode(input)
export const decode = (input: ArrayBufferView | ArrayBuffer, stream = false) =>
  Decoder.decode(input, { stream })

export function byteLength(input?: string): number {
  return input ? Encoder.encode(input).byteLength : 0
}

export function formatUrl(url: string | NextEdgeUrl) {
  return typeof url !== 'string' ? format(filterUrl(url)) : url
}

export function formatPathname(
  pathname: string,
  options: {
    basePath?: string
    defaultLocale?: string
    locale?: string
  }
) {
  if (!pathname.startsWith('/')) {
    return pathname
  }

  if (options.locale && options.defaultLocale !== options.locale) {
    pathname = `/${options.locale}${pathname}`
  }

  if (options.basePath && !pathname.startsWith(options.basePath)) {
    pathname = `${options.basePath}${pathname}`
  }

  return pathname
}

function filterUrl(url: NextEdgeUrl): NextEdgeUrl {
  return {
    basePath: url.basePath,
    calls: url.calls,
    defaultLocale: url.defaultLocale,
    hash: url.hash || null,
    hostname: url.hostname || null,
    locale: url.locale,
    page: url.page,
    params: url.params,
    pathname: url.pathname,
    port: url.port || null,
    preflight: url.preflight,
    protocol: url.protocol,
    query: url.query,
  }
}

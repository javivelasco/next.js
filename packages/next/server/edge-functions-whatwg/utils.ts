import type { ParsedUrl } from '../../shared/lib/router/utils/parse-url'
import type { ParsedNextUrl } from '../../shared/lib/router/utils/parse-next-url'
import type { I18NConfig } from '../config-shared'
import { getLocaleMetadata } from '../../shared/lib/i18n/get-locale-metadata'
import { searchParamsToUrlQuery } from '../../shared/lib/router/utils/querystring'

export async function* streamToIterator<T>(
  readable: ReadableStream<T>
): AsyncIterableIterator<T> {
  const reader = readable.getReader()
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) {
      yield value
    }
  }
  reader.releaseLock()
}

export function notImplemented(name: string, method: string): any {
  throw new Error(
    `Failed to get the '${method}' property on '${name}': the property is not implemented`
  )
}

export function parseUrl(url: string): ParsedUrl {
  if (url.startsWith('/')) {
    const parsedURL = new URL(url, new URL('http://n'))
    return {
      pathname: parsedURL.pathname,
      query: searchParamsToUrlQuery(parsedURL.searchParams),
      search: parsedURL.search,
      hash: parsedURL.hash,
    }
  }

  const parsedURL = new URL(url)
  return {
    hash: parsedURL.hash,
    hostname: parsedURL.hostname,
    pathname: parsedURL.pathname,
    port: parsedURL.port,
    protocol: parsedURL.protocol,
    query: searchParamsToUrlQuery(parsedURL.searchParams),
    search: parsedURL.search,
  }
}

export function parseNextUrl({
  cookies,
  headers,
  nextConfig: config,
  url,
}: {
  cookies(): { [key: string]: string }
  headers: Headers
  nextConfig?: {
    basePath?: string
    i18n?: I18NConfig | null
    trailingSlash?: boolean
  }
  url: string
}) {
  const urlParsed: ParsedNextUrl = parseUrl(url.replace(/^\/+/, '/'))
  if (config?.basePath && urlParsed.pathname.startsWith(config.basePath)) {
    urlParsed.pathname = urlParsed.pathname.replace(config.basePath, '') || '/'
    urlParsed.basePath = config.basePath
  }

  if (config?.i18n) {
    urlParsed.locale = getLocaleMetadata({
      cookies,
      headers: toNodeHeaders(headers),
      nextConfig: {
        basePath: config.basePath,
        i18n: config.i18n,
      },
      url: urlParsed,
    })

    if (urlParsed.locale?.path.detectedLocale) {
      urlParsed.pathname = urlParsed.locale.path.pathname
    }
  }

  return urlParsed
}

function toNodeHeaders(headers?: Headers) {
  const obj: { [key: string]: string[] | string | undefined } = {}

  if (headers) {
    for (const [key, value] of headers.entries()) {
      obj[key] = value.includes(';') ? value.split(';') : value
    }
  }

  return obj
}

// function getTotalBytes(body: BodyInit, boundary: string): number | null {
//     if (body === null) {
//       return 0;
//     } else if (typeof body === 'string') {
//       const encoder = new TextEncoder()
//       return encoder.encode(body).byteLength
//     } else if (util.isBlob(body)) {
//       return body.size;
//     } else if (util.isDataView(body)) {
//       return body.byteLength;
//     } else if (util.isArrayBuffer(body)) {
//       return body.byteLength;
//     } else if (util.isArrayBufferView(body)) {
//       return body.byteLength;
//     } else if (util.isURLSearchParams(body)) {
//       const encoder = new TextEncoder()
//       return encoder.encode(body.toString()).byteLength;
//     } else if (util.isFormData(body)) {
//       return getFormDataLength(body, boundary);
//     } else if (util.isReadableStream(body)) {
//       return null;
//     } else {
//       const encoder = new TextEncoder()
//       const text = Object.prototype.toString.call(body)
//       return encoder.encode(text).byteLength
//     }
//   }

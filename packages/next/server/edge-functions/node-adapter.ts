import type { NextEdgeFunction } from './types'
import type { ParsedUrlQuery } from 'querystring'
import type { IncomingMessage, ServerResponse } from 'http'
import { parse } from 'url'

interface Options {
  url?: {
    basePath?: string
    defaultLocale?: string
    hash?: string | null
    hostname?: string | null
    locale?: string
    page?: string
    params?: { [key: string]: string }
    pathname?: string
    port?: string | null
    preflight?: boolean
    protocol?: string | null
    query?: ParsedUrlQuery
  }
}

export function nodeMiddlewareAdapter(edgeFunction: NextEdgeFunction) {
  return async function (
    req: IncomingMessage,
    res: ServerResponse,
    options: Options = {}
  ) {
    const parsed = parse(req.url || '/', true)

    const result = await edgeFunction({
      response: {
        headers: new Headers(toWHATWGLikeHeaders(res.getHeaders())),
      },
      request: {
        headers: new Headers(toWHATWGLikeHeaders(req.headers)),
        method: req.method || 'GET',
        url: {
          ...parsed,
          pathname: parsed.pathname || '/',
          preflight: options.url?.preflight ?? false,
          ...options.url,
        },
      },
    })

    for (const [key, value] of result.response.headers.entries()) {
      res.setHeader(key, value)
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(res.statusCode)
      return res.end()
    }

    if (result.event === 'streaming') {
      const reader = result.response.readable.getReader()
      res.writeHead(res.statusCode)

      while (true) {
        let { value, done } = await reader.read()
        if (done) break
        res.write(value)
      }

      return res.end()
    }

    const location = result.response.headers.get('x-nextjs-redirect')
    if (location) {
      res.statusCode = result.response.statusCode
      res.setHeader('Location', location)
      if (res.statusCode === 308) {
        res.setHeader('Refresh', `0;url=${location}`)
      }

      res.end()
    }

    const rewrite = result.response.headers.get('x-nextjs-rewrite')
    if (rewrite) {
      return getRewriteHandler({
        destination: rewrite,
      }).call(this, req, res, {}, parsed)
    }

    if (result.event === 'data') {
      res.end(result.response.body)
      return { finished: true }
    }
  }
}

/**
 * Transforms the IncomingMessage headers which can contain undefined
 * values and arrays into a dictionary of strings that can be used to
 * build the WHATWG Headers.
 *
 * @param iHeaders Incoming Request Headers
 * @returns The headers as a dictionary of strings
 */
export function toWHATWGLikeHeaders(iHeaders: {
  [header: string]: number | string | string[] | undefined
}) {
  const headers: { [k: string]: string } = {}

  for (let headerKey in iHeaders) {
    const headerValue = iHeaders[headerKey]
    if (Array.isArray(headerValue)) {
      headers[headerKey] = headerValue.join('; ')
    } else if (headerValue) {
      headers[headerKey] = String(headerValue)
    }
  }

  return headers
}

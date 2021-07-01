import { format as formatUrl, UrlWithParsedQuery, parse as parseUrl } from 'url'
import { getContentType } from './serve-static'
import { getCookieParser, NextApiRequestCookies } from './api-utils'
import cookie, { CookieSerializeOptions } from 'next/dist/compiled/cookie'

const CHARSET_REGEXP = /;\s*charset\s*=/

interface Request {
  method?: string
  headers: { [key: string]: undefined | string | string[] }
  url: NextEdgeUrl
}

export interface NextEdgeUrl extends UrlWithParsedQuery {
  basePath?: string
  defaultLocale?: string
  locale?: string
  page?: string
  params: { [key: string]: string }
  pathname: string
  preflight: boolean
}

export interface Effects {
  headers?: { [key: string]: string | string[] | number }
  redirect?: { status: number; location: string }
  rewrite?: { destination: string }
}

export async function middlewareAdapter({
  handler,
  req,
}: {
  handler: (_req: EdgeRequest, res: any) => Promise<any>
  req: Request
}) {
  /**
   * Find out the locale
   */
  const vcRequest = new EdgeRequest(req)
  const vcResponse = new EdgeResponse()

  await handler(vcRequest, vcResponse)

  const headers =
    Object.keys(vcResponse.headers).length > 0 ? vcResponse.headers : undefined

  if (
    vcResponse.headers['Location'] &&
    typeof vcResponse.headers['Location'] === 'string'
  ) {
    const location = vcResponse.headers['Location']
    delete (headers || {})['Location']
    return {
      headers,
      redirect: {
        status: vcResponse.statusCode!,
        location,
      },
    }
  }

  if (vcResponse.dest) {
    return {
      headers,
      rewrite: {
        destination: vcResponse.dest,
      },
    }
  }

  return { headers }
}

export class EdgeRequest {
  public method?: string
  public url: NextEdgeUrl
  private req: Request
  private cookieParser: () => NextApiRequestCookies

  constructor(req: Request) {
    this.url = req.url
    this.cookieParser = getCookieParser(req.headers)
    this.method = req.method || 'GET'
    this.req = req
  }

  get cookies() {
    return this.cookieParser()
  }

  get headers() {
    return this.req.headers
  }
}

export class EdgeResponse {
  private finished: boolean
  public dest?: string
  public headers: { [key: string]: string | string[] }
  public statusCode?: number

  constructor() {
    this.headers = {}
    this.finished = false
  }

  /**
   * Save the provided status code to be used in the response and optionally
   * the provided headers. It finishes the handler since we don't allow to
   * define a body.
   *
   * @param statusCode The status code for the response.
   * @param headers Headers for the response.
   */
  public writeHead(
    statusCode: number,
    headers?: { [key: string]: string | string[] }
  ) {
    this.status(statusCode)

    if (headers) {
      this.set(headers)
    }

    this.end()
  }

  /**
   * Append additional header `field` with value `val`.
   * Example:
   *    res.append('Link', ['<http://localhost/>', '<http://localhost:3000/>']);
   *    res.append('Set-Cookie', 'foo=bar; Path=/; HttpOnly');
   *    res.append('Warning', '199 Miscellaneous warning');
   *
   * @param field The header name.
   * @param val The header value.
   */
  public append(field: string, val: string | string[]) {
    const prev = this.get(field)
    let value: string | string[] = val

    if (prev) {
      value = Array.isArray(prev)
        ? prev.concat(val)
        : Array.isArray(val)
        ? [prev].concat(val)
        : [prev, val]
    }

    return this.set(field, value)
  }

  /**
   * Set cookie `name` to `value`, with the given `options`.
   * Examples:
   *    res.cookie('rememberme', '1', { expires: new Date(Date.now() + 900000), httpOnly: true });
   *    res.cookie('rememberme', '1', { maxAge: 900000, httpOnly: true })
   *
   * @param name The name of the cookie.
   * @param value The value of the cookie.
   * @param options Cookie options.
   */
  public cookie(
    name: string,
    value: { [key: string]: any } | string,
    opts: CookieSerializeOptions = {}
  ) {
    const val =
      typeof value === 'object' ? 'j:' + JSON.stringify(value) : String(value)

    if (opts.maxAge) {
      opts.expires = new Date(Date.now() + opts.maxAge)
      opts.maxAge /= 1000
    }

    if (opts.path == null) {
      opts.path = '/'
    }

    this.append('Set-Cookie', cookie.serialize(name, String(val), opts))
    return this
  }

  /**
   * Clear cookie `name`.
   *
   * @param options Cookie options that can be overriden.
   */
  public clearCookie(name: string, opts: CookieSerializeOptions = {}) {
    return this.cookie(name, '', { expires: new Date(1), path: '/', ...opts })
  }

  /**
   * Get value for header `field`.
   *
   * @param name The header name.
   */
  public get(name: string): string | string[] | undefined {
    return this.headers[name]
  }

  /**
   * Set header `field` to `val`, or pass an object of header fields.
   * Examples:
   *    res.set('Foo', ['bar', 'baz']);
   *    res.set('Accept', 'application/json');
   *    res.set({ Accept: 'text/plain', 'X-API-Key': 'tobi' });
   *
   * @param name The name of the header or a Dictionary of values.
   * @param val The value or values for the header.
   */
  public set(dict: { [key: string]: any }, val?: undefined): EdgeResponse
  public set(name: string, val?: string | string[]): EdgeResponse
  public set(
    name: { [key: string]: any } | string,
    val?: string | string[]
  ): EdgeResponse {
    if (typeof name === 'string') {
      let value = Array.isArray(val) ? val.map(String) : String(val)

      // add charset to content-type
      if (name.toLowerCase() === 'content-type') {
        if (Array.isArray(value)) {
          throw new TypeError('Content-Type cannot be set to an Array')
        }

        if (!CHARSET_REGEXP.test(value)) {
          const charset = getContentType(value.split(';')[0])
          if (charset) {
            value += '; charset=' + charset.toLowerCase()
          }
        }
      }

      this.headers[name] = value
    } else {
      for (const key in name) {
        this.set(key, name[key])
      }
    }

    return this
  }

  /**
   * Set the location header to `url`. The given `url` can also be "back",
   * which redirects to the Referrer or Referer_headers or "/".
   * Examples:
   *    res.location('/foo/bar').;
   *    res.location('http://example.com');
   *    res.location('../login');
   *
   * @param  url The URL to set the location to.
   */
  public location(url: string) {
    let loc = url

    // "back" is an alias for the referrer
    if (url === 'back') {
      loc = (this.get('Referrer') as string) || '/'
    }

    // set location
    return this.set('Location', formatUrl(parseUrl(loc)))
  }

  /**
   * Set status `code` for the response.
   *
   * @param statusCode The status code.
   */
  public status(statusCode: number) {
    this.statusCode = statusCode
    return this
  }

  /**
   * Redirect to the given `url` with optional response `status` defaulting
   * to 302. The resulting `url` is determined by `res.location()`.
   * Examples:
   *    res.redirect('/foo/bar');
   *    res.redirect('http://example.com');
   *    res.redirect(301, 'http://example.com');
   *    res.redirect('../login'); // /blog/post/1 -> /blog/login
   *
   * @param status The status or the URL to redirect to.
   * @param url If the first param is the status, this should be the URL.
   */
  public redirect(url: string): void
  public redirect(status: number, url: string): void
  public redirect(statusOrUrl: string | number, url?: string) {
    let status: number
    let address: string

    if (typeof statusOrUrl === 'string') {
      address = statusOrUrl
      status = 302
    } else {
      status = statusOrUrl
      address = url as string
    }

    this.location(address)
    this.status(status)
    this.end()
  }

  /**
   * Rewrite to the given `url` with optional response `status` defaulting
   * to 302. The resulting `url` is determined by `res.location()`.
   * Examples:
   *    res.rewrite('/foo/bar');
   *    res.rewrite('http://example.com');
   *
   * @param url The URL or path where the rewrite should be done to.
   */
  public rewrite(url: string) {
    this.dest = url
    this.end()
  }

  /**
   * Finishes the response. After calling this function we don't allow
   * any further calls.
   */
  public end() {
    if (this.finished) {
      throw new Error(`Headers already sent`)
    }

    this.finished = true
  }
}

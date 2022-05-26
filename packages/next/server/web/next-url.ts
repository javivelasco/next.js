import type { DomainLocale, I18NConfig } from '../config-shared'
import { detectDomainLocale } from '../../shared/lib/i18n/detect-domain-locale'
import { getHostname } from '../../shared/lib/get-hostname'
import { pathHasPrefix } from '../../shared/lib/router/utils/path-has-prefix'
import { getStuff } from '../../shared/lib/router/utils/get-stuff'

interface Options {
  base?: string | URL
  basePath?: string
  headers?: { [key: string]: string | string[] | undefined }
  i18n?: I18NConfig | null
}

const Internal = Symbol('NextURLInternal')

export class NextURL {
  [Internal]: {
    basePath: string
    buildId?: string
    defaultLocale?: string
    domainLocale?: DomainLocale
    locale?: string
    options: Options
    url: URL
  }

  constructor(input: string | URL, base?: string | URL, opts?: Options)
  constructor(input: string | URL, opts?: Options)
  constructor(
    input: string | URL,
    baseOrOpts?: string | URL | Options,
    opts?: Options
  ) {
    let base: undefined | string | URL
    let options: Options

    if (
      (typeof baseOrOpts === 'object' && 'pathname' in baseOrOpts) ||
      typeof baseOrOpts === 'string'
    ) {
      base = baseOrOpts
      options = opts || {}
    } else {
      options = opts || baseOrOpts || {}
    }

    this[Internal] = {
      url: parseURL(input, base ?? options.base),
      options: options,
      basePath: '',
    }

    this.analyzeUrl()
  }

  private analyzeUrl() {
    const stuff = getStuff(this[Internal].url, {
      basePath: this[Internal].options.basePath,
      locales: this[Internal].options.i18n?.locales,
    })

    this[Internal].domainLocale = detectDomainLocale(
      this[Internal].options.i18n?.domains,
      getHostname(this[Internal].url, this[Internal].options.headers)
    )

    const defaultLocale =
      this[Internal].domainLocale?.defaultLocale ||
      this[Internal].options.i18n?.defaultLocale

    this[Internal].url.pathname = stuff.path
    this[Internal].defaultLocale = defaultLocale
    this[Internal].basePath = stuff.basePath ?? ''
    this[Internal].buildId = stuff.buildId
    this[Internal].locale = stuff.locale ?? defaultLocale
  }

  private formatPathname() {
    return formatStuff(
      {
        path: this[Internal].url.pathname,
        basePath: this[Internal].basePath,
        buildId: this[Internal].buildId,
        locale: this[Internal].locale,
      },
      {
        basePath: this[Internal].options.basePath,
        locales: this[Internal].options.i18n?.locales,
        defaultLocale: this[Internal].defaultLocale,
      }
    )
  }

  public get buildId() {
    return this[Internal].buildId
  }

  public set buildId(buildId: string | undefined) {
    this[Internal].buildId = buildId
  }

  public get locale() {
    return this[Internal].locale ?? ''
  }

  public set locale(locale: string) {
    if (
      !this[Internal].locale ||
      !this[Internal].options.i18n?.locales.includes(locale)
    ) {
      throw new TypeError(
        `The NextURL configuration includes no locale "${locale}"`
      )
    }

    this[Internal].locale = locale
  }

  get defaultLocale() {
    return this[Internal].defaultLocale
  }

  get domainLocale() {
    return this[Internal].domainLocale
  }

  get searchParams() {
    return this[Internal].url.searchParams
  }

  get host() {
    return this[Internal].url.host
  }

  set host(value: string) {
    this[Internal].url.host = value
  }

  get hostname() {
    return this[Internal].url.hostname
  }

  set hostname(value: string) {
    this[Internal].url.hostname = value
  }

  get port() {
    return this[Internal].url.port
  }

  set port(value: string) {
    this[Internal].url.port = value
  }

  get protocol() {
    return this[Internal].url.protocol
  }

  set protocol(value: string) {
    this[Internal].url.protocol = value
  }

  get href() {
    const pathname = this.formatPathname()
    return `${this.protocol}//${this.host}${pathname}${this[Internal].url.search}`
  }

  set href(url: string) {
    this[Internal].url = parseURL(url)
    this.analyzeUrl()
  }

  get origin() {
    return this[Internal].url.origin
  }

  get pathname() {
    return this[Internal].url.pathname
  }

  set pathname(value: string) {
    this[Internal].url.pathname = value
  }

  get hash() {
    return this[Internal].url.hash
  }

  set hash(value: string) {
    this[Internal].url.hash = value
  }

  get search() {
    return this[Internal].url.search
  }

  set search(value: string) {
    this[Internal].url.search = value
  }

  get password() {
    return this[Internal].url.password
  }

  set password(value: string) {
    this[Internal].url.password = value
  }

  get username() {
    return this[Internal].url.username
  }

  set username(value: string) {
    this[Internal].url.username = value
  }

  get basePath() {
    return this[Internal].basePath
  }

  set basePath(value: string) {
    this[Internal].basePath = value.startsWith('/') ? value : `/${value}`
  }

  toString() {
    return this.href
  }

  toJSON() {
    return this.href
  }

  [Symbol.for('edge-runtime.inspect.custom')]() {
    return {
      href: this.href,
      origin: this.origin,
      protocol: this.protocol,
      username: this.username,
      password: this.password,
      host: this.host,
      hostname: this.hostname,
      port: this.port,
      pathname: this.pathname,
      search: this.search,
      searchParams: this.searchParams,
      hash: this.hash,
    }
  }

  clone() {
    return new NextURL(String(this), this[Internal].options)
  }
}

const REGEX_LOCALHOST_HOSTNAME =
  /(?!^https?:\/\/)(127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}|::1|localhost)/

function parseURL(url: string | URL, base?: string | URL) {
  return new URL(
    String(url).replace(REGEX_LOCALHOST_HOSTNAME, 'localhost'),
    base && String(base).replace(REGEX_LOCALHOST_HOSTNAME, 'localhost')
  )
}

function addLocale(
  path: string,
  locale?: string | false,
  defaultLocale?: string
) {
  if (locale && locale !== defaultLocale) {
    const pathname = pathNoQueryHash(path)
    const pathLower = pathname.toLowerCase()
    const localeLower = locale.toLowerCase()

    if (
      !pathHasPrefix(pathLower, '/' + localeLower) &&
      !pathHasPrefix(pathLower, '/api')
    ) {
      return addPathPrefix(path, '/' + locale)
    }
  }
  return path
}

function addPathPrefix(path: string, prefix?: string) {
  if (!path.startsWith('/') || !prefix) {
    return path
  }
  const pathname = pathNoQueryHash(path)
  return `${prefix}${pathname}` + path.slice(pathname.length)
}

function addPathSuffix(path: string, suffix: string) {
  let pathname = pathNoQueryHash(path)
  return `${pathname}${suffix}${path.slice(pathname.length)}`
}

function pathNoQueryHash(path: string) {
  const queryIndex = path.indexOf('?')
  const hashIndex = path.indexOf('#')

  if (queryIndex > -1 || hashIndex > -1) {
    path = path.substring(0, queryIndex > -1 ? queryIndex : hashIndex)
  }
  return path
}

interface Stuff {
  basePath?: string
  buildId?: string
  locale?: string
  path: string
}

interface StuffOptions {
  basePath?: string
  defaultLocale?: string // only to serialize
  locales?: string[]
}

function formatStuff(stuff: Stuff, opts: StuffOptions) {
  // first we add the locale if we have to
  let path = addLocale(
    stuff.path,
    stuff.locale,
    !stuff.buildId ? opts.defaultLocale : undefined
  )

  // then we maybe have to add the data format
  if (stuff.buildId) {
    path = addPathSuffix(
      addPathPrefix(path, `/_next/data/${stuff.buildId}`),
      stuff.path === '/' ? 'index.json' : '.json'
    )
  }

  return addPathPrefix(path, stuff.basePath)
}

import type { ParsedNextUrl } from '../../../shared/lib/router/utils/parse-next-url'
import type { I18NConfig } from '../../config-shared'
import { Request as WhatWGRequest } from '../spec-compliant/request'
import { INTERNALS } from '../spec-compliant/request'
import { parseNextUrl } from '../utils'
import cookie from 'next/dist/compiled/cookie'

export class Request extends WhatWGRequest {
  [INTERNALS]: {
    cookieParser(): { [key: string]: string }
    credentials: RequestCredentials
    headers: Headers
    method: string
    redirect: RequestRedirect
    url: ParsedNextUrl
  }

  constructor(input: Request | string, init: RequestInit = {}) {
    super(input, init)

    this[INTERNALS].cookieParser = () => {
      const value = this.headers.get('cookie')
      return value ? cookie.parse(value) : {}
    }

    this[INTERNALS].url = parseNextUrl({
      cookies: this[INTERNALS].cookieParser,
      headers: this.headers,
      nextConfig: init.nextConfig,
      url: typeof input === 'string' ? input : input.url,
    })
  }

  public get cookies() {
    return this[INTERNALS].cookieParser()
  }

  public get parsedURL() {
    return this[INTERNALS].url
  }
}

interface RequestInit extends globalThis.RequestInit {
  nextConfig?: {
    basePath?: string
    i18n?: I18NConfig | null
    trailingSlash?: boolean
  }
}

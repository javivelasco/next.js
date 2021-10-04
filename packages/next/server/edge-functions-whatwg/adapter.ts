import type { EdgeFunctionResult } from './types'
import type { I18NConfig } from '../config-shared'

import { FetchEvent } from './spec-compliant/fetch-event'
import { Request } from './spec-extension/request'
import { Response } from './spec-extension/response'
import { waitUntilSymbol, responseSymbol } from './spec-compliant/fetch-event'

export async function adapter(params: {
  handler: (event: FetchEvent) => void | Promise<void>
  request: {
    config?: {
      basePath?: string
      i18n?: I18NConfig | null
      trailingSlash?: boolean
    }
    geo?: { city?: string; country?: string; region?: string }
    headers: Headers
    ip?: string
    method: string
    url: string
  }
}): Promise<EdgeFunctionResult> {
  const event = new FetchEvent(
    new Request(params.request.url, {
      headers: params.request.headers,
      method: params.request.method,
      nextConfig: params.request.config,
    })
  )

  // Execute the handler, it could be a promise but it has
  // to be executed synchronously. Should we check if the
  // user is attempting to respondWith after nextTick?
  params.handler(event)

  return {
    response: (await event[responseSymbol]) || Response.next(),
    waitUntil: Promise.all(event[waitUntilSymbol]),
  }
}

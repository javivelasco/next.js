import type { UrlWithParsedQuery } from 'url'
import type { EdgeRequest } from './request'
import type { EdgeResponse } from './response'

export type Dictionary<T = any> = {
  [key: string]: T
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

export interface RequestHandler {
  (req: EdgeRequest, res: EdgeResponse, next?: () => void): Promise<void>
}

export type HeadersEvent = 'streaming' | 'data' | 'next'

export interface EdgeFunctionResult {
  event: HeadersEvent
  promise: Promise<void>
  response: EdgeResponse
}

export interface RequestData {
  method: string
  headers: Headers
  url: NextEdgeUrl
}

export interface ResponseData {
  headers?: Headers
}

export interface NextEdgeFunction {
  (params: { request: RequestData; response: ResponseData }): Promise<
    EdgeFunctionResult
  >
}

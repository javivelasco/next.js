import type { ParsedUrlQuery } from 'querystring'
import type { EdgeRequest } from './request'
import type { EdgeResponse } from './response'

export type Dictionary<T = any> = {
  [key: string]: T
}

export interface NextEdgeUrl {
  basePath?: string
  calls: number
  defaultLocale?: string
  hash: string | null
  hostname: string | null
  locale?: string
  page?: string
  params: { [key: string]: string }
  pathname: string
  port: string | null
  preflight: boolean
  protocol: string | null
  query: ParsedUrlQuery
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

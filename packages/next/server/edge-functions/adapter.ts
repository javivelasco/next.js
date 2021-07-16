import type { EdgeFunctionResult, RequestHandler } from './types'
import type { RequestData, ResponseData } from './types'
import { EdgeResponse } from './response'
import { EdgeRequest } from './request'

export async function adapter(params: {
  handler: RequestHandler
  request: RequestData
  response: ResponseData
  runner?: (handler: RequestHandler) => RequestHandler
}) {
  return new Promise<EdgeFunctionResult>((resolveResponse) => {
    let resolveHandler: {
      resolve: () => void
      reject: (err: Error) => void
    }

    const promise = new Promise<void>((resolve, reject) => {
      resolveHandler = { resolve: resolve, reject: reject }
    })

    const req = new EdgeRequest({
      headers: params.request.headers,
      method: params.request.method,
      url: params.request.url,
    })

    const res = new EdgeResponse({
      url: params.request.url,
      method: params.request.method,
      headers: params.response.headers,
      onHeadersSent: (event, response) => {
        resolveResponse({
          event,
          response,
          promise,
        })
      },
    })

    function next() {
      if (res.finished) {
        return
      }

      res.headers.set('x-nextjs-next', '1')
      resolveResponse({
        event: 'next',
        response: res,
        promise,
      })
    }

    const runner = params.runner || defaultRunner
    runner(params.handler)(req, res, next)
      .then(resolveHandler!.resolve)
      .catch((error) => {
        resolveHandler!.reject(error)
      })
  })
}

function defaultRunner(handler: RequestHandler) {
  return function (req: EdgeRequest, res: EdgeResponse, next: () => void) {
    return handler(req, res, next)
  }
}

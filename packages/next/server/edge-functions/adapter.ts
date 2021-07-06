import type { EdgeFunctionResult, RequestHandler } from './types'
import type { RequestData, ResponseData } from './types'
import { EdgeResponse } from './response'
import { EdgeRequest } from './request'

export async function adapter(params: {
  handler: RequestHandler
  request: RequestData
  response: ResponseData
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

      res.headers.set('x-vercel-next', '1')
      resolveResponse({
        event: 'next',
        response: res,
        promise,
      })
    }

    params
      .handler(req, res, next)
      .then(resolveHandler!.resolve)
      .catch((error) => {
        resolveHandler!.reject(error)
      })
  })
}

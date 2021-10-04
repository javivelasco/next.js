import { Response as WhatWGResponse } from '../spec-compliant/response'

export class Response extends WhatWGResponse {
  static rewrite(location: string) {
    return new Response(null, {
      headers: {
        'x-middleware-rewrite': location,
      },
    })
  }

  static next() {
    return new Response(null, {
      headers: {
        'x-middleware-next': '1',
      },
    })
  }
}

import type { EdgeFunctionResult } from './types'
import type { RequestData, ResponseData } from './types'
import { TransformStream } from 'web-streams-polyfill/ponyfill'
import { readFileSync } from 'fs'
import { dirname } from 'path'
import vm from 'vm'

export async function run(params: {
  path: string
  request: RequestData
  response: ResponseData
}): Promise<EdgeFunctionResult> {
  const cache = new Map()
  const _require: any = (referrer: string, specifier: string) => {
    const resolved = require.resolve(specifier, { paths: [dirname(referrer)] })
    const cached = cache.get(resolved)
    if (cached !== undefined) {
      return cached.exports
    }

    const module = {
      exports: {},
      loaded: false,
      id: resolved,
    }

    cache.set(resolved, module)
    const fn = vm.runInContext(
      `(function(module,exports,require,__dirname,__filename) {${readFileSync(
        resolved,
        'utf-8'
      )}\n})`,
      sandbox
    )

    try {
      fn(
        module,
        module.exports,
        _require.bind(null, resolved),
        dirname(resolved),
        resolved
      )
    } finally {
      cache.delete(resolved)
    }

    module.loaded = true
    return module.exports
  }

  const sandbox = vm.createContext({
    atob: (b64Encoded: string) =>
      Buffer.from(b64Encoded, 'base64').toString('binary'),
    btoa: (str: string) => Buffer.from(str, 'binary').toString('base64'),
    Buffer,
    console,
    Headers,
    TextDecoder,
    URLSearchParams,
    TextEncoder,
    TransformStream,
  })

  const m = _require(params.path, params.path)
  const fn = m.default || m
  return fn({ request: params.request, response: params.response })
}

import type { I18NConfig } from '../config-shared'
import type { EdgeFunctionResult } from '../edge-functions-whatwg'

import {
  Blob,
  File,
  FormData,
} from 'next/dist/compiled/@javivelasco/formdata-node'
import { ReadableStream } from 'next/dist/compiled/web-streams-polyfill'
import { TransformStream } from 'next/dist/compiled/web-streams-polyfill'
import { Crypto } from '../edge-functions-whatwg/polyfills'
import { readFileSync } from 'fs'
import vm from 'vm'

function atob(b64Encoded: string) {
  return Buffer.from(b64Encoded, 'base64').toString('binary')
}

function btoa(str: string) {
  return Buffer.from(str, 'binary').toString('base64')
}

class TextEncoderRuntime {
  encoder: TextEncoder

  constructor() {
    this.encoder = new TextEncoder()
  }

  get encoding() {
    return this.encoder.encoding
  }

  public encode(input: string) {
    return this.encoder.encode(input)
  }
}

class TextDecoderRuntime {
  decoder: TextDecoder

  constructor() {
    this.decoder = new TextDecoder()
  }

  get encoding() {
    return this.decoder.encoding
  }

  get fatal() {
    return this.decoder.fatal
  }

  get ignoreBOM() {
    return this.decoder.ignoreBOM
  }

  public decode(input: BufferSource, options?: TextDecodeOptions) {
    return this.decoder.decode(input, options)
  }
}

let cache:
  | {
      context: { [key: string]: any }
      paths: Set<string>
      sandbox: vm.Context
    }
  | undefined

export function clearSandboxCache(path: string) {
  // clear cache when path is used by cached sandbox
  if (cache === undefined) return
  if (!cache.paths.has(path)) return
  cache = undefined
}

export async function run(params: {
  name: string
  paths: string[]
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
  if (cache === undefined) {
    const context: { [key: string]: any } = {
      _NEXT_ENTRIES: {},
      atob,
      Blob,
      btoa,
      clearInterval,
      clearTimeout,
      console: {
        assert: console.assert.bind(console),
        error: console.error.bind(console),
        info: console.info.bind(console),
        log: console.log.bind(console),
        time: console.time.bind(console),
        timeEnd: console.timeEnd.bind(console),
        timeLog: console.timeLog.bind(console),
        warn: console.warn.bind(console),
      },
      Crypto,
      crypto: new Crypto(),
      fetch,
      File,
      FormData,
      Headers,
      process: { env: { ...process.env } },
      ReadableStream,
      setInterval,
      setTimeout,
      TextDecoder: TextDecoderRuntime,
      TextEncoder: TextEncoderRuntime,
      TransformStream,
      URL,
      URLSearchParams,
    }

    cache = {
      context,
      sandbox: vm.createContext({
        ...context,
        self: context,
      }),
      paths: new Set<string>(),
    }
  }

  for (const path of params.paths) {
    if (!cache.paths.has(path)) {
      vm.runInNewContext(readFileSync(path, 'utf-8'), cache.sandbox, {
        filename: path,
      })
      cache.paths.add(path)
    }
  }

  const fn = cache.context._NEXT_ENTRIES[`edge_${params.name}`].default
  return fn({ request: params.request })
}

import {
  webpack,
  isWebpack5,
  sources,
} from 'next/dist/compiled/webpack/webpack'
import { EDGE_MANIFEST } from '../../../shared/lib/constants'

export interface EdgeManifest {
  [page: string]: string
}

export default class EdgeManifestPlugin {
  dev: boolean

  constructor({ dev }: { dev: boolean }) {
    this.dev = dev
  }

  createAssets(compilation: any, assets: any) {
    const entrypoints = compilation.entrypoints
    const edgeFunctions: EdgeManifest = {}

    for (const entrypoint of entrypoints.values()) {
      const location = getEdgeFunctionFromEntrypoint(entrypoint.name)
      if (!location) {
        continue
      }

      const files = entrypoint
        .getFiles()
        .filter(
          (file: string) =>
            !file.includes('webpack-runtime') && file.endsWith('.js')
        )

      if (!isWebpack5 && files.length > 1) {
        console.log(
          `Found more than one file in server entrypoint ${entrypoint.name}`,
          files
        )
        continue
      }

      edgeFunctions[location] = files[files.length - 1]
      if (isWebpack5 && !this.dev) {
        edgeFunctions[location] = edgeFunctions[location].slice(3)
      }

      edgeFunctions[location] = edgeFunctions[location].replace(/\\/g, '/')
    }

    assets[
      `${isWebpack5 && !this.dev ? '../' : ''}` + EDGE_MANIFEST
    ] = new sources.RawSource(JSON.stringify(edgeFunctions, null, 2))
  }

  apply(compiler: webpack.Compiler) {
    if (isWebpack5) {
      compiler.hooks.make.tap('NextJsEdgeManifest', (compilation) => {
        // @ts-ignore TODO: Remove ignore when webpack 5 is stable
        compilation.hooks.processAssets.tap(
          {
            name: 'NextJsEdgeManifest',
            // @ts-ignore TODO: Remove ignore when webpack 5 is stable
            stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
          },
          (assets: any) => {
            this.createAssets(compilation, assets)
          }
        )
      })
      return
    }

    compiler.hooks.emit.tap('NextJsEdgeManifest', (compilation: any) => {
      this.createAssets(compilation, compilation.assets)
    })
  }
}

const EDGE_FUNCTION_REGEX = /^pages[/\\]?(.*)\/_edge$/

function getEdgeFunctionFromEntrypoint(entryFile: string): string | null {
  const result = EDGE_FUNCTION_REGEX.exec(entryFile)
  return result ? `/${result[1]}` : null
}

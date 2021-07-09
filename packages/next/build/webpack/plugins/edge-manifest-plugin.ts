import {
  webpack,
  isWebpack5,
  sources,
} from 'next/dist/compiled/webpack/webpack'
import { EDGE_MANIFEST } from '../../../shared/lib/constants'
import { getEdgeFunctionRegex } from '../../../shared/lib/router/utils'

export type EdgeManifest = {
  version: 1
  edgeFunctions: {
    [page: string]: {
      file: string
      page: string
      regexp: string
    }
  }
}

export default class EdgeManifestPlugin {
  dev: boolean

  constructor({ dev }: { dev: boolean }) {
    this.dev = dev
  }

  createAssets(compilation: any, assets: any) {
    const entrypoints = compilation.entrypoints
    const edgeManifest: EdgeManifest = {
      edgeFunctions: {},
      version: 1,
    }

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

      edgeManifest.edgeFunctions[location] = {
        file: files[files.length - 1],
        page: location,
        regexp: getEdgeFunctionRegex(location).namedRegex!,
      }

      if (isWebpack5 && !this.dev) {
        edgeManifest.edgeFunctions[location].file = edgeManifest.edgeFunctions[
          location
        ].file.slice(3)
      }

      edgeManifest.edgeFunctions[location].file = edgeManifest.edgeFunctions[
        location
      ].file.replace(/\\/g, '/')
    }

    assets[
      `${isWebpack5 && !this.dev ? '../' : ''}` + EDGE_MANIFEST
    ] = new sources.RawSource(JSON.stringify(edgeManifest, null, 2))
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

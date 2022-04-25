import type { ClientPagesLoaderOptions } from './webpack/loaders/next-client-pages-loader'
import type { MiddlewareLoaderOptions } from './webpack/loaders/next-middleware-loader'
import type { MiddlewareSSRLoaderQuery } from './webpack/loaders/next-middleware-ssr-loader'
import type { NextConfigComplete, NextConfig } from '../server/config-shared'
import type { PageRuntime } from '../server/config-shared'
import type { ServerlessLoaderQuery } from './webpack/loaders/next-serverless-loader'
import type { webpack5 } from 'next/dist/compiled/webpack/webpack'
import type { LoadedEnvFiles } from '@next/env'
import fs from 'fs'
import chalk from 'next/dist/compiled/chalk'
import { posix, join } from 'path'
import { stringify } from 'querystring'
import { API_ROUTE, DOT_NEXT_ALIAS, PAGES_DIR_ALIAS } from '../lib/constants'
import { EDGE_RUNTIME_WEBPACK } from '../shared/lib/constants'
import { MIDDLEWARE_ROUTE } from '../lib/constants'
import { __ApiPreviewProps } from '../server/api-utils'
import { isTargetLikeServerless } from '../server/utils'
import { normalizePagePath } from '../server/normalize-page-path'
import { normalizePathSep } from '../server/denormalize-page-path'
import { ssrEntries } from './webpack/plugins/middleware-plugin'
import { warn } from './output/log'
import { parse } from '../build/swc'
import { isFlightPage, withoutRSCExtensions } from './utils'

type ObjectValue<T> = T extends { [key: string]: infer V } ? V : never

/**
 * For a given page path removes the provided extensions. `/_app.server` is a
 * special case because it is the only page where we want to preserve the RSC
 * server extension.
 */
export function getPageFromPath(pagePath: string, pageExtensions: string[]) {
  const extensions = pagePath.includes('/_app.server.')
    ? withoutRSCExtensions(pageExtensions)
    : pageExtensions

  const page = normalizePathSep(
    pagePath.replace(new RegExp(`\\.+(${extensions.join('|')})$`), '')
  ).replace(/\/index$/, '')

  return page === '' ? '/' : page
}

export function createPagesMapping({
  hasServerComponents,
  isDev,
  pageExtensions,
  pagePaths,
}: {
  hasServerComponents: boolean
  isDev: boolean
  pageExtensions: string[]
  pagePaths: string[]
}): { [page: string]: string } {
  const previousPages: { [key: string]: string } = {}
  const pages = pagePaths.reduce<{ [key: string]: string }>(
    (result, pagePath) => {
      // Do not process .d.ts files inside the `pages` folder
      if (pagePath.endsWith('.d.ts') && pageExtensions.includes('ts')) {
        return result
      }

      const pageKey = getPageFromPath(pagePath, pageExtensions)

      // Assume that if there's a Client Component, that there is
      // a matching Server Component that will map to the page.
      // so we will not process it
      if (hasServerComponents && /\.client$/.test(pageKey)) {
        return result
      }

      if (pageKey in result) {
        warn(
          `Duplicate page detected. ${chalk.cyan(
            join('pages', previousPages[pageKey])
          )} and ${chalk.cyan(
            join('pages', pagePath)
          )} both resolve to ${chalk.cyan(pageKey)}.`
        )
      } else {
        previousPages[pageKey] = pagePath
      }

      result[pageKey] = normalizePathSep(join(PAGES_DIR_ALIAS, pagePath))
      return result
    },
    {}
  )

  // In development we always alias these to allow Webpack to fallback to
  // the correct source file so that HMR can work properly when a file is
  // added or removed.
  if (isDev) {
    delete pages['/_app']
    delete pages['/_app.server']
    delete pages['/_error']
    delete pages['/_document']
  }

  const root = isDev ? PAGES_DIR_ALIAS : 'next/dist/pages'
  return {
    '/_app': `${root}/_app`,
    '/_error': `${root}/_error`,
    '/_document': `${root}/_document`,
    ...(hasServerComponents ? { '/_app.server': `${root}/_app.server` } : {}),
    ...pages,
  }
}

const cachedPageRuntimeConfig = new Map<string, [number, PageRuntime]>()

// @TODO: We should limit the maximum concurrency of this function as there
// could be thousands of pages existing.
export async function getPageRuntime(
  pageFilePath: string,
  nextConfig: Partial<NextConfig>,
  isDev?: boolean
): Promise<PageRuntime> {
  if (!nextConfig.experimental?.reactRoot) return undefined

  const globalRuntime = nextConfig.experimental?.runtime
  const cached = cachedPageRuntimeConfig.get(pageFilePath)
  if (cached) {
    return cached[1]
  }

  let pageContent: string
  try {
    pageContent = await fs.promises.readFile(pageFilePath, {
      encoding: 'utf8',
    })
  } catch (err) {
    if (!isDev) throw err
    return undefined
  }

  // When gSSP or gSP is used, this page requires an execution runtime. If the
  // page config is not present, we fallback to the global runtime. Related
  // discussion:
  // https://github.com/vercel/next.js/discussions/34179
  let isRuntimeRequired: boolean = false
  let pageRuntime: PageRuntime = undefined

  // Since these configurations should always be static analyzable, we can
  // skip these cases that "runtime" and "gSP", "gSSP" are not included in the
  // source code.
  if (/runtime|getStaticProps|getServerSideProps/.test(pageContent)) {
    try {
      const { body } = await parse(pageContent, {
        filename: pageFilePath,
        isModule: 'unknown',
      })

      for (const node of body) {
        const { type, declaration } = node
        if (type === 'ExportDeclaration') {
          // Match `export const config`
          const valueNode = declaration?.declarations?.[0]
          if (valueNode?.id?.value === 'config') {
            const props = valueNode.init.properties
            const runtimeKeyValue = props.find(
              (prop: any) => prop.key.value === 'runtime'
            )
            const runtime = runtimeKeyValue?.value?.value
            pageRuntime =
              runtime === 'edge' || runtime === 'nodejs' ? runtime : pageRuntime
          } else if (declaration?.type === 'FunctionDeclaration') {
            // Match `export function getStaticProps | getServerSideProps`
            const identifier = declaration.identifier?.value
            if (
              identifier === 'getStaticProps' ||
              identifier === 'getServerSideProps'
            ) {
              isRuntimeRequired = true
            }
          }
        } else if (type === 'ExportNamedDeclaration') {
          // Match `export { getStaticProps | getServerSideProps } <from '../..'>`
          const { specifiers } = node
          for (const specifier of specifiers) {
            const { orig } = specifier
            const hasDataFetchingExports =
              specifier.type === 'ExportSpecifier' &&
              orig?.type === 'Identifier' &&
              (orig?.value === 'getStaticProps' ||
                orig?.value === 'getServerSideProps')
            if (hasDataFetchingExports) {
              isRuntimeRequired = true
              break
            }
          }
        }
      }
    } catch (err) {}
  }

  if (!pageRuntime) {
    if (isRuntimeRequired) {
      pageRuntime = globalRuntime
    }
  }

  cachedPageRuntimeConfig.set(pageFilePath, [Date.now(), pageRuntime])
  return pageRuntime
}

export function invalidatePageRuntimeCache(
  pageFilePath: string,
  safeTime: number
) {
  const cached = cachedPageRuntimeConfig.get(pageFilePath)
  if (cached && cached[0] < safeTime) {
    cachedPageRuntimeConfig.delete(pageFilePath)
  }
}

interface CreateEntrypointsParams {
  buildId: string
  config: NextConfigComplete
  envFiles: LoadedEnvFiles
  isDev?: boolean
  pages: { [page: string]: string }
  pagesDir: string
  previewMode: __ApiPreviewProps
  target: 'server' | 'serverless' | 'experimental-serverless-trace'
}

export async function createEntrypoints(params: CreateEntrypointsParams) {
  const { config, pages, pagesDir, isDev, target } = params
  const edgeServer: webpack5.EntryObject = {}
  const server: webpack5.EntryObject = {}
  const client: webpack5.EntryObject = {}

  await Promise.all(
    Object.keys(pages).map(async (page) => {
      const bundleFile = normalizePagePath(page)
      const clientBundlePath = posix.join('pages', bundleFile)
      const serverBundlePath = posix.join('pages', bundleFile)
      const pageRuntime = await getPageRuntime(
        !pages[page].startsWith(PAGES_DIR_ALIAS)
          ? require.resolve(pages[page])
          : join(pagesDir, pages[page].replace(PAGES_DIR_ALIAS, '')),
        config,
        isDev
      )

      if (isTargetLikeServerless(target) && pageRuntime === 'edge') {
        throw new Error(`Edge Runtime is not compatible with Serverless`)
      }

      if (isTargetLikeServerless(target) && page === '/_app.server') {
        throw new Error(`RSC is not compatible with Serverless`)
      }

      // Make sure next/router is a dependency of _app or else chunk splitting
      // might cause the router to not be able to load causing hydration
      // to fail
      const addClientEntry = () => {
        const pageLoader = `next-client-pages-loader?${stringify(
          getClientPagesLoader(page, params)
        )}!`

        client[clientBundlePath] =
          page === '/_app'
            ? [pageLoader, require.resolve('../client/router')]
            : pageLoader
      }

      const addServerEntry = () => {
        if (isTargetLikeServerless(target)) {
          if (page !== '/_app' && page !== '/_document') {
            server[serverBundlePath] = `next-serverless-loader?${stringify(
              getServerlessLoaderOpts(page, params)
            )}!`
          }
        } else {
          server[serverBundlePath] = [pages[page]]
        }
      }

      const addEdgeServerEntry = () => {
        if (page.match(MIDDLEWARE_ROUTE)) {
          edgeServer[serverBundlePath] = finalizeEntrypoint({
            isEdgeServer: true,
            isMiddleware: true,
            name: '[name].js',
            value: `next-middleware-loader?${stringify(
              getNextMiddlewareLoaderOpts(page, params)
            )}!`,
          })
        } else {
          const isFlight = isFlightPage(config, pages[page])
          ssrEntries.set(clientBundlePath, { requireFlightManifest: isFlight })
          edgeServer[serverBundlePath] = finalizeEntrypoint({
            isEdgeServer: true,
            name: '[name].js',
            value: `next-middleware-ssr-loader?${stringify(
              getMiddlewareSSRLoaderOpts(page, params)
            )}!`,
          })
        }
      }

      if (page.match(MIDDLEWARE_ROUTE)) {
        return addEdgeServerEntry()
      }

      if (page.match(API_ROUTE)) {
        return addServerEntry()
      }

      if (page === '/_document') {
        return addServerEntry()
      }

      if (
        page === '/_app' ||
        page === '/_error' ||
        page === '/404' ||
        page === '/500'
      ) {
        addClientEntry()
        addServerEntry()
        return
      }

      addClientEntry()
      if (pageRuntime === 'edge') {
        addEdgeServerEntry()
      } else {
        addServerEntry()
      }
    })
  )

  return {
    client,
    server,
    edgeServer,
  }
}

function getNextMiddlewareLoaderOpts(
  page: string,
  opts: CreateEntrypointsParams
): MiddlewareLoaderOptions {
  return {
    absolutePagePath: opts.pages[page],
    page: page,
  }
}

function getClientPagesLoader(
  page: string,
  opts: CreateEntrypointsParams
): ClientPagesLoaderOptions {
  return {
    absolutePagePath: opts.pages[page],
    page: page,
  }
}

function getServerlessLoaderOpts(
  page: string,
  opts: CreateEntrypointsParams
): ServerlessLoaderQuery {
  return {
    absolute404Path: opts.pages['/404'] || '',
    absoluteAppPath: opts.pages['/_app'],
    absoluteAppServerPath: opts.pages['/_app.server'],
    absoluteDocumentPath: opts.pages['/_document'],
    absoluteErrorPath: opts.pages['/_error'],
    absolutePagePath: opts.pages[page],
    assetPrefix: opts.config.assetPrefix,
    basePath: opts.config.basePath,
    buildId: opts.buildId,
    canonicalBase: opts.config.amp.canonicalBase || '',
    distDir: DOT_NEXT_ALIAS,
    generateEtags: opts.config.generateEtags ? 'true' : '',
    i18n: opts.config.i18n ? JSON.stringify(opts.config.i18n) : '',
    // base64 encode to make sure contents don't break webpack URL loading
    loadedEnvFiles: Buffer.from(JSON.stringify(opts.envFiles)).toString(
      'base64'
    ),
    page: page,
    poweredByHeader: opts.config.poweredByHeader ? 'true' : '',
    previewProps: JSON.stringify(opts.previewMode),
    reactRoot: !!opts.config.experimental.reactRoot ? 'true' : '',
    runtimeConfig:
      Object.keys(opts.config.publicRuntimeConfig).length > 0 ||
      Object.keys(opts.config.serverRuntimeConfig).length > 0
        ? JSON.stringify({
            publicRuntimeConfig: opts.config.publicRuntimeConfig,
            serverRuntimeConfig: opts.config.serverRuntimeConfig,
          })
        : '',
  }
}

function getMiddlewareSSRLoaderOpts(
  page: string,
  opts: CreateEntrypointsParams
): MiddlewareSSRLoaderQuery {
  return {
    absolute500Path: opts.pages['/500'] || '',
    absoluteAppPath: opts.pages['/_app'],
    absoluteAppServerPath: opts.pages['/_app.server'],
    absoluteDocumentPath: opts.pages['/_document'],
    absoluteErrorPath: opts.pages['/_error'],
    absolutePagePath: opts.pages[page],
    buildId: opts.buildId,
    dev: false,
    isServerComponent: isFlightPage(opts.config, opts.pages[page]),
    page: page,
    stringifiedConfig: JSON.stringify(opts.config),
  }
}

export function finalizeEntrypoint({
  name,
  value,
  isNodeServer,
  isMiddleware,
  isEdgeServer,
}: {
  name: string
  value: ObjectValue<webpack5.EntryObject>
  isNodeServer?: boolean
  isMiddleware?: boolean
  isEdgeServer?: boolean
}): ObjectValue<webpack5.EntryObject> {
  if (isEdgeServer && isNodeServer) {
    throw new Error(`You can't provide both "isNodeServer" and "isEdgeServer"`)
  }

  const entry =
    typeof value !== 'object' || Array.isArray(value)
      ? { import: value }
      : value

  if (isNodeServer) {
    const isApi = name.startsWith('pages/api/')
    return {
      publicPath: isApi ? '' : undefined,
      runtime: isApi ? 'webpack-api-runtime' : 'webpack-runtime',
      layer: isApi ? 'api' : undefined,
      ...entry,
    }
  }

  if (isEdgeServer) {
    return {
      layer: isMiddleware ? 'middleware' : undefined,
      library: { name: ['_ENTRIES', `middleware_[name]`], type: 'assign' },
      runtime: EDGE_RUNTIME_WEBPACK,
      asyncChunks: false,
      ...entry,
    }
  }

  if (
    // Client special cases
    name !== 'polyfills' &&
    name !== 'main' &&
    name !== 'amp' &&
    name !== 'react-refresh'
  ) {
    return {
      dependOn:
        name.startsWith('pages/') && name !== 'pages/_app'
          ? 'pages/_app'
          : 'main',
      ...entry,
    }
  }

  return entry
}

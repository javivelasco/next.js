import { promises } from 'fs'
import { join } from 'path'
import {
  EDGE_MANIFEST,
  PAGES_MANIFEST,
  SERVER_DIRECTORY,
  SERVERLESS_DIRECTORY,
  FONT_MANIFEST,
} from '../shared/lib/constants'
import { normalizePagePath, denormalizePagePath } from './normalize-page-path'
import { PagesManifest } from '../build/webpack/plugins/pages-manifest-plugin'
import {
  EdgeManifest,
  EdgeManifestItem,
} from '../build/webpack/plugins/edge-manifest-plugin'
import { normalizeLocalePath } from '../shared/lib/i18n/normalize-locale-path'

export function pageNotFoundError(page: string): Error {
  const err: any = new Error(`Cannot find module for page: ${page}`)
  err.code = 'ENOENT'
  return err
}

export function getPagePath(
  page: string,
  distDir: string,
  serverless: boolean,
  dev?: boolean,
  locales?: string[]
): string {
  const serverBuildPath = join(
    distDir,
    serverless && !dev ? SERVERLESS_DIRECTORY : SERVER_DIRECTORY
  )
  const pagesManifest = require(join(
    serverBuildPath,
    PAGES_MANIFEST
  )) as PagesManifest

  try {
    page = denormalizePagePath(normalizePagePath(page))
  } catch (err) {
    console.error(err)
    throw pageNotFoundError(page)
  }
  let pagePath = pagesManifest[page]

  if (!pagesManifest[page] && locales) {
    const manifestNoLocales: typeof pagesManifest = {}

    for (const key of Object.keys(pagesManifest)) {
      manifestNoLocales[normalizeLocalePath(key, locales).pathname] =
        pagesManifest[key]
    }
    pagePath = manifestNoLocales[page]
  }

  if (!pagePath) {
    throw pageNotFoundError(page)
  }
  return join(serverBuildPath, pagePath)
}

export function requirePage(
  page: string,
  distDir: string,
  serverless: boolean
): any {
  const pagePath = getPagePath(page, distDir, serverless)
  if (pagePath.endsWith('.html')) {
    return promises.readFile(pagePath, 'utf8')
  }
  return require(pagePath)
}

export function requireFontManifest(distDir: string, serverless: boolean) {
  const serverBuildPath = join(
    distDir,
    serverless ? SERVERLESS_DIRECTORY : SERVER_DIRECTORY
  )
  const fontManifest = require(join(serverBuildPath, FONT_MANIFEST))
  return fontManifest
}

/**
 * For a given Edge Function location it will load the Edge Manifest to find
 * the file for that location. If it is not possible to find it, it will
 * throw an error, otherwise it returns the full path to import the module.
 */
export function getEdgeFunctionPath(
  page: string,
  distDir: string,
  serverless: boolean,
  dev?: boolean
): string {
  const serverBuildPath = join(
    distDir,
    serverless && !dev ? SERVERLESS_DIRECTORY : SERVER_DIRECTORY
  )

  const edgeManifest: EdgeManifest = require(join(
    serverBuildPath,
    EDGE_MANIFEST
  ))

  try {
    page = denormalizePagePath(normalizePagePath(page))
  } catch (err) {
    throw pageNotFoundError(page)
  }

  edgeManifest.forEach((edgeManifestElement) => {
    if (edgeManifestElement['page'] === page) {
      return join(serverBuildPath, edgeManifestElement['file'])
    }
  })

  throw pageNotFoundError(page)
}

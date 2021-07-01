import { IncomingMessage, ServerResponse } from 'http'
import { UrlWithParsedQuery } from 'url'
import type { ParsedUrlQuery } from 'querystring'

import pathMatch from '../shared/lib/router/utils/path-match'
import { removePathTrailingSlash } from '../client/normalize-trailing-slash'
import { normalizeLocalePath } from '../shared/lib/i18n/normalize-locale-path'
import { RouteHas } from '../lib/load-custom-routes'
import { matchHas } from '../shared/lib/router/utils/prepare-destination'

export const route = pathMatch()

export type Params = { [param: string]: any }

export type RouteMatch = (pathname: string | null | undefined) => false | Params

type RouteResult = {
  finished: boolean
  pathname?: string
  query?: ParsedUrlQuery
}

export type Route = {
  match: RouteMatch
  has?: RouteHas[]
  type: string
  check?: boolean
  statusCode?: number
  name: string
  requireBasePath?: false
  internal?: true
  fn: (
    req: IncomingMessage,
    res: ServerResponse,
    params: Params,
    parsedUrl: UrlWithParsedQuery
  ) => Promise<RouteResult> | RouteResult
}

export type DynamicRoutes = Array<{ page: string; match: RouteMatch }>

export type PageChecker = (pathname: string) => Promise<boolean>

const customRouteTypes = new Set(['rewrite', 'redirect', 'header'])

/**
 * Removes `basePath` from `pathname` if it is present making sure that
 * when it consists of just the basePath the root is returned.
 *
 * @param basePath The basePath to be removed
 * @param pathname The pathname to remove the basePath from
 * @returns The pathname with no basePath
 */
function replaceBasePath(basePath: string, pathname: string) {
  return pathname!.replace(basePath, '') || '/'
}

export default class Router {
  basePath: string
  headers: Route[]
  fsRoutes: Route[]
  redirects: Route[]
  rewrites: {
    beforeFiles: Route[]
    afterFiles: Route[]
    fallback: Route[]
  }
  catchAllRoute: Route
  catchAllEdgeFunctions: Route
  pageChecker: PageChecker
  dynamicRoutes: DynamicRoutes
  useFileSystemPublicRoutes: boolean
  locales: string[]

  constructor({
    basePath = '',
    headers = [],
    fsRoutes = [],
    rewrites = {
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    },
    redirects = [],
    catchAllRoute,
    catchAllEdgeFunctions,
    dynamicRoutes = [],
    pageChecker,
    useFileSystemPublicRoutes,
    locales = [],
  }: {
    basePath: string
    headers: Route[]
    fsRoutes: Route[]
    rewrites: {
      beforeFiles: Route[]
      afterFiles: Route[]
      fallback: Route[]
    }
    redirects: Route[]
    catchAllRoute: Route
    catchAllEdgeFunctions: Route
    dynamicRoutes: DynamicRoutes | undefined
    pageChecker: PageChecker
    useFileSystemPublicRoutes: boolean
    locales: string[]
  }) {
    this.basePath = basePath
    this.headers = headers
    this.fsRoutes = fsRoutes
    this.rewrites = rewrites
    this.redirects = redirects
    this.pageChecker = pageChecker
    this.catchAllRoute = catchAllRoute
    this.catchAllEdgeFunctions = catchAllEdgeFunctions
    this.dynamicRoutes = dynamicRoutes
    this.useFileSystemPublicRoutes = useFileSystemPublicRoutes
    this.locales = locales
  }

  setDynamicRoutes(routes: DynamicRoutes = []) {
    this.dynamicRoutes = routes
  }

  addFsRoute(fsRoute: Route) {
    this.fsRoutes.unshift(fsRoute)
  }

  async execute(
    req: IncomingMessage,
    res: ServerResponse,
    parsedUrl: UrlWithParsedQuery
  ): Promise<boolean> {
    /**
     * An object to memoize page checks.
     */
    const pageChecks: { [name: string]: Promise<boolean> } = {}

    /**
     * A memoized version of the pageChecker that checks if a file
     * for a given path exists.
     *
     * @param p Pathname to check if there is a page for.
     * @returns True if a page exists or false otherwise.
     */
    const memoizedPageChecker = async (p: string): Promise<boolean> => {
      p = normalizeLocalePath(p, this.locales).pathname

      if (pageChecks[p]) {
        return pageChecks[p]
      }
      const result = this.pageChecker(p)
      pageChecks[p] = result
      return result
    }

    /**
     * Since we will be iterating through each route, this object accumulates
     * potential changes to the pathname and query for cases where we rewrite
     * or append new parameters.
     */
    const parsedUrlUpdated = parsedUrl

    /**
     * For the provided parsed URL it checks each of the routes in fsRoutes.
     * For every match it will invoke the handler with a temp replacement
     * of the parsed URL. It will go on until the request is finished.
     *
     * If it is not finished, it will next check for a specific page or a
     * matching dynamic route. When there is a match, it will invoke the
     * catchAllRoute passing `_nextBubbleNoFallback` to prevent fallbacks.
     */
    const applyCheckTrue = async (checkParsedUrl: UrlWithParsedQuery) => {
      const originalFsPathname = checkParsedUrl.pathname
      const fsPathname = replaceBasePath(this.basePath, originalFsPathname!)

      for (const fsRoute of this.fsRoutes) {
        const fsParams = fsRoute.match(fsPathname)

        if (fsParams) {
          checkParsedUrl.pathname = fsPathname

          const fsResult = await fsRoute.fn(req, res, fsParams, checkParsedUrl)

          if (fsResult.finished) {
            return true
          }

          checkParsedUrl.pathname = originalFsPathname
        }
      }
      let matchedPage = await memoizedPageChecker(fsPathname)

      // If we didn't match a page check dynamic routes
      if (!matchedPage) {
        const normalizedFsPathname = normalizeLocalePath(
          fsPathname,
          this.locales
        ).pathname

        for (const dynamicRoute of this.dynamicRoutes) {
          if (dynamicRoute.match(normalizedFsPathname)) {
            matchedPage = true
          }
        }
      }

      // Matched a page or dynamic route so render it using catchAllRoute
      if (matchedPage) {
        const pageParams = this.catchAllRoute.match(checkParsedUrl.pathname)
        checkParsedUrl.pathname = fsPathname
        checkParsedUrl.query._nextBubbleNoFallback = '1'

        const result = await this.catchAllRoute.fn(
          req,
          res,
          pageParams as Params,
          checkParsedUrl
        )
        return result.finished
      }
    }

    /*
      Desired routes order
      - headers
      - redirects
      - Check filesystem (including pages), if nothing found continue
      - User rewrites (checking filesystem and pages each match)
    */

    const allRoutes = [
      ...this.headers,
      ...this.redirects,
      ...this.rewrites.beforeFiles,
      ...this.fsRoutes,
      ...(this.useFileSystemPublicRoutes ? [this.catchAllEdgeFunctions] : []),
      // We only check the catch-all route if public page routes hasn't been
      // disabled
      ...(this.useFileSystemPublicRoutes
        ? [
            {
              type: 'route',
              name: 'page checker',
              requireBasePath: false,
              match: route('/:path*'),
              fn: async (checkerReq, checkerRes, params, parsedCheckerUrl) => {
                let { pathname } = parsedCheckerUrl
                pathname = removePathTrailingSlash(pathname || '/')

                if (!pathname) {
                  return { finished: false }
                }

                if (await memoizedPageChecker(pathname)) {
                  return this.catchAllRoute.fn(
                    checkerReq,
                    checkerRes,
                    params,
                    parsedCheckerUrl
                  )
                }
                return { finished: false }
              },
            } as Route,
          ]
        : []),
      ...this.rewrites.afterFiles,
      ...(this.rewrites.fallback.length
        ? [
            {
              type: 'route',
              name: 'dynamic route/page check',
              requireBasePath: false,
              match: route('/:path*'),
              fn: async (
                _checkerReq,
                _checkerRes,
                _params,
                parsedCheckerUrl
              ) => {
                return {
                  finished: await applyCheckTrue(parsedCheckerUrl),
                }
              },
            } as Route,
            ...this.rewrites.fallback,
          ]
        : []),

      // We only check the catch-all route if public page routes hasn't been
      // disabled
      ...(this.useFileSystemPublicRoutes ? [this.catchAllRoute] : []),
    ]
    const originallyHadBasePath =
      !this.basePath || (req as any)._nextHadBasePath

    for (const testRoute of allRoutes) {
      // if basePath is being used, the basePath will still be included
      // in the pathname here to allow custom-routes to require containing
      // it or not, filesystem routes and pages must always include the basePath
      // if it is set
      let currentPathname = parsedUrlUpdated.pathname as string
      const originalPathname = currentPathname
      const isCustomRoute = customRouteTypes.has(testRoute.type)
      const isPublicFolderCatchall = testRoute.name === 'public folder catchall'
      const keepBasePath = isCustomRoute || isPublicFolderCatchall
      const keepLocale = isCustomRoute

      const currentPathnameNoBasePath = replaceBasePath(
        this.basePath,
        currentPathname
      )

      if (!keepBasePath) {
        currentPathname = currentPathnameNoBasePath
      }

      const localePathResult = normalizeLocalePath(
        currentPathnameNoBasePath,
        this.locales
      )
      const activeBasePath = keepBasePath ? this.basePath : ''

      if (keepLocale) {
        if (
          !testRoute.internal &&
          parsedUrl.query.__nextLocale &&
          !localePathResult.detectedLocale
        ) {
          currentPathname = `${activeBasePath}/${parsedUrl.query.__nextLocale}${
            currentPathnameNoBasePath === '/' ? '' : currentPathnameNoBasePath
          }`
        }

        if (
          (req as any).__nextHadTrailingSlash &&
          !currentPathname.endsWith('/')
        ) {
          currentPathname += '/'
        }
      } else {
        currentPathname = `${
          (req as any)._nextHadBasePath ? activeBasePath : ''
        }${
          activeBasePath && localePathResult.pathname === '/'
            ? ''
            : localePathResult.pathname
        }`
      }

      let newParams = testRoute.match(currentPathname)

      if (testRoute.has && newParams) {
        const hasParams = matchHas(req, testRoute.has, parsedUrlUpdated.query)

        if (hasParams) {
          Object.assign(newParams, hasParams)
        } else {
          newParams = false
        }
      }

      // Check if the match function matched
      if (newParams) {
        // since we require basePath be present for non-custom-routes we
        // 404 here when we matched an fs route
        if (!keepBasePath) {
          if (!originallyHadBasePath && !(req as any)._nextDidRewrite) {
            if (testRoute.requireBasePath !== false) {
              // consider this a non-match so the 404 renders
              return false
            }
            // page checker occurs before rewrites so we need to continue
            // to check those since they don't always require basePath
            continue
          }

          /**
           * Temporary change the pathname to invoke the handler when the
           * route matches. This change should be reverted afterwards if
           * there will be more handlers.
           */
          parsedUrlUpdated.pathname = currentPathname
        }

        const result = await testRoute.fn(req, res, newParams, parsedUrlUpdated)
        if (result.finished) {
          return true
        }

        /**
         * Since at this point there will be more routes to match we must
         * restore the original pathname if it was previously changed.
         */
        if (!keepBasePath) {
          parsedUrlUpdated.pathname = originalPathname
        }

        /**
         * When the result of the invoked handler has an effect to change
         * the pathname we will carry the change within the ParsedURL.
         */
        if (result.pathname) {
          parsedUrlUpdated.pathname = result.pathname
        }

        /**
         * When the result of the invoked handler has an effect to change
         * the query we will merge the query with the current one.
         */
        if (result.query) {
          parsedUrlUpdated.query = {
            ...parsedUrlUpdated.query,
            ...result.query,
          }
        }

        /**
         * If the route matched and it has a flag to check the filesystem,
         * we shorcut applying the filesystem routing. This happens for
         * rewrite handlers.
         */
        if (testRoute.check === true) {
          if (await applyCheckTrue(parsedUrlUpdated)) {
            return true
          }
        }
      }
    }
    return false
  }
}

import { getParametrizedRoute, RouteRegex } from './route-regex'

/**
 * Takes a normalizedRoute being a page path that will hold an edge function
 * and generates the corresponding RouteRegex that would tell if the edge
 * should be invoked for a given path.
 */
export function getEdgeFunctionRegex(normalizedRoute: string): RouteRegex {
  const result = getParametrizedRoute(normalizedRoute)
  if ('routeKeys' in result) {
    if (result.parameterizedRoute === '/') {
      return {
        groups: {},
        namedRegex: `^/(?!_next).*$`,
        re: new RegExp('^/(?!_next).*$'),
        routeKeys: {},
      }
    }

    return {
      groups: result.groups,
      namedRegex: `^${result.namedParameterizedRoute}(?:(/.*)?)$`,
      re: new RegExp(`^${result.parameterizedRoute}(?:(/.*)?)$`),
      routeKeys: result.routeKeys,
    }
  }

  if (result.parameterizedRoute === '/') {
    return {
      groups: {},
      re: new RegExp('^/.*$'),
    }
  }

  return {
    groups: {},
    re: new RegExp(`^${result.parameterizedRoute}(?:(/.*)?)$`),
  }
}

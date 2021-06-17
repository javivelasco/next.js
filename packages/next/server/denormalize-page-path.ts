/**
 * Removes all escape characters from a given path for each of the separators.
 * Allows to chance from /foo\/bar\/baz to /foo/bar/baz.
 *
 * @param path The path to normalized.
 * @returns The normalized path.
 */
export function normalizePathSep(path: string): string {
  return path.replace(/\\/g, '/')
}

/**
 * Removes all escape characters from a given page path and removes the
 * leading /index if it exists. When the page is /index it normalizes to
 * simply the root /.
 *
 * @param page Page to dernomalize.
 * @returns The denormalized page.
 */
export function denormalizePagePath(page: string) {
  page = normalizePathSep(page)
  if (page.startsWith('/index/')) {
    page = page.slice(6)
  } else if (page === '/index') {
    page = '/'
  }
  return page
}

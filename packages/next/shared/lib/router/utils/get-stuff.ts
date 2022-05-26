import { normalizeLocalePath } from '../../i18n/normalize-locale-path'
import { pathHasPrefix } from './path-has-prefix'
import { removePathPrefix } from './remove-path-prefix'

export interface Stuff {
  basePath?: string
  buildId?: string
  locale?: string
  path: string
}

interface StuffOptions {
  basePath?: string
  defaultLocale?: string // only to serialize
  locales?: string[]
}

interface URLLike {
  pathname: string
}

export function getStuff(url: URLLike, opts: StuffOptions): Stuff {
  return getRemoveLocale(opts)(
    getRemoveData()(
      getRemoveBasePath(opts)({
        path: url.pathname,
      })
    )
  )
}

function getRemoveBasePath(opts: Pick<StuffOptions, 'basePath'>) {
  return ({ path, ...rest }: Stuff) => {
    if (!opts.basePath || !pathHasPrefix(path, opts.basePath)) {
      return {
        ...rest,
        path,
        basePath: '',
      }
    }

    return {
      ...rest,
      path: removePathPrefix(path, opts.basePath),
      basePath: opts.basePath,
    }
  }
}

function getRemoveData() {
  return ({ path, ...others }: Stuff) => {
    if (!path.startsWith('/_next/data/') || !path.endsWith('.json')) {
      return { ...others, path, buildId: '' }
    }

    const [buildId, ...rest] = path
      .replace(/^\/_next\/data\//, '')
      .replace(/\.json$/, '')
      .split('/')

    return {
      ...others,
      path: rest[0] !== 'index' ? `/${rest.join('/')}` : '/',
      buildId,
    }
  }
}

function getRemoveLocale(opts: Pick<StuffOptions, 'locales'>) {
  return ({ path, ...others }: Stuff) => {
    const pathLocale = normalizeLocalePath(path, opts.locales)
    return {
      ...others,
      locale: pathLocale?.detectedLocale,
      path: pathLocale?.pathname || path,
    }
  }
}

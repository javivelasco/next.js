import loaderUtils from 'next/dist/compiled/loader-utils'

export type EdgeLoaderOptions = {
  absolutePagePath: string
}

/**
 * This loader allows to transform the user-provided edge function into a
 * function with a different signature that will be the build output. It
 * does so through an adapter.
 */
export default function nextEdgeLoader(this: any) {
  const { absolutePagePath }: EdgeLoaderOptions = loaderUtils.getOptions(this)
  const stringifiedAbsolutePagePath = JSON.stringify(absolutePagePath)

  return `
        import { adapter } from 'next/dist/server/edge-functions'
        import { onEdgeRequest } from ${stringifiedAbsolutePagePath}

        export default function edgeFunction (opts) {
            return adapter({
                ...opts,
                handler: onEdgeRequest
            })
        }
    `
}

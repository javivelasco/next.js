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
        import { middlewareAdapter } from 'next/dist/server/edge-functions'
        const handler = require(${stringifiedAbsolutePagePath}).onEdgeRequest

        export default function (opts) {
            return middlewareAdapter({
                ...opts,
                handler
            })
        }
    `
}

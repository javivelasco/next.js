import loaderUtils from 'next/dist/compiled/loader-utils'

export type EdgeFunctionLoaderOptions = {
  absolutePagePath: string
}

export default function nextEdgeLoader(this: any) {
  const {
    absolutePagePath,
  }: EdgeFunctionLoaderOptions = loaderUtils.getOptions(this)
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

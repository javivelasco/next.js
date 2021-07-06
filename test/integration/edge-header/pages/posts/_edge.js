/*
 * One of the effects of the Edge middleware is adding headers to
 * the request. Here, all requests should have a new header 'foo'
 * with value 'bar'.
 */

export function onEdgeRequest(
  req,
  res,
  next = () => {
    return
  }
) {
  res.setHeaders({ 'x-bar': 'foo' })
  next()
}

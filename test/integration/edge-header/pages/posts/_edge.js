/*
 * One of the effects of the Edge middleware is adding headers to
 * the request. Here, all requests made to posts/ should have a
 * new header 'x-bar' with value 'foo'.
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

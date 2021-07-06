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
  if (req.url.pathname === '/rewrite-me-to-about') {
    res.rewrite('/about')
  }

  if (req.url.pathname === '/rewrite-me-to-about-with-chained-sequence') {
    res.rewrite('/about-with-chained-sequence')
  }

  if (req.url.pathname === '/about-with-chained-sequence') {
    res.write('this is a chained response')
    res.end()
  }

  if (req.url.pathname === '/stream-response') {
    res.write('this is a streamed ')
    res.write('response')
    res.end()
  }

  if (req.url.pathname === '/rewrite-me-to-vercel') {
    res.rewrite('https://vercel.com')
  }

  res.setHeaders({ 'x-foo': 'bar' })
  next()
}

export function onEdgeRequest(
  req,
  res,
  next = () => {
    return
  }
) {
  // Redirects users to another page
  if (req.url.pathname === '/rewrite-me-to-about') {
    res.rewrite('/about')
  }

  // Rewrites user to a page that then streams a response
  if (req.url.pathname === '/rewrite-me-to-about-with-chained-sequence') {
    res.rewrite('/about-with-chained-sequence')
  }

  if (req.url.pathname === '/about-with-chained-sequence') {
    res.write('this is a chained response')
    res.end()
  }

  // Streams a response to the user
  if (req.url.pathname === '/stream-response') {
    res.write('this is a streamed ')
    res.write('response')
    res.end()
  }

  // Rewrites a user to an external domain
  if (req.url.pathname === '/rewrite-me-to-vercel') {
    res.rewrite('https://vercel.com')
  }

  res.setHeaders({ 'x-foo': 'bar' })
  next()
}

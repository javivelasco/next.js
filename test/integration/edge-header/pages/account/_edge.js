/*
 * The last effect of Edge middleware is redirects.
 * Redirects update the URL and direct users to a new page.
 */
export function onEdgeRequest(
  req,
  res,
  next = () => {
    return
  }
) {
  if (req.url.pathname == '/account') {
    res.redirect('/account/new-page')
  }
  next()
}

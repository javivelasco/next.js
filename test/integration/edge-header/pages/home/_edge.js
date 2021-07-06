/*
 * Another effect of the Edge middleware is rewriting pages.
 * A rewrite is different than a redirect in the sense that the
 * content of the page changes but the url does not.
 */

export function onEdgeRequest(
  req,
  res,
  next = () => {
    return
  }
) {
  if (req.url.pathname == '/home') {
    let bucket = req.cookies.bucket
    if (!bucket) {
      bucket = Math.random() >= 0.5 ? 'a' : 'b'
      res.cookie('bucket', bucket)
    }
    res.rewrite(`/home/${bucket}`)
    next()
  }
  next()
}

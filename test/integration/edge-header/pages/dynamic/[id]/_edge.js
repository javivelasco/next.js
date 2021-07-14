export function onEdgeRequest(
  req,
  res,
  next = () => {
    return
  }
) {
  if (req.url.page == '/dynamic/[id]') {
    res.setHeaders({
      'req-url-basepath': req.url.basePath,
      'req-url-path': req.url.path,
      'req-url-pathname': req.url.pathname,
      'req-url-params': JSON.stringify(req.url.params),
      'req-url-page': req.url.page,
    })
  }
  next()
}

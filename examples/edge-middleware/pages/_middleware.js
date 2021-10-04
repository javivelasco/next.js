export function middleware(event) {
  console.log('inside middleware')
  const res = Response.next()
  res.headers.set('x-edge', '1')
  event.respondWith(res)
}

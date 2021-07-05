import type { NextEdgeUrl } from './types'
import cookie from 'next/dist/compiled/cookie'

export class EdgeRequest {
  private _cookieParser: () => { [key: string]: string }
  public url?: NextEdgeUrl
  public method?: string
  public headers: Headers

  constructor(req: { method: string; headers: Headers; url: NextEdgeUrl }) {
    this.method = req.method
    this.headers = req.headers
    this.url = req.url

    this._cookieParser = () => {
      const value = this.headers.get('cookie')
      return value ? cookie.parse(value) : {}
    }
  }

  public get cookies() {
    return this._cookieParser()
  }
}

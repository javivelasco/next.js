/* eslint-env jest */

import { join } from 'path'
import cheerio from 'cheerio'
import webdriver from 'next-webdriver'
import {
  fetchViaHTTP,
  findPort,
  killApp,
  launchApp,
  nextBuild,
  nextStart,
} from 'next-test-utils'

jest.setTimeout(1000 * 60 * 5)
const context = {}
context.appDir = join(__dirname, '../')

describe('Middleware base tests', () => {
  describe('dev mode', () => {
    beforeAll(async () => {
      context.appPort = await findPort()
      context.app = await launchApp(context.appDir, context.appPort)
    })
    afterAll(() => killApp(context.app))
    rewriteTests()
    rewriteTests('/fr')
    redirectTests()
    redirectTests('/fr')
    responseTests()
    responseTests('/fr')
    interfaceTests()
    interfaceTests('/fr')
  })
  describe('production mode', () => {
    beforeAll(async () => {
      await nextBuild(context.appDir)
      context.appPort = await findPort()
      context.app = await nextStart(context.appDir, context.appPort)
    })
    afterAll(() => killApp(context.app))
    rewriteTests()
    rewriteTests('/fr')
    redirectTests()
    redirectTests('/fr')
    responseTests()
    responseTests('/fr')
    interfaceTests()
    interfaceTests('/fr')
  })
})

function rewriteTests(locale = '') {
  it(`${locale} should write a response after chained executions`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/rewrites/rewrite-me-to-about-with-chained-sequence`
    )
    const html = await res.text()
    expect(res.headers.get('x-middleware-count')).toBe('2')
    expect(html).toBe('this is a chained response')
    const browser = await webdriver(
      context.appPort,
      `${locale}/rewrite-me-to-about-with-chained-sequence`
    )
    expect(await browser.eval(`window.location.pathname`)).toBe(
      `${locale}/rewrite-me-to-about-with-chained-sequence`
    )
    await browser.close()
  })

  it(`${locale} should add a cookie and rewrite to a/b test`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/rewrites/rewrite-to-ab-test`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    const bucket = getCookieFromResponse(res, 'bucket')
    const expectedText = bucket == 'a' ? 'Welcome Page A' : 'Welcome Page B'
    const browser = await webdriver(
      context.appPort,
      `${locale}/rewrites/rewrite-to-ab-test`
    )
    try {
      expect(await browser.eval(`window.location.pathname`)).toBe(
        `${locale}/rewrites/rewrite-to-ab-test`
      )
    } finally {
      await browser.close()
    }
    // -1 is returned if bucket was not found in func getCookieFromResponse
    expect(bucket).not.toBe(-1)
    expect($('.title').text()).toBe(expectedText)
  })

  it(`${locale} should rewrite to about page`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/rewrites/rewrite-me-to-about`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    const browser = await webdriver(
      context.appPort,
      `${locale}/rewrites/rewrite-me-to-about`
    )
    try {
      expect(await browser.eval(`window.location.pathname`)).toBe(
        `${locale}/rewrites/rewrite-me-to-about`
      )
    } finally {
      await browser.close()
    }
    expect($('.title').text()).toBe('About Page')
  })

  it(`${locale} should rewrite to Vercel`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/rewrites/rewrite-me-to-vercel`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    // const browser = await webdriver(context.appPort, '/rewrite-me-to-vercel')
    // TODO: running this to chech the window.location.pathname hangs for some reason;
    expect($('head > title').text()).toBe(
      'Develop. Preview. Ship. For the best frontend teams – Vercel'
    )
  })

  it(`${locale} should rewrite to the first reroute (Vercel and not Github) `, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/rewrites/rewrite-me-external-twice`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    expect($('head > title').text()).toBe(
      'Develop. Preview. Ship. For the best frontend teams – Vercel'
    )
  })

  it(`${locale} should rewrite without hard navigation`, async () => {
    const browser = await webdriver(context.appPort, '/rewrites/')
    await browser.eval('window.__SAME_PAGE = true')
    await browser.elementByCss('#link-with-rewritten-url').click()
    await browser.waitForElementByCss('.refreshed')
    expect(await browser.eval('window.__SAME_PAGE')).toBe(true)
    const element = await browser.elementByCss('.middleware')
    expect(await element.text()).toEqual('foo')
  })
}

function redirectTests(locale = '') {
  it(`${locale} should redirect`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/redirects/old-home`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    const browser = await webdriver(
      context.appPort,
      `${locale}/redirects/old-home`
    )
    try {
      expect(await browser.eval(`window.location.pathname`)).toBe(
        `${locale}/redirects/new-home`
      )
    } finally {
      await browser.close()
    }
    expect($('.title').text()).toBe('Welcome to a new page')
  })

  it(`${locale} should redirect cleanly with the original url param`, async () => {
    const browser = await webdriver(
      context.appPort,
      `${locale}/redirects/blank-page?foo=bar`
    )
    try {
      expect(
        await browser.eval(
          `window.location.href.replace(window.location.origin, '')`
        )
      ).toBe(`${locale}/redirects/new-home`)
    } finally {
      await browser.close()
    }
  })

  it(`${locale} should redirect multiple times`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/redirects/redirect-me-alot`
    )
    const browser = await webdriver(
      context.appPort,
      `${locale}/redirects/redirect-me-alot`
    )
    try {
      expect(await browser.eval(`window.location.pathname`)).toBe(
        `${locale}/redirects/new-home`
      )
    } finally {
      await browser.close()
    }
    const html = await res.text()
    const $ = cheerio.load(html)
    expect($('.title').text()).toBe('Welcome to a new page')

    expect(res.headers.get('x-middleware-count')).toBe('1')
  })

  it(`${locale} should redirect only once to Google and not stream a response`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/redirects/redirect-to-google-stream`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    expect($('head > title').text()).toBe('Google')
    expect(html).not.toBe('whoops!')
  })

  it(`${locale} should redirect only once to Google and not respond with body`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/redirects/redirect-to-google`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    expect($('head > title').text()).toBe('Google')
    expect(html).not.toBe('whoops!')
  })

  it(`${locale} should redirect (infinite-loop)`, async () => {
    try {
      await fetchViaHTTP(context.appPort, `${locale}/redirects/infinite-loop`)
      throw new Error(
        'Infinite loop did not throw ERR_TOO_MANY_REDIRECTS error'
      )
    } catch (e) {
      expect(e.type).toBe('max-redirect')
    }
  })
}

function responseTests(locale = '') {
  it(`${locale} should stream a response`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/responses/stream-a-response`
    )
    const html = await res.text()
    expect(res.headers.get('x-middleware-count')).toBe('1')
    expect(html).toBe('this is a streamed response')
  })

  it(`${locale} should only stream once`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/responses/stream-end-stream`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    expect(res.headers.get('x-middleware-count')).toBe('1')
    expect(html).toBe('first stream')
  })

  it(`${locale} should stream a body and not have a certain header`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/responses/stream-header-end`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    expect(res.headers.get('x-middleware-count')).toBe('1')
    expect(res.headers.get('x-machina')).not.toBe('hello')
    expect(res.headers.get('x-pre-header')).toBe('1')
    expect(html).toBe('hello world')
  })

  it(`${locale} should respond with a body`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/responses/send-response`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    expect(res.headers.get('x-middleware-count')).toBe('1')
    expect(html).toBe('{"message":"hi!"}')
  })

  it(`${locale} should respond with a 401 status code`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/responses/bad-status`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    expect(res.headers.get('x-middleware-count')).toBe('1')
    expect(res.status).toBe(401)
    expect(html).toBe('Auth required')
  })

  it(`${locale} should render a React component`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/responses/react?name=jack`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    expect(res.headers.get('x-middleware-count')).toBe('1')
    expect(html).toBe(
      '<h1 data-reactroot="">SSR with React on the edge! Hello, jack</h1>'
    )
  })

  it(`${locale} should stream a React component`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/responses/react-stream`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    expect(res.headers.get('x-middleware-count')).toBe('1')
    expect(html).toBe(
      '<h1 data-reactroot="">I am a stream</h1><p data-reactroot="">I am another stream</p>'
    )
  })

  it(`${locale} should stream a long response`, async () => {
    const res = await fetchViaHTTP(context.appPort, '/responses/stream-long')
    const html = await res.text()
    expect(res.headers.get('x-middleware-count')).toBe('1')
    expect(html).toBe(
      'this is a streamed this is a streamed this is a streamed this is a streamed this is a streamed this is a streamed this is a streamed this is a streamed this is a streamed this is a streamed after 2 seconds after 2 seconds after 2 seconds after 2 seconds after 2 seconds after 2 seconds after 2 seconds after 2 seconds after 2 seconds after 2 seconds after 4 seconds after 4 seconds after 4 seconds after 4 seconds after 4 seconds after 4 seconds after 4 seconds after 4 seconds after 4 seconds after 4 seconds '
    )
  })

  it(`${locale} should redirect only once to Google and not stream a response`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/responses/redirect-stream`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    expect($('head > title').text()).toBe('Google')
    expect(html).not.toBe('whoops!')
  })

  it(`${locale} should render the right content via SSR`, async () => {
    const res = await fetchViaHTTP(context.appPort, '/responses/')
    const html = await res.text()
    const $ = cheerio.load(html)
    expect($('.title').text()).toBe('Hello World')
  })

  it(`${locale} should respond with a header`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/responses/header`
    )
    expect(res.headers.get('x-first-header')).toBe('valid')
  })

  it(`${locale} should respond with 2 nested headers`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/responses/header?nested-header=true`
    )
    expect(res.headers.get('x-first-header')).toBe('valid')
    expect(res.headers.get('x-nested-header')).toBe('valid')
  })

  it(`${locale} should only recieve the first body`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/responses/body-end-header`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    expect(res.headers.get('x-middleware-count')).toBe('1')
    expect(res.headers.get('x-late')).not.toBe('valid')
    expect(html).toBe('hello world')
  })

  it(`${locale} should only recieve the first body`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/responses/body-end-body`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    expect(res.headers.get('x-middleware-count')).toBe('1')
    expect(html).toBe('hello world')
  })

  it(`${locale} should redirect to Google and not send a body`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/responses/redirect-body`
    )
    const html = await res.text()
    const $ = cheerio.load(html)
    expect($('head > title').text()).toBe('Google')
    expect(html).not.toBe('whoops!')
  })
}

function interfaceTests(locale = '') {
  it(`${locale} should validate request url parameters from a static route`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/interface/static`
    )
    //expect(res.headers.get('req-url-basepath')).toBe('')
    expect(res.headers.get('req-url-pathname')).toBe('/interface/static')
    expect(res.headers.get('req-url-params')).not.toBe('{}')
    expect(res.headers.get('req-url-query')).not.toBe('bar')
    if (locale != '') {
      expect(res.headers.get('req-url-locale')).toBe(locale.slice(1))
    }
  })

  it(`${locale} should validate request url parameters from a dynamic route with param 1`, async () => {
    const res = await fetchViaHTTP(context.appPort, `${locale}/interface/1`)
    //expect(res.headers.get('req-url-basepath')).toBe('')
    expect(res.headers.get('req-url-pathname')).toBe('/interface/1')
    expect(res.headers.get('req-url-params')).toBe('{"id":"1"}')
    expect(res.headers.get('req-url-page')).toBe('/interface/[id]')
    expect(res.headers.get('req-url-query')).not.toBe('bar')

    if (locale != '') {
      expect(res.headers.get('req-url-locale')).toBe(locale.slice(1))
    }
  })

  it(`${locale} should validate request url parameters from a dynamic route with param abc123`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/interface/abc123`
    )
    //expect(res.headers.get('req-url-basepath')).toBe('')
    expect(res.headers.get('req-url-pathname')).toBe('/interface/abc123')
    expect(res.headers.get('req-url-params')).toBe('{"id":"abc123"}')
    expect(res.headers.get('req-url-page')).toBe('/interface/[id]')
    expect(res.headers.get('req-url-query')).not.toBe('bar')

    if (locale != '') {
      expect(res.headers.get('req-url-locale')).toBe(locale.slice(1))
    }
  })

  it(`${locale} should validate request url parameters from a dynamic route with param abc123 and query foo = bar`, async () => {
    const res = await fetchViaHTTP(
      context.appPort,
      `${locale}/interface/abc123?foo=bar`
    )
    //expect(res.headers.get('req-url-basepath')).toBe('')
    expect(res.headers.get('req-url-pathname')).toBe('/interface/abc123')
    expect(res.headers.get('req-url-params')).toBe('{"id":"abc123"}')
    expect(res.headers.get('req-url-page')).toBe('/interface/[id]')
    expect(res.headers.get('req-url-query')).toBe('bar')
    if (locale != '') {
      expect(res.headers.get('req-url-locale')).toBe(locale.slice(1))
    }
  })
}

function getCookieFromResponse(res, cookieName) {
  // node-fetch bundles the cookies as string in the Response
  const cookieArray = res.headers.raw()['set-cookie']
  for (const cookie of cookieArray) {
    let individualCookieParams = cookie.split(';')
    let individualCookie = individualCookieParams[0].split('=')
    if (individualCookie[0] == cookieName) {
      return individualCookie[1]
    }
  }
  return -1
}

/* eslint-env jest */

import {
  Blob,
  File,
  FormData,
} from 'next/dist/compiled/@javivelasco/formdata-node'
import { Crypto } from 'next/dist/server/edge-functions-whatwg/polyfills'
import { Headers as HeadersImplementation } from 'node-fetch'
import * as streams from 'web-streams-polyfill/ponyfill'

beforeAll(() => {
  global['Blob'] = Blob
  global['crypto'] = new Crypto()
  global['File'] = File
  global['FormData'] = FormData
  global['Headers'] = HeadersImplementation
  global['ReadableStream'] = streams.ReadableStream
  global['TransformStream'] = streams.TransformStream
})

afterAll(() => {
  delete global['Blob']
  delete global['crypto']
  delete global['File']
  delete global['Headers']
  delete global['FormData']
  delete global['ReadableStream']
  delete global['TransformStream']
})

it('clones responses', async () => {
  console.log(Event)
  expect(true).toEqual(true)
})

import { Crypto } from 'next/dist/compiled/@peculiar/webcrypto'
import { v4 as uuid } from 'next/dist/compiled/uuid'

class WebCrypto extends Crypto {
  randomUUID() {
    return uuid()
  }
}

export { WebCrypto as Crypto }

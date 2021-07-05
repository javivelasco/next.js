export const Encoder = new TextEncoder()
export const Decoder = new TextDecoder()

export const encode = (input: string) => Encoder.encode(input)
export const decode = (input: ArrayBufferView | ArrayBuffer, stream = false) =>
  Decoder.decode(input, { stream })

export function byteLength(input?: string): number {
  return input ? Encoder.encode(input).byteLength : 0
}

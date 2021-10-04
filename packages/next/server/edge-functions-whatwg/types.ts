export interface EdgeFunctionResult {
  response: Response
  waitUntil: Promise<any>
}

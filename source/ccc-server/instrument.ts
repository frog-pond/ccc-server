import type {Options} from 'memoize'
import mem from 'memoize'

type Input = string | URL | Request
type RequestOptions = Record<string, unknown>

/**
 * A wrapper for Response objects that safely clones them before consumption
 * to prevent "Body has already been consumed" errors when memoized values
 * are accessed multiple times.
 */
export function safeResponse<T extends (url: Input, options?: RequestOptions) => Promise<Response>>(
  fn: T,
  options?: Options<T, unknown>,
): T {
  const wrapped = (async (url: Input, options?: RequestOptions): Promise<Response> => {
    const response = await fn(url, options)
    
    // Create a Response-like object with modified methods
    const enhancedResponse = Object.create(response)
    
    // Add body consumption methods that clone before consumption
    for (const method of ['json', 'text', 'blob', 'arrayBuffer', 'formData']) {
      enhancedResponse[method] = function(...args: unknown[]) {
        const clonedResponse = response.clone()
        return clonedResponse[method](...args)
      }
    }
    
    return enhancedResponse
  }) as T

  return mem(wrapped, {maxAge: options?.maxAge ?? 0})
}

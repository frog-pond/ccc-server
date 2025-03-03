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

    return new Proxy(response, {
      get<K extends keyof Response>(
        target: Response,
        prop: K,
      ): Response[K] {
        const value = Reflect.get(target, prop, target)

        if (
          typeof value === 'function' && 
          ['json', 'text', 'blob', 'arrayBuffer', 'formData'].includes(prop as string)
        ) {
          return (function(...args: unknown[]) {
            const clonedResponse = target.clone()
            return (clonedResponse[prop] as (...args: unknown[]) => unknown).apply(clonedResponse, args)
          }) as unknown as Response[K]
        }

        return value as Response[K]
      }
    })
  }) as T

  return mem(wrapped, {maxAge: options?.maxAge ?? 0})
}

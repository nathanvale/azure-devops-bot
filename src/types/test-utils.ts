import { vi } from 'vitest'

export type MockedFunction<T extends (...args: unknown[]) => unknown> = T & {
  mockImplementation: (fn: T) => MockedFunction<T>
  mockResolvedValue: T extends (...args: unknown[]) => Promise<infer R>
    ? (value: R) => MockedFunction<T>
    : never
  mockRejectedValue: T extends (...args: unknown[]) => Promise<unknown>
    ? (value: unknown) => MockedFunction<T>
    : never
  mockReturnValue: T extends (...args: unknown[]) => infer R
    ? (value: R) => MockedFunction<T>
    : never
}

export const createMockFunction = <
  T extends (...args: unknown[]) => unknown,
>(): MockedFunction<T> => {
  return vi.fn() as unknown as MockedFunction<T>
}

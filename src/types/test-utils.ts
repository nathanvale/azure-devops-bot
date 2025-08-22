import { vi } from 'vitest'

export type MockedFunction<T extends (...args: any[]) => any> = T & {
  mockImplementation: (fn: T) => MockedFunction<T>
  mockResolvedValue: T extends (...args: any[]) => Promise<infer R>
    ? (value: R) => MockedFunction<T>
    : never
  mockRejectedValue: T extends (...args: any[]) => Promise<any>
    ? (value: any) => MockedFunction<T>
    : never
  mockReturnValue: T extends (...args: any[]) => infer R
    ? (value: R) => MockedFunction<T>
    : never
}

export const createMockFunction = <
  T extends (...args: any[]) => any,
>(): MockedFunction<T> => {
  return vi.fn() as unknown as MockedFunction<T>
}

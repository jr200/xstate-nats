const getCircularReplacer = () => {
  const seen = new WeakSet()
  return (_key: string, value: any) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]' // Better than undefined
      }
      seen.add(value)

      // Handle Maps by converting to array of entries
      if (value instanceof Map) {
        return Array.from(value.entries())
      }

      // Handle Dates by converting to ISO string
      if (value instanceof Date) {
        return value.toISOString()
      }

      // Handle Sets
      if (value instanceof Set) {
        return Array.from(value)
      }

      // Handle other non-serializable objects
      if (value instanceof RegExp) {
        return value.toString()
      }

      if (typeof value === 'function') {
        return '[Function]'
      }

      if (typeof value === 'symbol') {
        return value.toString()
      }
    }
    return value
  }
}

export const safeStringify = (obj: any, space?: number) => {
  try {
    return JSON.stringify(obj, getCircularReplacer(), space)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `[Error serializing object: ${errorMessage}]`
  }
}

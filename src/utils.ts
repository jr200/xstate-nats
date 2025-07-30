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

export class Pair<A, B> {
  x: A
  y: B

  constructor(x: A, y: B) {
    this.x = x
    this.y = y
  }
  toKey() {
    return `Pair(${this.x}, ${this.y})`
  }

  equals(other: Pair<A, B>) {
    return this.x === other.x && this.y === other.y
  }

  static fromKey<A, B>(key: string) {
    // Parse the Pair(x, y) format
    const match = key.match(/^Pair\((.*), (.*)\)$/)
    if (!match) {
      throw new Error(`Invalid Pair key format: ${key}`)
    }
    const [, x, y] = match
    return new Pair<A, B>(x as A, y as B)
  }

  static key<X, Y>(x: X, y: Y) {
    return new Pair(x, y).toKey()
  }
}

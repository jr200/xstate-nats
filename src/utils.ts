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

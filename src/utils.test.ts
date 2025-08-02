import { describe, it, expect } from 'vitest'
import { safeStringify } from './utils'

describe('safeStringify', () => {
  it('should safely stringify objects with circular references', () => {
    // Create an object with a circular reference
    const obj: any = { name: 'test', data: {} }
    obj.data.self = obj

    const result = safeStringify(obj)
    
    // Should not throw and should handle circular reference
    expect(result).toContain('[Circular Reference]')
    expect(result).toContain('"name":"test"')
    expect(typeof result).toBe('string')
  })
}) 
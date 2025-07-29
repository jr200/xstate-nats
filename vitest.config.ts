import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000, // 10 second timeout per test
    hookTimeout: 5000, // 5 second timeout for hooks
  },
})

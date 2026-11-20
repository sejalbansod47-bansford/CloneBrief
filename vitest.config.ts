import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'fake-detonation/src/**/*.test.ts'] } })

module.exports = {
  clearMocks: true,
  coverageThreshold: {
    global: {
      statements: 50,
      branches: 0,
      functions: 100,
      lines: 70
    }
  },
  moduleFileExtensions: ['js', 'ts'],
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  testRunner: 'jest-circus/runner',
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  verbose: true
}
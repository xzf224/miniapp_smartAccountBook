/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  testMatch: ['**/*.test.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'miniprogram/utils/parser.ts',
    'miniprogram/utils/statistics.ts',
    'miniprogram/utils/date.ts',
    'miniprogram/models/record.ts',
    'miniprogram/utils/storage.ts',
  ],
}

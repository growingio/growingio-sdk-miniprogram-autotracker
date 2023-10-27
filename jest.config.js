/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */
module.exports = {
  testMatch: ['**/test/**/*.[jt]s?(x)'],
  // testPathIgnorePatterns: [
  //   '<rootDir>/test/cdp/cdp.js',
  //   '<rootDir>/test/cdp/utm.js',
  //   '<rootDir>/test/cdp/dataCollect.js'
  //   // '<rootDir>/test/cdp/getGioInfo.js'
  // ],
  clearMocks: true,
  collectCoverage: false,
  setupFilesAfterEnv: ['./jest.setup.js'],
  testEnvironment: 'node',
  testTimeout: 60000,
  runner: 'jest-serial-runner'
};

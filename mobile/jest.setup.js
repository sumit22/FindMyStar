// Jest setup file for FindMyStar
// Mock native modules that aren't available in test environment

jest.mock('react-native-sqlite-storage', () => ({
  openDatabase: jest.fn(() => ({
    transaction: jest.fn(),
    executeSql: jest.fn(),
  })),
}));

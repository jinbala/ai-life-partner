/**
 * Jest 测试设置文件
 */

// 设置测试超时时间
jest.setTimeout(30000);

// 全局 Mock
beforeEach(() => {
  // 清空所有 mocks
  jest.clearAllMocks();
});

// 不要在测试之间重置模块，否则数据库单例会被破坏
// afterEach(() => {
//   jest.resetModules();
// });

// 所有测试完成后关闭数据库
afterAll(() => {
  const { closeDatabase } = require('../src/database');
  closeDatabase();
});

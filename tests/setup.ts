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

// 测试完成后清理
afterEach(() => {
  jest.resetModules();
});

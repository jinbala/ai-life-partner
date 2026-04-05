/**
 * SessionService 单元测试
 */

import { SessionService } from '../../src/services/session';
import { UserRepository } from '../../src/database/repositories';
import { getDatabase, closeDatabase } from '../../src/database';

describe('SessionService', () => {
  let service: SessionService;
  let userRepo: UserRepository;
  let testUserId: string;
  let db: ReturnType<typeof getDatabase>;

  beforeAll(() => {
    // 确保数据库已初始化
    const { initializeDatabase } = require('../../src/database');
    initializeDatabase();
    db = getDatabase();
    // 禁用外键约束以避免测试中的数据依赖问题
    db.pragma('foreign_keys = OFF');
  });

  afterAll(() => {
    db.pragma('foreign_keys = ON');
    closeDatabase();
  });

  beforeEach(() => {
    service = new SessionService();
    userRepo = new UserRepository();
    // 为每个测试创建唯一的用户（避免外键约束和数据冲突）
    testUserId = `test_session_user_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    userRepo.findOrCreate(testUserId);
  });

  describe('getOrCreate', () => {
    it('应该创建新会话', () => {
      const session = service.getOrCreate(testUserId);

      expect(session).toBeDefined();
      expect(session.userId).toBe(testUserId);
      expect(session.id).toBeDefined();
    });

    it('应该返回缓存的会话', () => {
      const session1 = service.getOrCreate(testUserId);
      const session2 = service.getOrCreate(testUserId);

      expect(session1.id).toBe(session2.id);
    });
  });

  describe('addMessage', () => {
    it('应该添加用户消息', () => {
      const session = service.getOrCreate(testUserId);

      service.addMessage(testUserId, 'user', '你好');

      const updated = service.getSession(testUserId);
      expect(updated?.conversationHistory.length).toBe(1);
      expect(updated?.conversationHistory[0].role).toBe('user');
    });

    it('应该添加助手消息', () => {
      const session = service.getOrCreate(testUserId);

      service.addMessage(testUserId, 'user', '你好');
      service.addMessage(testUserId, 'assistant', '你好！有什么可以帮你？');

      const updated = service.getSession(testUserId);
      expect(updated?.conversationHistory.length).toBe(2);
    });

    it('应该限制历史消息数量为 10 条', () => {
      const session = service.getOrCreate(testUserId);

      for (let i = 0; i < 15; i++) {
        service.addMessage(testUserId, 'user', `消息${i}`);
      }

      const updated = service.getSession(testUserId);
      expect(updated?.conversationHistory.length).toBeLessThanOrEqual(10);
    });
  });

  describe('update', () => {
    it('应该更新会话状态', () => {
      const session = service.getOrCreate(testUserId);

      service.update(testUserId, {
        currentFocus: '测试焦点',
        hasPendingChallenge: true,
      });

      const updated = service.getSession(testUserId);
      expect(updated?.currentFocus).toBe('测试焦点');
      expect(updated?.hasPendingChallenge).toBe(true);
    });
  });

  describe('clear', () => {
    it('应该清除会话历史', () => {
      const session = service.getOrCreate(testUserId);
      service.addMessage(testUserId, 'user', '你好');

      service.clear(testUserId);

      const updated = service.getSession(testUserId);
      expect(updated?.conversationHistory.length).toBe(0);
      expect(updated?.currentFocus).toBeNull();
    });
  });

  describe('delete', () => {
    it('应该删除会话', () => {
      const session = service.getOrCreate(testUserId);

      const deleted = service.delete(testUserId);

      expect(deleted).toBe(true);
      expect(service.getSession(testUserId)).toBeNull();
    });
  });
});

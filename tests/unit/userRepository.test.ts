/**
 * UserRepository 单元测试
 */

import { UserRepository } from '../../src/database/repositories';
import { getDatabase, initializeDatabase, closeDatabase } from '../../src/database';

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeAll(() => {
    initializeDatabase();
    repository = new UserRepository();
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(() => {
    // 清理测试数据
    const db = getDatabase();
    db.prepare('DELETE FROM users WHERE open_id LIKE ?').run('test_%');
  });

  describe('findOrCreate', () => {
    it('应该创建新用户', () => {
      const user = repository.findOrCreate('test_user_1');

      expect(user).toBeDefined();
      expect(user.open_id).toBe('test_user_1');
      expect(user.id).toBeDefined();
    });

    it('应该返回已存在的用户', () => {
      const user1 = repository.findOrCreate('test_user_2');
      const user2 = repository.findOrCreate('test_user_2');

      expect(user1.id).toBe(user2.id);
      expect(user1.open_id).toBe(user2.open_id);
    });
  });

  describe('findById', () => {
    it('应该找到用户', () => {
      const created = repository.findOrCreate('test_user_3');
      const found = repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('应该返回 null 当用户不存在', () => {
      const found = repository.findById('non_existent_id');

      expect(found).toBeFalsy();
    });
  });

  describe('findByOpenId', () => {
    it('应该找到用户', () => {
      repository.findOrCreate('test_user_4');
      const found = repository.findByOpenId('test_user_4');

      expect(found).toBeDefined();
      expect(found?.open_id).toBe('test_user_4');
    });

    it('应该返回 null 当用户不存在', () => {
      const found = repository.findByOpenId('non_existent_open_id');

      expect(found).toBeFalsy();
    });
  });

  describe('updateSettings', () => {
    it('应该更新用户设置', () => {
      const user = repository.findOrCreate('test_user_5');

      repository.updateSettings(user.id, {
        morning_push_enabled: false,
        review_reminder_enabled: false,
      });

      const updated = repository.findById(user.id);

      expect(updated?.morning_push_enabled).toBe(0);
      expect(updated?.review_reminder_enabled).toBe(0);
    });
  });

  describe('findAll', () => {
    it('应该返回所有用户', () => {
      repository.findOrCreate('test_user_6');
      repository.findOrCreate('test_user_7');

      const users = repository.findAll();

      expect(users.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('findWithMorningPushEnabled', () => {
    it('应该返回启用早上推送的用户', () => {
      const user = repository.findOrCreate('test_user_8');

      const users = repository.findWithMorningPushEnabled();
      const found = users.find(u => u.id === user.id);

      expect(found).toBeDefined();
    });
  });

  describe('findWithReviewReminderEnabled', () => {
    it('应该返回启用复盘提醒的用户', () => {
      const user = repository.findOrCreate('test_user_9');

      const users = repository.findWithReviewReminderEnabled();
      const found = users.find(u => u.id === user.id);

      expect(found).toBeDefined();
    });
  });
});

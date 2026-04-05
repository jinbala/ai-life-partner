/**
 * GoalRepository 单元测试
 */

import { GoalRepository, UserRepository } from '../../src/database/repositories';
import { getDatabase, initializeDatabase, closeDatabase } from '../../src/database';

describe('GoalRepository', () => {
  let repository: GoalRepository;
  let userRepo: UserRepository;
  let testUserId: string;
  let db: ReturnType<typeof getDatabase>;

  beforeAll(() => {
    initializeDatabase();
    repository = new GoalRepository();
    userRepo = new UserRepository();
    db = getDatabase();
    // 禁用外键约束以避免测试中的数据依赖问题
    db.pragma('foreign_keys = OFF');
  });

  afterAll(() => {
    db.pragma('foreign_keys = ON');
    closeDatabase();
  });

  beforeEach(() => {
    // 为每个测试创建唯一的用户（避免外键约束和数据冲突）
    testUserId = `test_goal_user_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    userRepo.findOrCreate(testUserId);
  });

  describe('create', () => {
    it('应该创建目标', () => {
      const goal = repository.create({
        user_id: testUserId,
        level: 'weekly',
        description: '测试目标',
      });

      expect(goal).toBeDefined();
      expect(goal.id).toBeDefined();
      expect(goal.description).toBe('测试目标');
      expect(goal.is_completed).toBe(false);
    });
  });

  describe('findByUser', () => {
    it('应该返回用户的所有目标', () => {
      repository.create({ user_id: testUserId, level: 'weekly', description: '目标 1' });
      repository.create({ user_id: testUserId, level: 'monthly', description: '目标 2' });

      const goals = repository.findByUser(testUserId);

      expect(goals.length).toBe(2);
    });
  });

  describe('findByLevel', () => {
    it('应该按级别返回目标', () => {
      repository.create({ user_id: testUserId, level: 'weekly', description: '周目标' });
      repository.create({ user_id: testUserId, level: 'monthly', description: '月目标' });

      const weeklyGoals = repository.findByLevel(testUserId, 'weekly');

      expect(weeklyGoals.length).toBe(1);
      expect(weeklyGoals[0].description).toBe('周目标');
    });
  });

  describe('updateProgress', () => {
    it('应该更新目标进度', () => {
      const goal = repository.create({
        user_id: testUserId,
        level: 'weekly',
        description: '测试目标',
      });

      repository.updateProgress(goal.id, 50);

      const updated = repository.findById(goal.id);
      expect(updated?.progress).toBe(50);
    });
  });

  describe('markAsCompleted', () => {
    it('应该标记目标为完成', () => {
      const goal = repository.create({
        user_id: testUserId,
        level: 'weekly',
        description: '测试目标',
      });

      repository.markAsCompleted(goal.id);

      const updated = repository.findById(goal.id);
      expect(updated?.is_completed).toBe(true);
    });
  });

  describe('delete', () => {
    it('应该删除目标', () => {
      const goal = repository.create({
        user_id: testUserId,
        level: 'weekly',
        description: '测试目标',
      });

      const deleted = repository.delete(goal.id);

      expect(deleted).toBe(true);
      expect(repository.findById(goal.id)).toBeFalsy();
    });
  });
});

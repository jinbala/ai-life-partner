/**
 * 用户画像初始化脚本
 * 用于手动设置用户基本信息
 */

import { UserRepository, PortraitRepository } from '../src/database/repositories';
import { UserService } from '../src/services/user';

async function initializeUserProfile(userId: string, openId: string) {
  console.log('初始化用户画像...');

  const userRepo = new UserRepository();
  const portraitRepo = new PortraitRepository();

  // 1. 创建或获取用户
  const user = await userRepo.findOrCreate(openId);
  console.log('用户:', user.id);

  // 2. 初始化用户画像（使用默认值）
  const defaultPortrait = {
    userId: user.id,
    version: 1,
    industry: '互联网/软件',
    incomeStructure: '工资收入 + 投资理财',
    resources: '技术背景，有一定人脉资源',
    decisionStyle: 'rational', // rational/intuitive
    stuckPoints: '工作与生活的平衡',
    procrastinationTriggers: '任务过多时容易拖延',
    abilities: JSON.stringify({
      businessJudgment: 6,
      execution: 7,
      cognition: 6,
      riskControl: 5,
      learningAbility: 8,
    }),
    growthTrackData: null,
    basicsData: null,
  };

  // 3. 保存画像
  await portraitRepo.save(defaultPortrait);
  console.log('画像已保存');

  // 4. 添加初始记忆
  const { MemoryRepository } = await import('../src/database/repositories/memoryRepository');
  const memoryRepo = new MemoryRepository();

  await memoryRepo.create({
    userId: user.id,
    type: 'fact',
    content: '用户在互联网/软件行业工作',
    importance: 5,
  });

  console.log('初始化完成！');
  console.log('用户 ID:', user.id);
  console.log('OpenID:', openId);
}

// 从命令行参数获取用户 ID
const userId = process.argv[2] || 'user_' + Date.now();
const openId = process.argv[3] || 'ou_' + userId;

console.log('用户 ID:', userId);
console.log('OpenID:', openId);

initializeUserProfile(userId, openId)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('初始化失败:', err);
    process.exit(1);
  });

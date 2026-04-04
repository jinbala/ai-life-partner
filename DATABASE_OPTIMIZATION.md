# 数据库优化报告

## 完成日期
2026-04-04

## 优化背景
原项目使用 JSON 文件存储用户数据，存在以下问题：
- 无事务支持，数据一致性无法保证
- 查询效率低，需要加载整个文件
- 无法进行复杂查询和关联
- 数据格式无约束，容易出错

## 解决方案
引入 SQLite 数据库（better-sqlite3），提供：
- 零配置，单文件存储
- 完整的 SQL 查询能力
- 事务支持和数据完整性
- 适合个人项目和小规模应用

## 新增文件

### 核心模块
```
src/database/
├── index.ts              # 数据库连接和表结构初始化
├── migrations.ts         # 数据库迁移管理
└── repositories/
    ├── index.ts          # Repository 统一导出
    └── userRepository.ts # 用户数据访问层
```

### 数据库文件
```
data/
├── app.db               # SQLite 数据库文件
├── app.db-shm          # WAL 模式共享内存文件
└── app.db-wal          # WAL 预写日志文件
```

## 数据库表结构（11 张表）

### 1. users - 用户表
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  open_id TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  morning_push_enabled INTEGER DEFAULT 1,
  review_reminder_enabled INTEGER DEFAULT 1
)
```

### 2. user_portraits - 用户画像表
```sql
CREATE TABLE user_portraits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  industry TEXT,
  income_structure TEXT,
  resources TEXT,
  decision_style TEXT DEFAULT 'intuitive',
  stuck_points TEXT,
  procrastination_triggers TEXT,
  abilities TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### 3. goals - 目标表
```sql
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  level TEXT NOT NULL,
  parent_id TEXT,
  description TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  success_signals TEXT,
  danger_signals TEXT,
  stop_loss_line TEXT,
  start_date TEXT,
  end_date TEXT,
  is_completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES goals(id) ON DELETE CASCADE
)
```

### 4. daily_tasks - 日常任务表
### 5. memories - 记忆表
### 6. ability_assets - 能力资产表
### 7. decisions - 决策记录表
### 8. challenges - 认知挑战表
### 9. reviews - 复盘记录表
### 10. conversation_history - 对话历史表
### 11. schema_migrations - 迁移版本表

## Repository 层

### UserRepository
```typescript
- findOrCreate(openId): User          // 创建或获取用户
- findById(id): User | null           // 按 ID 查找
- findByOpenId(openId): User | null   // 按 openId 查找
- updateSettings(id, settings): void  // 更新用户设置
- findAll(): User[]                   // 获取所有用户
- findWithMorningPushEnabled(): User[] // 获取启用早推的用户
- findWithReviewReminderEnabled(): User[] // 获取启用复盘提醒的用户
- delete(id): boolean                 // 删除用户
```

## 已集成的功能

### 1. 用户管理
- 用户自动注册（基于 openId）
- 用户设置持久化到数据库
- 早推/复盘提醒开关控制

### 2. 定时推送
- 早上推送从数据库读取用户列表
- 只推送给启用该功能的用户

### 3. 数据持久化
- 用户注册表从 JSON 迁移到数据库
- 优雅关闭时自动关闭数据库连接

## 使用示例

### 在代码中使用 Repository
```typescript
import { UserRepository } from './database/repositories';

const userRepository = new UserRepository();

// 创建或获取用户
const user = userRepository.findOrCreate('ou_xxx');

// 更新用户设置
userRepository.updateSettings(user.id, {
  morning_push_enabled: true
});

// 查询所有启用早推的用户
const users = userRepository.findWithMorningPushEnabled();
```

## 迁移说明

### 从 JSON 到数据库
原有的 `data/user-registry.json` 已被数据库替代，包含以下字段映射：

| JSON 字段 | 数据库字段 | 类型 |
|-----------|-----------|------|
| openId | open_id | TEXT |
| registeredAt | created_at | TEXT |
| morningPushEnabled | morning_push_enabled | INTEGER |
| reviewReminderEnabled | review_reminder_enabled | INTEGER |

## 优势对比

| 特性 | JSON 文件 | SQLite |
|------|----------|--------|
| 事务支持 | ❌ | ✅ |
| 复杂查询 | ❌ | ✅ |
| 数据约束 | ❌ | ✅ |
| 并发安全 | ❌ | ✅ (WAL 模式) |
| 查询性能 | O(n) | O(log n) |
| 文件大小 | 随数据增长 | 紧凑存储 |
| 备份 | 手动复制 | 支持 dump |

## 后续优化空间

### 1. 完善 Repository 层
为以下实体创建 Repository：
- PortraitRepository（用户画像）
- GoalRepository（目标管理）
- MemoryRepository（记忆管理）
- AssetRepository（资产管理）
- DecisionRepository（决策记录）
- ChallengeRepository（认知挑战）
- ReviewRepository（复盘记录）

### 2. 添加 Service 层
在 Repository 之上添加业务逻辑层：
```
src/services/
├── userService.ts
├── goalService.ts
├── memoryService.ts
└── ...
```

### 3. 添加数据验证
使用 zod 或 joi 验证输入数据

### 4. 添加索引优化
根据查询模式添加合适的索引

### 5. 添加数据库备份
定期备份 SQLite 数据库文件

## 测试验证

```bash
# 启动服务器
npm run dev

# 健康检查
curl http://localhost:3000/health

# 测试接口
curl -X POST http://localhost:3000/test-ai -H "Content-Type: application/json" -d '{"message":"你好"}'
```

## 注意事项

1. **数据库文件位置**: `data/app.db`
2. **WAL 模式**: 启用了预写日志，提高并发性能
3. **外键约束**: 已启用，确保数据完整性
4. **级联删除**: 用户删除时自动删除关联数据
5. **时区设置**: SQLite 使用 UTC 时间，应用层转换为本地时间

# 数据库架构文档

## 完成日期
2026-04-05

## 架构概述

本项目采用 **Repository 模式** 实现数据库访问层，支持 **SQLite** 和 **MySQL** 双数据库切换。

### 核心特性
- **零配置切换**: 通过环境变量 `DB_TYPE` 切换数据库
- **统一接口**: `IDatabase` 定义标准数据库操作接口
- **工厂模式**: `DatabaseFactory` 根据配置创建相应适配器
- **异步操作**: 全异步数据库访问，支持高并发
- **兼容处理**: 自动处理 SQLite/MySQL 语法差异

## 架构层次

```
┌─────────────────────────────────────┐
│         Service Layer               │  业务逻辑层
├─────────────────────────────────────┤
│       Repository Layer              │  数据访问层
├─────────────────────────────────────┤
│      Database Adapters              │  数据库适配器
├─────────────────────────────────────┤
│    SQLite  │││││    MySQL          │  数据库引擎
└─────────────────────────────────────┘
```

## 文件结构

```
src/database/
├── IDatabase.ts            # 数据库接口定义
├── DatabaseFactory.ts      # 数据库工厂
├── BaseRepository.ts       # Repository 基类
├── index.ts                # 数据库连接入口
├── migrations.ts           # 数据库迁移管理
├── adapters/
│   ├── SQLiteAdapter.ts    # SQLite 适配器
│   └── MySQLAdapter.ts     # MySQL 适配器
└── repositories/
    ├── userRepository.ts
    ├── portraitRepository.ts
    ├── goalRepository.ts
    ├── dailyTaskRepository.ts
    ├── memoryRepository.ts
    ├── abilityAssetRepository.ts
    ├── decisionRepository.ts
    ├── challengeRepository.ts
    ├── reviewRepository.ts
    ├── sessionRepository.ts
    └── tokenUsageRepository.ts
```

## 数据库接口 (IDatabase)

```typescript
interface IDatabase {
  // 查询单行
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>;
  
  // 查询多行
  queryMany<T>(sql: string, params?: any[]): Promise<T[]>;
  
  // 执行插入并返回 ID
  insert(sql: string, params?: any[]): Promise<string | number>;
  
  // 执行更新
  update(sql: string, params?: any[]): Promise<number>;
  
  // 执行删除
  delete(sql: string, params?: any[]): Promise<number>;
  
  // 执行事务
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  
  // 执行 SQL
  execute(sql: string, params?: any[]): Promise<any>;
  
  // 关闭连接
  close(): Promise<void>;
}
```

## 数据库配置

### SQLite 模式（默认）

```bash
# .env 文件中不配置 DB_* 变量
NODE_ENV=development
```

数据文件：`data/app.db`

### MySQL 模式

```bash
# .env 文件配置
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ai_life_partner
```

## 语法兼容性处理

### 时间函数

```typescript
// BaseRepository.ts 导出
import { getNowSql } from '../database/BaseRepository';

// 使用示例
const sql = `UPDATE users SET updated_at = ${getNowSql()} WHERE id = ?`;
// SQLite: datetime('now')
// MySQL:  NOW()
```

### 自增主键

```typescript
// SQLite
INTEGER PRIMARY KEY AUTOINCREMENT

// MySQL
INT PRIMARY KEY AUTO_INCREMENT
```

## Repository 使用示例

```typescript
import { UserRepository } from './database/repositories';

// 创建 Repository 实例
const userRepository = new UserRepository();

// 创建或获取用户
const user = await userRepository.findOrCreate('ou_xxx');

// 按 ID 查找
const found = await userRepository.findById(user.id);

// 更新用户设置
await userRepository.updateSettings(user.id, {
  morning_push_enabled: true
});

// 查询启用早推的所有用户
const users = await userRepository.findWithMorningPushEnabled();
```

## 数据库表结构

### 核心表

| 表名 | 说明 | 主要字段 |
|------|------|----------|
| `users` | 用户表 | id, open_id, created_at, updated_at |
| `user_portraits` | 用户画像 | user_id, version, industry, abilities |
| `goals` | 目标表 | id, user_id, level, parent_id, description |
| `daily_tasks` | 日常任务 | id, user_id, goal_id, description, is_completed |
| `memories` | 长期记忆 | user_id, type, content, importance |
| `ability_assets` | 能力资产 | user_id, type, content, usage_count |
| `decisions` | 决策记录 | user_id, topic, chosen, expected_outcome |
| `challenges` | 认知挑战 | user_id, scenario, status, user_answer |
| `reviews` | 复盘记录 | user_id, type, content |
| `sessions` | 会话管理 | user_id, session_data, last_active_at |
| `token_usage` | Token 统计 | user_id, model, token_count |
| `schema_migrations` | 迁移版本 | version, name, applied_at |

## 迁移管理

### 运行迁移

```typescript
import { runMigrations } from './database/migrations';

await runMigrations();
```

### 迁移文件结构

```typescript
interface Migration {
  version: number;
  name: string;
  up: string;    // 升级 SQL
  down?: string; // 回滚 SQL
}
```

## 事务支持

```typescript
import { BaseRepository } from './database/BaseRepository';

class MyRepository extends BaseRepository {
  async transferPoints(from: string, to: string, amount: number) {
    return await this.transaction(async () => {
      await this.execute('UPDATE users SET points = points - ? WHERE id = ?', [amount, from]);
      await this.execute('UPDATE users SET points = points + ? WHERE id = ?', [amount, to]);
    });
  }
}
```

## 性能优化建议

### 1. 索引优化

```sql
-- 常用查询字段添加索引
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_memories_user_type ON memories(user_id, type);
CREATE INDEX idx_tasks_user_status ON daily_tasks(user_id, is_completed);
```

### 2. 批量操作

```typescript
// 使用事务批量插入
async function batchInsert(data: any[]) {
  return await this.transaction(async () => {
    for (const item of data) {
      await this.execute('INSERT INTO ...', [item.id, item.value]);
    }
  });
}
```

### 3. 连接池（MySQL）

MySQL 适配器使用连接池管理连接，默认配置：
- `connectionLimit: 10`
- `queueLimit: 0`

## 数据备份

### SQLite 备份

```bash
# 复制数据库文件
cp data/app.db data/app.db.backup

# 或使用 dump 命令
sqlite3 data/app.db .dump > backup.sql
```

### MySQL 备份

```bash
# 使用 mysqldump
mysqldump -u root -p ai_life_partner > backup.sql

# 恢复
mysql -u root -p ai_life_partner < backup.sql
```

## 常见问题

### Q: 如何在开发中切换数据库？

A: 修改 `.env` 中的 `DB_TYPE` 变量，重启服务器即可。

### Q: SQLite 和 MySQL 的性能差异？

A: 
- SQLite: 适合单机、小规模数据（<100GB），零配置
- MySQL: 适合多用户、高并发、大数据量场景

### Q: 迁移失败如何回滚？

A: 使用 `rollbackMigration()` 函数回滚最后一次迁移。

### Q: 如何查看当前数据库类型？

A: 检查日志输出 `[DatabaseFactory] 创建数据库适配器` 会显示类型。

## 最佳实践

1. **始终使用 Repository**: 不要在 Service 层直接调用数据库
2. **使用 async/await**: 所有数据库操作都是异步的
3. **事务边界**: 在 Repository 层处理事务，不在 Service 层
4. **参数化查询**: 始终使用参数化防止 SQL 注入
5. **错误处理**: 使用 try-catch 包裹数据库操作

## 附录：完整表结构

详见项目中的 `src/database/index.ts` 文件。

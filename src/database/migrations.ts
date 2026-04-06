/**
 * 数据库迁移管理
 */

import { getDatabase } from './index';
import { logger } from '../utils/logger';
import { createDatabaseConfigFromEnv } from './DatabaseFactory';

interface Migration {
  version: number;
  name: string;
  up: string;
  down?: string;
}

/**
 * 获取当前数据库类型
 */
function getDbType(): 'sqlite' | 'mysql' {
  const config = createDatabaseConfigFromEnv();
  return config.type as 'sqlite' | 'mysql';
}

/**
 * 根据数据库类型获取当前时间函数
 */
function getNowSql(): string {
  return getDbType() === 'sqlite' ? 'CURRENT_TIMESTAMP' : 'NOW()';
}

/**
 * 根据数据库类型获取自增字段类型
 */
function getAutoIncrementSql(): string {
  return getDbType() === 'sqlite' ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT PRIMARY KEY AUTO_INCREMENT';
}

/**
 * 获取动态生成的迁移（运行时根据数据库类型生成）
 */
function getMigrations(): Migration[] {
  return [
    {
      version: 1,
      name: 'initial_schema',
      up: `
        -- 初始表结构已在 index.ts 中创建
        -- 此处用于记录迁移历史
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version ${getDbType() === 'sqlite' ? 'INTEGER PRIMARY KEY' : 'INT PRIMARY KEY'},
          name ${getDbType() === 'sqlite' ? 'TEXT' : 'VARCHAR(255)'} NOT NULL,
          applied_at ${getDbType() === 'sqlite' ? 'TEXT' : 'TIMESTAMP'} DEFAULT ${getNowSql()}
        );
      `,
    },
  ];
}

/**
 * 运行迁移
 */
export async function runMigrations(): Promise<void> {
  const db = await getDatabase();

  // 确保迁移表存在
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version ${getDbType() === 'sqlite' ? 'INTEGER PRIMARY KEY' : 'INT PRIMARY KEY'},
      name ${getDbType() === 'sqlite' ? 'TEXT' : 'VARCHAR(255)'} NOT NULL,
      applied_at ${getDbType() === 'sqlite' ? 'TEXT' : 'TIMESTAMP'} DEFAULT ${getNowSql()}
    )
  `);

  // 获取已应用的迁移
  const applied = await db.queryMany<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version');
  const appliedVersions = new Set(applied.map(m => m.version));

  // 运行未应用的迁移
  for (const migration of getMigrations()) {
    if (!appliedVersions.has(migration.version)) {
      logger.info(`[Migration] 运行迁移：${migration.name} (v${migration.version})`);

      await db.transaction(async () => {
        await db.execute(migration.up);
        await db.execute('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', [
          migration.version,
          migration.name
        ]);
      });

      logger.info(`[Migration] 迁移成功：${migration.name}`);
    }
  }

  logger.info('[Migration] 所有迁移已完成');
}

/**
 * 回滚最后一次迁移
 */
export async function rollbackMigration(): Promise<void> {
  const db = await getDatabase();

  const lastMigration = await db.queryOne<{ version: number; name: string }>(
    `SELECT version, name FROM schema_migrations ORDER BY version DESC ${getDbType() === 'sqlite' ? 'LIMIT 1' : 'LIMIT 1'}`
  );

  if (!lastMigration) {
    logger.warn('[Migration] 没有可回滚的迁移');
    return;
  }

  const migration = getMigrations().find(m => m.version === lastMigration.version);
  if (!migration || !migration.down) {
    logger.error(`[Migration] 迁移 ${lastMigration.name} 没有定义回滚 SQL`);
    return;
  }

  logger.info(`[Migration] 回滚迁移：${migration.name}`);

  await db.transaction(async () => {
    await db.execute(migration.down!);
    await db.execute('DELETE FROM schema_migrations WHERE version = ?', [migration.version]);
  });

  logger.info(`[Migration] 回滚成功：${migration.name}`);
}

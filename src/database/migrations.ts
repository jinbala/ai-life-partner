/**
 * 数据库迁移管理
 */

import { getDatabase } from './index';
import { logger } from '../utils/logger';

interface Migration {
  version: number;
  name: string;
  up: string;
  down?: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      -- 初始表结构已在 index.ts 中创建
      -- 此处用于记录迁移历史
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT DEFAULT (datetime('now'))
      );
    `,
  },
  {
    version: 2,
    name: 'add_user_profile_fields',
    up: `
      -- 添加更多用户画像字段
      ALTER TABLE user_portraits ADD COLUMN basics_data TEXT;
      ALTER TABLE user_portraits ADD COLUMN growth_track_data TEXT;
    `,
  },
];

/**
 * 运行迁移
 */
export function runMigrations(): void {
  const db = getDatabase();

  // 确保迁移表存在
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 获取已应用的迁移
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{ version: number }>;
  const appliedVersions = new Set(applied.map(m => m.version));

  // 运行未应用的迁移
  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      logger.info(`[Migration] 运行迁移：${migration.name} (v${migration.version})`);

      const transaction = db.transaction(() => {
        db.exec(migration.up);
        db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
          migration.version,
          migration.name
        );
      });

      transaction();
      logger.info(`[Migration] 迁移成功：${migration.name}`);
    }
  }

  logger.info('[Migration] 所有迁移已完成');
}

/**
 * 回滚最后一次迁移
 */
export function rollbackMigration(): void {
  const db = getDatabase();

  const lastMigration = db.prepare(
    'SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT 1'
  ).get() as { version: number; name: string } | undefined;

  if (!lastMigration) {
    logger.warn('[Migration] 没有可回滚的迁移');
    return;
  }

  const migration = migrations.find(m => m.version === lastMigration.version);
  if (!migration || !migration.down) {
    logger.error(`[Migration] 迁移 ${lastMigration.name} 没有定义回滚 SQL`);
    return;
  }

  logger.info(`[Migration] 回滚迁移：${migration.name}`);

  const transaction = db.transaction(() => {
    db.exec(migration.down!);
    db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(migration.version);
  });

  transaction();
  logger.info(`[Migration] 回滚成功：${migration.name}`);
}

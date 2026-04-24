/**
 * 用户画像数据仓库
 */

import { BaseRepository, getNowSql } from '../BaseRepository';

export interface UserPortrait {
  id: number;
  user_id: string;
  version: number;
  industry: string | null;
  income_structure: string | null;
  resources: string | null;
  decision_style: string;
  stuck_points: string | null;
  procrastination_triggers: string | null;
  abilities: string | null;
  growth_track: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePortraitInput {
  user_id: string;
  industry?: string;
  income_structure?: string | any;
  resources?: string | any;
  decision_style?: string;
  stuck_points?: string | string[];
  procrastination_triggers?: string | string[];
  abilities?: string | any;
  growth_track?: string | any;
}

export class PortraitRepository extends BaseRepository {
  /**
   * 创建或获取用户画像
   */
  async findOrCreate(userId: string): Promise<UserPortrait> {
    const existing = await this.queryOne<UserPortrait>(
      'SELECT * FROM user_portraits WHERE user_id = ? ORDER BY version DESC LIMIT 1',
      [userId]
    );

    if (existing) {
      return existing;
    }

    // 创建默认画像
    const defaultData = {
      industry: null,
      income_structure: JSON.stringify({ sources: [], largestSource: '' }),
      resources: JSON.stringify({ skills: [], connections: [] }),
      decision_style: 'intuitive',
      stuck_points: JSON.stringify([]),
      procrastination_triggers: JSON.stringify([]),
      abilities: JSON.stringify({
        businessJudgment: 5,
        execution: 5,
        cognition: 5,
        riskControl: 5,
        learningAbility: 5,
      }),
      growth_track: JSON.stringify({
        decisionQuality: [],
        cognitionUpgrades: [],
        abilityTrend: [],
      }),
    };

    await this.execute(`
      INSERT INTO user_portraits (user_id, version, industry, income_structure, resources, decision_style, stuck_points, procrastination_triggers, abilities, growth_track)
      VALUES (?, 1, ?, ?, ?, 'intuitive', ?, ?, ?, ?)
    `, [
      userId,
      defaultData.industry,
      defaultData.income_structure,
      defaultData.resources,
      defaultData.stuck_points,
      defaultData.procrastination_triggers,
      defaultData.abilities,
      defaultData.growth_track
    ]);

    return (await this.findByUserId(userId))!;
  }

  /**
   * 根据用户 ID 查找画像
   */
  async findByUserId(userId: string): Promise<UserPortrait | null> {
    return await this.queryOne<UserPortrait>('SELECT * FROM user_portraits WHERE user_id = ? ORDER BY version DESC LIMIT 1', [userId]);
  }

  /**
   * 根据 ID 查找画像
   */
  async findById(id: number): Promise<UserPortrait | null> {
    return await this.queryOne<UserPortrait>('SELECT * FROM user_portraits WHERE id = ?', [id]);
  }

  /**
   * 更新画像
   */
  async update(userId: string, fields: Partial<Omit<CreatePortraitInput, 'user_id'>>): Promise<UserPortrait> {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (fields.industry !== undefined) {
      setClauses.push('industry = ?');
      values.push(fields.industry);
    }
    if (fields.income_structure !== undefined) {
      setClauses.push('income_structure = ?');
      values.push(typeof fields.income_structure === 'string' ? fields.income_structure : JSON.stringify(fields.income_structure));
    }
    if (fields.resources !== undefined) {
      setClauses.push('resources = ?');
      values.push(typeof fields.resources === 'string' ? fields.resources : JSON.stringify(fields.resources));
    }
    if (fields.decision_style !== undefined) {
      setClauses.push('decision_style = ?');
      values.push(fields.decision_style);
    }
    if (fields.stuck_points !== undefined) {
      setClauses.push('stuck_points = ?');
      values.push(typeof fields.stuck_points === 'string' ? fields.stuck_points : JSON.stringify(fields.stuck_points));
    }
    if (fields.procrastination_triggers !== undefined) {
      setClauses.push('procrastination_triggers = ?');
      values.push(typeof fields.procrastination_triggers === 'string' ? fields.procrastination_triggers : JSON.stringify(fields.procrastination_triggers));
    }
    if (fields.abilities !== undefined) {
      setClauses.push('abilities = ?');
      values.push(typeof fields.abilities === 'string' ? fields.abilities : JSON.stringify(fields.abilities));
    }
    if (fields.growth_track !== undefined) {
      setClauses.push('growth_track = ?');
      values.push(typeof fields.growth_track === 'string' ? fields.growth_track : JSON.stringify(fields.growth_track));
    }

    if (setClauses.length > 0) {
      // 获取当前版本号
      const current = await this.findByUserId(userId);
      const newVersion = current ? current.version + 1 : 1;

      setClauses.push('version = ?');
      values.push(newVersion);

      setClauses.push(`updated_at = ${getNowSql()}`);
      values.push(userId);

      await this.runUpdate(`UPDATE user_portraits SET ${setClauses.join(', ')} WHERE user_id = ?`, values);
    }

    return (await this.findByUserId(userId))!;
  }

  /**
   * 记录能力变化
   */
  async recordAbilityChange(userId: string, ability: string, oldValue: number, newValue: number, reason: string): Promise<void> {
    const portrait = await this.findByUserId(userId);
    if (!portrait) return;

    const growthTrack = portrait.growth_track ? JSON.parse(portrait.growth_track) : { abilityTrend: [] };
    growthTrack.abilityTrend = growthTrack.abilityTrend || [];
    growthTrack.abilityTrend.push({
      date: new Date().toISOString(),
      ability,
      oldValue,
      newValue,
      reason,
    });

    await this.update(userId, { growth_track: JSON.stringify(growthTrack) });
  }

  /**
   * 记录决策质量
   */
  async recordDecisionQuality(userId: string, decision: string, quality: number, outcome?: string): Promise<void> {
    const portrait = await this.findByUserId(userId);
    if (!portrait) return;

    const growthTrack = portrait.growth_track ? JSON.parse(portrait.growth_track) : { decisionQuality: [] };
    growthTrack.decisionQuality = growthTrack.decisionQuality || [];
    growthTrack.decisionQuality.push({
      date: new Date().toISOString(),
      decision,
      quality,
      outcome,
    });

    await this.update(userId, { growth_track: JSON.stringify(growthTrack) });
  }

  /**
   * 记录认知升级
   */
  async recordCognitionUpgrade(userId: string, description: string, trigger: string): Promise<void> {
    const portrait = await this.findByUserId(userId);
    if (!portrait) return;

    const growthTrack = portrait.growth_track ? JSON.parse(portrait.growth_track) : { cognitionUpgrades: [] };
    growthTrack.cognitionUpgrades = growthTrack.cognitionUpgrades || [];
    growthTrack.cognitionUpgrades.push({
      date: new Date().toISOString(),
      description,
      trigger,
    });

    await this.update(userId, { growth_track: JSON.stringify(growthTrack) });
  }

  /**
   * 删除画像
   */
  async delete(userId: string): Promise<boolean> {
    const result = await this.runDelete('DELETE FROM user_portraits WHERE user_id = ?', [userId]);
    return result > 0;
  }
}

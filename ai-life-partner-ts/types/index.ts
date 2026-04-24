/**
 * 统一类型导出
 */

// 从子模块重新导出所有类型
export * from './portrait';
export * from './goal';

// DecisionRecord 在 portrait.ts 和此文件中都有定义，这里保留此文件的版本以避免冲突
export interface DecisionRecord {
  id: string;
  date: string;
  topic: string;
  essence: string;
  options: Array<{
    name: string;
    cost: string;
    benefit: string;
    reversible: boolean;
  }>;
  chosen: string;
  reason: string;
  expected_outcome: string;
  verify_date: string;
  actual_outcome: string;
  deviation: string;
  deviation_reason: string;
  lesson_extracted: string;
  lesson_asset_id: string;
  profile_impact: string;
  status: string;
  reminded: boolean;
}

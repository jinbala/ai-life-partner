# 项目结构重构报告

## 重构完成日期

2026-04-04

## 重构目标

将原有的单体 `src/core/` 和 `src/feishu/` 重构为模块化、分层清晰的架构。

## 新目录结构

```
src/
├── api/                          # API 层
│   ├── index.ts                  # API 统一导出
│   ├── middleware/               # Express 中间件
│   │   ├── index.ts
│   │   ├── auth.ts               # 认证中间件（API Key、Session、Rate Limit）
│   │   └── logging.ts            # 日志中间件（请求日志、慢请求检测）
│   └── routes/                   # API 路由
│       ├── index.ts
│       ├── chat.ts               # 聊天接口
│       ├── feishu.ts             # 飞书 webhook
│       └── health.ts             # 健康检查
│
├── constants/                    # 常量配置
│   └── index.ts                  # 系统提示词、配置常量、枚举
│
├── context/                      # 上下文管理
│   └── sessionManager.ts         # 会话管理器（避免内存泄漏）
│
├── integrations/                 # 第三方集成
│   └── feishu/
│       ├── index.ts
│       └── messageService.ts     # 飞书消息服务
│
├── services/                     # 业务服务层
│   ├── index.ts                  # 服务统一导出
│   ├── ai/                       # AI 服务
│   │   ├── index.ts
│   │   ├── aiService.ts          # AI 模型调用
│   │   └── aiPersona.ts          # AI 人设提示词
│   ├── memory/                   # 记忆服务
│   │   ├── index.ts
│   │   └── memoryManager.ts      # 长期记忆管理
│   ├── assets/                   # 资产服务
│   │   ├── index.ts
│   │   └── abilityAssetManager.ts # 能力资产管理
│   ├── user/                     # 用户服务
│   │   ├── index.ts
│   │   ├── portraitManager.ts    # 用户画像管理
│   │   └── goalManager.ts        # 目标管理
│   ├── growth/                   # 成长服务
│   │   ├── index.ts
│   │   ├── autoReviewManager.ts  # 自动复盘
│   │   ├── cognitionChallenge.ts # 认知挑战
│   │   └── silentAnalysisManager.ts # 静默分析
│   └── decision/                 # 决策服务
│       ├── index.ts
│       └── decisionFeedback.ts   # 决策反馈闭环
│
├── types/                        # 类型定义
│   ├── index.ts                  # 统一导出
│   ├── portrait.ts               # 用户画像类型
│   ├── goal.ts                   # 目标管理类型
│   └── decision.ts               # 决策类型
│
├── utils/                        # 工具函数
│   ├── index.ts
│   ├── logger.ts                 # 日志系统
│   └── errors.ts                 # 错误处理
│
└── server.ts                     # 应用入口

tests/
├── setup.ts                      # Jest 配置
├── unit/                         # 单元测试
└── integration/                  # 集成测试
```

## 主要改进

### 1. 分层架构

- **API 层**: 处理 HTTP 请求、认证、日志
- **服务层**: 业务逻辑，按功能模块划分
- **工具层**: 通用工具函数

### 2. 模块化设计

每个服务独立管理自己的数据和逻辑：

- `AIService`: 多模型支持（Claude、GPT、DeepSeek 等）
- `MemoryManager`: 6 种记忆类型管理
- `AbilityAssetManager`: 5 类能力资产
- `PortraitManager`: 用户画像演化
- `GoalManager`: 目标树管理
- `CognitionChallengeManager`: 认知挑战生成
- `DecisionFeedbackManager`: 决策闭环
- `SilentAnalysisManager`: 异步静默分析

### 3. 会话管理优化

- 新增 `SessionManager` 类
- 自动过期清理（30 分钟无活动）
- 内存使用监控
- 防止内存泄漏

### 4. 错误处理统一

- `AppError` 基类
- 错误码枚举（ErrorCode）
- 专用错误类型（BusinessError、ValidationError 等）

### 5. 日志系统完善

- 多级别日志（debug/info/warn/error）
- 彩色输出
- 文件记录支持
- 模块级日志实例

### 6. 中间件系统

- 请求日志中间件
- 请求 ID 追踪
- API Key 认证
- 速率限制

## 新增开发脚本

```json
{
  "test": "jest",
  "test:unit": "jest --testPathPattern=tests/unit",
  "test:integration": "jest --testPathPattern=tests/integration",
  "typecheck": "tsc --noEmit",
  "lint": "eslint src --ext .ts",
  "clean": "rm -rf dist"
}
```

## 依赖更新

新增开发依赖：

- `@types/jest`: Jest 测试框架类型
- `jest`: 测试框架
- `ts-jest`: TypeScript + Jest

## 迁移说明

### 原路径 → 新路径


| 原路径                              | 新路径                                         |
| ----------------------------------- | ---------------------------------------------- |
| `src/core/aiService.ts`             | `src/services/ai/aiService.ts`                 |
| `src/core/aiPersona.ts`             | `src/services/ai/aiPersona.ts`                 |
| `src/core/portraitManager.ts`       | `src/services/user/portraitManager.ts`         |
| `src/core/goalManager.ts`           | `src/services/user/goalManager.ts`             |
| `src/core/memoryManager.ts`         | `src/services/memory/memoryManager.ts`         |
| `src/core/abilityAssetManager.ts`   | `src/services/assets/abilityAssetManager.ts`   |
| `src/core/autoReviewManager.ts`     | `src/services/growth/autoReviewManager.ts`     |
| `src/core/cognitionChallenge.ts`    | `src/services/growth/cognitionChallenge.ts`    |
| `src/core/decisionFeedback.ts`      | `src/services/decision/decisionFeedback.ts`    |
| `src/core/silentAnalysisManager.ts` | `src/services/growth/silentAnalysisManager.ts` |
| `src/feishu/`                       | `src/integrations/feishu/`                     |

## 使用示例

### 导入服务

```typescript
// 从服务层导入
import { AIService } from './services/ai';
import { PortraitManager } from './services/user';
import { MemoryManager } from './services/memory';

// 从 API 层导入中间件
import { apiKeyAuth, requestLogger } from './api/middleware';
import { healthRoutes, chatRoutes } from './api/routes';
```

### 使用 SessionManager

```typescript
import { sessionManager } from './context/sessionManager';

// 获取或创建会话
const session = sessionManager.getOrCreateSession(userId);

// 添加消息
sessionManager.addMessage(userId, 'user', '你好');

// 获取统计
const stats = sessionManager.getStats();
```

### 使用常量

```typescript
import { SYSTEM_PROMPTS, CONFIG, AI_MODELS } from './constants';

// 使用系统提示词
const prompt = SYSTEM_PROMPTS.MAIN;

// 使用配置
const timeout = CONFIG.SESSION_TIMEOUT;
```

## 后续优化建议

1. **添加 ESLint 配置**: 代码风格统一
2. **添加 Prettier**: 代码格式化
3. **编写单元测试**: 为核心服务添加测试覆盖
4. **API 文档**: 使用 Swagger/OpenAPI 文档
5. **Docker 化**: 容器化部署
6. **CI/CD**: GitHub Actions 自动化

## 验证

重构后验证：

- ✅ TypeScript 编译通过 (`npm run typecheck`)
- ✅ 目录结构清晰
- ✅ 导入路径正确
- ✅ 服务模块独立

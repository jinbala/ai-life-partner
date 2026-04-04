/**
 * 健康检查路由
 */

import { Router } from 'express';
import { AIService } from '../../services/ai';

const router = Router();
const aiService = new AIService();

/**
 * GET /health
 * 健康检查
 */
router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    model: aiService.getModelInfo(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /ready
 * 就绪检查（可扩展用于检查依赖服务）
 */
router.get('/ready', async (req, res) => {
  try {
    // 可在此检查数据库、AI 服务等依赖
    res.json({
      ready: true,
      services: {
        ai: 'ok',
      },
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      services: {
        ai: 'error',
      },
    });
  }
});

export default router;

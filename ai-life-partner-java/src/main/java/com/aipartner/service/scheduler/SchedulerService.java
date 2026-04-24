package com.aipartner.service.scheduler;

import com.aipartner.entity.User;
import com.aipartner.entity.Goal;
import com.aipartner.entity.DailyTask;
import com.aipartner.entity.Review;
import com.aipartner.entity.ConversationHistory;
import com.aipartner.service.ai.AiPersona;
import com.aipartner.service.ai.AiService;
import com.aipartner.integration.feishu.FeishuMessageService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 定时任务服务（暂时禁用）
 */
@ApplicationScoped
public class SchedulerService {

    @Inject
    FeishuMessageService feishuMessageService;

    @Inject
    AiService aiService;

    /**
     * 早安推送 - 每天 8:00
     * TODO: 修复 cron 表达式（需要 7 字段）
     */
    // @Scheduled(cron = "0 0 8 * * * ?")
    public void morningPush() {
        // 暂时禁用
    }

    /**
     * 复盘提醒 - 每天 21:00
     */
    // @Scheduled(cron = "0 0 21 * * * ?")
    public void reviewReminder() {
        // 暂时禁用
    }

    /**
     * 数据库备份 - 每天 3:00
     */
    // @Scheduled(cron = "0 0 3 * * * ?")
    public void backupDatabase() {
        System.out.println("执行数据库备份...");
    }

    /**
     * 周画像分析 - 每周一 10:00
     */
    // @Scheduled(cron = "0 0 10 ? * MON")
    public void weeklyPortraitAnalysis() {
        // 暂时禁用
    }

    /**
     * 每日总结 - 每天 23:00
     */
    // @Scheduled(cron = "0 0 23 * * * ?")
    public void dailySummary() {
        // 暂时禁用
    }

    /**
     * 对话清理 - 每周日 2:00 删除 90 天前的对话
     */
    // @Scheduled(cron = "0 0 2 ? * SUN")
    public void cleanupOldConversations() {
        // 暂时禁用
    }
}
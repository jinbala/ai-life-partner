package com.aipartner.service.user;

import com.aipartner.entity.User;
import com.aipartner.entity.UserPortrait;
import com.aipartner.entity.Goal;
import com.aipartner.entity.DailyTask;
import com.aipartner.entity.Memory;
import com.aipartner.entity.Decision;
import com.aipartner.entity.Review;
import com.aipartner.entity.AbilityAsset;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

import java.util.List;

/**
 * 用户综合服务入口
 * 整合用户画像、目标、记忆、决策等所有用户相关功能
 */
@ApplicationScoped
public class UserService {

    /**
     * 获取或创建用户
     */
    @Transactional
    public User getOrCreateUser(String openId) {
        return User.findOrCreateByOpenId(openId);
    }

    /**
     * 根据 ID 获取用户
     */
    public User getUserById(String id) {
        return User.findById(id);
    }

    /**
     * 获取或创建用户画像
     */
    @Transactional
    public UserPortrait getOrCreatePortrait(String userId) {
        UserPortrait portrait = UserPortrait.findByUserId(userId);
        if (portrait == null) {
            portrait = new UserPortrait();
            portrait.id = "portrait_" + System.currentTimeMillis();
            portrait.userId = userId;
            portrait.businessJudgment = 50;
            portrait.executionAbility = 50;
            portrait.cognitionLevel = 50;
            portrait.riskControl = 50;
            portrait.learningAbility = 50;
            portrait.persist();
        }
        return portrait;
    }

    /**
     * 保存用户画像
     */
    @Transactional
    public void savePortrait(UserPortrait portrait) {
        portrait.persist();
    }

    /**
     * 获取用户的所有目标
     */
    public List<Goal> getGoals(String userId) {
        return Goal.findByUserId(userId);
    }

    /**
     * 获取用户的今日任务
     */
    public List<Goal> getTodayGoals(String userId) {
        return Goal.findByUserIdAndType(userId, "daily");
    }

    /**
     * 创建目标
     */
    @Transactional
    public Goal createGoal(Goal goal) {
        goal.id = "goal_" + System.currentTimeMillis();
        goal.status = "active";
        goal.persist();
        return goal;
    }

    /**
     * 获取用户的记忆
     */
    public List<Memory> getMemories(String userId) {
        return Memory.findByUserId(userId);
    }

    /**
     * 搜索记忆
     */
    public List<Memory> searchMemories(String userId, String keyword, int limit) {
        return Memory.search(userId, keyword, limit);
    }

    /**
     * 添加记忆
     */
    @Transactional
    public Memory addMemory(Memory memory) {
        memory.id = "memory_" + System.currentTimeMillis();
        memory.persist();
        return memory;
    }

    /**
     * 获取用户的决策
     */
    public List<Decision> getDecisions(String userId) {
        return Decision.findByUserId(userId);
    }

    /**
     * 获取待复盘的决策
     */
    public List<Decision> getPendingDecisions(String userId) {
        return Decision.findPendingReview(userId);
    }

    /**
     * 创建决策
     */
    @Transactional
    public Decision createDecision(Decision decision) {
        decision.id = "decision_" + System.currentTimeMillis();
        decision.status = "pending";
        decision.persist();
        return decision;
    }

    /**
     * 关闭决策闭环
     */
    @Transactional
    public void closeDecision(String decisionId, String actualOutcome, String deviationAnalysis) {
        Decision decision = Decision.findById(decisionId);
        if (decision != null) {
            decision.actualOutcome = actualOutcome;
            decision.deviationAnalysis = deviationAnalysis;
            decision.status = "closed";
            decision.persist();
        }
    }

    /**
     * 获取用户的复盘
     */
    public List<Review> getReviews(String userId) {
        return Review.findByUserId(userId);
    }

    /**
     * 获取用户某类型的复盘
     */
    public List<Review> getReviewsByType(String userId, String type) {
        return Review.findByUserIdAndType(userId, type);
    }

    /**
     * 创建复盘
     */
    @Transactional
    public Review createReview(Review review) {
        review.id = "review_" + System.currentTimeMillis();
        review.persist();
        return review;
    }

    /**
     * 获取用户的能力资产
     */
    public List<AbilityAsset> getAbilityAssets(String userId) {
        return AbilityAsset.findByUserId(userId);
    }

    /**
     * 获取某类型的能力资产
     */
    public List<AbilityAsset> getAbilityAssetsByType(String userId, String type) {
        return AbilityAsset.findByUserIdAndType(userId, type);
    }

    /**
     * 添加能力资产
     */
    @Transactional
    public AbilityAsset addAbilityAsset(AbilityAsset asset) {
        asset.id = "asset_" + System.currentTimeMillis();
        asset.persist();
        return asset;
    }

    /**
     * 获取用户画像摘要
     */
    public PortraitSummary getPortraitSummary(String userId) {
        UserPortrait portrait = getOrCreatePortrait(userId);
        PortraitSummary summary = new PortraitSummary();
        summary.industry = portrait.industry;
        summary.incomeStructure = portrait.incomeStructure;
        summary.skills = portrait.skills;
        summary.resources = portrait.resources;
        summary.decisionStyle = portrait.decisionStyle;
        summary.painPoints = portrait.painPoints;
        summary.procrastinationTriggers = portrait.procrastinationTriggers;
        summary.abilities = new PortraitSummary.AbilityRadar(
            portrait.businessJudgment,
            portrait.executionAbility,
            portrait.cognitionLevel,
            portrait.riskControl,
            portrait.learningAbility
        );
        summary.summary = portrait.summary;
        return summary;
    }

    /**
     * 更新能力分数
     */
    @Transactional
    public void updateAbilityScore(String userId, String ability, int delta) {
        UserPortrait portrait = getOrCreatePortrait(userId);
        switch (ability) {
            case "businessJudgment" -> portrait.businessJudgment = Math.min(100, Math.max(0, portrait.businessJudgment + delta));
            case "execution" -> portrait.executionAbility = Math.min(100, Math.max(0, portrait.executionAbility + delta));
            case "cognition" -> portrait.cognitionLevel = Math.min(100, Math.max(0, portrait.cognitionLevel + delta));
            case "riskControl" -> portrait.riskControl = Math.min(100, Math.max(0, portrait.riskControl + delta));
            case "learningAbility" -> portrait.learningAbility = Math.min(100, Math.max(0, portrait.learningAbility + delta));
        }
        portrait.persist();
    }

    /**
     * 用户画像摘要
     */
    public static class PortraitSummary {
        public String industry;
        public String incomeStructure;
        public String skills;
        public String resources;
        public String decisionStyle;
        public String painPoints;
        public String procrastinationTriggers;
        public AbilityRadar abilities;
        public String summary;

        public static class AbilityRadar {
            public int businessJudgment;
            public int execution;
            public int cognition;
            public int riskControl;
            public int learningAbility;

            public AbilityRadar(int businessJudgment, int execution, int cognition, int riskControl, int learningAbility) {
                this.businessJudgment = businessJudgment;
                this.execution = execution;
                this.cognition = cognition;
                this.riskControl = riskControl;
                this.learningAbility = learningAbility;
            }
        }
    }
}
package com.aipartner.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_portraits")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserPortrait extends PanacheEntityBase {

    @Id
    @Column(length = 64)
    public String id;

    @Column(name = "user_id", length = 64, nullable = false)
    public String userId;

    @Column(columnDefinition = "TEXT")
    public String industry;           // 行业

    @Column(columnDefinition = "TEXT")
    public String incomeStructure;    // 收入结构

    @Column(columnDefinition = "TEXT")
    public String skills;             // 技能

    @Column(columnDefinition = "TEXT")
    public String resources;          // 资源

    @Column(columnDefinition = "TEXT")
    public String decisionStyle;      // 决策风格

    @Column(name = "pain_points", columnDefinition = "TEXT")
    public String painPoints;         // 痛点/卡点

    @Column(name = "procrastination_triggers", columnDefinition = "TEXT")
    public String procrastinationTriggers;  // 拖延触发因素

    @Column(name = "business_judgment")
    public int businessJudgment = 50;  // 商业判断 0-100

    @Column(name = "execution_ability")
    public int executionAbility = 50;  // 执行力 0-100

    @Column(name = "cognition_level")
    public int cognitionLevel = 50;    // 认知力 0-100

    @Column(name = "risk_control")
    public int riskControl = 50;       // 风控 0-100

    @Column(name = "learning_ability")
    public int learningAbility = 50;   // 学习力 0-100

    @Column(columnDefinition = "TEXT")
    public String summary;             // 画像摘要

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    public LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    public LocalDateTime updatedAt;

    /**
     * 根据用户 ID 查找画像
     */
    public static UserPortrait findByUserId(String userId) {
        return find("userId", userId).firstResult();
    }
}
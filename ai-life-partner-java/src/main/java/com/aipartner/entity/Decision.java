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
@Table(name = "decisions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Decision extends PanacheEntityBase {

    @Id
    @Column(length = 64)
    public String id;

    @Column(name = "user_id", length = 64, nullable = false)
    public String userId;

    @Column(columnDefinition = "TEXT", nullable = false)
    public String topic;              // 决策主题

    @Column(name = "first_principle", columnDefinition = "TEXT")
    public String firstPrinciple;     // 第一性原理分析

    @Column(columnDefinition = "TEXT")
    public String optionsAnalysis;    // 选项分析

    @Column(columnDefinition = "TEXT")
    public String executionPlan;      // 执行计划

    @Column(name = "stop_loss", columnDefinition = "TEXT")
    public String stopLoss;           // 止损线

    @Column(name = "expected_outcome", columnDefinition = "TEXT")
    public String expectedOutcome;    // 预期结果

    @Column(name = "actual_outcome", columnDefinition = "TEXT")
    public String actualOutcome;      // 实际结果

    @Column(columnDefinition = "TEXT")
    public String deviationAnalysis;  // 偏差分析

    @Column(length = 16)
    public String status;             // 状态: pending/reviewed/closed

    @Column(name = "review_due_date")
    public LocalDateTime reviewDueDate;  // 复盘到期日

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    public LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    public LocalDateTime updatedAt;

    /**
     * 根据用户 ID 查找决策
     */
    public static java.util.List<Decision> findByUserId(String userId) {
        return list("userId", userId);
    }

    /**
     * 获取待复盘的决策
     */
    public static java.util.List<Decision> findPendingReview(String userId) {
        return list("userId = ?1 and status = ?2", userId, "pending");
    }
}
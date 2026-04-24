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
@Table(name = "daily_tasks")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DailyTask extends PanacheEntityBase {

    @Id
    @Column(length = 64)
    public String id;

    @Column(name = "user_id", length = 64, nullable = false)
    public String userId;

    @Column(name = "goal_id", length = 64)
    public String goalId;             // 关联的目标

    @Column(length = 128, nullable = false)
    public String title;              // 任务标题

    @Column(columnDefinition = "TEXT")
    public String description;        // 任务描述

    @Column(name = "target_date")
    public LocalDateTime targetDate;  // 目标日期

    @Column
    public boolean completed = false; // 是否完成

    @Column(name = "completed_at")
    public LocalDateTime completedAt; // 完成时间

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    public LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    public LocalDateTime updatedAt;

    /**
     * 根据用户 ID 和日期查找今日任务
     */
    public static java.util.List<DailyTask> findTodayTasks(String userId, LocalDateTime date) {
        LocalDateTime startOfDay = date.toLocalDate().atStartOfDay();
        LocalDateTime endOfDay = date.toLocalDate().atTime(23, 59, 59);
        return list("userId = ?1 and targetDate >= ?2 and targetDate <= ?3", userId, startOfDay, endOfDay);
    }

    /**
     * 根据用户 ID 查找未完成任务
     */
    public static java.util.List<DailyTask> findPendingByUserId(String userId) {
        return list("userId = ?1 and completed = false", userId);
    }
}
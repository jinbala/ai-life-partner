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
@Table(name = "goals")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Goal extends PanacheEntityBase {

    @Id
    @Column(length = 64)
    public String id;

    @Column(name = "user_id", length = 64, nullable = false)
    public String userId;

    @Column(length = 64)
    public String parentId;           // 父目标 ID（用于树状结构）

    @Column(length = 32)
    public String type;               // 类型: northstar(北极星)/annual(年度)/monthly(月度)/weekly(周)/daily(日常)

    @Column(length = 128, nullable = false)
    public String title;              // 目标标题

    @Column(columnDefinition = "TEXT")
    public String description;        // 目标描述

    @Column
    public int progress = 0;          // 进度 0-100

    @Column(name = "target_date")
    public LocalDateTime targetDate;  // 目标日期

    @Column(length = 16)
    public String status;             // 状态: active/completed/archived

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    public LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    public LocalDateTime updatedAt;

    /**
     * 根据用户 ID 查找目标
     */
    public static java.util.List<Goal> findByUserId(String userId) {
        return list("userId", userId);
    }

    /**
     * 根据用户 ID 和类型查找目标
     */
    public static java.util.List<Goal> findByUserIdAndType(String userId, String type) {
        return list("userId = ?1 and type = ?2", userId, type);
    }

    /**
     * 获取用户的北极星目标
     */
    public static Goal findNorthStar(String userId) {
        return find("userId = ?1 and type = ?2", userId, "northstar").firstResult();
    }

    /**
     * 根据父 ID 查找子目标
     */
    public static java.util.List<Goal> findByParentId(String parentId) {
        return list("parentId", parentId);
    }
}
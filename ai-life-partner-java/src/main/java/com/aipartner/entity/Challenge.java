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
@Table(name = "challenges")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Challenge extends PanacheEntityBase {

    @Id
    @Column(length = 64)
    public String id;

    @Column(name = "user_id", length = 64, nullable = false)
    public String userId;

    @Column(columnDefinition = "TEXT", nullable = false)
    public String scenario;           // 挑战场景

    @Column(columnDefinition = "TEXT")
    public String question;           // 问题

    @Column(columnDefinition = "TEXT")
    public String answer;             // 用户的回答

    @Column(columnDefinition = "TEXT")
    public String evaluation;         // AI 评估

    @Column(columnDefinition = "TEXT")
    public String insights;           // 洞察

    @Column(length = 32)
    public String ability;            // 涉及的能力维度

    @Column(length = 16)
    public String status;             // 状态: pending/completed

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    public LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    public LocalDateTime updatedAt;

    /**
     * 根据用户 ID 查找挑战
     */
    public static java.util.List<Challenge> findByUserId(String userId) {
        return list("userId", userId);
    }

    /**
     * 获取用户的待完成挑战
     */
    public static java.util.List<Challenge> findPending(String userId) {
        return list("userId = ?1 and status = ?2", userId, "pending");
    }
}
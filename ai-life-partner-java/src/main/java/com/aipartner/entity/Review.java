package com.aipartner.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "reviews")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Review extends PanacheEntityBase {

    @Id
    @Column(length = 64)
    public String id;

    @Column(name = "user_id", length = 64, nullable = false)
    public String userId;

    @Column(length = 16, nullable = false)
    public String type;               // 类型: daily/weekly/monthly

    @Column(columnDefinition = "TEXT", nullable = false)
    public String content;            // 复盘内容

    @Column(columnDefinition = "TEXT")
    public String aiContent;          // AI 生成/润色内容

    @Column(columnDefinition = "TEXT")
    public String highlights;         // 亮点

    @Column(columnDefinition = "TEXT")
    public String improvements;       // 改进点

    @Column(columnDefinition = "TEXT")
    public String insights;           // 洞察/感悟

    @Column(name = "period_start")
    public LocalDate periodStart;     // 开始日期（如日记日期）

    @Column(name = "period_end")
    public LocalDate periodEnd;       // 结束日期

    @Column(length = 32)
    public String mood;               // 心情

    @Column(name = "review_date")
    public LocalDateTime reviewDate;  // 复盘日期

    @Column(name = "ai_polished", columnDefinition = "TEXT")
    public String aiPolished;         // AI 润色后的内容

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    public LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    public LocalDateTime updatedAt;

    /**
     * 根据用户 ID 查找复盘
     */
    public static java.util.List<Review> findByUserId(String userId) {
        return list("userId", userId);
    }

    /**
     * 根据用户 ID 和类型查找复盘
     */
    public static java.util.List<Review> findByUserIdAndType(String userId, String type) {
        return list("userId = ?1 and type = ?2 order by reviewDate desc", userId, type);
    }

    /**
     * 获取最近的复盘
     */
    public static java.util.List<Review> findRecent(String userId, String type, int limit) {
        return find("userId = ?1 and type = ?2 order by reviewDate desc", userId, type)
            .page(0, limit)
            .list();
    }
}
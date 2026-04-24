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
@Table(name = "ability_assets")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AbilityAsset extends PanacheEntityBase {

    @Id
    @Column(length = 64)
    public String id;

    @Column(name = "user_id", length = 64, nullable = false)
    public String userId;

    @Column(length = 32, nullable = false)
    public String type;               // 类型: framework/lesson/sop/insight/resource

    @Column(length = 128, nullable = false)
    public String title;              // 标题

    @Column(columnDefinition = "TEXT", nullable = false)
    public String content;            // 内容

    @Column(columnDefinition = "TEXT")
    public String source;             // 来源（从哪个决策/复盘来的）

    @Column(columnDefinition = "TEXT")
    public String tags;               // 标签

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    public LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    public LocalDateTime updatedAt;

    /**
     * 根据用户 ID 查找资产
     */
    public static java.util.List<AbilityAsset> findByUserId(String userId) {
        return list("userId", userId);
    }

    /**
     * 根据用户 ID 和类型查找资产
     */
    public static java.util.List<AbilityAsset> findByUserIdAndType(String userId, String type) {
        return list("userId = ?1 and type = ?2", userId, type);
    }
}
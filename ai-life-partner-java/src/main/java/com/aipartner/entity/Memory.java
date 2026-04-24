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
@Table(name = "memories")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Memory extends PanacheEntityBase {

    @Id
    @Column(length = 64)
    public String id;

    @Column(name = "user_id", length = 64, nullable = false)
    public String userId;

    @Column(length = 32, nullable = false)
    public String type;               // 类型: fact/lesson/preference/event/decision/relationship

    @Column(columnDefinition = "TEXT", nullable = false)
    public String content;            // 记忆内容

    @Column
    public int importance = 5;        // 重要性 1-10

    @Column(columnDefinition = "TEXT")
    public String keywords;           // 关键词

    @Column(name = "expires_at")
    public LocalDateTime expiresAt;   // 过期时间

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    public LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    public LocalDateTime updatedAt;

    /**
     * 根据用户 ID 查找所有记忆
     */
    public static java.util.List<Memory> findByUserId(String userId) {
        return list("userId", userId);
    }

    /**
     * 根据用户 ID 和类型查找记忆
     */
    public static java.util.List<Memory> findByUserIdAndType(String userId, String type) {
        return list("userId = ?1 and type = ?2", userId, type);
    }

    /**
     * 搜索相关记忆
     */
    public static java.util.List<Memory> search(String userId, String keyword, int limit) {
        return find("userId = ?1 and content like ?2", userId, "%" + keyword + "%")
            .page(0, limit)
            .list();
    }
}
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
@Table(name = "sessions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Session extends PanacheEntityBase {

    @Id
    @Column(length = 64)
    public String id;

    @Column(name = "user_id", length = 64, nullable = false)
    public String userId;

    @Column(columnDefinition = "TEXT")
    public String context;            // 会话上下文

    @Column(name = "last_message_at")
    public LocalDateTime lastMessageAt;  // 最后消息时间

    @Column(name = "message_count")
    public int messageCount = 0;     // 消息数量

    @Column(length = 16)
    public String status;             // 状态: active/expired

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    public LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    public LocalDateTime updatedAt;

    /**
     * 根据用户 ID 查找活跃会话
     */
    public static Session findActiveByUserId(String userId) {
        return find("userId = ?1 and status = ?2", userId, "active").firstResult();
    }

    /**
     * 根据用户 ID 查找会话
     */
    public static Session findByUserId(String userId) {
        return find("userId", userId).firstResult();
    }

    /**
     * 获取或创建会话
     */
    public static Session getOrCreate(String userId) {
        Session session = findActiveByUserId(userId);
        if (session == null) {
            session = new Session();
            session.id = "session_" + System.currentTimeMillis();
            session.userId = userId;
            session.status = "active";
            session.messageCount = 0;
            session.persist();
        }
        return session;
    }
}
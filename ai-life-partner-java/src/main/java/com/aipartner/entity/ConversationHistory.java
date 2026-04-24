package com.aipartner.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "conversation_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConversationHistory extends PanacheEntityBase {

    @Id
    @Column(length = 64)
    public String id;

    @Column(name = "user_id", length = 64, nullable = false)
    public String userId;

    @Column(name = "session_id", length = 64)
    public String sessionId;

    @Column(length = 16, nullable = false)
    public String role;               // role: user/assistant/system

    @Column(columnDefinition = "TEXT", nullable = false)
    public String content;            // 消息内容

    @Column(columnDefinition = "TEXT")
    public String model;              // 使用的模型

    @Column(name = "token_count")
    public int tokenCount = 0;        // token 数量

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    public LocalDateTime createdAt;

    /**
     * 根据会话 ID 查找对话历史
     */
    public static java.util.List<ConversationHistory> findBySessionId(String sessionId) {
        return list("sessionId = ?1 order by createdAt asc", sessionId);
    }

    /**
     * 根据用户 ID 查找最近的对话历史
     */
    public static java.util.List<ConversationHistory> findRecentByUserId(String userId, int limit) {
        return find("userId = ?1 order by createdAt desc", userId)
            .page(0, limit)
            .list();
    }
}
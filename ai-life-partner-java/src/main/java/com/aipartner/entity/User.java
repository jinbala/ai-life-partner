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
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User extends PanacheEntityBase {

    @Id
    @Column(length = 64)
    public String id;

    @Column(name = "open_id", length = 64, unique = true, nullable = false)
    public String openId;

    @Column(name = "morning_push_enabled")
    public boolean morningPushEnabled = true;

    @Column(name = "review_reminder_enabled")
    public boolean reviewReminderEnabled = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    public LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    public LocalDateTime updatedAt;

    /**
     * 根据 openId 查找或创建用户
     */
    public static User findOrCreateByOpenId(String openId) {
        User user = find("openId", openId).firstResult();
        if (user == null) {
            user = new User();
            user.id = "user_" + System.currentTimeMillis() + "_" + (int)(Math.random() * 1000000);
            user.openId = openId;
            user.morningPushEnabled = true;
            user.reviewReminderEnabled = true;
            user.persist();
        }
        return user;
    }

    /**
     * 根据 ID 查找用户
     */
    public static User findById(String id) {
        return find("id", id).firstResult();
    }

    /**
     * 根据 openId 查找用户
     */
    public static User findByOpenId(String openId) {
        return find("openId", openId).firstResult();
    }

    /**
     * 获取启用早上推送的用户
     */
    public static java.util.List<User> findWithMorningPushEnabled() {
        return list("morningPushEnabled", true);
    }

    /**
     * 获取启用复盘提醒的用户
     */
    public static java.util.List<User> findWithReviewReminderEnabled() {
        return list("reviewReminderEnabled", true);
    }
}
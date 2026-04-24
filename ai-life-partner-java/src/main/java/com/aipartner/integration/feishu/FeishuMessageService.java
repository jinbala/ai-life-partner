package com.aipartner.integration.feishu;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * 飞书消息服务
 */
@ApplicationScoped
public class FeishuMessageService {

    private static final Logger LOG = Logger.getLogger(FeishuMessageService.class);

    @Inject
    @ConfigProperty(name = "feishu.app-id")
    String appId;

    @Inject
    @ConfigProperty(name = "feishu.app-secret")
    String appSecret;

    private String tenantAccessToken;
    private long tokenExpireTime;

    /**
     * 发送文本消息
     */
    public void sendTextMessage(String openId, String content) {
        if (!isConfigured()) {
            LOG.warn("飞书未配置，跳过发送消息");
            return;
        }

        try {
            ensureTokenValid();

            // TODO: 实现实际的飞书 API 调用
            // 这里需要使用飞书 SDK 或 HTTP 客户端
            LOG.infof("发送飞书消息 to %s: %s", openId, content);

        } catch (Exception e) {
            LOG.error("发送飞书消息失败", e);
        }
    }

    /**
     * 发送交互式卡片消息
     */
    public void sendInteractiveMessage(String openId, String text, Button[] buttons) {
        if (!isConfigured()) {
            LOG.warn("飞书未配置，跳过发送消息");
            return;
        }

        try {
            ensureTokenValid();

            // TODO: 实现卡片消息
            LOG.infof("发送飞书卡片消息 to %s: %s", openId, text);

        } catch (Exception e) {
            LOG.error("发送飞书卡片消息失败", e);
        }
    }

    /**
     * 解析接收到的消息
     */
    public ReceivedMessage parseReceivedMessage(Object event) {
        // TODO: 解析飞书 webhook 事件
        ReceivedMessage message = new ReceivedMessage();
        // 从 event 中提取信息
        return message;
    }

    /**
     * 检查飞书是否已配置
     */
    public boolean isConfigured() {
        return appId != null && !appId.isBlank()
            && appSecret != null && !appSecret.isBlank();
    }

    /**
     * 确保 token 有效
     */
    private void ensureTokenValid() {
        if (tenantAccessToken == null || System.currentTimeMillis() > tokenExpireTime) {
            refreshToken();
        }
    }

    /**
     * 刷新 tenant_access_token
     */
    private void refreshToken() {
        // TODO: 调用飞书 API 获取 token
        // POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal
        // Body: {"app_id": "xxx", "app_secret": "xxx"}
        LOG.info("刷新飞书 tenant_access_token");
    }

    public static class Button {
        public String text;
        public String url;
        public String actionId;

        public Button(String text, String url, String actionId) {
            this.text = text;
            this.url = url;
            this.actionId = actionId;
        }
    }

    public static class ReceivedMessage {
        public String messageId;
        public String openId;
        public String content;
        public String chatType;
        public String messageType;
    }
}
package com.aipartner.service.websocket;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.websocket.Session;
import org.jboss.logging.Logger;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket 服务
 */
@ApplicationScoped
public class WebSocketService {

    private static final Logger LOG = Logger.getLogger(WebSocketService.class);

    // 存储 sessionId -> Session 的映射
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();

    /**
     * 处理新的 WebSocket 连接
     */
    public void onConnect(Session session) {
        String userId = session.getRequestParameterMap().getOrDefault("userId", java.util.Collections.singletonList("anonymous")).get(0);
        sessions.put(session.getId(), session);
        LOG.infof("WebSocket 连接: sessionId=%s, userId=%s", session.getId(), userId);
    }

    /**
     * 处理 WebSocket 断开
     */
    public void onDisconnect(Session session) {
        sessions.remove(session.getId());
        LOG.infof("WebSocket 断开: sessionId=%s", session.getId());
    }

    /**
     * 发送消息给指定 session
     */
    public void sendToSession(String sessionId, String message) {
        Session session = sessions.get(sessionId);
        if (session != null && session.isOpen()) {
            try {
                session.getBasicRemote().sendText(message);
            } catch (Exception e) {
                LOG.errorf("发送消息失败: %s", e.getMessage());
            }
        }
    }

    /**
     * 广播消息给所有连接
     */
    public void broadcast(String message) {
        for (Session session : sessions.values()) {
            if (session.isOpen()) {
                try {
                    session.getBasicRemote().sendText(message);
                } catch (Exception e) {
                    LOG.errorf("广播消息失败: %s", e.getMessage());
                }
            }
        }
    }

    /**
     * 获取连接数
     */
    public int getClientCount() {
        return sessions.size();
    }
}
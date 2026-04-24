package com.aipartner.api.websocket;

import com.aipartner.service.websocket.WebSocketService;
import jakarta.inject.Inject;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.websocket.*;
import jakarta.websocket.server.ServerEndpoint;

/**
 * WebSocket 端点
 */
@ServerEndpoint("/ws")
public class ChatWebSocket {

    @Inject
    WebSocketService webSocketService;

    @OnOpen
    public void onOpen(Session session) {
        String userId = session.getRequestParameterMap().getOrDefault("userId", java.util.Collections.singletonList("anonymous")).get(0);
        System.out.println("WebSocket 连接: " + session.getId() + ", userId: " + userId);
    }

    @OnClose
    public void onClose(Session session) {
        System.out.println("WebSocket 断开: " + session.getId());
    }

    @OnError
    public void onError(Session session, Throwable error) {
        System.err.println("WebSocket 错误: " + error.getMessage());
    }

    @OnMessage
    public String onMessage(Session session, String message) {
        // 简单回声，实际应该处理消息
        return "{\"type\":\"heartbeat\",\"message\":\"pong\"}";
    }
}
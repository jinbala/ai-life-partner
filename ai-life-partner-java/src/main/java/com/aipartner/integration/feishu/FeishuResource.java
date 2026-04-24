package com.aipartner.integration.feishu;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Map;

/**
 * 飞书 Webhook 端点
 */
@Path("/api/feishu")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class FeishuResource {

    @Inject
    FeishuMessageService messageService;

    /**
     * 飞书验证 URL（用于配置回调 URL 时验证）
     */
    @GET
    @Path("/webhook")
    public Response verify(@QueryParam("challenge") String challenge) {
        if (challenge != null) {
            return Response.ok(Map.of("challenge", challenge)).build();
        }
        return Response.ok().build();
    }

    /**
     * 接收飞书事件回调
     */
    @POST
    @Path("/webhook")
    public Response handleEvent(Map<String, Object> payload) {
        try {
            String type = (String) payload.get("type");

            if ("url_verification".equals(type)) {
                // URL 验证
                String challenge = (String) payload.get("challenge");
                return Response.ok(Map.of("challenge", challenge)).build();
            }

            if ("event_callback".equals(type)) {
                // 处理事件
                Map<String, Object> event = (Map<String, Object>) payload.get("event");
                if (event != null) {
                    String eventType = (String) event.get("type");

                    if ("message".equals(eventType)) {
                        // 处理消息事件
                        handleMessageEvent(event);
                    }
                }
            }

            return Response.ok(Map.of("success", true)).build();

        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(Map.of("error", e.getMessage()))
                .build();
        }
    }

    /**
     * 处理消息事件
     */
    private void handleMessageEvent(Map<String, Object> event) {
        String messageId = (String) event.get("message_id");
        String openId = (String) event.get("open_id");
        String content = (String) event.get("content");
        String chatType = (String) event.get("chat_type");

        System.out.println("收到飞书消息: " + messageId + " from " + openId);

        // TODO: 处理用户消息，调用 AI 服务，然后回复
    }

    /**
     * 飞书发送消息接口
     */
    @POST
    @Path("/send")
    public Response sendMessage(FeishuSendRequest request) {
        if (!messageService.isConfigured()) {
            return Response.status(Response.Status.SERVICE_UNAVAILABLE)
                .entity(Map.of("error", "Feishu not configured"))
                .build();
        }

        messageService.sendTextMessage(request.openId, request.content);
        return Response.ok(Map.of("success", true)).build();
    }

    public static class FeishuSendRequest {
        public String openId;
        public String content;
    }
}
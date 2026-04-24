package com.aipartner.api;

import com.aipartner.entity.ConversationHistory;
import com.aipartner.entity.Session;
import com.aipartner.entity.User;
import com.aipartner.service.ai.AiPersona;
import com.aipartner.service.ai.AiService;
import com.aipartner.service.user.UserService;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 聊天 API
 */
@Path("/api/chat")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ChatResource {

    @Inject
    AiService aiService;

    @Inject
    UserService userService;

    /**
     * 发送消息
     */
    @POST
    @Path("/message")
    @Transactional
    public Response sendMessage(ChatRequest request) {
        try {
            // 获取或创建用户
            String openId = request.userId != null ? request.userId : "default_user";
            User user = userService.getOrCreateUser(openId);

            // 获取或创建会话
            Session session = Session.getOrCreate(user.id);

            // 构建消息历史
            List<AiService.ChatMessage> messages = buildMessageHistory(session.id, request.message);

            // 添加用户新消息
            AiService.ChatMessage userMessage = new AiService.ChatMessage("user", request.message);
            messages.add(userMessage);

            // 保存用户消息
            saveConversationHistory(user.id, session.id, "user", request.message);

            // 调用 AI 服务
            AiService.ChatResponse aiResponse = aiService.chat(messages);

            String aiContent = aiResponse != null ? aiResponse.content : "抱歉，我暂时无法回答。";

            // 保存 AI 响应
            saveConversationHistory(user.id, session.id, "assistant", aiContent);

            // 更新会话
            session.lastMessageAt = LocalDateTime.now();
            session.messageCount++;
            session.persist();

            return Response.ok(Map.of(
                "success", true,
                "data", Map.of(
                    "message", aiContent,
                    "sessionId", session.id,
                    "messageId", "msg_" + System.currentTimeMillis()
                )
            )).build();

        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(Map.of("error", e.getMessage()))
                .build();
        }
    }

    /**
     * 获取会话历史
     */
    @GET
    @Path("/session/{sessionId}")
    public Response getSessionHistory(@PathParam("sessionId") String sessionId) {
        List<ConversationHistory> history = ConversationHistory.findBySessionId(sessionId);
        List<Map<String, String>> messages = history.stream()
            .map(h -> Map.of("role", h.role, "content", h.content))
            .collect(Collectors.toList());

        return Response.ok(Map.of("messages", messages)).build();
    }

    /**
     * 删除会话
     */
    @DELETE
    @Path("/session/{sessionId}")
    @Transactional
    public Response deleteSession(@PathParam("sessionId") String sessionId) {
        // 删除会话中的对话历史
        ConversationHistory.delete("sessionId", sessionId);

        // 将会话标记为过期
        Session session = Session.findById(sessionId);
        if (session != null) {
            session.status = "expired";
            session.persist();
        }

        return Response.ok(Map.of("success", true)).build();
    }

    /**
     * 决策分析
     */
    @POST
    @Path("/decision")
    public Response decisionAnalysis(DecisionRequest request) {
        String prompt = AiPersona.decisionAnalysisPrompt(request.topic);
        List<AiService.ChatMessage> messages = List.of(
            new AiService.ChatMessage("system", AiPersona.generateSystemPrompt()),
            new AiService.ChatMessage("user", prompt)
        );

        AiService.ChatResponse response = aiService.chat(messages);
        String content = response != null ? response.content : "抱歉，无法生成决策分析。";

        return Response.ok(Map.of("content", content)).build();
    }

    /**
     * 紧急决策
     */
    @POST
    @Path("/quick-decision")
    public Response quickDecision(QuickDecisionRequest request) {
        String prompt = AiPersona.quickDecisionPrompt(request.situation);
        List<AiService.ChatMessage> messages = List.of(
            new AiService.ChatMessage("system", AiPersona.generateSystemPrompt()),
            new AiService.ChatMessage("user", prompt)
        );

        AiService.ChatResponse response = aiService.chat(messages);
        String content = response != null ? response.content : "抱歉，无法生成决策建议。";

        return Response.ok(Map.of("content", content)).build();
    }

    /**
     * 构建消息历史
     */
    private List<AiService.ChatMessage> buildMessageHistory(String sessionId, String currentMessage) {
        List<AiService.ChatMessage> messages = new ArrayList<>();
        messages.add(new AiService.ChatMessage("system", AiPersona.generateSystemPrompt()));

        // 获取最近的对话历史
        List<ConversationHistory> history = ConversationHistory.findBySessionId(sessionId);
        int count = 0;
        for (ConversationHistory h : history) {
            if (count >= 10) break;  // 最多 10 条历史
            messages.add(new AiService.ChatMessage(h.role, h.content));
            count++;
        }

        return messages;
    }

    /**
     * 保存对话历史
     */
    @Transactional
    public void saveConversationHistory(String userId, String sessionId, String role, String content) {
        ConversationHistory history = new ConversationHistory();
        history.id = "msg_" + System.currentTimeMillis() + "_" + (int)(Math.random() * 10000);
        history.userId = userId;
        history.sessionId = sessionId;
        history.role = role;
        history.content = content;
        history.persist();
    }

    // DTOs
    public static class ChatRequest {
        public String userId;
        public String message;
        public String sessionId;
    }

    public static class DecisionRequest {
        public String userId;
        public String topic;
    }

    public static class QuickDecisionRequest {
        public String userId;
        public String situation;
    }
}
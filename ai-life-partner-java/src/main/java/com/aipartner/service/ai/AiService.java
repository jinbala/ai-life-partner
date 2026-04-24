package com.aipartner.service.ai;

import com.aipartner.config.AiConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * AI 对话服务 - 支持多模型
 */
@ApplicationScoped
public class AiService {

    private static final Logger LOG = Logger.getLogger(AiService.class);

    @Inject
    AiConfig aiConfig;

    private String currentProvider;

    private final Map<String, String> modelEndpoints = Map.of(
        "openai", "https://api.openai.com/v1",
        "deepseek", "https://api.deepseek.com/v1",
        "claude", "https://api.anthropic.com/v1",
        "moonshot", "https://api.moonshot.cn/v1",
        "qwen", "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "zhipu", "https://open.bigmodel.cn/api/paas/v4",
        "ollama", "http://localhost:11434/v1",
        "custom", ""
    );

    /**
     * 获取当前使用的模型配置
     */
    public ModelConfig getCurrentModelConfig() {
        String provider = currentProvider != null ? currentProvider : aiConfig.provider();
        return buildModelConfig(provider);
    }

    /**
     * 切换 AI 模型提供商
     */
    public void switchProvider(String provider) {
        if (!modelEndpoints.containsKey(provider)) {
            throw new IllegalArgumentException("不支持的 AI 提供商: " + provider);
        }
        this.currentProvider = provider;
        LOG.infof("切换 AI 提供商: %s", provider);
    }

    /**
     * 构建模型配置
     */
    private ModelConfig buildModelConfig(String provider) {
        ModelConfig config = new ModelConfig();
        config.provider = provider;
        config.baseUrl = modelEndpoints.getOrDefault(provider, aiConfig.custom().baseUrl());
        config.model = getModelForProvider(provider);
        config.apiKey = getApiKeyForProvider(provider);
        return config;
    }

    private String getModelForProvider(String provider) {
        return switch (provider) {
            case "openai" -> "gpt-4o-mini";
            case "deepseek" -> "deepseek-chat";
            case "claude" -> "claude-sonnet-4-20250514";
            case "moonshot" -> "moonshot-v1-8k";
            case "qwen" -> "qwen-plus";
            case "zhipu" -> "glm-4";
            case "ollama" -> "llama3";
            case "custom" -> aiConfig.custom().model();
            default -> "deepseek-chat";
        };
    }

    private String getApiKeyForProvider(String provider) {
        return switch (provider) {
            case "openai" -> aiConfig.openai().apiKey();
            case "deepseek" -> aiConfig.deepseek().apiKey();
            case "claude" -> aiConfig.claude().apiKey();
            case "moonshot" -> aiConfig.moonshot().apiKey();
            case "qwen" -> aiConfig.qwen().apiKey();
            case "zhipu" -> aiConfig.zhipu().apiKey();
            case "custom" -> aiConfig.custom().apiKey();
            default -> "";
        };
    }

    /**
     * 发送聊天请求
     */
    public ChatResponse chat(List<ChatMessage> messages) {
        ModelConfig config = getCurrentModelConfig();

        // 构建请求体
        ChatRequest request = new ChatRequest();
        request.model = config.model;
        request.messages = messages;
        request.temperature = 0.7;
        request.maxTokens = 4096;

        LOG.debugf("发送 AI 请求, provider: %s, model: %s", config.provider, config.model);

        // TODO: 实现实际的 HTTP 调用
        // 这里需要根据不同 provider 调用不同的 API

        return null;
    }

    /**
     * 测试 AI 连接
     */
    public boolean testConnection() {
        try {
            ModelConfig config = getCurrentModelConfig();
            if (config.apiKey == null || config.apiKey.isBlank()) {
                LOG.warn("AI API Key 未配置");
                return false;
            }
            // 发送一个简单的测试请求
            List<ChatMessage> messages = List.of(
                new ChatMessage("system", "你是一个 helpful assistant"),
                new ChatMessage("user", "Hello")
            );
            ChatResponse response = chat(messages);
            return response != null && response.content != null;
        } catch (Exception e) {
            LOG.error("AI 连接测试失败", e);
            return false;
        }
    }

    public static class ModelConfig {
        public String provider;
        public String baseUrl;
        public String model;
        public String apiKey;
    }

    public static class ChatMessage {
        public String role;
        public String content;

        public ChatMessage() {}

        public ChatMessage(String role, String content) {
            this.role = role;
            this.content = content;
        }
    }

    public static class ChatRequest {
        public String model;
        public List<ChatMessage> messages;
        public double temperature;
        public int maxTokens;
    }

    public static class ChatResponse {
        public String id;
        public String model;
        public String content;
        public int promptTokens;
        public int completionTokens;
        public int totalTokens;
    }
}
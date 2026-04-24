package com.aipartner.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import io.smallrye.config.WithName;

@ConfigMapping(prefix = "ai")
public interface AiConfig {

    @WithDefault("custom")
    String provider();

    CustomConfig custom();

    DeepSeekConfig deepseek();

    OpenAiConfig openai();

    ClaudeConfig claude();

    MoonshotConfig moonshot();

    QwenConfig qwen();

    ZhipuConfig zhipu();

    OllamaConfig ollama();

    interface CustomConfig {
        @WithName("base-url")
        @WithDefault("https://api.aipaibox.com/v1")
        String baseUrl();

        @WithDefault("claude-sonnet-4-6")
        String model();

        String apiKey();
    }

    interface DeepSeekConfig {
        String apiKey();
    }

    interface OpenAiConfig {
        String apiKey();
    }

    interface ClaudeConfig {
        String apiKey();
    }

    interface MoonshotConfig {
        String apiKey();
    }

    interface QwenConfig {
        String apiKey();
    }

    interface ZhipuConfig {
        String apiKey();
    }

    interface OllamaConfig {
        @WithName("base-url")
        @WithDefault("http://localhost:11434")
        String baseUrl();
    }
}
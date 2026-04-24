package com.aipartner.api;

import com.aipartner.entity.User;
import com.aipartner.service.user.UserService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 认证 API
 */
@Path("/api/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthResource {

    @Inject
    UserService userService;

    // 简单的 token 存储（生产环境应该用 JWT）
    private static final Map<String, String> tokenStore = new HashMap<>();

    /**
     * 登录 - 生成访问令牌
     */
    @POST
    @Path("/login")
    public Response login(LoginRequest request) {
        try {
            // 获取或创建用户
            User user = userService.getOrCreateUser(request.openId);

            // 生成简单的 token
            String accessToken = UUID.randomUUID().toString().replace("-", "");
            String refreshToken = UUID.randomUUID().toString().replace("-", "");

            // 存储 token 映射
            tokenStore.put(accessToken, user.id);
            tokenStore.put(refreshToken, user.id);

            return Response.ok(Map.of(
                "accessToken", accessToken,
                "refreshToken", refreshToken,
                "userId", user.id,
                "expiresIn", 86400  // 24 小时
            )).build();

        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(Map.of("error", e.getMessage()))
                .build();
        }
    }

    /**
     * 刷新令牌
     */
    @POST
    @Path("/refresh")
    public Response refresh(RefreshRequest request) {
        String userId = tokenStore.get(request.refreshToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED)
                .entity(Map.of("error", "Invalid refresh token"))
                .build();
        }

        // 生成新的 token
        String newAccessToken = UUID.randomUUID().toString().replace("-", "");
        tokenStore.put(newAccessToken, userId);

        return Response.ok(Map.of(
            "accessToken", newAccessToken,
            "expiresIn", 86400
        )).build();
    }

    /**
     * 验证令牌
     */
    @GET
    @Path("/verify")
    public Response verify(@HeaderParam("Authorization") String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return Response.status(Response.Status.UNAUTHORIZED)
                .entity(Map.of("error", "Missing or invalid Authorization header"))
                .build();
        }

        String token = authHeader.substring(7);
        String userId = tokenStore.get(token);

        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED)
                .entity(Map.of("error", "Invalid token"))
                .build();
        }

        return Response.ok(Map.of(
            "valid", true,
            "userId", userId
        )).build();
    }

    // DTOs
    public static class LoginRequest {
        public String openId;
    }

    public static class RefreshRequest {
        public String refreshToken;
    }
}
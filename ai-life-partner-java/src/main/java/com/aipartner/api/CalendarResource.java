package com.aipartner.api;

import com.aipartner.entity.Review;
import com.aipartner.service.user.UserService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 日历日记 API
 */
@Path("/api/calendar")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class CalendarResource {

    @Inject
    UserService userService;

    /**
     * GET /api/calendar/entries
     * 获取指定年月的日记列表
     */
    @GET
    @Path("/entries")
    public Response getEntries(
        @HeaderParam("Authorization") String authHeader,
        @QueryParam("year") int year,
        @QueryParam("month") int month
    ) {
        try {
            String userId = extractUserId(authHeader);
            if (userId == null) {
                return Response.status(Response.Status.UNAUTHORIZED)
                    .entity(Map.of("success", false, "error", Map.of("message", "未登录")))
                    .build();
            }

            YearMonth yearMonth = YearMonth.of(year, month);
            LocalDate startDate = yearMonth.atDay(1);
            LocalDate endDate = yearMonth.atEndOfMonth();

            // 查询日记
            List<Review> reviews = Review.find(
                "userId = ?1 AND type = ?2 AND periodStart >= ?3 AND periodStart <= ?4",
                userId, "daily", startDate, endDate
            ).list();

            Map<String, Object> entries = new HashMap<>();
            for (Review review : reviews) {
                if (review.periodStart != null) {
                    String dateKey = review.periodStart.toString();
                    entries.put(dateKey, Map.of(
                        "id", review.id,
                        "date", dateKey,
                        "content", review.content != null ? review.content : "",
                        "mood", review.mood != null ? review.mood : "",
                        "summary", review.content != null ? review.content.substring(0, Math.min(50, review.content.length())) : "",
                        "createdAt", review.createdAt != null ? review.createdAt.toString() : ""
                    ));
                }
            }

            return Response.ok(Map.of(
                "success", true,
                "data", Map.of("entries", entries)
            )).build();

        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(Map.of("success", false, "error", Map.of("message", e.getMessage())))
                .build();
        }
    }

    /**
     * GET /api/calendar/entry/{date}
     * 获取指定日期的日记
     */
    @GET
    @Path("/entry/{date}")
    public Response getEntry(
        @HeaderParam("Authorization") String authHeader,
        @PathParam("date") String dateStr
    ) {
        try {
            String userId = extractUserId(authHeader);
            if (userId == null) {
                return Response.status(Response.Status.UNAUTHORIZED)
                    .entity(Map.of("success", false, "error", Map.of("message", "未登录")))
                    .build();
            }

            LocalDate date = LocalDate.parse(dateStr);

            Review review = Review.find(
                "userId = ?1 AND type = ?2 AND periodStart = ?3",
                userId, "daily", date
            ).firstResult();

            if (review == null) {
                return Response.ok(Map.of(
                    "success", true,
                    "data", Map.of("entry", new HashMap<>())
                )).build();
            }

            return Response.ok(Map.of(
                "success", true,
                "data", Map.of("entry", Map.of(
                    "id", review.id,
                    "date", review.periodStart != null ? review.periodStart.toString() : dateStr,
                    "content", review.content != null ? review.content : "",
                    "mood", review.mood != null ? review.mood : "",
                    "summary", review.content != null ? review.content.substring(0, Math.min(50, review.content.length())) : "",
                    "aiContent", review.aiContent != null ? review.aiContent : "",
                    "createdAt", review.createdAt != null ? review.createdAt.toString() : "",
                    "updatedAt", review.updatedAt != null ? review.updatedAt.toString() : ""
                ))
            )).build();

        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(Map.of("success", false, "error", Map.of("message", e.getMessage())))
                .build();
        }
    }

    /**
     * POST /api/calendar/entry/{date}
     * 保存指定日期的日记
     */
    @POST
    @Path("/entry/{date}")
    public Response saveEntry(
        @HeaderParam("Authorization") String authHeader,
        @PathParam("date") String dateStr,
        Map<String, String> body
    ) {
        try {
            String userId = extractUserId(authHeader);
            if (userId == null) {
                return Response.status(Response.Status.UNAUTHORIZED)
                    .entity(Map.of("success", false, "error", Map.of("message", "未登录")))
                    .build();
            }

            LocalDate date = LocalDate.parse(dateStr);
            String content = body.get("content");
            String mood = body.get("mood");

            // 查找或创建日记
            Review review = Review.find(
                "userId = ?1 AND type = ?2 AND periodStart = ?3",
                userId, "daily", date
            ).firstResult();

            if (review == null) {
                review = new Review();
                review.userId = userId;
                review.type = "daily";
                review.periodStart = date;
            }

            review.content = content;
            review.mood = mood;
            review.updatedAt = LocalDateTime.now();
            review.persist();

            return Response.ok(Map.of(
                "success", true,
                "data", Map.of("entry", Map.of(
                    "id", review.id,
                    "date", dateStr,
                    "content", content,
                    "mood", mood != null ? mood : ""
                ))
            )).build();

        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(Map.of("success", false, "error", Map.of("message", e.getMessage())))
                .build();
        }
    }

    /**
     * POST /api/calendar/generate/{date}
     * AI 生成日记
     */
    @POST
    @Path("/generate/{date}")
    public Response generateEntry(
        @HeaderParam("Authorization") String authHeader,
        @PathParam("date") String dateStr
    ) {
        // 暂时返回模拟数据
        return Response.ok(Map.of(
            "success", true,
            "data", Map.of("content", "今天过得怎么样？记录一下吧。")
        )).build();
    }

    /**
     * POST /api/calendar/ai-polish
     * AI 润色日记
     */
    @POST
    @Path("/ai-polish")
    public Response aiPolish(
        @HeaderParam("Authorization") String authHeader,
        Map<String, String> body
    ) {
        // 暂时返回模拟数据
        String content = body.get("content");
        return Response.ok(Map.of(
            "success", true,
            "data", Map.of("polishedContent", content != null ? "润色后的内容：" + content : "")
        )).build();
    }

    /**
     * POST /api/calendar/ai-expand
     * AI 扩写日记
     */
    @POST
    @Path("/ai-expand")
    public Response aiExpand(
        @HeaderParam("Authorization") String authHeader,
        Map<String, String> body
    ) {
        // 暂时返回模拟数据
        String content = body.get("content");
        return Response.ok(Map.of(
            "success", true,
            "data", Map.of("expandedContent", content != null ? "扩写后的内容：" + content : "")
        )).build();
    }

    private String extractUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        // 简单处理：从 token 映射中获取（实际应该验证 token）
        return "demo_user";
    }
}
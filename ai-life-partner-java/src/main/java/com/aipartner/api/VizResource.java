package com.aipartner.api;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.*;

/**
 * 数据可视化 API
 */
@Path("/api/viz")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class VizResource {

    /**
     * GET /api/viz/dashboard
     * 综合统计数据
     */
    @GET
    @Path("/dashboard")
    public Response getDashboard(@HeaderParam("Authorization") String authHeader) {
        Map<String, Object> data = new HashMap<>();
        data.put("totalDecisions", 0);
        data.put("totalGoals", 0);
        data.put("totalMemories", 0);
        data.put("streak", 0);

        Map<String, Object> abilities = new HashMap<>();
        abilities.put("radar", Map.of(
            "labels", Arrays.asList("学习", "健康", "工作", "社交", "财务"),
            "values", Arrays.asList(65, 80, 70, 60, 75)
        ));
        data.put("abilities", abilities);

        return Response.ok(Map.of("success", true, "data", data)).build();
    }

    /**
     * GET /api/viz/ability-trend
     * 能力趋势
     */
    @GET
    @Path("/ability-trend")
    public Response getAbilityTrend(
        @HeaderParam("Authorization") String authHeader,
        @QueryParam("days") int days
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("dates", Arrays.asList("2026-04-01", "2026-04-08", "2026-04-15", "2026-04-22"));
        data.put("scores", Arrays.asList(65, 68, 72, 70));

        return Response.ok(Map.of("success", true, "data", data)).build();
    }

    /**
     * GET /api/viz/decision-stats
     * 决策统计
     */
    @GET
    @Path("/decision-stats")
    public Response getDecisionStats(@HeaderParam("Authorization") String authHeader) {
        Map<String, Object> data = new HashMap<>();
        data.put("total", 0);
        data.put("pending", 0);
        data.put("completed", 0);
        data.put("categories", Map.of());

        return Response.ok(Map.of("success", true, "data", data)).build();
    }

    /**
     * GET /api/viz/task-completion-trend
     * 任务完成趋势
     */
    @GET
    @Path("/task-completion-trend")
    public Response getTaskCompletionTrend(
        @HeaderParam("Authorization") String authHeader,
        @QueryParam("days") int days
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("dates", Arrays.asList("2026-04-01", "2026-04-08", "2026-04-15", "2026-04-22"));
        data.put("completed", Arrays.asList(5, 8, 6, 10));
        data.put("total", Arrays.asList(8, 10, 12, 15));

        return Response.ok(Map.of("success", true, "data", data)).build();
    }

    /**
     * GET /api/viz/topic-analysis
     * 话题分析
     */
    @GET
    @Path("/topic-analysis")
    public Response getTopicAnalysis(
        @HeaderParam("Authorization") String authHeader,
        @QueryParam("days") int days
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("topics", Arrays.asList(
            Map.of("name", "学习", "count", 10),
            Map.of("name", "健康", "count", 8),
            Map.of("name", "工作", "count", 15)
        ));

        return Response.ok(Map.of("success", true, "data", data)).build();
    }

    /**
     * GET /api/viz/weekly-report
     * 周报
     */
    @GET
    @Path("/weekly-report")
    public Response getWeeklyReport(@HeaderParam("Authorization") String authHeader) {
        Map<String, Object> data = new HashMap<>();
        data.put("week", "2026-W17");
        data.put("summary", "本周暂无数据");

        return Response.ok(Map.of("success", true, "data", data)).build();
    }

    /**
     * GET /api/viz/monthly-report
     * 月报
     */
    @GET
    @Path("/monthly-report")
    public Response getMonthlyReport(@HeaderParam("Authorization") String authHeader) {
        Map<String, Object> data = new HashMap<>();
        data.put("month", "2026-04");
        data.put("summary", "本月暂无数据");

        return Response.ok(Map.of("success", true, "data", data)).build();
    }

    /**
     * GET /api/viz/goal-progress
     * 目标进度
     */
    @GET
    @Path("/goal-progress")
    public Response getGoalProgress(@HeaderParam("Authorization") String authHeader) {
        List<Map<String, Object>> goals = new ArrayList<>();

        return Response.ok(Map.of("success", true, "data", Map.of("goals", goals))).build();
    }
}
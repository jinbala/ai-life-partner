package com.aipartner.api;

import com.aipartner.service.ai.AiService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.Map;

/**
 * 健康检查接口
 */
@Path("/health")
@Produces(MediaType.APPLICATION_JSON)
public class HealthResource {

    @GET
    public Response health() {
        return Response.ok(Map.of(
            "status", "UP",
            "service", "AI Life Partner",
            "timestamp", System.currentTimeMillis()
        )).build();
    }
}
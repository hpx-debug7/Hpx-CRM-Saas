import { NextRequest, NextResponse } from "next/server";
import { secureHandlerTyped } from "@/lib/server/secureHandler";
import { scopedPrisma } from "@/lib/server/db";
import { formatTimeline, TimelineLog } from "@/lib/timeline";
import { ApiError } from "@/lib/errors";

const VALID_ENTITY_TYPES = new Set([
  "Lead",
  "User",
  "Project",
  "Company",
  "Invoice",
  "Task",
  "Contact",
  "Meeting",
  "Deal",
  "Pipeline"
]);

// ─────────────────────────────────────────────
// TIMELINE PAGINATION NOTE
// Cursor pagination depends on:
// - current filters (entityType, entityId)
// - current dataset state (new inserts / deletes)
//
// Behavior:
// - Changing filters invalidates existing cursor
// - Concurrent writes may shift timeline ordering
// - Invalid cursor returns 400 (intentional)
//
// Frontend must:
// - Reset cursor when filters change
// - Reset and refetch on INVALID_CURSOR error
// ─────────────────────────────────────────────

export const GET = secureHandlerTyped(
  async (req: NextRequest, { companyId }) => {
    try {
      const { searchParams } = new URL(req.url);
      
      // Extract filters
      const entityType = searchParams.get("entityType");
      const entityId = searchParams.get("entityId");
      
      // Extract pagination params
      const cursor = searchParams.get("cursor");
      const limitParam = searchParams.get("limit");

      // 1. EMPTY STRING VALIDATION
      if (entityType !== null && entityType.trim() === "") {
        throw new ApiError("entityType cannot be empty", 400, "INVALID_INPUT");
      }
      if (entityId !== null && entityId.trim() === "") {
        throw new ApiError("entityId cannot be empty", 400, "INVALID_INPUT");
      }

      if (entityType && !VALID_ENTITY_TYPES.has(entityType)) {
        throw new ApiError("Invalid entityType parameter", 400, "INVALID_ENTITY_TYPE");
      }

      // Safe Limit Parameter Handling (Default 20, Max 50)
      let limit = limitParam ? parseInt(limitParam, 10) : 20;
      if (isNaN(limit) || limit < 1) limit = 20;
      if (limit > 50) limit = 50;

      // Initialize Prisma locally for the tenant
      const db = scopedPrisma(companyId);

      // Base context
      const where: any = { companyId };

      if (entityType) {
        where.entityType = entityType;
      }
      if (entityId) {
        where.entityId = entityId;
      }

      // Prepare query
      const queryArgs: any = {
        where,
        // 2. STABLE PAGINATION ORDER
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" }
        ],
        // 3. HASMORE CORRECTION: Fetch limit + 1 records to test if more exist
        take: limit + 1,
        select: {
          id: true,
          actionType: true,
          entityType: true,
          entityId: true,
          description: true,
          performedByName: true,
          createdAt: true,
        },
      };

      // Apply cursor if it exists
      if (cursor) {
        queryArgs.cursor = { id: cursor };
        queryArgs.skip = 1; // Skip the item matching the cursor id itself
      }

      // Execute exactly typed payload
      let rawLogs: TimelineLog[] = await db.auditLog.findMany(queryArgs);

      let nextCursor: string | null = null;
      let hasMore = false;
      
      // 4. HASMORE DECISION AND SLICE
      if (rawLogs.length > limit) {
        hasMore = true;
        rawLogs = rawLogs.slice(0, limit); // Remove the +1 peek item
        
        if (rawLogs.length > 0) {
          nextCursor = rawLogs[rawLogs.length - 1].id;
        }
      }

      // Format strictly
      const events = formatTimeline(rawLogs);

      // Stable Response Contract
      return NextResponse.json({
        events,
        pagination: {
          nextCursor,
          hasMore
        }
      });
      
    } catch (error: any) {
      console.error("[Timeline API Error]:", error);
      
      // 5. INVALID CURSOR HANDLING (Prisma Exception Trap)
      if (error?.code === "P2025") {
        throw new ApiError("Invalid cursor", 400, "INVALID_CURSOR");
      }

      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(
        "Failed to fetch timeline events",
        500,
        "TIMELINE_FETCH_ERROR"
      );
    }
  },
  {
    allowWithoutPermission: true,
  }
);

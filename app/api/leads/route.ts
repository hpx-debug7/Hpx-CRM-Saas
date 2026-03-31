import { NextRequest, NextResponse } from "next/server";
import { secureHandlerTyped } from "@/lib/server/secureHandler";
import { scopedPrisma } from "@/lib/server/db";
import { ApiError } from "@/lib/errors";
import { logAuditEvent } from "@/src/lib/auditLogger";
import { createLeadSchema, queryLeadSchema } from "@/lib/validations/lead";
import { sanitizeCreateLeadInput } from "@/lib/server/sanitize/lead";
import { buildLeadAuditPayload } from "@/lib/server/audit/auditPayload";
import { Prisma } from "@prisma/client";

export const POST = secureHandlerTyped(
  async (req: NextRequest, { companyId, userId }) => {
    try {
      const body = await req.json();

      const validationResult = createLeadSchema.safeParse(body);
      if (!validationResult.success) {
        throw new ApiError(
          "Invalid input data",
          400,
          "VALIDATION_ERROR",
          { errors: validationResult.error.errors }
        );
      }

      const input = validationResult.data;
      const db = scopedPrisma(companyId);

      const safeData = sanitizeCreateLeadInput(input);

      const lead = await db.lead.create({
        data: {
          ...safeData,
          companyId,
          createdById: userId,
        },
      });

      await logAuditEvent({
        companyId,
        performedById: userId,
        actionType: "LEAD_CREATED",
        entityType: "Lead",
        entityId: lead.id,
        description: `Lead created: ${lead.title}`,
        afterValue: buildLeadAuditPayload(lead),
      });

      return NextResponse.json({ data: lead }, { status: 201 });
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError("Failed to create lead", 500, "CREATE_LEAD_ERROR");
    }
  },
  { requiredPermission: "lead:create" as any }
);

export const GET = secureHandlerTyped(
  async (req: NextRequest, { companyId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const queryParams = Object.fromEntries(searchParams.entries());

      const validationResult = queryLeadSchema.safeParse(queryParams);
      if (!validationResult.success) {
        throw new ApiError(
          "Invalid query parameters",
          400,
          "VALIDATION_ERROR",
          { errors: validationResult.error.errors }
        );
      }

      const { cursor, limit, status, assignedToId } = validationResult.data;
      const db = scopedPrisma(companyId);

      const where: Prisma.LeadWhereInput = { companyId, isDeleted: false };
      if (status) {
        where.status = status;
      }
      if (assignedToId) {
        where.assignedToId = assignedToId;
      }

      const queryArgs: Prisma.LeadFindManyArgs = {
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
      };

      if (cursor) {
        queryArgs.cursor = { id: cursor };
        queryArgs.skip = 1; // Skip the cursor itself
      }

      let rawLeads = await db.lead.findMany(queryArgs);

      let nextCursor: string | null = null;
      if (rawLeads.length > limit) {
        rawLeads = rawLeads.slice(0, limit);
        if (rawLeads.length > 0) {
          nextCursor = rawLeads[rawLeads.length - 1].id;
        }
      }

      return NextResponse.json({
        data: rawLeads,
        nextCursor,
      });
    } catch (error: any) {
      if (error?.code === "P2025") {
        throw new ApiError("Invalid cursor", 400, "INVALID_CURSOR");
      }

      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError("Failed to fetch leads", 500, "FETCH_LEADS_ERROR");
    }
  },
  { requiredPermission: "lead:read" as any }
);

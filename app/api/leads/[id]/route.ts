import { NextRequest, NextResponse } from "next/server";
import { secureHandlerTyped } from "@/lib/server/secureHandler";
import { scopedPrisma } from "@/lib/server/db";
import { ApiError } from "@/lib/errors";
import { logAuditEvent } from "@/src/lib/auditLogger";
import { updateLeadSchema } from "@/lib/validations/lead";
import { sanitizeUpdateLeadInput } from "@/lib/server/sanitize/lead";
import { buildLeadAuditPayload } from "@/lib/server/audit/auditPayload";

export const GET = secureHandlerTyped(
  async (req: NextRequest, { companyId, params }) => {
    try {
      const db = scopedPrisma(companyId);
      const id = params.id;

      const lead = await db.lead.findFirst({
        where: {
          id,
          companyId,
          isDeleted: false,
        },
      });

      if (!lead) {
        throw new ApiError("Lead not found", 404, "NOT_FOUND");
      }

      return NextResponse.json({ data: lead });
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError("Failed to fetch lead", 500, "FETCH_LEAD_ERROR");
    }
  },
  { requiredPermission: "lead:read" as any }
);

export const PATCH = secureHandlerTyped(
  async (req: NextRequest, { companyId, userId, params }) => {
    try {
      const db = scopedPrisma(companyId);
      const id = params.id;

      const lead = await db.lead.findFirst({
        where: { id, companyId, isDeleted: false },
      });

      if (!lead) {
        throw new ApiError("Lead not found", 404, "NOT_FOUND");
      }

      const body = await req.json();
      const validationResult = updateLeadSchema.safeParse(body);
      
      if (!validationResult.success) {
        throw new ApiError(
          "Invalid input data",
          400,
          "VALIDATION_ERROR",
          { errors: validationResult.error.errors }
        );
      }

      const input = validationResult.data;
      
      const updateData = sanitizeUpdateLeadInput(input, lead);

      const updatedLead = await db.lead.update({
        where: { id },
        data: updateData,
      });

      await logAuditEvent({
        companyId,
        performedById: userId,
        actionType: "LEAD_UPDATED",
        entityType: "Lead",
        entityId: updatedLead.id,
        description: `Lead updated: ${updatedLead.title}`,
        beforeValue: buildLeadAuditPayload(lead),
        afterValue: buildLeadAuditPayload(updatedLead),
      });

      return NextResponse.json({ data: updatedLead });
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError("Failed to update lead", 500, "UPDATE_LEAD_ERROR");
    }
  },
  { requiredPermission: "lead:update" as any }
);

export const DELETE = secureHandlerTyped(
  async (req: NextRequest, { companyId, userId, params }) => {
    try {
      const db = scopedPrisma(companyId);
      const id = params.id;

      const lead = await db.lead.findFirst({
        where: { id, companyId, isDeleted: false },
      });

      if (!lead) {
        throw new ApiError("Lead not found", 404, "NOT_FOUND");
      }

      const deletedLead = await db.lead.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      await logAuditEvent({
        companyId,
        performedById: userId,
        actionType: "LEAD_DELETED",
        entityType: "Lead",
        entityId: deletedLead.id,
        description: `Lead deleted: ${deletedLead.title}`,
        beforeValue: buildLeadAuditPayload(lead),
        afterValue: buildLeadAuditPayload(deletedLead),
      });

      return new Response(null, { status: 204 });
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError("Failed to delete lead", 500, "DELETE_LEAD_ERROR");
    }
  },
  { requiredPermission: "lead:delete" as any }
);

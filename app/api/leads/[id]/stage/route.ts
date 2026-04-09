import { NextRequest, NextResponse } from "next/server";
import { secureHandlerTyped } from "@/lib/server/secureHandler";
import { scopedPrisma } from "@/lib/server/db";
import { ApiError } from "@/lib/errors";
import { logAuditEvent } from "@/src/lib/auditLogger";
import { z } from "zod";

/**
 * PATCH /api/leads/[id]/stage
 *
 * Updates the pipeline stage of a lead.
 *
 * Security:
 *  - Uses secureHandler → session-derived companyId (never trust body)
 *  - Validates that both the lead and the stage belong to the same company
 *  - Logs a LEAD_STAGE_CHANGED audit event
 */

const updateStageSchema = z.object({
  stageId: z.string().min(1, "stageId is required"),
});

export const PATCH = secureHandlerTyped(
  async (req: NextRequest, { companyId, userId, params }) => {
    try {
      const db = scopedPrisma(companyId);
      const leadId = (await params).id;

      // ── 1. Parse + validate input ───────────────────────────────────────
      const body = await req.json();
      const parsed = updateStageSchema.safeParse(body);

      if (!parsed.success) {
        throw new ApiError(
          "Invalid input: stageId is required",
          400,
          "VALIDATION_ERROR",
          { errors: parsed.error.errors }
        );
      }

      const { stageId } = parsed.data;

      // ── 2. Fetch lead scoped by companyId ───────────────────────────────
      const lead = await db.lead.findFirst({
        where: { id: leadId, companyId },
      });

      if (!lead) {
        throw new ApiError("Lead not found", 404, "NOT_FOUND");
      }

      // ── 3. Fetch stage scoped by companyId ──────────────────────────────
      const stage = await db.pipelineStage.findFirst({
        where: { id: stageId, companyId },
      });

      if (!stage) {
        throw new ApiError("Pipeline stage not found", 404, "STAGE_NOT_FOUND");
      }

      // ── 4. Extra safety: verify both belong to same company ─────────────
      if (lead.companyId !== stage.companyId) {
        throw new ApiError("Forbidden", 403, "CROSS_TENANT_VIOLATION");
      }

      // ── 5. Update the lead's stageId ────────────────────────────────────
      const previousStageId = lead.stageId;

      const updatedLead = await db.lead.update({
        where: { id: leadId },
        data: { stageId },
      });

      // ── 6. Log audit event ──────────────────────────────────────────────
      await logAuditEvent({
        companyId,
        performedById: userId,
        actionType: "LEAD_STAGE_CHANGED",
        entityType: "Lead",
        entityId: leadId,
        description: `Lead stage changed to "${stage.name}"`,
        beforeValue: { stageId: previousStageId },
        afterValue: { stageId: stage.id, stageName: stage.name },
      });

      // ── 7. Return updated lead ──────────────────────────────────────────
      return NextResponse.json({ data: updatedLead });
    } catch (error: any) {
      if (error instanceof ApiError || (error && typeof error === 'object' && 'statusCode' in error)) {
        return NextResponse.json(
          { error: error.message, code: error.code || 'API_ERROR' },
          { status: error.statusCode }
        );
      }
      return NextResponse.json(
        { error: "Failed to update lead stage", code: "UPDATE_STAGE_ERROR" },
        { status: 500 }
      );
    }
  },
  { requiredPermission: "lead:update" as any }
);

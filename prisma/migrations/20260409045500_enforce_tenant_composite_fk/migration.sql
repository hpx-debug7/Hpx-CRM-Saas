-- ============================================================================
-- Enforce tenant isolation at the database level via composite foreign key.
-- After this migration, Lead.stageId can ONLY reference a PipelineStage
-- that belongs to the SAME company. Cross-tenant linkage becomes impossible.
-- ============================================================================

-- Step 1: Drop the old single-column FK (stageId → pipeline_stages.id)
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_stageId_fkey";

-- Step 2: Add composite unique index on pipeline_stages(id, companyId)
-- This is safe because `id` is already a PK (unique), so (id, companyId)
-- can never have duplicates.
CREATE UNIQUE INDEX "pipeline_stages_id_companyId_key" ON "pipeline_stages"("id", "companyId");

-- Step 3: Add the composite FK — now the DB enforces that leads.companyId
-- must match pipeline_stages.companyId for any stageId reference.
-- ON DELETE SET NULL: if a stage is deleted, leads keep their companyId but
-- stageId becomes NULL (safe — no orphan data).
ALTER TABLE "leads" ADD CONSTRAINT "leads_stageId_companyId_fkey"
  FOREIGN KEY ("stageId", "companyId")
  REFERENCES "pipeline_stages"("id", "companyId")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

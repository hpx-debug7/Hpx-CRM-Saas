-- Fix composite FK cascade behavior.
-- ON DELETE SET NULL nullifies ALL composite columns (including companyId),
-- which violates the NOT NULL constraint on leads.companyId.
-- Change to ON DELETE RESTRICT to prevent stage deletion while leads reference it.

ALTER TABLE "leads" DROP CONSTRAINT "leads_stageId_companyId_fkey";

ALTER TABLE "leads"
ADD CONSTRAINT "leads_stageId_companyId_fkey"
FOREIGN KEY ("stageId", "companyId")
REFERENCES "pipeline_stages"("id", "companyId")
ON DELETE RESTRICT
ON UPDATE CASCADE;

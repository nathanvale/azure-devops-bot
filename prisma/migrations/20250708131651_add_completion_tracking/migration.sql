-- AlterTable
ALTER TABLE "work_items" ADD COLUMN "closedBy" TEXT;
ALTER TABLE "work_items" ADD COLUMN "resolvedBy" TEXT;
ALTER TABLE "work_items" ADD COLUMN "resolvedDate" DATETIME;

-- CreateIndex
CREATE INDEX "work_items_closedBy_idx" ON "work_items"("closedBy");

-- CreateIndex
CREATE INDEX "work_items_resolvedBy_idx" ON "work_items"("resolvedBy");

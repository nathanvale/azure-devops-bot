/*
  Warnings:

  - You are about to drop the column `areaId` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `commentCount` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `hasAttachments` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `nodeId` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `stackRank` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `teamProject` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `valueArea` on the `work_items` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_work_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "assignedTo" TEXT NOT NULL,
    "azureUrl" TEXT NOT NULL,
    "description" TEXT,
    "iterationPath" TEXT,
    "areaPath" TEXT,
    "boardColumn" TEXT,
    "boardColumnDone" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER,
    "severity" TEXT,
    "tags" TEXT,
    "createdDate" DATETIME,
    "changedDate" DATETIME,
    "closedDate" DATETIME,
    "resolvedDate" DATETIME,
    "activatedDate" DATETIME,
    "stateChangeDate" DATETIME,
    "createdBy" TEXT,
    "changedBy" TEXT,
    "closedBy" TEXT,
    "resolvedBy" TEXT,
    "storyPoints" REAL,
    "effort" REAL,
    "remainingWork" REAL,
    "completedWork" REAL,
    "originalEstimate" REAL,
    "acceptanceCriteria" TEXT,
    "reproSteps" TEXT,
    "systemInfo" TEXT,
    "parentId" INTEGER,
    "rev" INTEGER,
    "reason" TEXT,
    "watermark" INTEGER,
    "rawJson" TEXT NOT NULL,
    "lastUpdatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_work_items" ("acceptanceCriteria", "activatedDate", "areaPath", "assignedTo", "azureUrl", "boardColumn", "boardColumnDone", "changedBy", "changedDate", "closedBy", "closedDate", "completedWork", "createdBy", "createdDate", "description", "effort", "id", "iterationPath", "lastSyncedAt", "lastUpdatedAt", "originalEstimate", "parentId", "priority", "rawJson", "reason", "remainingWork", "reproSteps", "resolvedBy", "resolvedDate", "rev", "severity", "state", "stateChangeDate", "storyPoints", "systemInfo", "tags", "title", "type", "watermark") SELECT "acceptanceCriteria", "activatedDate", "areaPath", "assignedTo", "azureUrl", "boardColumn", "boardColumnDone", "changedBy", "changedDate", "closedBy", "closedDate", "completedWork", "createdBy", "createdDate", "description", "effort", "id", "iterationPath", "lastSyncedAt", "lastUpdatedAt", "originalEstimate", "parentId", "priority", "rawJson", "reason", "remainingWork", "reproSteps", "resolvedBy", "resolvedDate", "rev", "severity", "state", "stateChangeDate", "storyPoints", "systemInfo", "tags", "title", "type", "watermark" FROM "work_items";
DROP TABLE "work_items";
ALTER TABLE "new_work_items" RENAME TO "work_items";
CREATE INDEX "work_items_type_idx" ON "work_items"("type");
CREATE INDEX "work_items_state_idx" ON "work_items"("state");
CREATE INDEX "work_items_assignedTo_idx" ON "work_items"("assignedTo");
CREATE INDEX "work_items_iterationPath_idx" ON "work_items"("iterationPath");
CREATE INDEX "work_items_changedDate_idx" ON "work_items"("changedDate");
CREATE INDEX "work_items_createdDate_idx" ON "work_items"("createdDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

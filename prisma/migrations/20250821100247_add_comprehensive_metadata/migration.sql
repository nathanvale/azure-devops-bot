/*
  Warnings:

  - You are about to drop the column `isHistoricalImport` on the `work_items` table. All the data in the column will be lost.
  - Added the required column `rawJson` to the `work_items` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "work_item_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workItemId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdDate" DATETIME NOT NULL,
    "modifiedBy" TEXT,
    "modifiedDate" DATETIME,
    CONSTRAINT "work_item_comments_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "work_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "rawJson" TEXT NOT NULL,
    "lastUpdatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_work_items" ("assignedTo", "azureUrl", "closedBy", "closedDate", "createdDate", "description", "id", "lastSyncedAt", "lastUpdatedAt", "resolvedBy", "resolvedDate", "state", "title", "type") SELECT "assignedTo", "azureUrl", "closedBy", "closedDate", "createdDate", "description", "id", "lastSyncedAt", "lastUpdatedAt", "resolvedBy", "resolvedDate", "state", "title", "type" FROM "work_items";
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

-- CreateIndex
CREATE INDEX "work_item_comments_workItemId_idx" ON "work_item_comments"("workItemId");

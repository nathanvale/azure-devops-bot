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
    "url" TEXT,
    "commentCount" INTEGER DEFAULT 0,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "teamProject" TEXT,
    "areaId" INTEGER,
    "nodeId" INTEGER,
    "stackRank" REAL,
    "valueArea" TEXT,
    "rawJson" TEXT NOT NULL,
    "lastUpdatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_work_items" ("acceptanceCriteria", "activatedDate", "areaPath", "assignedTo", "azureUrl", "boardColumn", "boardColumnDone", "changedBy", "changedDate", "closedBy", "closedDate", "completedWork", "createdBy", "createdDate", "description", "effort", "id", "iterationPath", "lastSyncedAt", "lastUpdatedAt", "originalEstimate", "parentId", "priority", "rawJson", "remainingWork", "reproSteps", "resolvedBy", "resolvedDate", "severity", "state", "stateChangeDate", "storyPoints", "systemInfo", "tags", "title", "type") SELECT "acceptanceCriteria", "activatedDate", "areaPath", "assignedTo", "azureUrl", "boardColumn", "boardColumnDone", "changedBy", "changedDate", "closedBy", "closedDate", "completedWork", "createdBy", "createdDate", "description", "effort", "id", "iterationPath", "lastSyncedAt", "lastUpdatedAt", "originalEstimate", "parentId", "priority", "rawJson", "remainingWork", "reproSteps", "resolvedBy", "resolvedDate", "severity", "state", "stateChangeDate", "storyPoints", "systemInfo", "tags", "title", "type" FROM "work_items";
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

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
    "createdDate" DATETIME,
    "closedDate" DATETIME,
    "lastUpdatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isHistoricalImport" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_work_items" ("assignedTo", "azureUrl", "id", "lastSyncedAt", "lastUpdatedAt", "state", "title", "type") SELECT "assignedTo", "azureUrl", "id", "lastSyncedAt", "lastUpdatedAt", "state", "title", "type" FROM "work_items";
DROP TABLE "work_items";
ALTER TABLE "new_work_items" RENAME TO "work_items";
CREATE INDEX "work_items_type_idx" ON "work_items"("type");
CREATE INDEX "work_items_state_idx" ON "work_items"("state");
CREATE INDEX "work_items_assignedTo_idx" ON "work_items"("assignedTo");
CREATE INDEX "work_items_createdDate_idx" ON "work_items"("createdDate");
CREATE INDEX "work_items_isHistoricalImport_idx" ON "work_items"("isHistoricalImport");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

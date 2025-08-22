/*
  Warnings:

  - The primary key for the `work_item_comments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdBy` on the `work_item_comments` table. All the data in the column will be lost.
  - You are about to drop the column `createdDate` on the `work_item_comments` table. All the data in the column will be lost.
  - You are about to drop the column `modifiedBy` on the `work_item_comments` table. All the data in the column will be lost.
  - You are about to drop the column `modifiedDate` on the `work_item_comments` table. All the data in the column will be lost.
  - You are about to drop the column `workItemId` on the `work_item_comments` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `work_item_comments` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to drop the column `acceptanceCriteria` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `activatedDate` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `areaPath` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `assignedTo` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `azureUrl` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `boardColumn` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `boardColumnDone` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `changedBy` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `changedDate` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `closedBy` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `closedDate` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `completedWork` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `createdDate` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `iterationPath` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `lastSyncedAt` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `lastUpdatedAt` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `originalEstimate` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `rawJson` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `remainingWork` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `reproSteps` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `resolvedBy` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `resolvedDate` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `stateChangeDate` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `storyPoints` on the `work_items` table. All the data in the column will be lost.
  - You are about to drop the column `systemInfo` on the `work_items` table. All the data in the column will be lost.
  - Added the required column `created_by` to the `work_item_comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `created_date` to the `work_item_comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `work_item_id` to the `work_item_comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `assigned_to` to the `work_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `azure_url` to the `work_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_updated_at` to the `work_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `raw_json` to the `work_items` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_work_item_comments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "work_item_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL,
    "modified_by" TEXT,
    "modified_date" DATETIME,
    CONSTRAINT "work_item_comments_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_work_item_comments" ("id", "text") SELECT "id", "text" FROM "work_item_comments";
DROP TABLE "work_item_comments";
ALTER TABLE "new_work_item_comments" RENAME TO "work_item_comments";
CREATE INDEX "work_item_comments_work_item_id_idx" ON "work_item_comments"("work_item_id");
CREATE TABLE "new_work_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "assigned_to" TEXT NOT NULL,
    "azure_url" TEXT NOT NULL,
    "description" TEXT,
    "iteration_path" TEXT,
    "area_path" TEXT,
    "board_column" TEXT,
    "board_column_done" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER,
    "severity" TEXT,
    "tags" TEXT,
    "created_date" DATETIME,
    "changed_date" DATETIME,
    "closed_date" DATETIME,
    "resolved_date" DATETIME,
    "activated_date" DATETIME,
    "state_change_date" DATETIME,
    "created_by" TEXT,
    "changed_by" TEXT,
    "closed_by" TEXT,
    "resolved_by" TEXT,
    "story_points" REAL,
    "effort" REAL,
    "remaining_work" REAL,
    "completed_work" REAL,
    "original_estimate" REAL,
    "acceptance_criteria" TEXT,
    "repro_steps" TEXT,
    "system_info" TEXT,
    "parent_id" INTEGER,
    "rev" INTEGER,
    "reason" TEXT,
    "watermark" INTEGER,
    "url" TEXT,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "team_project" TEXT,
    "area_id" INTEGER,
    "node_id" INTEGER,
    "stack_rank" REAL,
    "value_area" TEXT,
    "raw_json" TEXT NOT NULL,
    "last_updated_at" DATETIME NOT NULL,
    "last_synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_work_items" ("description", "effort", "id", "priority", "reason", "rev", "severity", "state", "tags", "title", "type", "watermark") SELECT "description", "effort", "id", "priority", "reason", "rev", "severity", "state", "tags", "title", "type", "watermark" FROM "work_items";
DROP TABLE "work_items";
ALTER TABLE "new_work_items" RENAME TO "work_items";
CREATE INDEX "work_items_type_idx" ON "work_items"("type");
CREATE INDEX "work_items_state_idx" ON "work_items"("state");
CREATE INDEX "work_items_assigned_to_idx" ON "work_items"("assigned_to");
CREATE INDEX "work_items_iteration_path_idx" ON "work_items"("iteration_path");
CREATE INDEX "work_items_changed_date_idx" ON "work_items"("changed_date");
CREATE INDEX "work_items_created_date_idx" ON "work_items"("created_date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

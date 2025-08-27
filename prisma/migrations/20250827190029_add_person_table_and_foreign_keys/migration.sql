-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "uniqueName" TEXT NOT NULL,
    "url" TEXT,
    "imageUrl" TEXT,
    "descriptor" TEXT,
    "inactive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_work_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "assigned_to" TEXT NOT NULL,
    "azure_url" TEXT NOT NULL,
    "description" TEXT,
    "assigned_to_id" TEXT,
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
    "created_by_id" TEXT,
    "changed_by_id" TEXT,
    "closed_by_id" TEXT,
    "resolved_by_id" TEXT,
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
    "board_lane" TEXT,
    "activated_by" TEXT,
    "authorized_as" TEXT,
    "authorized_date" DATETIME,
    "activated_by_id" TEXT,
    "authorized_as_id" TEXT,
    "revised_date" DATETIME,
    "resolution" TEXT,
    "risk" TEXT,
    "business_value" REAL,
    "time_criticality" REAL,
    "custom_fields" TEXT,
    "raw_json" TEXT NOT NULL,
    "last_updated_at" DATETIME NOT NULL,
    "last_synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_items_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "persons" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "persons" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_items_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "persons" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_items_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "persons" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_items_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "persons" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_items_activated_by_id_fkey" FOREIGN KEY ("activated_by_id") REFERENCES "persons" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_items_authorized_as_id_fkey" FOREIGN KEY ("authorized_as_id") REFERENCES "persons" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_work_items" ("acceptance_criteria", "activated_by", "activated_date", "area_id", "area_path", "assigned_to", "authorized_as", "authorized_date", "azure_url", "board_column", "board_column_done", "board_lane", "business_value", "changed_by", "changed_date", "closed_by", "closed_date", "comment_count", "completed_work", "created_by", "created_date", "custom_fields", "description", "effort", "has_attachments", "id", "iteration_path", "last_synced_at", "last_updated_at", "node_id", "original_estimate", "parent_id", "priority", "raw_json", "reason", "remaining_work", "repro_steps", "resolution", "resolved_by", "resolved_date", "rev", "revised_date", "risk", "severity", "stack_rank", "state", "state_change_date", "story_points", "system_info", "tags", "team_project", "time_criticality", "title", "type", "url", "value_area", "watermark") SELECT "acceptance_criteria", "activated_by", "activated_date", "area_id", "area_path", "assigned_to", "authorized_as", "authorized_date", "azure_url", "board_column", "board_column_done", "board_lane", "business_value", "changed_by", "changed_date", "closed_by", "closed_date", "comment_count", "completed_work", "created_by", "created_date", "custom_fields", "description", "effort", "has_attachments", "id", "iteration_path", "last_synced_at", "last_updated_at", "node_id", "original_estimate", "parent_id", "priority", "raw_json", "reason", "remaining_work", "repro_steps", "resolution", "resolved_by", "resolved_date", "rev", "revised_date", "risk", "severity", "stack_rank", "state", "state_change_date", "story_points", "system_info", "tags", "team_project", "time_criticality", "title", "type", "url", "value_area", "watermark" FROM "work_items";
DROP TABLE "work_items";
ALTER TABLE "new_work_items" RENAME TO "work_items";
CREATE INDEX "work_items_type_idx" ON "work_items"("type");
CREATE INDEX "work_items_state_idx" ON "work_items"("state");
CREATE INDEX "work_items_assigned_to_idx" ON "work_items"("assigned_to");
CREATE INDEX "work_items_iteration_path_idx" ON "work_items"("iteration_path");
CREATE INDEX "work_items_changed_date_idx" ON "work_items"("changed_date");
CREATE INDEX "work_items_created_date_idx" ON "work_items"("created_date");
CREATE INDEX "work_items_assigned_to_state_idx" ON "work_items"("assigned_to", "state");
CREATE INDEX "work_items_iteration_path_state_idx" ON "work_items"("iteration_path", "state");
CREATE INDEX "work_items_area_path_idx" ON "work_items"("area_path");
CREATE INDEX "work_items_board_column_board_column_done_idx" ON "work_items"("board_column", "board_column_done");
CREATE INDEX "work_items_parent_id_idx" ON "work_items"("parent_id");
CREATE INDEX "work_items_type_state_idx" ON "work_items"("type", "state");
CREATE INDEX "work_items_priority_state_idx" ON "work_items"("priority", "state");
CREATE INDEX "work_items_assigned_to_id_idx" ON "work_items"("assigned_to_id");
CREATE INDEX "work_items_created_by_id_idx" ON "work_items"("created_by_id");
CREATE INDEX "work_items_changed_by_id_idx" ON "work_items"("changed_by_id");
CREATE INDEX "work_items_closed_by_id_idx" ON "work_items"("closed_by_id");
CREATE INDEX "work_items_resolved_by_id_idx" ON "work_items"("resolved_by_id");
CREATE INDEX "work_items_activated_by_id_idx" ON "work_items"("activated_by_id");
CREATE INDEX "work_items_authorized_as_id_idx" ON "work_items"("authorized_as_id");
CREATE INDEX "work_items_assigned_to_id_state_idx" ON "work_items"("assigned_to_id", "state");
CREATE INDEX "work_items_assigned_to_id_iteration_path_idx" ON "work_items"("assigned_to_id", "iteration_path");
CREATE INDEX "work_items_created_by_id_state_idx" ON "work_items"("created_by_id", "state");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "persons_uniqueName_key" ON "persons"("uniqueName");

-- CreateIndex
CREATE INDEX "persons_uniqueName_idx" ON "persons"("uniqueName");

-- CreateIndex
CREATE INDEX "persons_displayName_idx" ON "persons"("displayName");

-- CreateIndex
CREATE INDEX "persons_inactive_idx" ON "persons"("inactive");

-- CreateIndex
CREATE INDEX "persons_uniqueName_inactive_idx" ON "persons"("uniqueName", "inactive");

-- CreateIndex
CREATE INDEX "persons_displayName_inactive_idx" ON "persons"("displayName", "inactive");

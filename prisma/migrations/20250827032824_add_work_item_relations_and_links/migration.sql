-- AlterTable
ALTER TABLE "work_items" ADD COLUMN "activated_by" TEXT;
ALTER TABLE "work_items" ADD COLUMN "authorized_as" TEXT;
ALTER TABLE "work_items" ADD COLUMN "authorized_date" DATETIME;
ALTER TABLE "work_items" ADD COLUMN "board_lane" TEXT;
ALTER TABLE "work_items" ADD COLUMN "business_value" REAL;
ALTER TABLE "work_items" ADD COLUMN "custom_fields" TEXT;
ALTER TABLE "work_items" ADD COLUMN "resolution" TEXT;
ALTER TABLE "work_items" ADD COLUMN "revised_date" DATETIME;
ALTER TABLE "work_items" ADD COLUMN "risk" TEXT;
ALTER TABLE "work_items" ADD COLUMN "time_criticality" REAL;

-- CreateTable
CREATE TABLE "work_item_relations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "source_id" INTEGER NOT NULL,
    "target_id" INTEGER NOT NULL,
    "relationship_type" TEXT NOT NULL,
    "attributes" TEXT,
    CONSTRAINT "work_item_relations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "work_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "work_item_relations_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "work_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "work_item_links" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "work_item_id" INTEGER NOT NULL,
    "link_type" TEXT NOT NULL,
    "link_url" TEXT NOT NULL,
    "link_title" TEXT NOT NULL,
    "attributes" TEXT,
    CONSTRAINT "work_item_links_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "work_item_relations_source_id_idx" ON "work_item_relations"("source_id");

-- CreateIndex
CREATE INDEX "work_item_relations_target_id_idx" ON "work_item_relations"("target_id");

-- CreateIndex
CREATE INDEX "work_item_relations_relationship_type_idx" ON "work_item_relations"("relationship_type");

-- CreateIndex
CREATE INDEX "work_item_relations_source_id_relationship_type_idx" ON "work_item_relations"("source_id", "relationship_type");

-- CreateIndex
CREATE INDEX "work_item_relations_target_id_relationship_type_idx" ON "work_item_relations"("target_id", "relationship_type");

-- CreateIndex
CREATE INDEX "work_item_links_work_item_id_idx" ON "work_item_links"("work_item_id");

-- CreateIndex
CREATE INDEX "work_item_links_link_type_idx" ON "work_item_links"("link_type");

-- CreateIndex
CREATE INDEX "work_item_links_work_item_id_link_type_idx" ON "work_item_links"("work_item_id", "link_type");

-- CreateIndex
CREATE INDEX "work_items_assigned_to_state_idx" ON "work_items"("assigned_to", "state");

-- CreateIndex
CREATE INDEX "work_items_iteration_path_state_idx" ON "work_items"("iteration_path", "state");

-- CreateIndex
CREATE INDEX "work_items_area_path_idx" ON "work_items"("area_path");

-- CreateIndex
CREATE INDEX "work_items_board_column_board_column_done_idx" ON "work_items"("board_column", "board_column_done");

-- CreateIndex
CREATE INDEX "work_items_parent_id_idx" ON "work_items"("parent_id");

-- CreateIndex
CREATE INDEX "work_items_type_state_idx" ON "work_items"("type", "state");

-- CreateIndex
CREATE INDEX "work_items_priority_state_idx" ON "work_items"("priority", "state");

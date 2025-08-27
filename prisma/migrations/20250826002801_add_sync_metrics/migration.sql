-- CreateTable
CREATE TABLE "sync_metrics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sync_type" TEXT NOT NULL,
    "start_time" DATETIME NOT NULL,
    "end_time" DATETIME NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "total_attempted" INTEGER NOT NULL,
    "total_succeeded" INTEGER NOT NULL,
    "total_failed" INTEGER NOT NULL,
    "success_rate" REAL NOT NULL,
    "total_errors" INTEGER NOT NULL,
    "errors_by_type" TEXT NOT NULL,
    "avg_response_time" REAL,
    "rate_limit_hits" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "sync_metrics_sync_type_idx" ON "sync_metrics"("sync_type");

-- CreateIndex
CREATE INDEX "sync_metrics_start_time_idx" ON "sync_metrics"("start_time");

-- CreateIndex
CREATE INDEX "sync_metrics_success_rate_idx" ON "sync_metrics"("success_rate");

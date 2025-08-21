import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SyncService } from "../sync-service";
import { AzureAuth } from "../auth";
import { AzureDevOpsClient } from "../azure-devops";
import { DatabaseService } from "../database";

// Mock the dependencies
vi.mock("../auth");
vi.mock("../azure-devops");
vi.mock("../database");

describe("SyncService", () => {
  let service: SyncService;
  let mockAuth: AzureAuth;
  let mockClient: AzureDevOpsClient;
  let mockDb: DatabaseService;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create service instance
    service = new SyncService();

    // Get the mocked instances
    mockAuth = service["auth"] as any;
    mockClient = service["client"] as any;
    mockDb = service["db"] as any;

    // Setup default mock implementations
    mockAuth.ensureAuth = vi.fn().mockResolvedValue(undefined);
    mockClient.fetchWorkItems = vi.fn().mockResolvedValue([]);
    mockDb.syncWorkItems = vi.fn().mockResolvedValue(undefined);
    mockDb.getLastSyncTime = vi.fn().mockResolvedValue(null);
    mockDb.close = vi.fn().mockResolvedValue(undefined);

    // Mock console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Clear any intervals
    service.stopBackgroundSync();
  });

  describe("performSync", () => {
    it("should sync work items successfully", async () => {
      const mockWorkItems = [
        {
          id: 1234,
          title: "Test Item",
          state: "Active",
          type: "User Story",
          assignedTo: "nathan.vale@example.com",
          lastUpdatedAt: new Date(),
        },
      ];

      mockClient.fetchWorkItems.mockResolvedValue(mockWorkItems);

      await service.performSync();

      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1);
      expect(mockClient.fetchWorkItems).toHaveBeenCalledTimes(1);
      expect(mockDb.syncWorkItems).toHaveBeenCalledWith(mockWorkItems);
      expect(console.log).toHaveBeenCalledWith("✅ Synced 1 work items");
    });

    it("should handle authentication failure", async () => {
      mockAuth.ensureAuth.mockRejectedValue(new Error("Authentication failed"));

      await expect(service.performSync()).rejects.toThrow(
        "Authentication failed"
      );

      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1);
      expect(mockClient.fetchWorkItems).not.toHaveBeenCalled();
      expect(mockDb.syncWorkItems).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        "❌ Sync failed:",
        expect.any(Error)
      );
    });

    it("should handle work items fetch failure", async () => {
      mockClient.fetchWorkItems.mockRejectedValue(new Error("Fetch failed"));

      await expect(service.performSync()).rejects.toThrow("Fetch failed");

      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1);
      expect(mockClient.fetchWorkItems).toHaveBeenCalledTimes(1);
      expect(mockDb.syncWorkItems).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        "❌ Sync failed:",
        expect.any(Error)
      );
    });

    it("should handle database sync failure", async () => {
      const mockWorkItems = [
        {
          id: 1234,
          title: "Test Item",
          state: "Active",
          type: "User Story",
          assignedTo: "nathan.vale@example.com",
          lastUpdatedAt: new Date(),
        },
      ];

      mockClient.fetchWorkItems.mockResolvedValue(mockWorkItems);
      mockDb.syncWorkItems.mockRejectedValue(new Error("Database sync failed"));

      await expect(service.performSync()).rejects.toThrow(
        "Database sync failed"
      );

      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1);
      expect(mockClient.fetchWorkItems).toHaveBeenCalledTimes(1);
      expect(mockDb.syncWorkItems).toHaveBeenCalledWith(mockWorkItems);
      expect(console.error).toHaveBeenCalledWith(
        "❌ Sync failed:",
        expect.any(Error)
      );
    });

    it("should log correct number of synced items", async () => {
      const mockWorkItems = [
        {
          id: 1234,
          title: "Item 1",
          state: "Active",
          type: "User Story",
          assignedTo: "nathan.vale@example.com",
          lastUpdatedAt: new Date(),
        },
        {
          id: 5678,
          title: "Item 2",
          state: "Done",
          type: "Task",
          assignedTo: "nathan.vale@example.com",
          lastUpdatedAt: new Date(),
        },
      ];

      mockClient.fetchWorkItems.mockResolvedValue(mockWorkItems);

      await service.performSync();

      expect(console.log).toHaveBeenCalledWith("✅ Synced 2 work items");
    });

    it("should handle empty work items list", async () => {
      mockClient.fetchWorkItems.mockResolvedValue([]);

      await service.performSync();

      expect(mockDb.syncWorkItems).toHaveBeenCalledWith([]);
      expect(console.log).toHaveBeenCalledWith("✅ Synced 0 work items");
    });
  });

  describe("startBackgroundSync", () => {
    it("should start background sync with correct interval", async () => {
      const setIntervalSpy = vi.spyOn(global, "setInterval");

      await service.startBackgroundSync();

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        5 * 60 * 1000 // 5 minutes (default)
      );
      expect(console.log).toHaveBeenCalledWith(
        "🔄 Background sync started (every 5 minutes)"
      );
    });

    it("should use custom interval from environment variable", async () => {
      const originalEnv = process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES;
      process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES = "10";

      const setIntervalSpy = vi.spyOn(global, "setInterval");

      await service.startBackgroundSync();

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        10 * 60 * 1000 // 10 minutes
      );
      expect(console.log).toHaveBeenCalledWith(
        "🔄 Background sync started (every 10 minutes)"
      );

      // Restore original environment
      if (originalEnv) {
        process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES = originalEnv;
      } else {
        delete process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES;
      }
    });

    it("should handle invalid environment variable and use default", async () => {
      const originalEnv = process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES;
      process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES = "invalid";

      const setIntervalSpy = vi.spyOn(global, "setInterval");
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await service.startBackgroundSync();

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        5 * 60 * 1000 // 5 minutes (default fallback)
      );
      expect(console.log).toHaveBeenCalledWith(
        "🔄 Background sync started (every 5 minutes)"
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "⚠️  Invalid AZURE_DEVOPS_SYNC_INTERVAL_MINUTES value: invalid. Using default 5 minutes."
      );

      consoleWarnSpy.mockRestore();
      
      // Restore original environment
      if (originalEnv) {
        process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES = originalEnv;
      } else {
        delete process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES;
      }
    });

    it("should perform sync when interval triggers", async () => {
      vi.useFakeTimers();

      const performSyncSpy = vi
        .spyOn(service, "performSync")
        .mockResolvedValue();

      await service.startBackgroundSync();

      // Fast-forward time by 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(performSyncSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("should handle sync errors in background without throwing", async () => {
      vi.useFakeTimers();

      const performSyncSpy = vi
        .spyOn(service, "performSync")
        .mockRejectedValue(new Error("Background sync failed"));

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await service.startBackgroundSync();

      // Fast-forward time by 5 minutes to trigger the interval
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(performSyncSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Background sync failed:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
      vi.useRealTimers();
    });

    it("should continue background sync after errors", async () => {
      vi.useFakeTimers();

      const performSyncSpy = vi
        .spyOn(service, "performSync")
        .mockRejectedValueOnce(new Error("First sync failed"))
        .mockResolvedValueOnce();

      await service.startBackgroundSync();

      // First interval - should fail
      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(performSyncSpy).toHaveBeenCalledTimes(1);

      // Second interval - should succeed
      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(performSyncSpy).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe("stopBackgroundSync", () => {
    it("should stop background sync when running", async () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      await service.startBackgroundSync();
      service.stopBackgroundSync();

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith("⏹️  Background sync stopped");
    });

    it("should handle stopping when not running", () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      service.stopBackgroundSync();

      expect(clearIntervalSpy).not.toHaveBeenCalled();
    });

    it("should clear the interval reference", async () => {
      await service.startBackgroundSync();
      expect(service["syncInterval"]).not.toBeNull();

      service.stopBackgroundSync();
      expect(service["syncInterval"]).toBeNull();
    });
  });

  describe("shouldSync", () => {
    it("should return true when no previous sync exists", async () => {
      mockDb.getLastSyncTime.mockResolvedValue(null);

      const result = await service.shouldSync();

      expect(result).toBe(true);
      expect(mockDb.getLastSyncTime).toHaveBeenCalledTimes(1);
    });

    it("should return true when last sync was more than 5 minutes ago", async () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      mockDb.getLastSyncTime.mockResolvedValue(sixMinutesAgo);

      const result = await service.shouldSync();

      expect(result).toBe(true);
    });

    it("should return false when last sync was less than 5 minutes ago", async () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      mockDb.getLastSyncTime.mockResolvedValue(twoMinutesAgo);

      const result = await service.shouldSync();

      expect(result).toBe(false);
    });

    it("should return false when last sync was exactly 5 minutes ago", async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      mockDb.getLastSyncTime.mockResolvedValue(fiveMinutesAgo);

      const result = await service.shouldSync();

      expect(result).toBe(false);
    });

    it("should handle database errors when checking last sync time", async () => {
      mockDb.getLastSyncTime.mockRejectedValue(new Error("Database error"));

      await expect(service.shouldSync()).rejects.toThrow("Database error");
    });
  });

  describe("close", () => {
    it("should stop background sync and close database connection", async () => {
      const stopBackgroundSyncSpy = vi.spyOn(service, "stopBackgroundSync");

      await service.close();

      expect(stopBackgroundSyncSpy).toHaveBeenCalledTimes(1);
      expect(mockDb.close).toHaveBeenCalledTimes(1);
    });

    it("should handle database close errors", async () => {
      mockDb.close.mockRejectedValue(new Error("Database close failed"));

      await expect(service.close()).rejects.toThrow("Database close failed");
    });

    it("should stop background sync even if database close fails", async () => {
      const stopBackgroundSyncSpy = vi.spyOn(service, "stopBackgroundSync");
      mockDb.close.mockRejectedValue(new Error("Database close failed"));

      try {
        await service.close();
      } catch (error) {
        // Expected to throw
      }

      expect(stopBackgroundSyncSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete sync lifecycle", async () => {
      // Setup initial state
      mockDb.getLastSyncTime.mockResolvedValue(null);

      // Check if sync is needed
      const shouldSync = await service.shouldSync();
      expect(shouldSync).toBe(true);

      // Perform sync
      const mockWorkItems = [
        {
          id: 1234,
          title: "Integration Test Item",
          state: "Active",
          type: "User Story",
          assignedTo: "nathan.vale@example.com",
          lastUpdatedAt: new Date(),
        },
      ];
      mockClient.fetchWorkItems.mockResolvedValue(mockWorkItems);

      await service.performSync();

      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1);
      expect(mockClient.fetchWorkItems).toHaveBeenCalledTimes(1);
      expect(mockDb.syncWorkItems).toHaveBeenCalledWith(mockWorkItems);
    });

    it("should skip sync when recently synced", async () => {
      const recentSync = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      mockDb.getLastSyncTime.mockResolvedValue(recentSync);

      const shouldSync = await service.shouldSync();
      expect(shouldSync).toBe(false);

      // If we still performed sync, it should work
      await service.performSync();
      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1);
    });
  });
});

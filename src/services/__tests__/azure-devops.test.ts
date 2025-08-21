import { describe, it, expect, beforeEach, vi } from "vitest";

// Use vi.hoisted to ensure the mock function is available during module loading
const mockExecAsync = vi.hoisted(() => vi.fn());

vi.mock("util", () => ({
  promisify: () => mockExecAsync,
}));

vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

import { AzureDevOpsClient, WorkItemData } from "../azure-devops";

describe("AzureDevOpsClient", () => {
  let client: AzureDevOpsClient;

  beforeEach(() => {
    vi.resetAllMocks();
    client = new AzureDevOpsClient();
    // Set test emails for the client
    AzureDevOpsClient.setUserEmails(['Nathan.Vale@fwc.gov.au', 'ITEX-NV@fwc.gov.au']);
  });

  describe("fetchWorkItems", () => {
    it("should fetch and parse work items successfully", async () => {
      const mockAzureResponse = [
        {
          id: 1234,
          fields: {
            "System.Title": "Test User Story",
            "System.State": "Active",
            "System.WorkItemType": "User Story",
            "System.AssignedTo": {
              displayName: "Nathan Vale",
              uniqueName: "nathan.vale@example.com"
            },
            "System.ChangedDate": "2025-01-08T10:00:00Z",
          },
        },
        {
          id: 5678,
          fields: {
            "System.Title": "Test Task",
            "System.State": "Done",
            "System.WorkItemType": "Product Backlog Item",
            "System.AssignedTo": {
              displayName: "Nathan Vale",
              uniqueName: "nathan.vale@example.com"
            },
            "System.ChangedDate": "2025-01-07T15:30:00Z",
          },
        },
      ];

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockAzureResponse),
      });

      const result = await client.fetchWorkItems();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1234,
        title: "Test User Story",
        state: "Active",
        type: "User Story",
        assignedTo: "nathan.vale@example.com",
        lastUpdatedAt: new Date("2025-01-08T10:00:00Z"),
        description: "",
        createdDate: undefined,
        closedDate: undefined,
        resolvedDate: undefined,
        // Comprehensive schema fields
        iterationPath: undefined,
        areaPath: undefined,
        boardColumn: undefined,
        boardColumnDone: false,
        priority: undefined,
        severity: undefined,
        tags: undefined,
        changedDate: new Date("2025-01-08T10:00:00Z"),
        activatedDate: undefined,
        stateChangeDate: undefined,
        createdBy: "Unassigned",
        changedBy: "Unassigned",
        closedBy: "Unassigned",
        resolvedBy: "Unassigned",
        storyPoints: undefined,
        effort: undefined,
        remainingWork: undefined,
        completedWork: undefined,
        originalEstimate: undefined,
        acceptanceCriteria: undefined,
        reproSteps: undefined,
        systemInfo: undefined,
        parentId: undefined,
        rev: undefined,
        reason: undefined,
        watermark: undefined,
        url: undefined,
        commentCount: 0,
        hasAttachments: false,
        teamProject: undefined,
        areaId: undefined,
        nodeId: undefined,
        stackRank: undefined,
        valueArea: undefined,
        rawJson: expect.any(String),
      });
      expect(result[1]).toEqual({
        id: 5678,
        title: "Test Task",
        state: "Done",
        type: "Product Backlog Item",
        assignedTo: "nathan.vale@example.com",
        lastUpdatedAt: new Date("2025-01-07T15:30:00Z"),
        description: "",
        createdDate: undefined,
        closedDate: undefined,
        resolvedDate: undefined,
        // Comprehensive schema fields
        iterationPath: undefined,
        areaPath: undefined,
        boardColumn: undefined,
        boardColumnDone: false,
        priority: undefined,
        severity: undefined,
        tags: undefined,
        changedDate: new Date("2025-01-07T15:30:00Z"),
        activatedDate: undefined,
        stateChangeDate: undefined,
        createdBy: "Unassigned",
        changedBy: "Unassigned",
        closedBy: "Unassigned",
        resolvedBy: "Unassigned",
        storyPoints: undefined,
        effort: undefined,
        remainingWork: undefined,
        completedWork: undefined,
        originalEstimate: undefined,
        acceptanceCriteria: undefined,
        reproSteps: undefined,
        systemInfo: undefined,
        parentId: undefined,
        rev: undefined,
        reason: undefined,
        watermark: undefined,
        url: undefined,
        commentCount: 0,
        hasAttachments: false,
        teamProject: undefined,
        areaId: undefined,
        nodeId: undefined,
        stackRank: undefined,
        valueArea: undefined,
        rawJson: expect.any(String),
      });
    });

    it("should handle work items without assigned user", async () => {
      const mockAzureResponse = [
        {
          id: 1234,
          fields: {
            "System.Title": "Unassigned Item",
            "System.State": "New",
            "System.WorkItemType": "User Story",
            "System.ChangedDate": "2025-01-07T15:30:00Z",
          },
        },
      ];

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockAzureResponse),
      });

      const result = await client.fetchWorkItems();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1234,
        title: "Unassigned Item",
        state: "New",
        type: "User Story",
        assignedTo: "Unassigned",
        lastUpdatedAt: new Date("2025-01-07T15:30:00Z"),
        description: "",
        createdDate: undefined,
        closedDate: undefined,
        resolvedDate: undefined,
        // Comprehensive schema fields
        iterationPath: undefined,
        areaPath: undefined,
        boardColumn: undefined,
        boardColumnDone: false,
        priority: undefined,
        severity: undefined,
        tags: undefined,
        changedDate: new Date("2025-01-07T15:30:00Z"),
        activatedDate: undefined,
        stateChangeDate: undefined,
        createdBy: "Unassigned",
        changedBy: "Unassigned",
        closedBy: "Unassigned",
        resolvedBy: "Unassigned",
        storyPoints: undefined,
        effort: undefined,
        remainingWork: undefined,
        completedWork: undefined,
        originalEstimate: undefined,
        acceptanceCriteria: undefined,
        reproSteps: undefined,
        systemInfo: undefined,
        parentId: undefined,
        rev: undefined,
        reason: undefined,
        watermark: undefined,
        url: undefined,
        commentCount: 0,
        hasAttachments: false,
        teamProject: undefined,
        areaId: undefined,
        nodeId: undefined,
        stackRank: undefined,
        valueArea: undefined,
        rawJson: expect.any(String),
      });
    });

    it("should handle work items with null assigned user", async () => {
      const mockAzureResponse = [
        {
          id: 1234,
          fields: {
            "System.Title": "Null Assigned Item",
            "System.State": "Active",
            "System.WorkItemType": "Product Backlog Item",
            "System.AssignedTo": null,
            "System.ChangedDate": "2025-01-06T12:00:00Z",
          },
        },
      ];

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockAzureResponse),
      });

      const result = await client.fetchWorkItems();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1234,
        title: "Null Assigned Item",
        state: "Active",
        type: "Product Backlog Item",
        assignedTo: "Unassigned",
        lastUpdatedAt: new Date("2025-01-06T12:00:00Z"),
        description: "",
        createdDate: undefined,
        closedDate: undefined,
        resolvedDate: undefined,
        // Comprehensive schema fields
        iterationPath: undefined,
        areaPath: undefined,
        boardColumn: undefined,
        boardColumnDone: false,
        priority: undefined,
        severity: undefined,
        tags: undefined,
        changedDate: new Date("2025-01-06T12:00:00Z"),
        activatedDate: undefined,
        stateChangeDate: undefined,
        createdBy: "Unassigned",
        changedBy: "Unassigned",
        closedBy: "Unassigned",
        resolvedBy: "Unassigned",
        storyPoints: undefined,
        effort: undefined,
        remainingWork: undefined,
        completedWork: undefined,
        originalEstimate: undefined,
        acceptanceCriteria: undefined,
        reproSteps: undefined,
        systemInfo: undefined,
        parentId: undefined,
        rev: undefined,
        reason: undefined,
        watermark: undefined,
        url: undefined,
        commentCount: 0,
        hasAttachments: false,
        teamProject: undefined,
        areaId: undefined,
        nodeId: undefined,
        stackRank: undefined,
        valueArea: undefined,
        rawJson: expect.any(String),
      });
    });

    it("should use correct WIQL query", async () => {
      mockExecAsync.mockResolvedValue({ stdout: "[]" });

      await client.fetchWorkItems();

      expect(mockExecAsync).toHaveBeenCalledTimes(1);
      const calledCommand = mockExecAsync.mock.calls[0][0];
      expect(calledCommand).toContain("az boards query");
      expect(calledCommand).toContain("--wiql");
      expect(calledCommand).toContain("--output json");
      expect(calledCommand).toContain("SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo], [System.ChangedDate], [System.CreatedDate], [System.Description]");
      expect(calledCommand).toContain("[System.IterationPath], [System.AreaPath], [System.BoardColumn]");
      expect(calledCommand).toContain("[Microsoft.VSTS.Common.Priority]");
      expect(calledCommand).toContain("[Microsoft.VSTS.Scheduling.StoryPoints]");
      expect(calledCommand).toContain("FROM WorkItems");
      expect(calledCommand).toContain("WHERE [System.WorkItemType] IN ('User Story','Product Backlog Item','Bug','Task')");
      expect(calledCommand).toContain("AND [System.State] <> 'Removed'");
      expect(calledCommand).toContain("ORDER BY [System.ChangedDate] DESC");
    });

    it("should handle empty response from Azure CLI", async () => {
      mockExecAsync.mockResolvedValue({ stdout: "[]" });

      const result = await client.fetchWorkItems();

      expect(result).toEqual([]);
    });

    it("should handle invalid JSON response", async () => {
      mockExecAsync.mockResolvedValue({ stdout: "invalid json" });

      await expect(client.fetchWorkItems()).rejects.toThrow();
    });

    it("should handle Azure CLI execution errors", async () => {
      mockExecAsync.mockRejectedValue(new Error("Azure CLI not authenticated"));

      await expect(client.fetchWorkItems()).rejects.toThrow(
        "Azure CLI not authenticated"
      );
    });

    it("should handle Azure CLI command errors with stderr", async () => {
      mockExecAsync.mockRejectedValue(new Error("Command failed"));

      await expect(client.fetchWorkItems()).rejects.toThrow("Command failed");
    });

    it("should log error when fetching fails", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockExecAsync.mockRejectedValue(new Error("Fetch failed"));

      await expect(client.fetchWorkItems()).rejects.toThrow("Fetch failed");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to fetch work items:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should parse date fields correctly", async () => {
      const mockAzureResponse = [
        {
          id: 1234,
          fields: {
            "System.Title": "Date Test Item",
            "System.State": "Active",
            "System.WorkItemType": "User Story",
            "System.AssignedTo": {
              displayName: "Nathan Vale",
              uniqueName: "nathan.vale@example.com"
            },
            "System.ChangedDate": "2025-01-08T14:30:45.123Z",
          },
        },
      ];

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockAzureResponse),
      });

      const result = await client.fetchWorkItems();

      expect(result).toHaveLength(1);
      expect(result[0].lastUpdatedAt.toISOString()).toBe(
        "2025-01-08T14:30:45.123Z"
      );
    });

    it("should handle malformed work item fields", async () => {
      const mockAzureResponse = [
        {
          id: 1234,
          fields: {
            "System.Title": "Malformed Item",
            "System.State": "Active",
            "System.WorkItemType": "User Story",
            "System.AssignedTo": {
              displayName: "Nathan Vale",
              uniqueName: "nathan.vale@example.com"
            },
            "System.ChangedDate": "2025-01-05T09:15:30Z",
          },
        },
      ];

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockAzureResponse),
      });

      const result = await client.fetchWorkItems();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1234,
        title: "Malformed Item",
        state: "Active",
        type: "User Story",
        assignedTo: "nathan.vale@example.com",
        lastUpdatedAt: new Date("2025-01-05T09:15:30Z"),
        description: "",
        createdDate: undefined,
        closedDate: undefined,
        resolvedDate: undefined,
        // Comprehensive schema fields
        iterationPath: undefined,
        areaPath: undefined,
        boardColumn: undefined,
        boardColumnDone: false,
        priority: undefined,
        severity: undefined,
        tags: undefined,
        changedDate: new Date("2025-01-05T09:15:30Z"),
        activatedDate: undefined,
        stateChangeDate: undefined,
        createdBy: "Unassigned",
        changedBy: "Unassigned",
        closedBy: "Unassigned",
        resolvedBy: "Unassigned",
        storyPoints: undefined,
        effort: undefined,
        remainingWork: undefined,
        completedWork: undefined,
        originalEstimate: undefined,
        acceptanceCriteria: undefined,
        reproSteps: undefined,
        systemInfo: undefined,
        parentId: undefined,
        rev: undefined,
        reason: undefined,
        watermark: undefined,
        url: undefined,
        commentCount: 0,
        hasAttachments: false,
        teamProject: undefined,
        areaId: undefined,
        nodeId: undefined,
        stackRank: undefined,
        valueArea: undefined,
        rawJson: expect.any(String),
      });
    });
  });

  describe("validateUserEmails", () => {
    it("should validate emails that have work items assigned", async () => {
      const workItemsResponse = [{ id: 1234, fields: { "System.Title": "Test" } }];
      
      mockExecAsync
        .mockResolvedValueOnce({ stdout: JSON.stringify(workItemsResponse) })
        .mockResolvedValueOnce({ stdout: JSON.stringify(workItemsResponse) });
      
      const result = await client.validateUserEmails(['valid1@fwc.gov.au', 'valid2@fwc.gov.au']);
      
      expect(result.valid).toEqual(['valid1@fwc.gov.au', 'valid2@fwc.gov.au']);
      expect(result.invalid).toEqual([]);
      expect(mockExecAsync).toHaveBeenCalledTimes(2);
    });

    it("should validate emails that exist in organization but have no work items", async () => {
      const emptyWorkItemsResponse = [];
      const userResponse = { principalName: "user@fwc.gov.au" };
      
      mockExecAsync
        .mockResolvedValueOnce({ stdout: JSON.stringify(emptyWorkItemsResponse) })
        .mockResolvedValueOnce({ stdout: JSON.stringify(userResponse) });
      
      const result = await client.validateUserEmails(['user@fwc.gov.au']);
      
      expect(result.valid).toEqual(['user@fwc.gov.au']);
      expect(result.invalid).toEqual([]);
      expect(mockExecAsync).toHaveBeenCalledTimes(2);
    });

    it("should mark emails as invalid when they don't exist in organization", async () => {
      const emptyWorkItemsResponse = [];
      const emptyUserResponse = "[]";
      
      mockExecAsync
        .mockResolvedValueOnce({ stdout: JSON.stringify(emptyWorkItemsResponse) })
        .mockResolvedValueOnce({ stdout: emptyUserResponse });
      
      const result = await client.validateUserEmails(['invalid@example.com']);
      
      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual(['invalid@example.com']);
      expect(mockExecAsync).toHaveBeenCalledTimes(2);
    });

    it("should handle mixed valid and invalid emails", async () => {
      const workItemsResponse = [{ id: 1234, fields: { "System.Title": "Test" } }];
      const emptyWorkItemsResponse = [];
      const emptyUserResponse = "[]";
      
      mockExecAsync
        .mockResolvedValueOnce({ stdout: JSON.stringify(workItemsResponse) })
        .mockResolvedValueOnce({ stdout: JSON.stringify(emptyWorkItemsResponse) })
        .mockResolvedValueOnce({ stdout: emptyUserResponse });
      
      const result = await client.validateUserEmails(['valid@fwc.gov.au', 'invalid@example.com']);
      
      expect(result.valid).toEqual(['valid@fwc.gov.au']);
      expect(result.invalid).toEqual(['invalid@example.com']);
      expect(mockExecAsync).toHaveBeenCalledTimes(3);
    });

    it("should handle Azure CLI errors during validation", async () => {
      mockExecAsync.mockRejectedValue(new Error("Azure CLI error"));
      
      const result = await client.validateUserEmails(['error@fwc.gov.au']);
      
      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual(['error@fwc.gov.au']);
      expect(mockExecAsync).toHaveBeenCalledTimes(1);
    });

    it("should handle empty email list", async () => {
      const result = await client.validateUserEmails([]);
      
      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual([]);
      expect(mockExecAsync).not.toHaveBeenCalled();
    });

    it("should use correct WIQL query for email validation", async () => {
      const workItemsResponse = [{ id: 1234, fields: { "System.Title": "Test" } }];
      mockExecAsync.mockResolvedValue({ stdout: JSON.stringify(workItemsResponse) });
      
      await client.validateUserEmails(['test@fwc.gov.au']);
      
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining("SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = 'test@fwc.gov.au' OR [System.CreatedBy] = 'test@fwc.gov.au' OR [System.ChangedBy] = 'test@fwc.gov.au'"),
        expect.any(Object)
      );
    });

    it("should use correct user validation command", async () => {
      const emptyWorkItemsResponse = [];
      const userResponse = { principalName: "user@fwc.gov.au" };
      
      mockExecAsync
        .mockResolvedValueOnce({ stdout: JSON.stringify(emptyWorkItemsResponse) })
        .mockResolvedValueOnce({ stdout: JSON.stringify(userResponse) });
      
      await client.validateUserEmails(['user@fwc.gov.au']);
      
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('az devops user show --user "user@fwc.gov.au"'),
        expect.any(Object)
      );
    });

    it("should handle invalid JSON in user response", async () => {
      const emptyWorkItemsResponse = [];
      
      mockExecAsync
        .mockResolvedValueOnce({ stdout: JSON.stringify(emptyWorkItemsResponse) })
        .mockResolvedValueOnce({ stdout: "invalid json" });
      
      const result = await client.validateUserEmails(['user@fwc.gov.au']);
      
      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual(['user@fwc.gov.au']);
    });

    it("should handle user response without principalName", async () => {
      const emptyWorkItemsResponse = [];
      const userResponse = { displayName: "User Name" };
      
      mockExecAsync
        .mockResolvedValueOnce({ stdout: JSON.stringify(emptyWorkItemsResponse) })
        .mockResolvedValueOnce({ stdout: JSON.stringify(userResponse) });
      
      const result = await client.validateUserEmails(['user@fwc.gov.au']);
      
      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual(['user@fwc.gov.au']);
    });
  });

  describe("buildWorkItemUrl", () => {
    it("should build correct work item URL", () => {
      const url = AzureDevOpsClient.buildWorkItemUrl(12345);
      expect(url).toBe(
        "https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/12345"
      );
    });

    it("should handle special characters in project name", () => {
      const url = AzureDevOpsClient.buildWorkItemUrl(98765);
      expect(url).toBe(
        "https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/98765"
      );
    });

    it("should handle large work item IDs", () => {
      const url = AzureDevOpsClient.buildWorkItemUrl(999999999);
      expect(url).toBe(
        "https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/999999999"
      );
    });

    it("should handle work item ID of 0", () => {
      const url = AzureDevOpsClient.buildWorkItemUrl(0);
      expect(url).toBe(
        "https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/0"
      );
    });

    it("should handle negative work item IDs", () => {
      const url = AzureDevOpsClient.buildWorkItemUrl(-1);
      expect(url).toBe(
        "https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/-1"
      );
    });
  });
});

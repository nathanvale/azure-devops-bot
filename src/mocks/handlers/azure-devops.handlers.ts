import { http, HttpResponse } from 'msw'

import type { AzureDevOpsWorkItem } from '../../types/azure-devops-api'

// Base Azure DevOps API URL pattern
const AZURE_DEVOPS_BASE = 'https://dev.azure.com/:org/:project/_apis'

// PATCH operation types for Azure DevOps
interface PatchOperation {
  op: 'replace' | 'add' | 'remove'
  path: string
  value?: unknown
}

// Default mock work items
const mockWorkItems: AzureDevOpsWorkItem[] = [
  {
    id: 1234,
    rev: 1,
    url: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/1234',
    fields: {
      'System.Id': 1234,
      'System.Title': 'Implement user authentication',
      'System.State': 'Active',
      'System.WorkItemType': 'User Story',
      'System.AssignedTo': {
        displayName: 'Nathan Vale',
        uniqueName: 'nathan.vale@example.com',
      },
      'System.CreatedDate': '2025-01-01T10:00:00Z',
      'System.ChangedDate': '2025-01-08T10:00:00Z',
      'System.AreaPath': 'Customer Services Platform',
      'System.IterationPath': 'Customer Services Platform\\Sprint 1',
      'Microsoft.VSTS.Common.Priority': 1,
      'Microsoft.VSTS.Common.Severity': '2 - High',
      'System.Description':
        'As a user, I want to authenticate so that I can access the system',
    },
    _links: {
      self: {
        href: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/1234',
      },
      workItemUpdates: {
        href: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/1234/updates',
      },
      workItemRevisions: {
        href: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/1234/revisions',
      },
      workItemComments: {
        href: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/1234/comments',
      },
      html: {
        href: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/1234',
      },
    },
  },
  {
    id: 5678,
    rev: 1,
    url: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/5678',
    fields: {
      'System.Id': 5678,
      'System.Title': 'Setup CI/CD pipeline',
      'System.State': 'Done',
      'System.WorkItemType': 'Task',
      'System.AssignedTo': {
        displayName: 'Nathan Vale',
        uniqueName: 'nathan.vale@example.com',
      },
      'System.CreatedDate': '2024-12-15T10:00:00Z',
      'System.ChangedDate': '2025-01-05T10:00:00Z',
      'System.AreaPath': 'Customer Services Platform',
      'System.IterationPath': 'Customer Services Platform\\Sprint 1',
      'Microsoft.VSTS.Common.Priority': 2,
      'System.Description': 'Setup automated build and deployment pipeline',
    },
    _links: {
      self: {
        href: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/5678',
      },
      workItemUpdates: {
        href: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/5678/updates',
      },
      workItemRevisions: {
        href: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/5678/revisions',
      },
      workItemComments: {
        href: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/5678/comments',
      },
      html: {
        href: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/5678',
      },
    },
  },
]

// Success handlers
export const workItemsListHandler = http.get(
  `${AZURE_DEVOPS_BASE}/wit/workitems`,
  ({ request }) => {
    const url = new URL(request.url)
    const ids = url.searchParams.get('ids')

    if (ids) {
      const requestedIds = ids.split(',').map((id) => parseInt(id))
      const items: AzureDevOpsWorkItem[] = []

      requestedIds.forEach((id) => {
        // Check if we have a predefined mock item
        const existingItem = mockWorkItems.find((item) => item.id === id)
        if (existingItem) {
          items.push(existingItem)
        } else {
          // Generate mock data for any other ID
          items.push({
            id,
            rev: 1,
            url: `https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/${id}`,
            fields: {
              'System.Id': id,
              'System.Title': `Batch Mock Work Item ${id}`,
              'System.State': ['Active', 'Done', 'New'][id % 3],
              'System.WorkItemType': ['User Story', 'Bug', 'Task'][id % 3],
              'System.AssignedTo': {
                displayName: `Batch User ${id % 5}`,
                uniqueName: `batch.user${id % 5}@fwc.gov.au`,
              },
              'System.CreatedDate': '2025-01-08T10:00:00Z',
              'System.ChangedDate': '2025-01-08T14:30:00Z',
              'System.AreaPath': 'Customer Services Platform',
              'System.IterationPath': 'Customer Services Platform\\Sprint 1',
              'Microsoft.VSTS.Common.Priority': (id % 4) + 1,
              'Microsoft.VSTS.Scheduling.StoryPoints': (id % 13) + 1,
              'System.Description': `Batch mock work item description ${id}`,
              'System.Tags':
                id % 2 === 0 ? 'high-priority; feature' : 'bug-fix; urgent',
            },
            _links: {
              self: {
                href: `https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/${id}`,
              },
              workItemUpdates: {
                href: `https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/${id}/updates`,
              },
              workItemRevisions: {
                href: `https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/${id}/revisions`,
              },
              workItemComments: {
                href: `https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/${id}/comments`,
              },
              html: {
                href: `https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/${id}`,
              },
            },
          })
        }
      })

      return HttpResponse.json({
        count: items.length,
        value: items,
      })
    }

    return HttpResponse.json({
      count: mockWorkItems.length,
      value: mockWorkItems,
    })
  },
)

export const workItemsQueryHandler = http.post(
  `${AZURE_DEVOPS_BASE}/wit/wiql`,
  async ({ request }) => {
    const body = (await request.json()) as { query?: string }
    const query = body.query?.toLowerCase() || ''

    // Simple query parsing for tests
    let filteredItems = mockWorkItems

    if (query.includes("state = 'active'")) {
      filteredItems = mockWorkItems.filter(
        (item) => item.fields['System.State'] === 'Active',
      )
    } else if (query.includes("state = 'done'")) {
      filteredItems = mockWorkItems.filter(
        (item) => item.fields['System.State'] === 'Done',
      )
    } else if (query.includes("workitemtype = 'user story'")) {
      filteredItems = mockWorkItems.filter(
        (item) => item.fields['System.WorkItemType'] === 'User Story',
      )
    }

    return HttpResponse.json({
      queryType: 'flat',
      workItems: filteredItems.map((item) => ({
        id: item.id,
        url: `https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/${item.id}`,
      })),
    })
  },
)

export const createWorkItemHandler = http.post(
  `${AZURE_DEVOPS_BASE}/wit/workitems/$:type`,
  async ({ request, params }) => {
    const type = params.type as string
    const body = (await request.json()) as Array<{
      op: string
      path: string
      value?: unknown
    }>

    // Extract title from PATCH operations
    const titleOp = body.find((op) => op.path === '/fields/System.Title')
    const descriptionOp = body.find(
      (op) => op.path === '/fields/System.Description',
    )

    const newId = Math.floor(Math.random() * 10000) + 10000

    const newItem = {
      id: newId,
      rev: 1,
      fields: {
        'System.Id': newId,
        'System.Title': titleOp?.value || 'New Work Item',
        'System.State': 'New',
        'System.WorkItemType': type.replace('%20', ' '),
        'System.AssignedTo': {
          displayName: 'Nathan Vale',
          uniqueName: 'nathan.vale@example.com',
        },
        'System.CreatedDate': new Date().toISOString(),
        'System.ChangedDate': new Date().toISOString(),
        'System.AreaPath': 'Customer Services Platform',
        'System.IterationPath': 'Customer Services Platform\\Current Sprint',
        'Microsoft.VSTS.Common.Priority': 2,
        'System.Description': descriptionOp?.value || '',
      },
    }

    return HttpResponse.json(newItem, { status: 201 })
  },
)

export const updateWorkItemHandler = http.patch(
  `${AZURE_DEVOPS_BASE}/wit/workitems/:id`,
  async ({ request, params }) => {
    const id = parseInt(params.id as string)
    const body = (await request.json()) as PatchOperation[]

    const existingItem = mockWorkItems.find((item) => item.id === id)
    if (!existingItem) {
      return HttpResponse.json(
        { message: `Work item ${id} not found` },
        { status: 404 },
      )
    }

    // Apply PATCH operations
    const updatedFields = { ...existingItem.fields } as Record<string, unknown>
    body.forEach((operation) => {
      if (operation.op === 'replace' && operation.path.startsWith('/fields/')) {
        const fieldName = operation.path.replace('/fields/', '')
        updatedFields[fieldName] = operation.value
      }
    })

    const updatedItem = {
      ...existingItem,
      rev: existingItem.rev + 1,
      fields: {
        ...updatedFields,
        'System.ChangedDate': new Date().toISOString(),
      },
    }

    return HttpResponse.json(updatedItem)
  },
)

export const workItemCommentsHandler = http.get(
  `${AZURE_DEVOPS_BASE}/wit/workitems/:id/comments`,
  ({ params }) => {
    const workItemId = parseInt(params.id as string)

    return HttpResponse.json({
      totalCount: 2,
      count: 2,
      fromRevisionCount: 0,
      comments: [
        {
          id: '1',
          workItemId,
          text: 'This work item has been updated with new requirements.',
          createdBy: {
            displayName: 'Nathan Vale',
            uniqueName: 'nathan.vale@example.com',
            url: 'https://dev.azure.com/_apis/Identities/user-1',
            id: 'user-1',
            imageUrl:
              'https://dev.azure.com/_apis/GraphProfile/MemberAvatars/user-1',
            descriptor: 'descriptor-1',
          },
          createdDate: '2025-01-07T10:00:00Z',
          version: 1,
        },
        {
          id: '2',
          workItemId,
          text: 'Ready for review.',
          createdBy: {
            displayName: 'Nathan Vale',
            uniqueName: 'nathan.vale@example.com',
            url: 'https://dev.azure.com/_apis/Identities/user-2',
            id: 'user-2',
            imageUrl:
              'https://dev.azure.com/_apis/GraphProfile/MemberAvatars/user-2',
            descriptor: 'descriptor-2',
          },
          createdDate: '2025-01-08T14:30:00Z',
          version: 2,
        },
      ],
    })
  },
)

// Error handlers
export const createUnauthorizedHandler = () =>
  http.get(`${AZURE_DEVOPS_BASE}/*`, () =>
    HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
  )

export const createNotFoundHandler = () =>
  http.get(`${AZURE_DEVOPS_BASE}/*`, () =>
    HttpResponse.json({ message: 'Resource not found' }, { status: 404 }),
  )

export const createServerErrorHandler = () =>
  http.get(`${AZURE_DEVOPS_BASE}/*`, () =>
    HttpResponse.json({ message: 'Internal server error' }, { status: 500 }),
  )

export const createRateLimitHandler = () =>
  http.get(`${AZURE_DEVOPS_BASE}/*`, () =>
    HttpResponse.json({ message: 'Rate limit exceeded' }, { status: 429 }),
  )

// Factory for creating custom handlers
export const createCustomWorkItemHandler = (workItem: AzureDevOpsWorkItem) =>
  http.get(`${AZURE_DEVOPS_BASE}/wit/workitems/:id`, ({ params }) => {
    if (params.id === workItem.id.toString()) {
      return HttpResponse.json(workItem)
    }
    return HttpResponse.json(
      { message: 'Work item not found' },
      { status: 404 },
    )
  })

export const createWorkItemsHandler = (workItems: AzureDevOpsWorkItem[]) =>
  http.get(`${AZURE_DEVOPS_BASE}/wit/workitems`, () =>
    HttpResponse.json({
      count: workItems.length,
      value: workItems,
    }),
  )

// Single work item handler - generates mock data for any requested ID
export const singleWorkItemHandler = http.get(
  `${AZURE_DEVOPS_BASE}/wit/workitems/:id`,
  ({ params }) => {
    const id = parseInt(params.id as string)

    // Return specific mock items for known IDs
    const existingWorkItem = mockWorkItems.find((item) => item.id === id)
    if (existingWorkItem) {
      return HttpResponse.json(existingWorkItem)
    }

    // Generate mock data for any other ID (for testing purposes)
    const mockWorkItem: AzureDevOpsWorkItem = {
      id,
      rev: 1,
      url: `https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/${id}`,
      fields: {
        'System.Id': id,
        'System.Title': `Mock Work Item ${id}`,
        'System.State': ['Active', 'Done', 'New'][id % 3],
        'System.WorkItemType': ['User Story', 'Bug', 'Task'][id % 3],
        'System.AssignedTo': {
          displayName: 'Mock User',
          uniqueName: `mock.user${id % 5}@fwc.gov.au`,
        },
        'System.CreatedDate': '2025-01-08T10:00:00Z',
        'System.ChangedDate': '2025-01-08T14:30:00Z',
        'System.AreaPath': 'Customer Services Platform',
        'System.IterationPath': 'Customer Services Platform\\Sprint 1',
        'Microsoft.VSTS.Common.Priority': (id % 4) + 1,
        'Microsoft.VSTS.Scheduling.StoryPoints': (id % 13) + 1,
        'System.Description': `Mock work item description ${id}`,
        'System.Tags':
          id % 2 === 0 ? 'high-priority; feature' : 'bug-fix; urgent',
      },
      _links: {
        self: {
          href: `https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/${id}`,
        },
        workItemUpdates: {
          href: `https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/${id}/updates`,
        },
        workItemRevisions: {
          href: `https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/${id}/revisions`,
        },
        workItemComments: {
          href: `https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/${id}/comments`,
        },
        html: {
          href: `https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/${id}`,
        },
      },
    }

    return HttpResponse.json(mockWorkItem)
  },
)

// Add comment handler - for POST requests to create comments
export const addWorkItemCommentHandler = http.post(
  `${AZURE_DEVOPS_BASE}/wit/workitems/:id/comments`,
  async ({ params, request }) => {
    const workItemId = parseInt(params.id as string)
    const body = (await request.json()) as { text: string }

    // Return success response for comment creation
    return HttpResponse.json(
      {
        id: Math.floor(Math.random() * 1000) + 1,
        workItemId,
        text: body.text,
        createdBy: {
          displayName: 'Nathan Vale',
          uniqueName: 'nathan.vale@example.com',
        },
        createdDate: new Date().toISOString(),
        modifiedDate: null,
      },
      { status: 201 },
    )
  },
)

// Projects API handler - for configuration and validation requests
export const projectsHandler = http.get(
  'https://dev.azure.com/:org/_apis/projects',
  ({ params }) => {
    const org = params.org as string
    return HttpResponse.json({
      count: 1,
      value: [
        {
          id: 'test-project-id',
          name: 'Customer Services Platform',
          description: 'Test project for Azure DevOps Bot',
          url: `https://dev.azure.com/${org}/_apis/projects/test-project-id`,
          state: 'wellFormed',
          revision: 1,
          visibility: 'private',
        }
      ]
    })
  }
)

// Also handle any generic projects API requests
export const genericProjectsHandler = http.get(
  'https://dev.azure.com/:org/:project/_apis/projects',
  ({ params }) => {
    const org = params.org as string
    const project = params.project as string
    return HttpResponse.json({
      id: 'test-project-id',
      name: decodeURIComponent(project),
      description: 'Test project for Azure DevOps Bot',
      url: `https://dev.azure.com/${org}/_apis/projects/test-project-id`,
      state: 'wellFormed',
      revision: 1,
      visibility: 'private',
    })
  }
)

// Default handlers export
export const azureDevOpsHandlers = [
  workItemsListHandler,
  workItemsQueryHandler,
  singleWorkItemHandler,
  createWorkItemHandler,
  updateWorkItemHandler,
  workItemCommentsHandler,
  addWorkItemCommentHandler,
  projectsHandler,
  genericProjectsHandler,
]

import { http, HttpResponse } from 'msw'

// Base Azure DevOps API URL pattern
const AZURE_DEVOPS_BASE = 'https://dev.azure.com/:org/:project/_apis'

// Default mock work items
const mockWorkItems = [
  {
    id: 1234,
    rev: 1,
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
  },
  {
    id: 5678,
    rev: 1,
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
      const filteredItems = mockWorkItems.filter((item) =>
        requestedIds.includes(item.id),
      )

      return HttpResponse.json({
        count: filteredItems.length,
        value: filteredItems,
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
    const body = (await request.json()) as any
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
    const body = (await request.json()) as any[]

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
    const body = (await request.json()) as any[]

    const existingItem = mockWorkItems.find((item) => item.id === id)
    if (!existingItem) {
      return HttpResponse.json(
        { message: `Work item ${id} not found` },
        { status: 404 },
      )
    }

    // Apply PATCH operations
    const updatedFields = { ...existingItem.fields }
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
    const id = params.id as string

    return HttpResponse.json({
      totalCount: 2,
      count: 2,
      value: [
        {
          id: 1,
          text: 'This work item has been updated with new requirements.',
          createdBy: {
            displayName: 'Nathan Vale',
            uniqueName: 'nathan.vale@example.com',
          },
          createdDate: '2025-01-07T10:00:00Z',
        },
        {
          id: 2,
          text: 'Ready for review.',
          createdBy: {
            displayName: 'Nathan Vale',
            uniqueName: 'nathan.vale@example.com',
          },
          createdDate: '2025-01-08T14:30:00Z',
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
export const createCustomWorkItemHandler = (workItem: any) =>
  http.get(`${AZURE_DEVOPS_BASE}/wit/workitems/:id`, ({ params }) => {
    if (params.id === workItem.id.toString()) {
      return HttpResponse.json(workItem)
    }
    return HttpResponse.json(
      { message: 'Work item not found' },
      { status: 404 },
    )
  })

export const createWorkItemsHandler = (workItems: any[]) =>
  http.get(`${AZURE_DEVOPS_BASE}/wit/workitems`, () =>
    HttpResponse.json({
      count: workItems.length,
      value: workItems,
    }),
  )

// Default handlers export
export const azureDevOpsHandlers = [
  workItemsListHandler,
  workItemsQueryHandler,
  createWorkItemHandler,
  updateWorkItemHandler,
  workItemCommentsHandler,
]

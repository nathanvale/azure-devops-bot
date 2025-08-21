import { setupServer } from 'msw/node'
import { azureDevOpsHandlers } from './handlers/azure-devops.handlers'

export const server = setupServer(...azureDevOpsHandlers)
import { z } from 'zod'

import {
  HealthCheckResponseSchema,
  TableVerificationSchema,
  StatisticsResponseSchema,
  CleanupOrphansResponseSchema,
} from './admin.js'
import { createSuccessEnvelopeSchema } from './index.js'
import {
  SyncForceResponseSchema,
  SyncStatusResponseSchema,
  SyncMetricsResponseSchema,
  SyncSummarySchema,
} from './sync.js'
import {
  WorkItemResponseSchema,
  WorkItemRelationSchema,
  WorkItemRelationsResponseSchema,
  WorkItemListResponseSchema,
} from './work-item.js'

/**
 * Cache Domain Output Envelope Schemas
 */

// Single work item response (for cache_get_work_item)
export const WorkItemGetResponseEnvelope = createSuccessEnvelopeSchema(
  z.object({
    item: WorkItemResponseSchema,
    rawJson: z.any().optional(),
    relations: z
      .object({
        outgoing: z.array(WorkItemRelationSchema),
        incoming: z.array(WorkItemRelationSchema),
      })
      .optional(),
  }),
)

// Work item list response envelope
export const WorkItemListResponseEnvelope = createSuccessEnvelopeSchema(
  WorkItemListResponseSchema,
)

// Work item relations response envelope
export const WorkItemRelationsResponseEnvelope = createSuccessEnvelopeSchema(
  WorkItemRelationsResponseSchema,
)

// Sync summary response envelope (for cache_get_sync_summary)
export const SyncSummaryResponseEnvelope =
  createSuccessEnvelopeSchema(SyncSummarySchema)

/**
 * Sync Domain Output Envelope Schemas
 */

// Already properly structured as they contain success/message fields
export const SyncForceResponseEnvelope = createSuccessEnvelopeSchema(
  SyncForceResponseSchema,
)

export const SyncStatusResponseEnvelope = createSuccessEnvelopeSchema(
  SyncStatusResponseSchema,
)

export const SyncMetricsResponseEnvelope = createSuccessEnvelopeSchema(
  SyncMetricsResponseSchema,
)

/**
 * Admin Domain Output Envelope Schemas
 */

export const HealthCheckResponseEnvelope = createSuccessEnvelopeSchema(
  HealthCheckResponseSchema,
)

export const TableVerificationEnvelope = createSuccessEnvelopeSchema(
  TableVerificationSchema,
)

export const StatisticsResponseEnvelope = createSuccessEnvelopeSchema(
  StatisticsResponseSchema,
)

export const CleanupOrphansResponseEnvelope = createSuccessEnvelopeSchema(
  CleanupOrphansResponseSchema,
)

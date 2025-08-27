# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-28-fix-work-item-assignment/spec.md

> Created: 2025-08-28
> Status: Ready for Implementation

## Tasks

- [x] 1. Create Person Table Schema and Migration
  - [x] 1.1 Write tests for Person table structure and indexes
  - [x] 1.2 Create Prisma migration for Person table with optimal indexes
  - [x] 1.3 Add nullable Person foreign key fields to WorkItem table
  - [x] 1.4 Verify migration rollback capability
  - [x] 1.5 Verify all tests pass for schema changes

- [ ] 2. Update Azure DevOps Provider Data Extraction  
  - [ ] 2.1 Write tests for complete person data extraction from Azure DevOps responses
  - [ ] 2.2 Replace extractPersonName() with extractPersonData() method
  - [ ] 2.3 Update WorkItemData interface to include person objects instead of strings
  - [ ] 2.4 Update mapWorkItemToData() to extract all person fields
  - [ ] 2.5 Verify all tests pass for data extraction changes

- [ ] 3. Implement Person Management in Database Service
  - [ ] 3.1 Write tests for Person CRUD operations and email-based queries
  - [ ] 3.2 Add upsertPerson() method to handle Person record creation/updates
  - [ ] 3.3 Add getPersonByEmail() method for email-based lookups
  - [ ] 3.4 Update syncWorkItems() to create Person records before WorkItem sync
  - [ ] 3.5 Verify all tests pass for Person management methods

- [ ] 4. Update Database Query Methods for Person Joins
  - [ ] 4.1 Write tests for optimized Person join queries and performance validation  
  - [ ] 4.2 Update getWorkItemsForUsers() to use Person table joins instead of string matching
  - [ ] 4.3 Update getWorkItemsByStateForUsers() with Person join optimization
  - [ ] 4.4 Update getWorkItemsByTypeForUsers() with Person join optimization
  - [ ] 4.5 Verify all tests pass and performance targets met (<100ms queries)

- [ ] 5. Create and Execute Data Migration Script
  - [ ] 5.1 Write tests for data migration accuracy and completeness
  - [ ] 5.2 Create migration script to extract Person records from existing rawJson data
  - [ ] 5.3 Populate Person table with all unique persons from historical work item data
  - [ ] 5.4 Update WorkItem foreign keys to reference Person records
  - [ ] 5.5 Verify all tests pass and no data loss occurred during migration

- [ ] 6. Test Email-Based Query Functionality End-to-End
  - [ ] 6.1 Write integration tests for MCP tools with email-based queries
  - [ ] 6.2 Test wit_my_work_items MCP tool returns correct results for authenticated user
  - [ ] 6.3 Test query performance meets sub-100ms target with realistic data
  - [ ] 6.4 Test backward compatibility during migration period
  - [ ] 6.5 Verify all tests pass for complete email query functionality

- [ ] 7. Performance Validation and Documentation
  - [ ] 7.1 Write performance benchmark tests comparing old vs new query methods
  - [ ] 7.2 Run performance validation to confirm 25x improvement (50ms → 2ms)
  - [ ] 7.3 Create performance monitoring for ongoing query time tracking
  - [ ] 7.4 Update code documentation with Person table usage patterns
  - [ ] 7.5 Verify all tests pass and performance metrics are documented
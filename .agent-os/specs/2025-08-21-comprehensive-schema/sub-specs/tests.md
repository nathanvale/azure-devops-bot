# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-21-comprehensive-schema/spec.md

> Created: 2025-08-21
> Version: 1.0.0

## Test Coverage

### Unit Tests

**Database Service (database.ts)**
- Should save work item with all new comprehensive fields
- Should handle null values for optional comprehensive fields  
- Should preserve existing work items during schema migration
- Should query work items using new indexed fields

**Azure DevOps Service (azure-devops.ts)**
- Should fetch work item with `--expand all` flag
- Should parse all comprehensive fields from expanded JSON response
- Should handle missing fields gracefully with appropriate defaults
- Should preserve rawJson backup when parsing comprehensive fields

### Integration Tests

**Schema Migration**
- Should migrate existing database without data loss
- Should add all new columns with correct data types
- Should create all new indexes successfully
- Should preserve all existing data and relationships

**End-to-End Sync**  
- Should sync work item with comprehensive fields from Azure DevOps
- Should populate all new schema fields from `--expand all` response
- Should maintain rawJson backup with complete Azure DevOps response
- Should handle work items with missing optional fields

### Mocking Requirements

- **Azure DevOps CLI Response:** Mock `az boards work-item show --expand all` with comprehensive field data
- **Database State:** Mock existing work items to test migration compatibility
- **Field Variations:** Mock work items with different field combinations to test optional handling
# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-21-comprehensive-schema/spec.md

> Created: 2025-08-21
> Version: 1.0.0

## Technical Requirements

- Expand Prisma schema to include all Azure DevOps work item fields from `--expand all` output
- Maintain backward compatibility with existing data and queries
- Use proper TypeScript types for all fields (String, Int, Float, DateTime, Boolean)
- Add appropriate database indexes for query performance
- Update sync service to use `--expand all` flag and map all fields
- Preserve existing rawJson backup strategy for complete data safety

## Approach Options

**Option A:** Manual Field Addition
- Pros: Precise control over field types and naming, optimal database design
- Cons: Requires extensive research of Azure DevOps fields, time-consuming, may miss fields

**Option B:** Dynamic Schema Generation (Selected)
- Pros: Automatically discovers all fields, future-proof, less manual work
- Cons: Less control over field types, potential naming conflicts

**Rationale:** Dynamic approach aligns with the product mission of capturing ALL data and being future-proof. We can refine field types in iterations while ensuring no data is lost.

## External Dependencies

- **Prisma CLI** - For schema generation and migrations
- **Justification:** Already used in the project for database management

## Implementation Strategy

### Phase 1: Field Discovery
1. Fetch sample work items with `az boards work-item show --expand all`
2. Analyze JSON structure to identify all possible fields
3. Map field types (string, number, boolean, date) based on sample data

### Phase 2: Schema Design
1. Create comprehensive Prisma schema with all discovered fields
2. Use optional fields with appropriate defaults to handle missing data
3. Maintain existing field names for backward compatibility
4. Add new indexes for commonly queried fields

### Phase 3: Migration and Sync Update
1. Generate Prisma migration file
2. Update database service to handle new fields
3. Modify sync service to populate all fields from expanded Azure DevOps data
4. Ensure rawJson field continues to store complete response as backup

## Risk Mitigation

- **Field Type Conflicts**: Use String for unknown types, refine later
- **Migration Failures**: Test migration on copy of production database first  
- **Performance Impact**: Add indexes incrementally based on usage patterns
- **Data Loss**: rawJson field provides complete backup if field mapping fails
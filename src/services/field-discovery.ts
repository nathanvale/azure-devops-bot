import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface FieldAnalysisResult {
  totalFields: number
  systemFields: string[]
  vstsFields: string[]
  customFields: string[]
  metadataFields: string[]
  fieldTypes: Record<string, string>
}

export class FieldDiscoveryService {
  private static readonly ORGANIZATION = 'fwcdev'
  private static readonly PROJECT = 'Customer Services Platform'

  /**
   * Fetch a single work item with all expanded fields using --expand all flag
   */
  async fetchWorkItemWithAllFields(workItemId: number): Promise<any> {
    const command = `az boards work-item show --id ${workItemId} --expand all --output json`

    try {
      const { stdout } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024,
      })
      return JSON.parse(stdout)
    } catch (error) {
      console.error(
        `Failed to fetch work item ${workItemId} with --expand all:`,
        error,
      )
      throw error
    }
  }

  /**
   * Analyze a work item to categorize and type all its fields
   */
  analyzeFields(workItem: any): FieldAnalysisResult {
    const systemFields: string[] = []
    const vstsFields: string[] = []
    const customFields: string[] = []
    const metadataFields: string[] = []
    const fieldTypes: Record<string, string> = {}

    // Process top-level metadata fields (id, rev, url, relations, _links)
    const metadataKeys = ['id', 'rev', 'url', 'relations', '_links']
    metadataKeys.forEach((key) => {
      if (workItem.hasOwnProperty(key) && workItem[key] !== undefined) {
        metadataFields.push(key)
        fieldTypes[key] = this.detectFieldType(workItem[key])
      }
    })

    // Process fields object
    if (workItem.fields) {
      Object.keys(workItem.fields).forEach((fieldName) => {
        const value = workItem.fields[fieldName]
        fieldTypes[fieldName] = this.detectFieldType(value)

        if (fieldName.startsWith('System.')) {
          systemFields.push(fieldName)
        } else if (fieldName.startsWith('Microsoft.VSTS.')) {
          vstsFields.push(fieldName)
        } else {
          customFields.push(fieldName)
        }
      })
    }

    return {
      totalFields: Object.keys(fieldTypes).length,
      systemFields: systemFields.sort(),
      vstsFields: vstsFields.sort(),
      customFields: customFields.sort(),
      metadataFields: metadataFields.sort(),
      fieldTypes,
    }
  }

  /**
   * Detect the type of a field value
   */
  private detectFieldType(value: any): string {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (Array.isArray(value)) return 'array'
    if (typeof value === 'object') return 'object'
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'number') return 'number'
    if (typeof value === 'string') return 'string'
    return 'unknown'
  }

  /**
   * Generate comprehensive field documentation from analysis results
   */
  generateFieldDocumentation(analysisResults: FieldAnalysisResult[]): string {
    if (analysisResults.length === 0) {
      return `# Azure DevOps Field Discovery Report

> Generated: ${new Date().toISOString()}

## Summary

**Total Work Items Analyzed:** 0
**Total Unique Fields Found:** 0

No fields discovered from the analysis.
`
    }

    // Combine all fields from all analysis results
    const allSystemFields = new Set<string>()
    const allVstsFields = new Set<string>()
    const allCustomFields = new Set<string>()
    const allMetadataFields = new Set<string>()
    const allFieldTypes = new Map<string, string>()

    analysisResults.forEach((result) => {
      result.systemFields.forEach((field) => allSystemFields.add(field))
      result.vstsFields.forEach((field) => allVstsFields.add(field))
      result.customFields.forEach((field) => allCustomFields.add(field))
      result.metadataFields.forEach((field) => allMetadataFields.add(field))

      Object.entries(result.fieldTypes).forEach(([field, type]) => {
        allFieldTypes.set(field, type)
      })
    })

    const totalUniqueFields = allFieldTypes.size

    let documentation = `# Azure DevOps Field Discovery Report

> Generated: ${new Date().toISOString()}

## Summary

**Total Work Items Analyzed:** ${analysisResults.length}
**Total Unique Fields Found:** ${totalUniqueFields}
**System Fields:** ${allSystemFields.size}
**VSTS Fields:** ${allVstsFields.size}
**Custom Fields:** ${allCustomFields.size}
**Metadata Fields:** ${allMetadataFields.size}

## Field Categories

`

    // System Fields
    if (allSystemFields.size > 0) {
      documentation += `### System Fields

`
      Array.from(allSystemFields)
        .sort()
        .forEach((field) => {
          const type = allFieldTypes.get(field) || 'unknown'
          documentation += `- ${field} (${type})\n`
        })
      documentation += '\n'
    }

    // Microsoft VSTS Fields
    if (allVstsFields.size > 0) {
      documentation += `### Microsoft VSTS Fields

`
      Array.from(allVstsFields)
        .sort()
        .forEach((field) => {
          const type = allFieldTypes.get(field) || 'unknown'
          documentation += `- ${field} (${type})\n`
        })
      documentation += '\n'
    }

    // Custom Fields
    if (allCustomFields.size > 0) {
      documentation += `### Custom Fields

`
      Array.from(allCustomFields)
        .sort()
        .forEach((field) => {
          const type = allFieldTypes.get(field) || 'unknown'
          documentation += `- ${field} (${type})\n`
        })
      documentation += '\n'
    }

    // Metadata Fields
    if (allMetadataFields.size > 0) {
      documentation += `### Metadata Fields

`
      Array.from(allMetadataFields)
        .sort()
        .forEach((field) => {
          const type = allFieldTypes.get(field) || 'unknown'
          documentation += `- ${field} (${type})\n`
        })
      documentation += '\n'
    }

    documentation += `## Field Type Distribution

`

    const typeDistribution = new Map<string, number>()
    allFieldTypes.forEach((type) => {
      typeDistribution.set(type, (typeDistribution.get(type) || 0) + 1)
    })

    Array.from(typeDistribution.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        documentation += `- **${type}**: ${count} fields\n`
      })

    return documentation
  }

  /**
   * Discover all fields from multiple work items and generate documentation
   */
  async discoverAllFields(workItemIds: number[]): Promise<string> {
    const analysisResults: FieldAnalysisResult[] = []
    let failedFetches = 0

    console.log(
      `Analyzing ${workItemIds.length} work items for field discovery...`,
    )

    for (const workItemId of workItemIds) {
      try {
        console.log(`Fetching work item ${workItemId} with --expand all...`)
        const workItem = await this.fetchWorkItemWithAllFields(workItemId)
        const analysis = this.analyzeFields(workItem)
        analysisResults.push(analysis)

        console.log(
          `Work item ${workItemId}: Found ${analysis.totalFields} fields`,
        )
      } catch (error) {
        console.warn(`Failed to fetch work item ${workItemId}:`, error)
        failedFetches++
      }
    }

    console.log(
      `Analysis complete. Successfully analyzed ${analysisResults.length} work items, ${failedFetches} failed.`,
    )

    const documentation = this.generateFieldDocumentation(analysisResults)

    // Add failed fetch info to documentation if any failed
    if (failedFetches > 0) {
      const summarySection = documentation.split('## Summary')[1]
      const updatedSummary = summarySection?.replace(
        /(\*\*Total Work Items Analyzed:\*\* \d+)/,
        `$1\n**Failed to Fetch:** ${failedFetches}`,
      )
      return documentation.replace(
        '## Summary' + summarySection,
        '## Summary' + updatedSummary,
      )
    }

    return documentation
  }
}

#!/usr/bin/env tsx

import dotenv from 'dotenv'
import https from 'https'

// Load environment variables
dotenv.config()

async function testPATAuthentication(): Promise<void> {
  const pat = process.env.AZURE_DEVOPS_PAT
  
  console.log('🔍 Simple PAT Authentication Test\n')
  
  if (!pat) {
    console.log('❌ No PAT token found in environment')
    process.exit(1)
  }

  console.log(`✅ PAT token found: ${pat.length} characters`)
  console.log(`🔑 Token prefix: ${pat.substring(0, 8)}...`)
  console.log()

  // Test with a simple WIQL query
  const organization = 'fwcdev'
  const project = 'Customer Services Platform'
  
  const testCases = [
    {
      name: 'Basic WIQL Query',
      url: `https://dev.azure.com/${organization}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.0`,
      method: 'POST',
      body: JSON.stringify({
        query: "SELECT [System.Id] FROM workitems WHERE [System.WorkItemType] = 'User Story' ORDER BY [System.Id] DESC"
      })
    },
    {
      name: 'Organization Info',
      url: `https://dev.azure.com/${organization}/_apis/projects?api-version=7.0`,
      method: 'GET',
      body: null
    },
    {
      name: 'Project Info', 
      url: `https://dev.azure.com/${organization}/_apis/projects/${encodeURIComponent(project)}?api-version=7.0`,
      method: 'GET',
      body: null
    }
  ]

  for (const testCase of testCases) {
    console.log(`🧪 Testing: ${testCase.name}`)
    console.log(`   ${testCase.method} ${testCase.url}`)
    
    try {
      const result = await makeRequest(testCase.url, testCase.method, testCase.body, pat)
      
      if (result.success) {
        console.log(`   ✅ Success: ${result.statusCode} ${result.statusText}`)
        if (result.data && typeof result.data === 'object') {
          if (testCase.name === 'Basic WIQL Query' && result.data.workItems) {
            console.log(`   📊 Found ${result.data.workItems.length} work items`)
          } else if (testCase.name === 'Organization Info' && result.data.value) {
            console.log(`   📊 Found ${result.data.value.length} projects`)
          } else if (testCase.name === 'Project Info' && result.data.name) {
            console.log(`   📊 Project: ${result.data.name}`)
          }
        }
      } else {
        console.log(`   ❌ Failed: ${result.statusCode} ${result.statusText}`)
        console.log(`   📝 Response: ${result.error || 'No error details'}`)
      }
      
      console.log()
    } catch (error) {
      console.log(`   💥 Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.log()
    }
  }
}

interface RequestResult {
  success: boolean
  statusCode: number
  statusText: string
  data?: any
  error?: string
}

function makeRequest(url: string, method: string, body: string | null, pat: string): Promise<RequestResult> {
  return new Promise((resolve) => {
    const urlObj = new URL(url)
    const auth = Buffer.from(`:${pat}`).toString('base64')
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'User-Agent': 'azure-devops-bot-test/1.0.0',
        ...(body ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        } : {})
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        const success = res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300
        
        let parsedData: any = null
        try {
          if (data.trim()) {
            parsedData = JSON.parse(data)
          }
        } catch (e) {
          // Keep raw data if parsing fails
          parsedData = data
        }
        
        resolve({
          success,
          statusCode: res.statusCode || 0,
          statusText: res.statusMessage || '',
          data: parsedData,
          error: success ? undefined : data
        })
      })
    })

    req.on('error', (error) => {
      resolve({
        success: false,
        statusCode: 0,
        statusText: 'Request Error',
        error: error.message
      })
    })

    if (body) {
      req.write(body)
    }
    req.end()
  })
}

// Run the test
testPATAuthentication()
  .then(() => {
    console.log('🏁 PAT authentication test completed')
  })
  .catch((error) => {
    console.error('💥 Test script failed:', error)
    process.exit(1)
  })
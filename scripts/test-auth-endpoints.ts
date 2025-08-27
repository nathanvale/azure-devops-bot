#!/usr/bin/env tsx
import axios from 'axios'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const PAT = process.env.AZURE_DEVOPS_PAT
const ORG = process.env.AZURE_DEVOPS_ORG || 'fwcdev'
const PROJECT = process.env.AZURE_DEVOPS_PROJECT || 'Customer Services Platform'

if (!PAT) {
  console.error('❌ AZURE_DEVOPS_PAT not found in environment')
  process.exit(1)
}

console.log('\n🔍 Testing Azure DevOps Authentication')
console.log('=' .repeat(50))
console.log(`Organization: ${ORG}`)
console.log(`Project: ${PROJECT}`)
console.log(`PAT length: ${PAT.length} characters`)
console.log('=' .repeat(50))

const encodedPat = Buffer.from(`:${PAT}`).toString('base64')
const headers = {
  Authorization: `Basic ${encodedPat}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

async function testEndpoint(name: string, url: string) {
  console.log(`\n📍 Testing: ${name}`)
  console.log(`   URL: ${url}`)
  
  try {
    const response = await axios.get(url, {
      headers,
      timeout: 10000,
    })
    console.log(`   ✅ Success: Status ${response.status}`)
    if (response.data?.value) {
      console.log(`   📊 Data: Found ${response.data.value.length} items`)
    }
    return true
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.response?.status || error.code} - ${error.response?.statusText || error.message}`)
    if (error.response?.data) {
      console.log(`   💬 Message: ${JSON.stringify(error.response.data).substring(0, 200)}`)
    }
    return false
  }
}

async function runTests() {
  // Test various endpoints to understand the correct URL structure
  const endpoints = [
    {
      name: 'Profile (User Info)',
      url: `https://dev.azure.com/${ORG}/_apis/profile/profiles/me?api-version=7.0`
    },
    {
      name: 'Projects List',
      url: `https://dev.azure.com/${ORG}/_apis/projects?api-version=7.0`
    },
    {
      name: 'Specific Project',
      url: `https://dev.azure.com/${ORG}/_apis/projects/${encodeURIComponent(PROJECT)}?api-version=7.0`
    },
    {
      name: 'Project with Path in URL (WRONG)',
      url: `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJECT)}/_apis/projects?api-version=7.0`
    },
    {
      name: 'Work Items Query',
      url: `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJECT)}/_apis/wit/wiql?api-version=7.0`
    },
    {
      name: 'Connection Data',
      url: `https://dev.azure.com/${ORG}/_apis/connectionData?api-version=7.0`
    }
  ]

  let successCount = 0
  for (const endpoint of endpoints) {
    const success = await testEndpoint(endpoint.name, endpoint.url)
    if (success) successCount++
  }

  console.log('\n' + '=' .repeat(50))
  console.log(`📈 Results: ${successCount}/${endpoints.length} endpoints succeeded`)
  
  if (successCount === 0) {
    console.log('\n⚠️  PAT might be invalid or expired')
    console.log('💡 Verify your PAT has the required permissions:')
    console.log('   - Work Items (Read)')
    console.log('   - Project and Team (Read)')
  }
}

runTests().catch(console.error)
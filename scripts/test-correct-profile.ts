#!/usr/bin/env tsx
import axios from 'axios'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const PAT = process.env.AZURE_DEVOPS_PAT
const ORG = process.env.AZURE_DEVOPS_ORG || 'fwcdev'

if (!PAT) {
  console.error('❌ AZURE_DEVOPS_PAT not found in environment')
  process.exit(1)
}

console.log('\n🔍 Finding correct profile/user endpoint')
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
    const data = response.data
    
    // Try to find user info in the response
    if (data?.authenticatedUser) {
      console.log(`   👤 User: ${data.authenticatedUser.providerDisplayName || data.authenticatedUser.subjectDescriptor}`)
    }
    if (data?.authorizedUser) {
      console.log(`   👤 User: ${data.authorizedUser.providerDisplayName || data.authorizedUser.id}`)
    }
    if (data?.displayName) {
      console.log(`   👤 Display Name: ${data.displayName}`)
    }
    if (data?.emailAddress) {
      console.log(`   📧 Email: ${data.emailAddress}`)
    }
    if (data?.publicAlias) {
      console.log(`   🏷️ Public Alias: ${data.publicAlias}`)
    }
    
    return { success: true, data }
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.response?.status || error.code} - ${error.response?.statusText || error.message}`)
    return { success: false }
  }
}

async function runTests() {
  // Try various profile/user endpoints
  const endpoints = [
    {
      name: 'VSSPs Profile API',
      url: `https://vssps.dev.azure.com/${ORG}/_apis/profile/profiles/me?api-version=7.1-preview.3`
    },
    {
      name: 'Graph User API',
      url: `https://vssps.dev.azure.com/${ORG}/_apis/graph/users?api-version=7.1-preview.1`
    },
    {
      name: 'Connection Data (with preview)',
      url: `https://dev.azure.com/${ORG}/_apis/connectionData?api-version=7.1-preview`
    },
    {
      name: 'Accounts API',
      url: `https://app.vssps.visualstudio.com/_apis/accounts?api-version=7.1-preview.1`
    }
  ]

  console.log('\nTrying different profile endpoints...')
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.name, endpoint.url)
    if (result.success && result.data) {
      console.log(`   📝 Full response structure:`)
      console.log(JSON.stringify(result.data, null, 2).substring(0, 500))
    }
  }
}

runTests().catch(console.error)
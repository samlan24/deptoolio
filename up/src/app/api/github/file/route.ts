import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

// Function to search for package.json files in the repository
async function findPackageJsonFiles(owner: string, repo: string, token: string) {
  const response = await fetch(
    `https://api.github.com/search/code?q=filename:package.json+repo:${owner}/${repo}`,
    {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'dependency-scanner/1.0'
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`)
  }

  const searchResult = await response.json()
  return searchResult.items || []
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const owner = searchParams.get('owner')
    const repo = searchParams.get('repo')

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Owner and repo are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.provider_token) {
      return NextResponse.json({ error: 'GitHub token not found' }, { status: 401 })
    }

    const packageJsonFiles = await findPackageJsonFiles(owner, repo, session.provider_token)

    return NextResponse.json({ files: packageJsonFiles })
  } catch (error) {
    console.error('Error searching for package.json files:', error)
    return NextResponse.json({ error: 'Failed to search for package.json files' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { owner, repo, path = 'package.json' } = await request.json()

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Owner and repo are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.provider_token) {
      return NextResponse.json({ error: 'GitHub token not found' }, { status: 401 })
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          'Authorization': `token ${session.provider_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'dependency-scanner/1.0'
        }
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'package.json not found at this path' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to fetch file' }, { status: response.status })
    }

    const fileData = await response.json()

    if (fileData.type !== 'file') {
      return NextResponse.json({ error: 'Path is not a file' }, { status: 400 })
    }

    // Decode base64 content
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8')

    return NextResponse.json({ content, sha: fileData.sha, path })
  } catch (error) {
    console.error('Error fetching file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
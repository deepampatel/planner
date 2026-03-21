const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080'

async function proxyRequest(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const pathStr = path.join('/')
  const url = new URL(`/api/${pathStr}`, BACKEND_URL)

  const incomingUrl = new URL(request.url)
  url.search = incomingUrl.search

  const headers = new Headers(request.headers)
  headers.delete('host')

  const response = await fetch(url.toString(), {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.text()
      : undefined,
    cache: 'no-store',
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

export const GET = proxyRequest
export const POST = proxyRequest
export const PUT = proxyRequest
export const DELETE = proxyRequest

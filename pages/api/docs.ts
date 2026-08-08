import type { NextApiRequest, NextApiResponse } from 'next'
import { apiError } from '../../lib/apiAuth'

const errorResponses = {
  '400': { description: 'Invalid pagination', content: { 'application/json': { example: { error: { code: 'INVALID_PAGINATION', message: 'limit must be a positive integer' } } } } },
  '401': { description: 'Missing, malformed, invalid, or revoked API key' },
  '403': { description: 'Insufficient scope or workspace access denied' },
  '409': { description: 'Multiple workspaces exist; send x-team-id' },
  '429': { description: 'Rate limit exceeded; inspect Retry-After' },
  '405': { description: 'Method not allowed; these v1 endpoints are read-only' },
  '500': { description: 'The request could not be completed' },
  '503': { description: 'Request denied because durable quota storage is unavailable or secure API cursor signing is not configured' },
}

const paginatedParameters = [
  { name: 'limit', in: 'query', schema: { type: 'integer', default: 25, minimum: 1, maximum: 100 }, description: 'Results per page; values over 100 are capped at 100.' },
  { name: 'cursor', in: 'query', schema: { type: 'string' }, description: 'Pass the previous response pagination.nextCursor value unchanged. Cursors are signed, opaque, and bound to this endpoint and selected workspace.' },
  { name: 'x-team-id', in: 'header', schema: { type: 'string' }, description: 'Required when the key owner can access multiple workspaces.' },
]

const listOperation = (summary: string, path: string) => ({
  summary,
  security: [{ bearerAuth: [] }],
  parameters: paginatedParameters,
  responses: { '200': { description: 'A stable, ascending-ID cursor page with safe fields and pagination.nextCursor.' }, ...errorResponses },
  'x-codeSamples': [{ lang: 'Shell', label: 'curl', source: `curl -H "Authorization: Bearer $FLEETVERA_API_KEY" -H "x-team-id: $FLEETVERA_TEAM_ID" "https://fleetvera.ashbi.ca${path}?limit=25"` }],
})

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return apiError(res, 405, 'METHOD_NOT_ALLOWED', 'This endpoint supports GET only')
  }
  return res.status(200).json({
    openapi: '3.1.0',
    info: {
      title: 'Fleetvera Read API', version: '1.0.0',
      description: 'Read-only v1 API. Create a key in Settings > API Keys; its plaintext is shown once. Newly created keys have the read scope; historical empty-scope keys remain inert. Requests are limited to 100 requests per minute per API key in a fixed UTC-minute window using a durable database counter shared across workers. A quota-storage failure is denied with 503. API errors use { error: { code, message } }. Selecting a team returns only rows assigned to that team; it never merges legacy unassigned owner rows. This file is served by pages/api/docs.ts because a .tsx file under pages/api is also an API handler, not a human page.',
    },
    servers: [{ url: 'https://fleetvera.ashbi.ca' }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'ff_<64-character-hex-token>', description: 'Authorization: Bearer <API key>' } },
    },
    paths: {
      '/api/v1/me': { get: {
        summary: 'Describe the authenticated caller, selected workspace, and scopes', security: [{ bearerAuth: [] }],
        parameters: [paginatedParameters[2]], responses: { '200': { description: 'Caller context; never includes key material.' }, ...errorResponses },
        'x-codeSamples': [{ lang: 'Shell', label: 'curl', source: 'curl -H "Authorization: Bearer $FLEETVERA_API_KEY" -H "x-team-id: $FLEETVERA_TEAM_ID" https://fleetvera.ashbi.ca/api/v1/me' }],
      } },
      '/api/v1/vehicles': { get: listOperation('List vehicles', '/api/v1/vehicles') },
      '/api/v1/maintenance': { get: listOperation('List maintenance tasks', '/api/v1/maintenance') },
      '/api/v1/deliveries': { get: listOperation('List deliveries', '/api/v1/deliveries') },
    },
  })
}

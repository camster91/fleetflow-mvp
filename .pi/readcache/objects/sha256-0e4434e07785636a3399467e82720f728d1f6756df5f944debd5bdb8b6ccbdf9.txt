import type { NextApiRequest, NextApiResponse } from 'next'

// This API route is deprecated - use /auth/callback page instead
// Redirect to the new callback page handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Redirect to the new callback page
  const query = new URLSearchParams(req.query as Record<string, string>)
  res.redirect(`/auth/callback?${query.toString()}`)
}

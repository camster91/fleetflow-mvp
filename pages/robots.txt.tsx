import type { GetServerSideProps } from 'next'

const robotsTxt = `User-agent: *
Allow: /

Sitemap: https://fleet.ashbi.ca/sitemap.xml
`

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader('Content-Type', 'text/plain')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate')
  res.write(robotsTxt)
  res.end()
  return { props: {} }
}

export default function Robots() {
  return null
}

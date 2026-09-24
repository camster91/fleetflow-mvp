export const LOCAL_BASE_URL = 'http://localhost:3000';
const PRODUCTION_HOSTS = ['fleet.ashbi.ca'];

/**
 * Resolve the Playwright target. Without PLAYWRIGHT_TEST_BASE_URL the suite
 * runs against a locally started server; remote targets must be explicit, and
 * production hosts additionally require PLAYWRIGHT_ALLOW_PRODUCTION=1.
 */
export function resolveBaseURL(env: Record<string, string | undefined> = process.env): { baseURL: string; remote: boolean } {
  const configured = env.PLAYWRIGHT_TEST_BASE_URL?.trim();
  if (!configured) return { baseURL: LOCAL_BASE_URL, remote: false };
  let host: string;
  try {
    host = new URL(configured).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    throw new Error(`PLAYWRIGHT_TEST_BASE_URL is not a valid URL: ${configured}`);
  }
  const isProduction = PRODUCTION_HOSTS.some((prod) => host === prod || host.endsWith(`.${prod}`));
  if (isProduction && env.PLAYWRIGHT_ALLOW_PRODUCTION !== '1') {
    throw new Error(
      `Refusing to run Playwright against production (${host}). Set PLAYWRIGHT_ALLOW_PRODUCTION=1 to override deliberately.`
    );
  }
  return { baseURL: configured, remote: true };
}

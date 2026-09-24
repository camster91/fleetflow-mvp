/*
 * Cross-platform helpers for the disposable-PostgreSQL QA harnesses
 * (verify-integration-migrations, run-release-e2e, run-intelligence-integrated-qa).
 * Every harness owns its containers, ports, secrets, and cleanup; none of them
 * may target a user or production database.
 *
 * CONTAINER_RUNTIME selects the container CLI (default: docker; podman works).
 */
const { spawn, spawnSync } = require('child_process')
const { existsSync, rmSync } = require('fs')
const os = require('os')
const path = require('path')

const isWindows = process.platform === 'win32'
const containerRuntime = process.env.CONTAINER_RUNTIME || 'docker'

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Run a command synchronously; returns { status, stdout }. Output is inherited unless captured. */
function run(command, args, { input, capture = false, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    env,
    input,
    encoding: 'utf8',
    // Windows needs a shell to resolve npm/npx .cmd shims.
    shell: isWindows && (command === 'npm' || command === 'npx'),
    stdio: [input === undefined ? 'inherit' : 'pipe', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'],
  })
  if (result.error) throw result.error
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' }
}

function runOrThrow(command, args, message, options) {
  const result = run(command, args, options)
  if (result.status !== 0) throw new Error(message)
  return result
}

function container(args, options) {
  return run(containerRuntime, args, options)
}

function removeContainers(...names) {
  spawnSync(containerRuntime, ['rm', '-f', ...names], { stdio: 'ignore' })
}

/**
 * Start a disposable postgres:16-alpine bound to loopback only. It uses trust
 * auth, so connection URLs carry no password.
 */
function startPostgres({ name, port, bindHost = '127.0.0.1', user, database }) {
  const envArgs = []
  if (user) envArgs.push('-e', `POSTGRES_USER=${user}`)
  envArgs.push('-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', `POSTGRES_DB=${database}`)
  const result = container(['run', '--name', name, ...envArgs, '-p', `${bindHost}:${port}:5432`, '-d', 'postgres:16-alpine'], { capture: true })
  if (result.status !== 0) throw new Error(`Could not start disposable PostgreSQL ${name}: ${result.stderr.trim()}`)
}

function waitPostgres(name, { user, database, attempts }) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (container(['exec', name, 'pg_isready', '-U', user, '-d', database], { capture: true }).status === 0) return
    sleep(500)
  }
  throw new Error(`${name} did not become ready`)
}

/** Pipe SQL into psql inside the container and return stdout. */
function psql(name, { user, database, sql, extraArgs = [] }) {
  const result = container(['exec', '-i', name, 'psql', '-U', user, '-d', database, ...extraArgs], { input: sql, capture: true })
  if (result.stderr.trim()) process.stderr.write(result.stderr)
  return result
}

function npx(args, message, env) {
  return runOrThrow('npx', args, message || `Command failed: npx ${args.join(' ')}`, { env })
}

/** Start an npm process in its own process group so the whole tree can be stopped. */
function startNpm(args, env) {
  return spawn(isWindows ? 'npm.cmd' : 'npm', args, {
    cwd: process.cwd(),
    env,
    stdio: 'ignore',
    detached: !isWindows,
    shell: isWindows,
    windowsHide: true,
  })
}

function stopProcessTree(child) {
  if (!child) return
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }
  try { process.kill(-child.pid, 'SIGKILL') } catch { /* already exited */ }
}

/** Poll a URL until it returns a 2xx response (like Invoke-WebRequest). Returns false if it never did. */
async function waitForHttp(url, attempts) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (response.ok) return true
    } catch { /* not ready */ }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return false
}

/** Remove a harness temp directory, but only if it is inside the OS temp dir and matches the prefix. */
function removeTempDir(directory, prefix) {
  const resolved = path.resolve(directory)
  const tempRoot = path.resolve(os.tmpdir())
  if (resolved.startsWith(tempRoot + path.sep) && path.basename(resolved).startsWith(prefix) && existsSync(resolved)) {
    rmSync(resolved, { recursive: true, force: true })
  }
}

function parseFlags(argv, spec) {
  const values = { ...spec.defaults }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const key = argument.replace(/^--/, '')
    if (!argument.startsWith('--') || !(key in spec.types)) throw new Error(`Unknown argument: ${argument}`)
    if (spec.types[key] === 'boolean') {
      values[key] = true
    } else {
      const value = Number(argv[index + 1])
      if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`${argument} expects a port number`)
      values[key] = value
      index += 1
    }
  }
  return values
}

function main(fn) {
  fn().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}

module.exports = {
  container,
  main,
  npx,
  parseFlags,
  psql,
  removeContainers,
  removeTempDir,
  run,
  runOrThrow,
  sleep,
  startNpm,
  startPostgres,
  stopProcessTree,
  waitForHttp,
  waitPostgres,
}

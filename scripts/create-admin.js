#!/usr/bin/env node

/**
 * Compatibility entrypoint.
 *
 * The authoritative administrator bootstrap lives at ../create-admin.js. It
 * requires an explicit email and confirmation, refuses non-empty databases,
 * and preserves the application's passwordless authentication model.
 */
require('../create-admin.js')

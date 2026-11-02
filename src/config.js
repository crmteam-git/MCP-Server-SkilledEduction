import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Load .env from the project root, not the cwd: MCP clients (Claude Desktop,
// Claude Code) usually launch the server from some other directory.
const envPath = join(import.meta.dirname, '..', '.env');
if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
}

function readBool(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

export const config = {
    accessToken: process.env.HUBSPOT_ACCESS_TOKEN?.trim() ?? '',
    baseUrl: (process.env.HUBSPOT_BASE_URL?.trim() || 'https://api.hubapi.com').replace(/\/+$/, ''),
    // When true, only read-only tools are registered.
    readOnly: readBool('HUBSPOT_READ_ONLY', false),
    requestTimeoutMs: Number(process.env.HUBSPOT_TIMEOUT_MS) || 30_000,
    maxRetries: Number(process.env.HUBSPOT_MAX_RETRIES) || 3
};

export function assertConfig() {
    if (!config.accessToken) {
        throw new Error(
            'HUBSPOT_ACCESS_TOKEN is not set. Create a HubSpot private app, copy its access token, ' +
                'and put it in .env (see .env.example) or in your MCP client config.'
        );
    }
}

#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { assertConfig, config } from './src/config.js';
import { createServer } from './src/server.js';

// stdout carries the MCP protocol, so all logging goes to stderr.
try {
    assertConfig();
} catch (error) {
    console.error(`[hubspot-mcp] ${error.message}`);
    process.exit(1);
}

serveStdio(createServer, {
    onerror: error => console.error('[hubspot-mcp] error:', error)
});

console.error(`[hubspot-mcp] running on stdio${config.readOnly ? ' (read-only mode)' : ''}`);

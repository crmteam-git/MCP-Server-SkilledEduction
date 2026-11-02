import { z } from 'zod';
import { HubSpotError } from '../hubspot/client.js';

export const objectType = z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/, 'Object type may only contain letters, digits, "_" and "-"')
    .describe(
        'CRM object type: contacts, companies, deals, tickets, products, line_items, quotes, ' +
            'calls, emails, meetings, notes, tasks, or a custom object type ID such as "2-1234567".'
    );

export const recordId = z.string().regex(/^\d+$/, 'Record IDs are numeric').describe('HubSpot record ID');

export const propertyList = z
    .array(z.string())
    .optional()
    .describe('Property names to return. Omit to get HubSpot defaults for the object type.');

export const limit = (max, fallback) =>
    z.number().int().min(1).max(max).default(fallback).describe(`Page size (1-${max})`);

export const after = z.string().optional().describe('Paging cursor from the previous response (paging.next.after)');

export const propertiesInput = z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .describe('Property name/value pairs, e.g. { "email": "jane@example.com", "firstname": "Jane" }');

export function ok(data) {
    return { content: [{ type: 'text', text: JSON.stringify(data ?? { success: true }, null, 2) }] };
}

export function fail(error) {
    const payload =
        error instanceof HubSpotError
            ? {
                  error: error.message,
                  status: error.status,
                  category: error.category,
                  correlationId: error.correlationId,
                  details: error.details
              }
            : { error: error?.message ?? String(error) };
    return { isError: true, content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

/** Wraps a tool handler so HubSpot/network errors come back as tool errors instead of crashing the call. */
export const handle = fn => async args => {
    try {
        return ok(await fn(args));
    } catch (error) {
        return fail(error);
    }
};

export const READ = { readOnlyHint: true, openWorldHint: true };
export const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
export const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: true };

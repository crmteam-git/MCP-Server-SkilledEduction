import { z } from 'zod';
import { hubspot, seg } from '../hubspot/client.js';
import { READ, after, handle, limit, objectType } from './shared.js';

export function registerMetadataTools(server) {
    server.registerTool(
        'hubspot_get_account_info',
        {
            title: 'Get account info',
            description: 'Get details of the connected HubSpot account (portal ID, time zone, currency, data hosting).',
            inputSchema: z.object({}),
            annotations: READ
        },
        handle(() => hubspot.get('/account-info/v3/details'))
    );

    server.registerTool(
        'hubspot_list_properties',
        {
            title: 'List object properties',
            description:
                'List property definitions for an object type: internal names, labels, types and allowed ' +
                'enumeration options. Call this before creating or updating records.',
            inputSchema: z.object({
                objectType,
                nameContains: z.string().optional().describe('Only return properties whose name or label contains this text'),
                includeOptions: z.boolean().default(true).describe('Include enumeration options')
            }),
            annotations: READ
        },
        handle(async ({ objectType, nameContains, includeOptions }) => {
            const { results } = await hubspot.get(`/crm/v3/properties/${seg(objectType)}`);
            const needle = nameContains?.toLowerCase();
            return results
                .filter(p => !needle || p.name.toLowerCase().includes(needle) || p.label?.toLowerCase().includes(needle))
                .map(p => ({
                    name: p.name,
                    label: p.label,
                    type: p.type,
                    fieldType: p.fieldType,
                    groupName: p.groupName,
                    readOnly: p.modificationMetadata?.readOnlyValue ?? false,
                    ...(includeOptions && p.options?.length && { options: p.options.map(o => ({ label: o.label, value: o.value })) })
                }));
        })
    );

    server.registerTool(
        'hubspot_list_pipelines',
        {
            title: 'List pipelines and stages',
            description: 'List pipelines and their stage IDs for deals or tickets.',
            inputSchema: z.object({ objectType: z.enum(['deals', 'tickets']) }),
            annotations: READ
        },
        handle(async ({ objectType }) => {
            const { results } = await hubspot.get(`/crm/v3/pipelines/${seg(objectType)}`);
            return results.map(p => ({
                id: p.id,
                label: p.label,
                archived: p.archived,
                stages: p.stages
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map(s => ({ id: s.id, label: s.label, metadata: s.metadata }))
            }));
        })
    );

    server.registerTool(
        'hubspot_list_owners',
        {
            title: 'List owners',
            description: 'List HubSpot users who can own records (use the id as hubspot_owner_id).',
            inputSchema: z.object({
                email: z.string().optional().describe('Filter by owner email'),
                archived: z.boolean().default(false),
                limit: limit(500, 100),
                after
            }),
            annotations: READ
        },
        handle(query => hubspot.get('/crm/v3/owners/', query))
    );
}

import { z } from 'zod';
import { hubspot, seg } from '../hubspot/client.js';
import {
    DESTRUCTIVE,
    READ,
    WRITE,
    after,
    handle,
    limit,
    objectType,
    propertiesInput,
    propertyList,
    recordId
} from './shared.js';

const filter = z.object({
    propertyName: z.string(),
    operator: z.enum([
        'EQ',
        'NEQ',
        'LT',
        'LTE',
        'GT',
        'GTE',
        'BETWEEN',
        'IN',
        'NOT_IN',
        'HAS_PROPERTY',
        'NOT_HAS_PROPERTY',
        'CONTAINS_TOKEN',
        'NOT_CONTAINS_TOKEN'
    ]),
    value: z.union([z.string(), z.number(), z.boolean()]).optional().describe('Used by most operators'),
    highValue: z.union([z.string(), z.number()]).optional().describe('Upper bound for BETWEEN'),
    values: z.array(z.union([z.string(), z.number()])).optional().describe('Used by IN / NOT_IN')
});

export function registerCrmTools(server, { readOnly }) {
    server.registerTool(
        'hubspot_search_objects',
        {
            title: 'Search CRM records',
            description:
                'Search HubSpot CRM records of one object type. Filters inside a filter group are ANDed; ' +
                'filter groups are ORed. "query" does a free-text search across default searchable properties. ' +
                'Dates are compared as millisecond timestamps or ISO strings.',
            inputSchema: z.object({
                objectType,
                query: z.string().optional().describe('Free-text search string'),
                filterGroups: z
                    .array(z.object({ filters: z.array(filter).min(1) }))
                    .max(5)
                    .optional(),
                sorts: z
                    .array(z.object({ propertyName: z.string(), direction: z.enum(['ASCENDING', 'DESCENDING']) }))
                    .optional(),
                properties: propertyList,
                limit: limit(200, 20),
                after
            }),
            annotations: READ
        },
        handle(({ objectType, query, filterGroups, sorts, properties, limit, after }) =>
            hubspot.post(`/crm/v3/objects/${seg(objectType)}/search`, {
                query,
                filterGroups: filterGroups ?? [],
                sorts,
                properties,
                limit,
                after
            })
        )
    );

    server.registerTool(
        'hubspot_list_objects',
        {
            title: 'List CRM records',
            description: 'Page through all records of a CRM object type (use hubspot_search_objects to filter).',
            inputSchema: z.object({
                objectType,
                properties: propertyList,
                associations: z.array(z.string()).optional().describe('Object types whose associated IDs to include'),
                archived: z.boolean().default(false),
                limit: limit(100, 20),
                after
            }),
            annotations: READ
        },
        handle(({ objectType, ...query }) => hubspot.get(`/crm/v3/objects/${seg(objectType)}`, query))
    );

    server.registerTool(
        'hubspot_get_object',
        {
            title: 'Get CRM record',
            description:
                'Get one CRM record by ID, or by a unique property via idProperty (e.g. idProperty "email" for contacts).',
            inputSchema: z.object({
                objectType,
                id: z.string().min(1).describe('Record ID, or the unique value when idProperty is set'),
                idProperty: z.string().optional().describe('Unique property to look up by, e.g. "email"'),
                properties: propertyList,
                associations: z.array(z.string()).optional().describe('Object types whose associated IDs to include')
            }),
            annotations: READ
        },
        handle(({ objectType, id, ...query }) => hubspot.get(`/crm/v3/objects/${seg(objectType)}/${seg(id)}`, query))
    );

    server.registerTool(
        'hubspot_batch_read_objects',
        {
            title: 'Batch read CRM records',
            description: 'Read up to 100 CRM records of one type in a single call.',
            inputSchema: z.object({
                objectType,
                ids: z.array(z.string().min(1)).min(1).max(100),
                idProperty: z.string().optional().describe('Unique property the ids refer to, e.g. "email"'),
                properties: propertyList
            }),
            annotations: READ
        },
        handle(({ objectType, ids, idProperty, properties }) =>
            hubspot.post(`/crm/v3/objects/${seg(objectType)}/batch/read`, {
                inputs: ids.map(id => ({ id })),
                idProperty,
                properties: properties ?? []
            })
        )
    );

    if (readOnly) return;

    server.registerTool(
        'hubspot_create_object',
        {
            title: 'Create CRM record',
            description:
                'Create a CRM record. Use hubspot_list_properties first to find valid property names and ' +
                'enumeration values. Deals need dealname, pipeline and dealstage; tickets need subject, ' +
                'hs_pipeline and hs_pipeline_stage (see hubspot_list_pipelines).',
            inputSchema: z.object({ objectType, properties: propertiesInput }),
            annotations: WRITE
        },
        handle(({ objectType, properties }) => hubspot.post(`/crm/v3/objects/${seg(objectType)}`, { properties }))
    );

    server.registerTool(
        'hubspot_update_object',
        {
            title: 'Update CRM record',
            description: 'Update properties on an existing CRM record. Only the given properties change.',
            inputSchema: z.object({
                objectType,
                id: recordId,
                properties: propertiesInput
            }),
            annotations: { ...WRITE, idempotentHint: true }
        },
        handle(({ objectType, id, properties }) =>
            hubspot.patch(`/crm/v3/objects/${seg(objectType)}/${seg(id)}`, { properties })
        )
    );

    server.registerTool(
        'hubspot_archive_object',
        {
            title: 'Archive (delete) CRM record',
            description: 'Archive a CRM record (moves it to the HubSpot recycle bin, restorable for 90 days).',
            inputSchema: z.object({ objectType, id: recordId }),
            annotations: DESTRUCTIVE
        },
        handle(async ({ objectType, id }) => {
            await hubspot.delete(`/crm/v3/objects/${seg(objectType)}/${seg(id)}`);
            return { success: true, archived: { objectType, id } };
        })
    );
}

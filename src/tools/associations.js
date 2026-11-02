import { z } from 'zod';
import { hubspot, seg } from '../hubspot/client.js';
import { DESTRUCTIVE, READ, WRITE, after, handle, limit, objectType, recordId } from './shared.js';

export function registerAssociationTools(server, { readOnly }) {
    server.registerTool(
        'hubspot_list_associations',
        {
            title: 'List associated records',
            description: 'List the records of one object type associated with a given record (e.g. a contact\'s deals).',
            inputSchema: z.object({
                fromObjectType: objectType,
                fromId: recordId,
                toObjectType: objectType,
                limit: limit(500, 100),
                after
            }),
            annotations: READ
        },
        handle(({ fromObjectType, fromId, toObjectType, limit, after }) =>
            hubspot.get(
                `/crm/v4/objects/${seg(fromObjectType)}/${seg(fromId)}/associations/${seg(toObjectType)}`,
                { limit, after }
            )
        )
    );

    if (readOnly) return;

    server.registerTool(
        'hubspot_associate_objects',
        {
            title: 'Associate two records',
            description: 'Create the default (unlabeled) association between two records, e.g. a contact and a company.',
            inputSchema: z.object({
                fromObjectType: objectType,
                fromId: recordId,
                toObjectType: objectType,
                toId: recordId
            }),
            annotations: { ...WRITE, idempotentHint: true }
        },
        handle(({ fromObjectType, fromId, toObjectType, toId }) =>
            hubspot.put(
                `/crm/v4/objects/${seg(fromObjectType)}/${seg(fromId)}/associations/default/${seg(toObjectType)}/${seg(toId)}`
            )
        )
    );

    server.registerTool(
        'hubspot_remove_association',
        {
            title: 'Remove association',
            description: 'Remove all associations between two records. The records themselves are not deleted.',
            inputSchema: z.object({
                fromObjectType: objectType,
                fromId: recordId,
                toObjectType: objectType,
                toId: recordId
            }),
            annotations: DESTRUCTIVE
        },
        handle(async ({ fromObjectType, fromId, toObjectType, toId }) => {
            await hubspot.delete(
                `/crm/v4/objects/${seg(fromObjectType)}/${seg(fromId)}/associations/${seg(toObjectType)}/${seg(toId)}`
            );
            return { success: true };
        })
    );
}

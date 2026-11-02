import { z } from 'zod';
import { hubspot, seg } from '../hubspot/client.js';
import { WRITE, handle, recordId } from './shared.js';

const associateWith = z
    .array(
        z.object({
            objectType: z.enum(['contacts', 'companies', 'deals', 'tickets']),
            id: recordId
        })
    )
    .default([])
    .describe('Records to attach this engagement to');

async function createEngagement(engagementType, properties, targets) {
    const engagement = await hubspot.post(`/crm/v3/objects/${engagementType}`, { properties });
    for (const target of targets) {
        await hubspot.put(
            `/crm/v4/objects/${engagementType}/${seg(engagement.id)}/associations/default/${seg(target.objectType)}/${seg(target.id)}`
        );
    }
    return { ...engagement, associatedWith: targets };
}

export function registerEngagementTools(server, { readOnly }) {
    if (readOnly) return;

    server.registerTool(
        'hubspot_create_note',
        {
            title: 'Create note',
            description: 'Add a note to the timeline of one or more contacts, companies, deals or tickets.',
            inputSchema: z.object({
                body: z.string().min(1).describe('Note text (basic HTML allowed)'),
                timestamp: z.string().optional().describe('ISO 8601 time the note refers to. Defaults to now.'),
                ownerId: z.string().optional().describe('hubspot_owner_id to assign'),
                associateWith
            }),
            annotations: WRITE
        },
        handle(({ body, timestamp, ownerId, associateWith }) =>
            createEngagement(
                'notes',
                {
                    hs_note_body: body,
                    hs_timestamp: timestamp ?? new Date().toISOString(),
                    ...(ownerId && { hubspot_owner_id: ownerId })
                },
                associateWith
            )
        )
    );

    server.registerTool(
        'hubspot_create_task',
        {
            title: 'Create task',
            description: 'Create a task, optionally assigned to an owner and attached to CRM records.',
            inputSchema: z.object({
                subject: z.string().min(1),
                body: z.string().optional(),
                dueDate: z.string().optional().describe('ISO 8601 due date/time. Defaults to now.'),
                status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'DEFERRED']).default('NOT_STARTED'),
                priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
                taskType: z.enum(['TODO', 'CALL', 'EMAIL']).default('TODO'),
                ownerId: z.string().optional().describe('hubspot_owner_id to assign'),
                associateWith
            }),
            annotations: WRITE
        },
        handle(({ subject, body, dueDate, status, priority, taskType, ownerId, associateWith }) =>
            createEngagement(
                'tasks',
                {
                    hs_task_subject: subject,
                    hs_timestamp: dueDate ?? new Date().toISOString(),
                    hs_task_status: status,
                    hs_task_type: taskType,
                    ...(body && { hs_task_body: body }),
                    ...(priority && { hs_task_priority: priority }),
                    ...(ownerId && { hubspot_owner_id: ownerId })
                },
                associateWith
            )
        )
    );
}

import { McpServer } from '@modelcontextprotocol/server';
import { config } from './config.js';
import { registerAssociationTools } from './tools/associations.js';
import { registerCrmTools } from './tools/crm.js';
import { registerEngagementTools } from './tools/engagements.js';
import { registerMetadataTools } from './tools/metadata.js';

export function createServer() {
    const server = new McpServer(
        { name: 'hubspot-mcp-server', version: '1.0.0' },
        {
            capabilities: { tools: {} },
            instructions:
                'Tools for the connected HubSpot CRM account. Before creating or updating records, call ' +
                'hubspot_list_properties to get exact property names and enumeration values, and ' +
                'hubspot_list_pipelines for deal/ticket pipeline and stage IDs. Use hubspot_search_objects ' +
                'to find records (e.g. a contact by email) before acting on them.'
        }
    );

    const options = { readOnly: config.readOnly };
    registerMetadataTools(server);
    registerCrmTools(server, options);
    registerAssociationTools(server, options);
    registerEngagementTools(server, options);

    return server;
}

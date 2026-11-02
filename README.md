# HubSpot MCP Server

An MCP (Model Context Protocol) server that connects Claude and other MCP clients to your HubSpot CRM. It runs over stdio and uses a HubSpot private app token.

## Project layout

```
index.js                  entry point (stdio transport)
src/config.js             loads .env and settings
src/server.js             builds the McpServer and registers tools
src/hubspot/client.js     HubSpot REST client (auth, retries on 429/5xx, errors)
src/tools/shared.js       shared zod schemas and result helpers
src/tools/metadata.js     account info, properties, pipelines, owners
src/tools/crm.js          search / list / get / batch read / create / update / archive
src/tools/associations.js list, create and remove associations
src/tools/engagements.js  create notes and tasks
```

## 1. Create a HubSpot private app

1. In HubSpot: **Settings → Integrations → Private Apps → Create a private app**.
2. Under **Scopes**, add the scopes for what you want the server to do:
   - `crm.objects.contacts.read` / `.write`
   - `crm.objects.companies.read` / `.write`
   - `crm.objects.deals.read` / `.write`
   - `tickets` (for tickets)
   - `crm.objects.owners.read` (for owners)
   - `crm.schemas.contacts.read`, `crm.schemas.companies.read`, `crm.schemas.deals.read` (for properties)
   - `crm.objects.custom.read` / `.write` (only if you use custom objects)
3. Create the app and copy the **access token**.

## 2. Configure

```bash
cp .env.example .env
# then edit .env and set HUBSPOT_ACCESS_TOKEN
npm install
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `HUBSPOT_ACCESS_TOKEN` | (required) | Private app token |
| `HUBSPOT_READ_ONLY` | `false` | `true` registers only read tools |
| `HUBSPOT_TIMEOUT_MS` | `30000` | Per-request timeout |
| `HUBSPOT_MAX_RETRIES` | `3` | Retries on 429 / 5xx / network errors |

## 3. Connect a client

**Claude Code**

```bash
claude mcp add hubspot -- node /Users/webguruztechnologies/Desktop/MCP_Server/index.js
```

**Claude Desktop**: add this to `~/Library/Application Support/Claude/claude_desktop_config.json` and restart the app:

```json
{
  "mcpServers": {
    "hubspot": {
      "command": "node",
      "args": ["/Users/webguruztechnologies/Desktop/MCP_Server/index.js"]
    }
  }
}
```

The server reads `.env` from its own folder, so you don't need to put the token in the client config. If you'd rather keep it there, add `"env": { "HUBSPOT_ACCESS_TOKEN": "..." }`.

**Test with MCP Inspector**: `npm run inspect`

## Tools

| Tool | What it does |
| --- | --- |
| `hubspot_get_account_info` | Portal ID, time zone, currency |
| `hubspot_list_properties` | Property names, types and dropdown options for an object type |
| `hubspot_list_pipelines` | Deal / ticket pipelines and stage IDs |
| `hubspot_list_owners` | Users who can own records |
| `hubspot_search_objects` | Search with filters, sorting and free text |
| `hubspot_list_objects` | Page through all records of a type |
| `hubspot_get_object` | Get one record by ID or unique property (e.g. email) |
| `hubspot_batch_read_objects` | Read up to 100 records at once |
| `hubspot_create_object` | Create a record * |
| `hubspot_update_object` | Update a record's properties * |
| `hubspot_archive_object` | Archive a record (recycle bin) * |
| `hubspot_list_associations` | Records associated with a record |
| `hubspot_associate_objects` | Associate two records * |
| `hubspot_remove_association` | Remove an association * |
| `hubspot_create_note` | Add a note to contacts/companies/deals/tickets * |
| `hubspot_create_task` | Create a task * |

\* Not registered when `HUBSPOT_READ_ONLY=true`.

All CRM tools take an `objectType`, so they work with contacts, companies, deals, tickets, products, line items, and custom objects (by type ID such as `2-1234567`).

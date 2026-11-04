# Telegram agent API: today's queue

## Endpoint

`GET /api/agent/v1/today-queue/`

The endpoint is read-only. It returns local CRM leads with either:

- a `next_contact_at` date equal to the CRM's local date; or
- an active, non-archived Kanban task linked through `Task.lead` whose deadline is on that local date.

Tasks linked only by a U-ON record ID and not by the local `Lead` relation are not included.

## Authentication and exposure

Send the dedicated API token in the `Authorization` header:

```http
Authorization: Bearer <AGENT_API_TOKEN>
```

The endpoint is disabled when `AGENT_API_TOKEN` is empty. Keep the same long random secret in the Russian CRM environment and the separate agent environment. Use HTTPS, restrict inbound access at the Russian server's firewall or reverse proxy to the agent's fixed outbound IP when available, and never put the token in a URL or logs. Rotate the token by updating both environments.

## Response fields

Each item contains:

- `request_number`: the local CRM `Lead.id`; it is not the tour operator's booking number or a U-ON ID.
- `client_name`: the CRM lead's display name.
- `tasks`: task IDs, titles, and due timestamps; the next-contact date is represented as a generic task.

Phone, email, address, full lead serializers, task descriptions, attachments, and comments are not returned.

Example:

```json
{
  "date": "2026-11-04",
  "items": [
    {
      "request_number": 142,
      "client_name": "Анна",
      "tasks": [
        {
          "task_id": 57,
          "title": "Передать информацию туроператору",
          "due_at": "2026-11-04T14:00:00+03:00"
        }
      ]
    }
  ]
}
```

The endpoint only reports work. Sending anything to a tour operator or changing a CRM record must be implemented as a separate write operation with an explicit confirmation step in the agent.

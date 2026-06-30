# Firestore Collections — Module 3 Dashboard + Module 4 Kanban

## Collection: `tasks`

Used by `/api/dashboard/metrics` to compute totals.

| Field       | Type      | Values / Notes                                      |
|-------------|-----------|-----------------------------------------------------|
| `title`     | string    | Task title                                          |
| `status`    | string    | `"todo"` \| `"in-progress"` \| `"completed"`        |
| `assignee`  | string    | UID of assigned user                                |
| `projectId` | string    | Reference to parent project                         |
| `createdAt` | Timestamp | Firestore server timestamp                          |
| `updatedAt` | Timestamp | Updated on every write                              |

> **Metrics logic:** a task counts as *completed* when `status === "completed"`;
> all other statuses count as *pending*.

---

## Collection: `activities`

Used by `/api/dashboard/activity` to render the recent-activity feed.

| Field         | Type      | Values / Notes                                                                     |
|---------------|-----------|------------------------------------------------------------------------------------|
| `type`        | string    | `"task_created"` \| `"task_updated"` \| `"task_completed"` \| `"task_deleted"` \| `"member_added"` \| `"comment"` |
| `message`     | string    | Human-readable description, e.g. `"Alice completed 'Fix login bug'"`               |
| `userId`      | string    | UID of the user who triggered the event                                            |
| `projectId`   | string    | Reference to the relevant project                                                  |
| `timestamp`   | Timestamp | Firestore server timestamp — used for ordering                                     |

> **Feed logic:** ordered by `timestamp desc`, limited to 10 documents.
> A Firestore composite index on `(timestamp DESC)` is required; create it
> via the Firebase Console or `firestore.indexes.json`.

---

## Firestore Index Required

```json
{
  "indexes": [
    {
      "collectionGroup": "activities",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Module 4 — Kanban additions to `tasks`

The M3 `tasks` schema is extended with these fields:

| Field          | Type      | Values / Notes                                                  |
|----------------|-----------|-----------------------------------------------------------------|
| `status`       | string    | `"todo"` \| `"in-progress"` \| `"review"` \| `"done"`          |
| `priority`     | string    | `"low"` \| `"medium"` \| `"high"` \| `"critical"`              |
| `description`  | string    | Optional free-text body                                         |
| `assigneeId`   | string    | UID of assigned team member (nullable)                          |
| `assigneeName` | string    | Display name of assignee (denormalised for read speed)          |
| `createdBy`    | string    | UID of the user who created the task                            |

### Additional Firestore Indexes Required

```json
{
  "indexes": [
    {
      "collectionGroup": "tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    }
  ]
}
```

## Module 4 — `activities` — new type values

In addition to M3 types, Module 4 writes these `type` values:

| type             | When logged                                  |
|------------------|----------------------------------------------|
| `task_created`   | POST /api/kanban/tasks                        |
| `task_updated`   | PATCH — title, description, priority, status |
| `task_completed` | PATCH — status set to `"done"`               |
| `task_deleted`   | DELETE /api/kanban/tasks/:id                  |

# Module 5 — Requirements Management

---

## Files Generated

| File | Location | Purpose |
|------|----------|---------|
| `backend/routes/requirements.js` | `backend/routes/requirements.js` | Express router — all CRUD endpoints |
| `frontend/js/requirements.js` | `frontend/js/requirements.js` | Frontend logic — rendering, modals, API calls |
| `frontend/css/requirements.css` | `frontend/css/requirements.css` | Scoped styles for the requirements UI |
| `frontend/requirements-html-snippet.html` | Reference only — paste into your project detail page | HTML structure (tabs, list area, modal) |

---

## server.js Integration

Add **one line** in `server.js` where the other route mounts are:

```js
// Existing mounts (example):
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/projects',  require('./routes/projects'));
app.use('/api/kanban',    require('./routes/kanban'));

// ← ADD THIS:
app.use('/api/requirements', require('./routes/requirements'));
```

The route file expects `req.user` (with `.uid` and `.role`) to be set by your existing auth middleware before this router runs — no changes needed to that middleware.

---

## Firestore Schema

### Collection: `requirements`

Each document represents one requirement (functional, non-functional, or feasibility item).

```
requirements/{requirementId}
  projectId          : string   — FK to projects collection
  type               : string   — "functional" | "non_functional" | "feasibility"
  title              : string   — required, max 200 chars
  description        : string   — optional free text
  priority           : string   — "high" | "medium" | "low"
  status             : string   — "draft" | "review" | "approved" | "rejected"
  createdBy          : string   — Firebase Auth UID
  createdAt          : Timestamp
  updatedAt          : Timestamp

  // Only present when type === "feasibility":
  feasibilityCategory: string   — "technical" | "operational" | "financial" | "schedule"
  score              : number   — 1–5 (supports decimals, e.g. 3.5), nullable
  notes              : string   — optional
```

### Recommended Firestore Indexes

The route queries by `projectId` + orders by `createdAt`. Add a **composite index**:

| Collection | Fields | Order |
|---|---|---|
| `requirements` | `projectId` ASC, `createdAt` ASC | — |
| `requirements` | `projectId` ASC, `type` ASC, `createdAt` ASC | — (for filtered queries) |

Create via Firebase Console → Firestore → Indexes → Composite, or add to `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "requirements",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "requirements",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "type",      "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### Activity Logs (existing collection)

Module 5 writes to the existing `activity_logs` collection using the same pattern as other modules:

```
activity_logs/{logId}
  projectId : string
  userId    : string
  action    : "REQUIREMENT_CREATED" | "REQUIREMENT_UPDATED" | "REQUIREMENT_DELETED"
  detail    : string   — e.g. 'Created functional requirement: "User login"'
  timestamp : Timestamp
```

---

## API Endpoints

Base path: `/api/requirements`

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/:projectId` | All authenticated | Fetch all requirements for a project |
| GET | `/:projectId?type=functional` | All authenticated | Filtered by type |
| GET | `/:projectId/:requirementId` | All authenticated | Single requirement |
| POST | `/:projectId` | admin, manager, member | Create a requirement |
| PUT | `/:projectId/:requirementId` | admin, manager, member | Update a requirement |
| DELETE | `/:projectId/:requirementId` | admin, manager | Delete a requirement |

> **Status change restriction:** Only `admin` and `manager` roles can set status to `approved` or `rejected`. Members can only move items to `draft` or `review`.

---

## Frontend Integration

### 1. Link the stylesheet

In the `<head>` of your project detail page:

```html
<link rel="stylesheet" href="/css/requirements.css">
```

### 2. Add the HTML

Paste the contents of `requirements-html-snippet.html` into the **Requirements tab panel** of your existing project detail page. The snippet provides:
- `.req-tabs` — the three sub-tabs (Functional / Non-Functional / Feasibility Study)
- `#req-list-container` — dynamic content area
- `#req-modal` — shared add/edit modal

### 3. Load the script and initialise

At the bottom of the page, after `api.js` is loaded:

```html
<script src="/js/requirements.js"></script>
<script>
  // currentProjectId and currentUser must already be in scope
  // from your existing project detail page setup.
  Requirements.init(currentProjectId, currentUser);
</script>
```

`currentUser` must be an object with at least `{ uid, role }`.

---

## Role-Based Behaviour Summary

| Action | viewer | member | manager | admin |
|--------|--------|--------|---------|-------|
| View requirements | ✓ | ✓ | ✓ | ✓ |
| Create / Edit | ✗ | ✓ | ✓ | ✓ |
| Approve / Reject status | ✗ | ✗ | ✓ | ✓ |
| Delete | ✗ | ✗ | ✓ | ✓ |

---

## UI Layout

```
[ Functional ] [ Non-Functional ] [ Feasibility Study ]   ← .req-tabs

[ Add Functional Requirement ]                            ← .req-toolbar

┌────────────────────────────────────────┐
│ Requirement Title              [High] [Draft] │  ← .req-card
│ Description text here…                       │
│ Added Jun 13, 2026       [Edit] [Delete]      │
└────────────────────────────────────────┘

Feasibility tab renders a table instead of cards:
┌────────┬──────────┬───────┬────────┬───────┬─────────┐
│ Title  │ Category │ Score │ Status │ Notes │ Actions │
└────────┴──────────┴───────┴────────┴───────┴─────────┘
```

---

## Conventions Maintained

- REST responses: `{ success: true, data: ... }` / `{ success: false, message: ... }`
- `api.js` used for all frontend HTTP calls (`api.get`, `api.post`, `api.put`, `api.delete`)
- Activity logging via `activity_logs` Firestore collection
- Role checks via `req.user.role` (set by existing auth middleware)
- Firestore via `firebase-admin` — same pattern as M3/M4
- No new dependencies introduced

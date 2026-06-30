# Module 6 — COCOMO Estimation

## Overview

Module 6 adds Basic COCOMO (Constructive Cost Model) estimation to the Software Project Management Tool. Users enter KLOC, project type, and team size; the system returns effort (person-months), duration (months), and required staffing (persons). All estimations are persisted in Firestore with full activity logging and role-based access control consistent with Modules 1–5.

---

## File Map

| File | Location in project | Purpose |
|---|---|---|
| `backend/routes/cocomo.js` | `backend/routes/cocomo.js` | Express router — 4 REST endpoints |
| `frontend/js/cocomo.js` | `frontend/js/cocomo.js` | UI logic, API calls, history rendering |
| `frontend/css/cocomo.css` | `frontend/css/cocomo.css` | Scoped styles; inherits main.css variables |
| `cocomo-html-snippet.html` | paste into your page template | Markup for the COCOMO section |
| `module6-cocomo.md` | `docs/module6-cocomo.md` | This document |

---

## Basic COCOMO Model

### Formula

```
Effort   (person-months) = a × (KLOC ^ b)
Duration (months)        = c × (Effort ^ d)
Staffing (persons)       = Effort / Duration
```

### Coefficients

| Project Type | a | b | c | d |
|---|---|---|---|---|
| Organic | 2.4 | 1.05 | 2.5 | 0.38 |
| Semi-detached | 3.0 | 1.12 | 2.5 | 0.35 |
| Embedded | 3.6 | 1.20 | 2.5 | 0.32 |

**Organic** — small teams, familiar problem domain (e.g. internal tools).  
**Semi-detached** — mixed experience, partially novel requirements.  
**Embedded** — tight hardware/OS constraints, complex requirements.

---

## API Endpoints

All endpoints require a valid Firebase ID token (`Authorization: Bearer <token>`).

### POST `/api/cocomo/estimate`
**Roles:** admin, manager, member

**Request body:**
```json
{
  "kloc":        12.5,
  "projectType": "organic",
  "teamSize":    5,
  "label":       "Phase 1 backend",   // optional
  "projectId":   "proj_abc123"        // optional
}
```

**Success (201):**
```json
{
  "success": true,
  "data": {
    "id":          "firestoreDocId",
    "kloc":        12.5,
    "projectType": "organic",
    "teamSize":    5,
    "effort":      32.15,
    "duration":    8.74,
    "staffing":    3.68
  }
}
```

**Error (400 / 500):**
```json
{ "success": false, "message": "kloc must be a positive number." }
```

---

### GET `/api/cocomo/history`
**Roles:** admin, manager → all records; member → own records only

**Query params:** `?projectId=<id>&limit=20`

**Success (200):**
```json
{
  "success": true,
  "data": [ /* array of estimation objects */ ]
}
```

---

### GET `/api/cocomo/history/:id`
**Roles:** admin, manager → any record; member → own records only

---

### DELETE `/api/cocomo/history/:id`
**Roles:** admin, manager only

---

## Firestore Schema

### Collection: `cocomoEstimations`

```
cocomoEstimations/
  {estimationId}/
    userId:      string   // Firebase Auth UID
    projectId:   string | null
    label:       string | null
    kloc:        number
    projectType: "organic" | "semidetached" | "embedded"
    teamSize:    number
    effort:      number   // person-months, 2 d.p.
    duration:    number   // months, 2 d.p.
    staffing:    number   // persons, 2 d.p.
    createdAt:   Timestamp
```

### Recommended Firestore Indexes

Add these composite indexes in the Firebase console (or `firestore.indexes.json`):

```json
{
  "indexes": [
    {
      "collectionGroup": "cocomoEstimations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId",    "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "cocomoEstimations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Activity Log entries (existing `activityLogs` collection)

```
activityLogs/{logId}/
  userId:    string
  action:    "COCOMO_ESTIMATE_CREATED" | "COCOMO_ESTIMATE_DELETED"
  module:    "cocomo"
  details:   { estimationId, kloc, projectType, teamSize }
  timestamp: Timestamp
```

---

## server.js Integration

Add **one line** to `server.js` (after existing route mounts):

```js
// Module 6 — COCOMO Estimation
app.use('/api/cocomo', require('./routes/cocomo'));
```

No other changes to `server.js` are needed.

---

## Frontend Integration

1. **Link the stylesheet** in your base HTML `<head>` (after `main.css`):
   ```html
   <link rel="stylesheet" href="/css/cocomo.css">
   ```

2. **Paste the HTML snippet** (`cocomo-html-snippet.html`) into your page template where the COCOMO tab/section should appear.

3. **Load the script** before `</body>` (after `api.js`):
   ```html
   <script src="/js/cocomo.js"></script>
   ```

4. **Wire up the tab** in your existing navigation/tab switcher using the section id `#cocomo-section` — consistent with how M3–M5 panels are toggled.

---

## Role-Based Access Summary

| Action | admin | manager | member |
|---|---|---|---|
| Create estimation | ✅ | ✅ | ✅ |
| View own history | ✅ | ✅ | ✅ |
| View all history | ✅ | ✅ | ❌ |
| Delete estimation | ✅ | ✅ | ❌ |

---

## Dependencies

- Existing `backend/middleware/auth.js` — `verifyToken`, `requireRole`
- Existing `frontend/js/api.js` — `api.get()`, `api.post()`, `api.delete()`
- Firebase Admin SDK (already initialized in `server.js`)
- Font Awesome (already loaded) — trash icon in history list

No new npm packages are required.

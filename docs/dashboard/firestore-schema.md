# Firestore Database Schema
## SE Project Management Tool — CSE181600E11

---

## Collection: `tasks`
Each document represents one Kanban task.

```
tasks/{taskId}
  title        : string        — Task description
  module       : string        — "mod1" | "mod2" | "mod3" | "mod4" | "mod5"
  status       : string        — "To Do" | "In Progress" | "Review" | "Done"
  assignedTo   : string        — Firebase Auth UID of the assignee
  assigneeInitial : string     — "A" | "B" | "C" (display avatar)
  createdBy    : string        — Firebase Auth UID
  createdAt    : timestamp
  updatedAt    : timestamp
```

---

## Collection: `requirements`
Each document is one requirement row (FR or NFR).

```
requirements/{reqId}
  reqId        : string        — "FR-01", "NF-01", etc.
  type         : string        — "functional" | "nonfunctional"
  description  : string
  module       : string        — "mod1" … "mod5"
  priority     : string        — "High" | "Medium" | "Low"
  status       : string        — "Done" | "In Progress" | "To Do"
  createdAt    : timestamp
  updatedAt    : timestamp
```

---

## Collection: `testCases`
Each document is one test case row.

```
testCases/{tcId}
  tcId         : string        — "TC-01", "TC-02", etc.
  description  : string
  level        : string        — "Unit Testing" | "Integration Testing" | "System Testing" | etc.
  technique    : string        — "Black Box" | "White Box" | "Boundary Value" | etc.
  result       : string        — "Pass" | "Fail" | "Pending"
  createdAt    : timestamp
  updatedAt    : timestamp
```

---

## Collection: `activities`
Activity feed entries written on every significant action.

```
activities/{activityId}
  text         : string        — Human-readable description
  color        : string        — Hex color for the dot indicator
  timestamp    : timestamp     — Used for ordering and "X ago" display
  userId       : string        — UID of user who triggered the action
  type         : string        — "task" | "requirement" | "testcase" | "auth"
```

---

## Collection: `team`
One document per team member (seeded once, not user-created).

```
team/{memberId}
  name         : string        — Full name
  roll         : string        — Roll number
  role         : string        — "Frontend & Requirements" etc.
  avatar       : string        — "A" | "B" | "C"
  uid          : string        — Firebase Auth UID (linked after login)
```

---

## Collection: `users`
Created automatically on first login via Firebase Auth trigger.

```
users/{uid}
  email        : string
  displayName  : string
  role         : string        — "admin" | "developer" | "tester"
  createdAt    : timestamp
```

---

## Firestore Security Rules (summary)
- `users`: read/write only by the authenticated user themselves; admin can read all
- `tasks`, `requirements`, `testCases`, `activities`: read by all authenticated users; write by authenticated users only
- `team`: read by all authenticated users; write by admin only

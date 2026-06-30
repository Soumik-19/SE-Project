# Module 3 — server.js Integration Note

Add the following two lines to `server.js` (after existing route registrations):

```js
const dashboardRoutes = require('./routes/dashboard');
app.use('/api/dashboard', dashboardRoutes);
```

This mounts:
  GET /api/dashboard/metrics   → task totals + progress %
  GET /api/dashboard/activity  → last 10 activity entries

---

# Module 4 — server.js Integration Note

Add the following after the dashboard route registration:

```js
const kanbanRoutes = require('./routes/kanban');
app.use('/api/kanban', kanbanRoutes);
```

This mounts:
  GET    /api/kanban/tasks          → list all tasks (filter by ?projectId=)
  POST   /api/kanban/tasks          → create task + log activity
  PATCH  /api/kanban/tasks/:id      → update/move/assign task + log activity
  DELETE /api/kanban/tasks/:id      → delete task + log activity

## Request context headers (set by api.js or auth middleware)

  x-user-id    — current user UID  (used for activity logs)
  x-project-id — active project ID (used for activity logs)

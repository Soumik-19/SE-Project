/**
 * api.js
 * ──────
 * Centralised fetch() wrapper for all backend API calls.
 * Automatically attaches the Firebase ID token to every request.
 *
 * PLACEMENT: frontend/js/api.js
 * IMPORTED BY: dashboard.js, kanban.js, requirements.js, testing.js, team.js
 */

import { getIdToken } from './auth.js';

const BASE_URL = 'http://localhost:3000/api';

// ── Core request helper ───────────────────────────────────────────────────
async function request(method, path, body = null) {
  const token = await getIdToken();

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.message || `Request failed: ${res.status}`);
  }
  return json.data;           // unwrap { success: true, data: ... }
}

// ── Convenience methods ───────────────────────────────────────────────────
export const api = {
  get:    (path)               => request('GET',    path),
  post:   (path, body)         => request('POST',   path, body),
  patch:  (path, body)         => request('PATCH',  path, body),
  delete: (path)               => request('DELETE', path),
};

// ── Named endpoint helpers ─────────────────────────────────────────────────
export const tasksAPI = {
  getAll:  ()           => api.get('/tasks'),
  create:  (task)       => api.post('/tasks', task),
  update:  (id, data)   => api.patch(`/tasks/${id}`, data),
  remove:  (id)         => api.delete(`/tasks/${id}`),
};

export const requirementsAPI = {
  getAll:  ()           => api.get('/requirements'),
  create:  (req)        => api.post('/requirements', req),
  update:  (id, data)   => api.patch(`/requirements/${id}`, data),
  remove:  (id)         => api.delete(`/requirements/${id}`),
};

export const testCasesAPI = {
  getAll:  ()           => api.get('/testcases'),
  create:  (tc)         => api.post('/testcases', tc),
  update:  (id, data)   => api.patch(`/testcases/${id}`, data),
  remove:  (id)         => api.delete(`/testcases/${id}`),
};

export const teamAPI = {
  getAll:  ()           => api.get('/team'),
  update:  (id, data)   => api.patch(`/team/${id}`, data),
};

export const activitiesAPI = {
  getAll:  ()           => api.get('/activities'),
  log:     (entry)      => api.post('/activities', entry),
};

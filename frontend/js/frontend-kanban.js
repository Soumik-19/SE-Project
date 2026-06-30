// frontend/js/kanban.js
// Module 4 — Kanban Board
// Renders the four-column board, wires drag-and-drop, and syncs with Firestore
// in real time via the client-side SDK (onSnapshot).
// All mutations go through the backend REST API (apiFetch from api.js) so
// activity logging, validation, and server timestamps stay server-side.

import { apiFetch }  from './api.js';
import { getAuth }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseApp } from './firebase-config.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLUMNS = [
  { id: 'todo',        label: 'To Do'       },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review',      label: 'Review'      },
  { id: 'done',        label: 'Done'        },
];

const PRIORITIES = [
  { value: 'critical', label: 'Critical' },
  { value: 'high',     label: 'High'     },
  { value: 'medium',   label: 'Medium'   },
  { value: 'low',      label: 'Low'      },
];

// ─── State ────────────────────────────────────────────────────────────────────
let tasks         = [];          // live array, kept in sync by onSnapshot
let teamMembers   = [];          // populated once on init
let currentUser   = null;
let activeProject = null;        // set via initKanban(projectId)
let unsubscribe   = null;        // Firestore listener teardown

// Drag state
let draggedTaskId = null;

// ─── Firestore client ─────────────────────────────────────────────────────────
const db   = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// ─── DOM helpers ──────────────────────────────────────────────────────────────
const boardEl   = () => document.getElementById('kanban-board');
const modalEl   = () => document.getElementById('task-modal');
const formEl    = () => document.getElementById('task-form');
const overlayEl = () => document.getElementById('modal-overlay');

// ─── Real-time Firestore listener ─────────────────────────────────────────────
function subscribeToTasks(projectId) {
  if (unsubscribe) unsubscribe();

  let q = query(collection(db, 'tasks'));
  if (projectId) q = query(collection(db, 'tasks'), where('projectId', '==', projectId));

  unsubscribe = onSnapshot(q, (snapshot) => {
    tasks = [];
    snapshot.forEach((doc) => tasks.push({ id: doc.id, ...doc.data() }));
    renderBoard();
  }, (err) => {
    console.error('Kanban onSnapshot error:', err);
  });
}

// ─── Board rendering ──────────────────────────────────────────────────────────
function renderBoard() {
  const board = boardEl();
  if (!board) return;

  COLUMNS.forEach((col) => {
    const colEl = board.querySelector(`[data-column="${col.id}"]`);
    if (!colEl) return;

    const listEl = colEl.querySelector('.kanban-task-list');
    if (!listEl) return;

    const colTasks = tasks
      .filter((t) => t.status === col.id)
      .sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));

    listEl.innerHTML = colTasks.length
      ? colTasks.map(buildTaskCard).join('')
      : '<div class="kanban-empty">No tasks</div>';

    // Update column task count badge
    const badge = colEl.querySelector('.kanban-col-count');
    if (badge) badge.textContent = colTasks.length;

    // Re-attach drag listeners to newly rendered cards
    listEl.querySelectorAll('.kanban-card').forEach(attachCardDrag);
  });
}

function priorityOrder(p) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[p] ?? 2;
}

function buildTaskCard(task) {
  const assignee = task.assigneeName
    ? `<span class="kanban-card__assignee">${escapeHtml(task.assigneeName)}</span>`
    : '';

  return `
  <div class="kanban-card kanban-card--${task.priority || 'medium'}"
       data-task-id="${task.id}"
       draggable="true">
    <div class="kanban-card__header">
      <span class="kanban-card__priority kanban-card__priority--${task.priority || 'medium'}">
        ${escapeHtml(task.priority || 'medium')}
      </span>
      <div class="kanban-card__actions">
        <button class="kanban-card__btn kanban-card__btn--edit"
                data-task-id="${task.id}" title="Edit task">&#9998;</button>
        <button class="kanban-card__btn kanban-card__btn--delete"
                data-task-id="${task.id}" title="Delete task">&#10005;</button>
      </div>
    </div>
    <p class="kanban-card__title">${escapeHtml(task.title)}</p>
    ${task.description ? `<p class="kanban-card__desc">${escapeHtml(task.description)}</p>` : ''}
    <div class="kanban-card__footer">
      ${assignee}
    </div>
  </div>`.trim();
}

// ─── Drag-and-drop ────────────────────────────────────────────────────────────
function attachCardDrag(cardEl) {
  cardEl.addEventListener('dragstart', onDragStart);
  cardEl.addEventListener('dragend',   onDragEnd);

  // Edit / delete buttons inside card
  const editBtn   = cardEl.querySelector('.kanban-card__btn--edit');
  const deleteBtn = cardEl.querySelector('.kanban-card__btn--delete');
  if (editBtn)   editBtn.addEventListener('click',   (e) => { e.stopPropagation(); openEditModal(editBtn.dataset.taskId); });
  if (deleteBtn) deleteBtn.addEventListener('click',  (e) => { e.stopPropagation(); deleteTask(deleteBtn.dataset.taskId); });
}

function onDragStart(e) {
  draggedTaskId = e.currentTarget.dataset.taskId;
  e.currentTarget.classList.add('kanban-card--dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('kanban-card--dragging');
  document.querySelectorAll('.kanban-drop-target').forEach((el) =>
    el.classList.remove('kanban-drop-target')
  );
  draggedTaskId = null;
}

function attachColumnDrop(colEl) {
  colEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    colEl.classList.add('kanban-drop-target');
  });

  colEl.addEventListener('dragleave', (e) => {
    if (!colEl.contains(e.relatedTarget)) {
      colEl.classList.remove('kanban-drop-target');
    }
  });

  colEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    colEl.classList.remove('kanban-drop-target');
    if (!draggedTaskId) return;

    const newStatus = colEl.dataset.column;
    const task = tasks.find((t) => t.id === draggedTaskId);
    if (!task || task.status === newStatus) return;

    await updateTaskStatus(draggedTaskId, newStatus);
  });
}

// ─── API calls ────────────────────────────────────────────────────────────────
async function updateTaskStatus(taskId, newStatus) {
  try {
    const res = await apiFetch(`/api/kanban/tasks/${taskId}`, {
      method: 'PATCH',
      body:   JSON.stringify({ status: newStatus }),
    });
    if (!res.success) throw new Error(res.message);
    // onSnapshot will re-render automatically
  } catch (err) {
    console.error('updateTaskStatus error:', err);
    showToast('Failed to move task.', 'error');
  }
}

async function createTask(payload) {
  try {
    const res = await apiFetch('/api/kanban/tasks', {
      method: 'POST',
      body:   JSON.stringify(payload),
    });
    if (!res.success) throw new Error(res.message);
    closeModal();
    showToast('Task created.');
  } catch (err) {
    console.error('createTask error:', err);
    showToast('Failed to create task.', 'error');
  }
}

async function updateTask(taskId, payload) {
  try {
    const res = await apiFetch(`/api/kanban/tasks/${taskId}`, {
      method: 'PATCH',
      body:   JSON.stringify(payload),
    });
    if (!res.success) throw new Error(res.message);
    closeModal();
    showToast('Task updated.');
  } catch (err) {
    console.error('updateTask error:', err);
    showToast('Failed to update task.', 'error');
  }
}

async function deleteTask(taskId) {
  const task = tasks.find((t) => t.id === taskId);
  if (!confirm(`Delete "${task?.title || 'this task'}"?`)) return;

  try {
    const res = await apiFetch(`/api/kanban/tasks/${taskId}`, { method: 'DELETE' });
    if (!res.success) throw new Error(res.message);
    showToast('Task deleted.');
  } catch (err) {
    console.error('deleteTask error:', err);
    showToast('Failed to delete task.', 'error');
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function buildMemberOptions() {
  return teamMembers
    .map((m) => `<option value="${m.id}" data-name="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`)
    .join('');
}

function buildPriorityOptions(selected = 'medium') {
  return PRIORITIES
    .map((p) => `<option value="${p.value}" ${p.value === selected ? 'selected' : ''}>${p.label}</option>`)
    .join('');
}

function buildStatusOptions(selected = 'todo') {
  return COLUMNS
    .map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.label}</option>`)
    .join('');
}

function openCreateModal(defaultStatus = 'todo') {
  const modal = modalEl();
  if (!modal) return;

  modal.dataset.mode   = 'create';
  modal.dataset.taskId = '';

  modal.querySelector('#modal-title').textContent        = 'New Task';
  modal.querySelector('#task-title-input').value         = '';
  modal.querySelector('#task-desc-input').value          = '';
  modal.querySelector('#task-priority-select').innerHTML = buildPriorityOptions('medium');
  modal.querySelector('#task-status-select').innerHTML   = buildStatusOptions(defaultStatus);
  modal.querySelector('#task-assignee-select').innerHTML =
    '<option value="">Unassigned</option>' + buildMemberOptions();

  showModal();
}

function openEditModal(taskId) {
  const task  = tasks.find((t) => t.id === taskId);
  if (!task) return;

  const modal = modalEl();
  if (!modal) return;

  modal.dataset.mode   = 'edit';
  modal.dataset.taskId = taskId;

  modal.querySelector('#modal-title').textContent        = 'Edit Task';
  modal.querySelector('#task-title-input').value         = task.title || '';
  modal.querySelector('#task-desc-input').value          = task.description || '';
  modal.querySelector('#task-priority-select').innerHTML = buildPriorityOptions(task.priority);
  modal.querySelector('#task-status-select').innerHTML   = buildStatusOptions(task.status);
  modal.querySelector('#task-assignee-select').innerHTML =
    '<option value="">Unassigned</option>' + buildMemberOptions();

  const assigneeSelect = modal.querySelector('#task-assignee-select');
  if (task.assigneeId) assigneeSelect.value = task.assigneeId;

  showModal();
}

function showModal() {
  const modal   = modalEl();
  const overlay = overlayEl();
  if (modal)   modal.classList.add('is-open');
  if (overlay) overlay.classList.add('is-open');
}

function closeModal() {
  const modal   = modalEl();
  const overlay = overlayEl();
  if (modal)   modal.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
}

function handleFormSubmit(e) {
  e.preventDefault();
  const modal = modalEl();
  if (!modal) return;

  const titleVal    = modal.querySelector('#task-title-input').value.trim();
  if (!titleVal) {
    showToast('Title is required.', 'error');
    return;
  }

  const assigneeSelect = modal.querySelector('#task-assignee-select');
  const assigneeId     = assigneeSelect.value || null;
  const assigneeName   = assigneeId
    ? assigneeSelect.options[assigneeSelect.selectedIndex]?.dataset.name || null
    : null;

  const payload = {
    title:        titleVal,
    description:  modal.querySelector('#task-desc-input').value.trim(),
    priority:     modal.querySelector('#task-priority-select').value,
    status:       modal.querySelector('#task-status-select').value,
    assigneeId,
    assigneeName,
    projectId:    activeProject,
    userId:       currentUser?.uid || 'anonymous',
  };

  if (modal.dataset.mode === 'edit') {
    updateTask(modal.dataset.taskId, payload);
  } else {
    createTask(payload);
  }
}

// ─── Toast notification ───────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const existing = document.getElementById('kanban-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id        = 'kanban-toast';
  toast.className = `kanban-toast kanban-toast--${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);

  // Trigger reflow for transition
  void toast.offsetWidth;
  toast.classList.add('kanban-toast--visible');

  setTimeout(() => {
    toast.classList.remove('kanban-toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Team members ─────────────────────────────────────────────────────────────
async function loadTeamMembers() {
  try {
    const res = await apiFetch('/api/team/members');
    if (res.success) teamMembers = res.data || [];
  } catch (err) {
    console.warn('Could not load team members:', err);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initKanban(projectId = null) {
  activeProject = projectId;
  currentUser   = auth.currentUser;

  await loadTeamMembers();

  // Wire "Add Task" buttons on each column header
  const board = boardEl();
  if (board) {
    COLUMNS.forEach((col) => {
      const colEl = board.querySelector(`[data-column="${col.id}"]`);
      if (!colEl) return;

      attachColumnDrop(colEl);

      const addBtn = colEl.querySelector('.kanban-col-add');
      if (addBtn) {
        addBtn.addEventListener('click', () => openCreateModal(col.id));
      }
    });
  }

  // Wire modal close + form submit
  const overlay = overlayEl();
  if (overlay) overlay.addEventListener('click', closeModal);

  const closeBtn = document.getElementById('modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  const form = formEl();
  if (form) form.addEventListener('submit', handleFormSubmit);

  // Global "Add Task" button (outside columns)
  const globalAddBtn = document.getElementById('kanban-add-task');
  if (globalAddBtn) globalAddBtn.addEventListener('click', () => openCreateModal());

  // Start real-time listener
  subscribeToTasks(activeProject);
}

/** Call this when navigating away from the Kanban page to stop the listener. */
export function destroyKanban() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

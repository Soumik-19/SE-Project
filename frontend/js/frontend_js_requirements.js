// requirements.js — Module 5: Requirements Management
// Handles Functional, Non-Functional, and Feasibility Study tabs.

(function () {
  "use strict";

  // ─── State ────────────────────────────────────────────────────────────────

  let currentProjectId = null;
  let currentUser = null;
  let currentTab = "functional"; // functional | non_functional | feasibility
  let requirements = { functional: [], non_functional: [], feasibility: [] };
  let editingId = null;

  // ─── Init ─────────────────────────────────────────────────────────────────

  function init(projectId, user) {
    currentProjectId = projectId;
    currentUser = user;

    bindTabSwitching();
    bindModalEvents();
    bindAddButton();

    loadRequirements();
  }

  // ─── Tab Switching ────────────────────────────────────────────────────────

  function bindTabSwitching() {
    const tabs = document.querySelectorAll(".req-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        currentTab = tab.dataset.tab;
        renderCurrentTab();
        syncAddButtonLabel();
      });
    });
  }

  function syncAddButtonLabel() {
    const btn = document.getElementById("req-add-btn");
    if (!btn) return;
    const labels = {
      functional: "Add Functional Requirement",
      non_functional: "Add Non-Functional Requirement",
      feasibility: "Add Feasibility Item",
    };
    btn.textContent = labels[currentTab] || "Add";
  }

  // ─── API Calls ────────────────────────────────────────────────────────────

  async function loadRequirements() {
    showLoading(true);
    try {
      const res = await api.get(`/requirements/${currentProjectId}`);
      if (!res.success) throw new Error(res.message);

      requirements = { functional: [], non_functional: [], feasibility: [] };
      res.data.forEach((req) => {
        if (requirements[req.type]) requirements[req.type].push(req);
      });

      renderCurrentTab();
    } catch (err) {
      showError("Failed to load requirements: " + err.message);
    } finally {
      showLoading(false);
    }
  }

  async function createRequirement(payload) {
    const res = await api.post(`/requirements/${currentProjectId}`, payload);
    if (!res.success) throw new Error(res.message);
    requirements[res.data.type].push(res.data);
    renderCurrentTab();
    return res.data;
  }

  async function updateRequirement(id, payload) {
    const res = await api.put(`/requirements/${currentProjectId}/${id}`, payload);
    if (!res.success) throw new Error(res.message);
    const list = requirements[res.data.type];
    const idx = list.findIndex((r) => r.id === id);
    if (idx !== -1) list[idx] = res.data;
    renderCurrentTab();
    return res.data;
  }

  async function deleteRequirement(id, type) {
    const res = await api.delete(`/requirements/${currentProjectId}/${id}`);
    if (!res.success) throw new Error(res.message);
    requirements[type] = requirements[type].filter((r) => r.id !== id);
    renderCurrentTab();
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  function renderCurrentTab() {
    const container = document.getElementById("req-list-container");
    if (!container) return;

    const list = requirements[currentTab] || [];

    if (list.length === 0) {
      container.innerHTML = `<div class="req-empty">
        <p>No ${tabLabel(currentTab).toLowerCase()} added yet.</p>
      </div>`;
      return;
    }

    if (currentTab === "feasibility") {
      container.innerHTML = renderFeasibilityTable(list);
    } else {
      container.innerHTML = list.map(renderRequirementCard).join("");
    }

    // Bind row/card actions
    container.querySelectorAll(".req-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => openEditModal(btn.dataset.id));
    });
    container.querySelectorAll(".req-delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => confirmDelete(btn.dataset.id, btn.dataset.type));
    });
  }

  function tabLabel(tab) {
    const map = {
      functional: "Functional Requirements",
      non_functional: "Non-Functional Requirements",
      feasibility: "Feasibility Study",
    };
    return map[tab] || tab;
  }

  function renderRequirementCard(req) {
    const canEdit = canModify();
    const canDelete = canDeleteReq();
    const statusClass = `req-status--${(req.status || "draft").replace("_", "-")}`;
    const priorityClass = `req-priority--${req.priority || "medium"}`;

    return `
      <div class="req-card" data-id="${req.id}">
        <div class="req-card__header">
          <span class="req-card__title">${escapeHtml(req.title)}</span>
          <div class="req-card__badges">
            <span class="req-badge req-priority ${priorityClass}">${capitalize(req.priority || "medium")}</span>
            <span class="req-badge req-status ${statusClass}">${formatStatus(req.status)}</span>
          </div>
        </div>
        ${req.description ? `<p class="req-card__desc">${escapeHtml(req.description)}</p>` : ""}
        <div class="req-card__footer">
          <span class="req-card__meta">Added ${formatDate(req.createdAt)}</span>
          <div class="req-card__actions">
            ${canEdit ? `<button class="btn btn--sm btn--ghost req-edit-btn" data-id="${req.id}">Edit</button>` : ""}
            ${canDelete ? `<button class="btn btn--sm btn--danger-ghost req-delete-btn" data-id="${req.id}" data-type="${req.type}">Delete</button>` : ""}
          </div>
        </div>
      </div>`;
  }

  function renderFeasibilityTable(list) {
    const canEdit = canModify();
    const canDelete = canDeleteReq();

    const rows = list
      .map(
        (req) => `
      <tr>
        <td>${escapeHtml(req.title)}</td>
        <td>${capitalize(req.feasibilityCategory || "technical")}</td>
        <td>
          <div class="req-score-bar">
            <div class="req-score-bar__fill" style="width:${((req.score || 0) / 5) * 100}%"></div>
            <span class="req-score-bar__label">${req.score != null ? req.score + "/5" : "—"}</span>
          </div>
        </td>
        <td><span class="req-badge req-status req-status--${(req.status || "draft").replace("_", "-")}">${formatStatus(req.status)}</span></td>
        <td class="req-table__notes">${escapeHtml(req.notes || "—")}</td>
        <td class="req-table__actions">
          ${canEdit ? `<button class="btn btn--sm btn--ghost req-edit-btn" data-id="${req.id}">Edit</button>` : ""}
          ${canDelete ? `<button class="btn btn--sm btn--danger-ghost req-delete-btn" data-id="${req.id}" data-type="${req.type}">Delete</button>` : ""}
        </td>
      </tr>`
      )
      .join("");

    return `
      <div class="req-table-wrapper">
        <table class="req-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Score</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ─── Modal ────────────────────────────────────────────────────────────────

  function bindAddButton() {
    const btn = document.getElementById("req-add-btn");
    if (btn) btn.addEventListener("click", () => openAddModal());
    syncAddButtonLabel();
  }

  function bindModalEvents() {
    const modal = document.getElementById("req-modal");
    if (!modal) return;

    const closeBtn = modal.querySelector(".req-modal__close");
    const cancelBtn = modal.querySelector("#req-modal-cancel");
    const form = modal.querySelector("#req-form");
    const typeField = modal.querySelector("#req-form-type");

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    if (typeField) typeField.addEventListener("change", toggleFeasibilityFields);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await handleFormSubmit();
      });
    }
  }

  function openAddModal() {
    editingId = null;
    resetForm();
    setFormType(currentTab);
    document.getElementById("req-modal-title").textContent =
      "Add " + tabLabel(currentTab).replace(/s$/, "");
    document.getElementById("req-modal-submit").textContent = "Add";
    openModal();
  }

  function openEditModal(id) {
    const req = findRequirement(id);
    if (!req) return;

    editingId = id;
    resetForm();
    populateForm(req);
    document.getElementById("req-modal-title").textContent = "Edit Requirement";
    document.getElementById("req-modal-submit").textContent = "Save Changes";
    openModal();
  }

  function openModal() {
    const modal = document.getElementById("req-modal");
    if (modal) modal.classList.add("active");
  }

  function closeModal() {
    const modal = document.getElementById("req-modal");
    if (modal) modal.classList.remove("active");
    editingId = null;
  }

  function resetForm() {
    const form = document.getElementById("req-form");
    if (form) form.reset();
    clearFormError();
    toggleFeasibilityFields();
  }

  function setFormType(type) {
    const typeField = document.getElementById("req-form-type");
    if (typeField) {
      typeField.value = type;
      toggleFeasibilityFields();
    }
  }

  function populateForm(req) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val != null) el.value = val;
    };
    set("req-form-type", req.type);
    set("req-form-title", req.title);
    set("req-form-description", req.description);
    set("req-form-priority", req.priority);
    set("req-form-status", req.status);
    set("req-form-feasibility-category", req.feasibilityCategory);
    set("req-form-score", req.score);
    set("req-form-notes", req.notes);
    toggleFeasibilityFields();
  }

  function toggleFeasibilityFields() {
    const typeField = document.getElementById("req-form-type");
    const feasSection = document.getElementById("req-feasibility-fields");
    if (!typeField || !feasSection) return;
    const isFeasibility = typeField.value === "feasibility";
    feasSection.style.display = isFeasibility ? "block" : "none";
  }

  async function handleFormSubmit() {
    const form = document.getElementById("req-form");
    clearFormError();

    const payload = {
      type: form.querySelector("#req-form-type").value,
      title: form.querySelector("#req-form-title").value.trim(),
      description: form.querySelector("#req-form-description").value.trim(),
      priority: form.querySelector("#req-form-priority").value,
      status: form.querySelector("#req-form-status").value,
    };

    if (!payload.title) {
      showFormError("Title is required.");
      return;
    }

    if (payload.type === "feasibility") {
      payload.feasibilityCategory = form.querySelector("#req-form-feasibility-category").value;
      const scoreVal = form.querySelector("#req-form-score").value;
      payload.score = scoreVal !== "" ? parseFloat(scoreVal) : null;
      payload.notes = form.querySelector("#req-form-notes").value.trim();
    }

    const submitBtn = document.getElementById("req-modal-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";

    try {
      if (editingId) {
        await updateRequirement(editingId, payload);
      } else {
        await createRequirement(payload);
      }
      closeModal();
    } catch (err) {
      showFormError(err.message || "Failed to save requirement.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = editingId ? "Save Changes" : "Add";
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  function confirmDelete(id, type) {
    const req = findRequirement(id);
    if (!req) return;

    if (!window.confirm(`Delete "${req.title}"? This cannot be undone.`)) return;

    deleteRequirement(id, type).catch((err) => {
      showError("Failed to delete: " + err.message);
    });
  }

  // ─── Access Control ───────────────────────────────────────────────────────

  function canModify() {
    return ["admin", "manager", "member"].includes(currentUser?.role);
  }

  function canDeleteReq() {
    return ["admin", "manager"].includes(currentUser?.role);
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  function findRequirement(id) {
    for (const list of Object.values(requirements)) {
      const found = list.find((r) => r.id === id);
      if (found) return found;
    }
    return null;
  }

  function showLoading(state) {
    const el = document.getElementById("req-loading");
    if (el) el.style.display = state ? "flex" : "none";
  }

  function showError(msg) {
    const el = document.getElementById("req-error");
    if (el) {
      el.textContent = msg;
      el.style.display = "block";
      setTimeout(() => (el.style.display = "none"), 5000);
    }
  }

  function showFormError(msg) {
    const el = document.getElementById("req-form-error");
    if (el) {
      el.textContent = msg;
      el.style.display = "block";
    }
  }

  function clearFormError() {
    const el = document.getElementById("req-form-error");
    if (el) el.style.display = "none";
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function formatStatus(status) {
    const map = {
      draft: "Draft",
      review: "In Review",
      approved: "Approved",
      rejected: "Rejected",
    };
    return map[status] || capitalize(status || "draft");
  }

  function formatDate(ts) {
    if (!ts) return "—";
    // Firestore Timestamp or plain date
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  // ─── Expose ───────────────────────────────────────────────────────────────

  window.Requirements = { init };
})();

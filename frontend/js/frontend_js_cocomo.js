// frontend/js/cocomo.js
// Depends on: frontend/js/api.js (api object with get/post/delete helpers)
// Depends on: Firebase Auth (currentUser token via api.js)

(function () {
  'use strict';

  // ─── DOM References ──────────────────────────────────────────────────────────
  const form           = document.getElementById('cocomo-form');
  const klocInput      = document.getElementById('cocomo-kloc');
  const typeSelect     = document.getElementById('cocomo-project-type');
  const teamInput      = document.getElementById('cocomo-team-size');
  const labelInput     = document.getElementById('cocomo-label');
  const calcBtn        = document.getElementById('cocomo-calc-btn');
  const resultSection  = document.getElementById('cocomo-result');
  const effortEl       = document.getElementById('cocomo-effort');
  const durationEl     = document.getElementById('cocomo-duration');
  const staffingEl     = document.getElementById('cocomo-staffing');
  const historyList    = document.getElementById('cocomo-history-list');
  const historySection = document.getElementById('cocomo-history-section');
  const errorBanner    = document.getElementById('cocomo-error');
  const loadingSpinner = document.getElementById('cocomo-loading');

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function showError(msg) {
    if (!errorBanner) return;
    errorBanner.textContent = msg;
    errorBanner.classList.remove('hidden');
    setTimeout(() => errorBanner.classList.add('hidden'), 5000);
  }

  function setLoading(state) {
    if (!loadingSpinner) return;
    loadingSpinner.classList.toggle('hidden', !state);
    if (calcBtn) calcBtn.disabled = state;
  }

  function formatDate(ts) {
    if (!ts) return '—';
    // Firestore Timestamp or ISO string
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  }

  // ─── Render Result ────────────────────────────────────────────────────────────
  function renderResult(data) {
    if (!resultSection) return;
    effortEl.textContent   = `${data.effort} person-months`;
    durationEl.textContent = `${data.duration} months`;
    staffingEl.textContent = `${data.staffing} persons`;
    resultSection.classList.remove('hidden');
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ─── Render History ───────────────────────────────────────────────────────────
  function renderHistory(estimations) {
    if (!historyList) return;
    historyList.innerHTML = '';

    if (!estimations || estimations.length === 0) {
      historyList.innerHTML = '<li class="cocomo-history-empty">No estimations yet.</li>';
      return;
    }

    estimations.forEach(item => {
      const li = document.createElement('li');
      li.className = 'cocomo-history-item';
      li.dataset.id = item.id;

      li.innerHTML = `
        <div class="cocomo-history-meta">
          <span class="cocomo-history-label">${item.label || 'Untitled'}</span>
          <span class="cocomo-history-type badge badge--${item.projectType}">${capitalize(item.projectType)}</span>
          <span class="cocomo-history-date">${formatDate(item.createdAt)}</span>
        </div>
        <div class="cocomo-history-values">
          <span><strong>${item.kloc}</strong> KLOC</span>
          <span><strong>${item.effort}</strong> PM</span>
          <span><strong>${item.duration}</strong> mo</span>
          <span><strong>${item.staffing}</strong> persons</span>
        </div>
        <button class="btn btn--icon cocomo-delete-btn" data-id="${item.id}" title="Delete estimation" aria-label="Delete estimation">
          <i class="fas fa-trash"></i>
        </button>
      `;
      historyList.appendChild(li);
    });

    // Attach delete listeners
    historyList.querySelectorAll('.cocomo-delete-btn').forEach(btn => {
      btn.addEventListener('click', handleDelete);
    });
  }

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  // ─── Load History ─────────────────────────────────────────────────────────────
  async function loadHistory() {
    try {
      const res = await api.get('/cocomo/history?limit=20');
      if (res.success) {
        renderHistory(res.data);
        if (historySection) historySection.classList.remove('hidden');
      } else {
        showError(res.message || 'Failed to load history.');
      }
    } catch (err) {
      console.error('Load history error:', err);
      showError('Could not load estimation history.');
    }
  }

  // ─── Handle Calculate ─────────────────────────────────────────────────────────
  async function handleCalculate(e) {
    e.preventDefault();

    const kloc        = parseFloat(klocInput.value);
    const projectType = typeSelect.value;
    const teamSize    = parseInt(teamInput.value, 10);
    const label       = labelInput ? labelInput.value.trim() : '';

    // Client-side validation
    if (isNaN(kloc) || kloc <= 0) {
      showError('KLOC must be a positive number.');
      klocInput.focus();
      return;
    }
    if (!projectType) {
      showError('Please select a project type.');
      typeSelect.focus();
      return;
    }
    if (isNaN(teamSize) || teamSize <= 0) {
      showError('Team size must be a positive whole number.');
      teamInput.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/cocomo/estimate', { kloc, projectType, teamSize, label });

      if (res.success) {
        renderResult(res.data);
        await loadHistory();
      } else {
        showError(res.message || 'Estimation failed.');
      }
    } catch (err) {
      console.error('Calculate error:', err);
      showError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ─── Handle Delete ────────────────────────────────────────────────────────────
  async function handleDelete(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    if (!confirm('Delete this estimation? This cannot be undone.')) return;

    try {
      const res = await api.delete(`/cocomo/history/${id}`);
      if (res.success) {
        await loadHistory();
        // Hide result panel if it was showing this estimation
        if (resultSection) resultSection.classList.add('hidden');
      } else {
        showError(res.message || 'Could not delete estimation.');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showError('Delete failed. You may not have permission.');
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    if (!form) return; // Page doesn't have COCOMO section

    form.addEventListener('submit', handleCalculate);

    // Hide result and history on fresh load
    if (resultSection)  resultSection.classList.add('hidden');
    if (historySection) historySection.classList.add('hidden');

    loadHistory();
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

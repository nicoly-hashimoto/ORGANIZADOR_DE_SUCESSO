const form = document.getElementById("task-form");
const cancelEditButton = document.getElementById("cancel-edit");
const statsGrid = document.getElementById("stats-grid");
const statusChart = document.getElementById("status-chart");
const progressChart = document.getElementById("progress-chart");
const taskColumns = document.getElementById("task-columns");
const goalTableBody = document.getElementById("goal-table-body");

const statusLabels = {
  ideia: "Ideias",
  execucao: "Execucao",
  finalizada: "Finalizada"
};

let tasks = [];

function statusClass(status) {
  if (status === "ideia") return "idea";
  if (status === "execucao") return "execution";
  return "done";
}

function normalizeDate(dateValue) {
  if (!dateValue) return "Sem prazo";
  return new Date(dateValue).toLocaleDateString("pt-BR");
}

function resetForm() {
  form.reset();
  document.getElementById("task-id").value = "";
  document.getElementById("target_value").value = 100;
  document.getElementById("current_value").value = 0;
  document.getElementById("status").value = "ideia";
  cancelEditButton.classList.add("hidden");
}

function renderStats(totals) {
  const cards = [
    { label: "Total de tarefas", value: totals.total },
    { label: "Em execucao", value: totals.execution },
    { label: "Finalizadas", value: totals.finished },
    { label: "Media de progresso", value: `${totals.averageProgress}%` }
  ];

  statsGrid.innerHTML = cards
    .map(
      (card) => `
        <div class="stat-card">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
        </div>
      `
    )
    .join("");
}

function renderStatusChart(statusData) {
  const maxValue = Math.max(1, ...statusData.map((item) => item.value));

  statusChart.innerHTML = statusData
    .map((item) => {
      const color =
        item.label === "Ideias"
          ? "var(--idea)"
          : item.label === "Execução" || item.label === "Execucao"
            ? "var(--execution)"
            : "var(--done)";
      const width = `${(item.value / maxValue) * 100}%`;

      return `
        <div class="status-row">
          <div class="status-label">
            <span>${item.label}</span>
            <strong>${item.value}</strong>
          </div>
          <div class="status-bar">
            <div class="status-fill" style="width:${width}; background:${color};"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderProgressChart(progressData) {
  if (!progressData.length) {
    progressChart.innerHTML = `<p class="empty-state">Cadastre tarefas para visualizar a evolucao das metas.</p>`;
    return;
  }

  progressChart.innerHTML = progressData
    .map(
      (item) => `
        <div class="progress-item">
          <div class="progress-meta">
            <span>${item.label}</span>
            <strong>${item.value}%</strong>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width:${item.value}%; background: linear-gradient(90deg, var(--accent), var(--brand));"></div>
          </div>
        </div>
      `
    )
    .join("");
}

function renderTable(rows) {
  if (!rows.length) {
    goalTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhuma tarefa cadastrada ainda.</td></tr>`;
    return;
  }

  goalTableBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.title}</td>
          <td>${row.goal}</td>
          <td>${statusLabels[row.status] || row.status}</td>
          <td>${row.progress}%</td>
          <td>${row.current_value}/${row.target_value}</td>
        </tr>
      `
    )
    .join("");
}

function renderTasks() {
  const columns = [
    { status: "ideia", title: "Ideias" },
    { status: "execucao", title: "Execucao" },
    { status: "finalizada", title: "Finalizada" }
  ];

  taskColumns.innerHTML = columns
    .map(({ status, title }) => {
      const items = tasks.filter((task) => task.status === status);

      return `
        <div class="task-column">
          <h3>${title} (${items.length})</h3>
          <div class="task-list">
            ${
              items.length
                ? items
                    .map(
                      (task) => `
                        <article class="task-card">
                          <div>
                            <h4>${task.title}</h4>
                            <p>${task.description || "Sem descricao informada."}</p>
                          </div>

                          <div class="pill-row">
                            <span class="pill ${statusClass(task.status)}">${statusLabels[task.status]}</span>
                            <span class="pill ${statusClass(task.status)}">${task.progress}%</span>
                            <span class="pill ${statusClass(task.status)}">${task.current_value}/${task.target_value}</span>
                          </div>

                          <p><strong>Meta:</strong> ${task.goal || "Sem meta definida"}</p>
                          <p><strong>Categoria:</strong> ${task.category || "Sem categoria"}</p>
                          <p><strong>Prazo:</strong> ${normalizeDate(task.due_date)}</p>

                          <div class="task-actions">
                            <button class="mini-btn" data-action="edit" data-id="${task.id}">Editar</button>
                            <button class="mini-btn" data-action="advance" data-id="${task.id}">Avancar</button>
                            <button class="mini-btn" data-action="delete" data-id="${task.id}">Excluir</button>
                          </div>
                        </article>
                      `
                    )
                    .join("")
                : `<p class="empty-state">Nenhuma tarefa nesta etapa.</p>`
            }
          </div>
        </div>
      `;
    })
    .join("");
}

function fillForm(task) {
  document.getElementById("task-id").value = task.id;
  document.getElementById("title").value = task.title;
  document.getElementById("description").value = task.description;
  document.getElementById("goal").value = task.goal;
  document.getElementById("category").value = task.category;
  document.getElementById("status").value = task.status;
  document.getElementById("current_value").value = task.current_value;
  document.getElementById("target_value").value = task.target_value;
  document.getElementById("due_date").value = task.due_date ? task.due_date.slice(0, 10) : "";
  cancelEditButton.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro inesperado." }));
    throw new Error(error.error || "Erro inesperado.");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function loadData() {
  const [taskData, stats] = await Promise.all([
    fetchJson("/api/tasks"),
    fetchJson("/api/stats")
  ]);

  tasks = taskData;
  renderStats(stats.totals);
  renderStatusChart(stats.statusChart);
  renderProgressChart(stats.progressChart);
  renderTasks();
  renderTable(stats.goalTable);
}

async function handleSubmit(event) {
  event.preventDefault();

  const taskId = document.getElementById("task-id").value;
  const payload = {
    title: document.getElementById("title").value.trim(),
    description: document.getElementById("description").value.trim(),
    goal: document.getElementById("goal").value.trim(),
    category: document.getElementById("category").value.trim(),
    status: document.getElementById("status").value,
    current_value: Number(document.getElementById("current_value").value),
    target_value: Number(document.getElementById("target_value").value),
    due_date: document.getElementById("due_date").value || null
  };

  try {
    if (taskId) {
      await fetchJson(`/api/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    } else {
      await fetchJson("/api/tasks", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    resetForm();
    await loadData();
  } catch (error) {
    alert(error.message);
  }
}

async function handleTaskAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  try {
    if (action === "edit") {
      fillForm(task);
      return;
    }

    if (action === "delete") {
      await fetchJson(`/api/tasks/${id}`, { method: "DELETE" });
    }

    if (action === "advance") {
      const nextStatus =
        task.status === "ideia"
          ? "execucao"
          : task.status === "execucao"
            ? "finalizada"
            : "finalizada";

      await fetchJson(`/api/tasks/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus })
      });
    }

    await loadData();
  } catch (error) {
    alert(error.message);
  }
}

form.addEventListener("submit", handleSubmit);
cancelEditButton.addEventListener("click", resetForm);
taskColumns.addEventListener("click", handleTaskAction);

resetForm();
loadData().catch((error) => {
  console.error(error);
  alert("Nao foi possivel carregar os dados da aplicacao.");
});

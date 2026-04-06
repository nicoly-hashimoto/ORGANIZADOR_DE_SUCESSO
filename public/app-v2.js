const taskForm = document.getElementById("task-form");
const reminderForm = document.getElementById("reminder-form");
const cancelEditButton = document.getElementById("cancel-edit");
const cancelReminderEditButton = document.getElementById("cancel-reminder-edit");
const statsGrid = document.getElementById("stats-grid");
const statusChart = document.getElementById("status-chart");
const progressChart = document.getElementById("progress-chart");
const taskColumns = document.getElementById("task-columns");
const goalTableBody = document.getElementById("goal-table-body");
const focusSummary = document.getElementById("focus-summary");
const focusList = document.getElementById("focus-list");
const taskSearchInput = document.getElementById("task-search");
const filterStatusInput = document.getElementById("filter-status");
const filterPriorityInput = document.getElementById("filter-priority");
const filterCategoryInput = document.getElementById("filter-category");
const filterDueInput = document.getElementById("filter-due");
const clearTaskFiltersButton = document.getElementById("clear-task-filters");
const taskResultsCount = document.getElementById("task-results-count");
const reminderList = document.getElementById("reminder-list");
const agendaSummary = document.getElementById("agenda-summary");
const notificationStatus = document.getElementById("notification-status");
const enableNotificationsButton = document.getElementById("enable-notifications");
const greetingTitle = document.getElementById("greeting-title");

const statusLabels = {
  ideia: "Ideias",
  execucao: "Execucao",
  finalizada: "Finalizada"
};

const priorityLabels = {
  alta: "Alta",
  media: "Media",
  baixa: "Baixa"
};

let tasks = [];
let reminders = [];
let reminderNotificationTimer = null;
const taskFilters = {
  search: "",
  status: "",
  priority: "",
  category: "",
  due: ""
};

function statusClass(status) {
  if (status === "ideia") return "idea";
  if (status === "execucao") return "execution";
  return "done";
}

function priorityClass(priority) {
  if (priority === "alta") return "priority-high";
  if (priority === "baixa") return "priority-low";
  return "priority-medium";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatLocalDateParts(date) {
  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1).padStart(2, "0"),
    day: String(date.getDate()).padStart(2, "0")
  };
}

function parseDateOnly(dateValue) {
  if (!dateValue || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return null;
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function normalizeDate(dateValue) {
  if (!dateValue) return "Sem data";
  const dateOnly = parseDateOnly(dateValue);
  if (dateOnly) {
    return dateOnly.toLocaleDateString("pt-BR");
  }

  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? dateValue : date.toLocaleDateString("pt-BR");
}

function formatReminderTime(timeValue) {
  if (!timeValue) return "Sem horario";
  return timeValue.slice(0, 5);
}

function reminderDateTime(reminder) {
  if (!reminder.reminder_date || !reminder.reminder_time) {
    return null;
  }

  const dateTime = new Date(`${reminder.reminder_date}T${reminder.reminder_time}:00`);
  if (Number.isNaN(dateTime.getTime())) {
    return null;
  }

  return dateTime;
}

function formatDuration(days) {
  if (days === null || days === undefined) {
    return "Sem medicao";
  }
  if (days === 0) {
    return "No mesmo dia";
  }
  if (days === 1) {
    return "1 dia";
  }
  return `${days} dias`;
}

function formatSubtaskSummary(task) {
  const total = Number(task.subtasks_total) || 0;
  const completed = Number(task.subtasks_completed) || 0;

  if (!total) {
    return "Sem checklist";
  }

  return `${completed}/${total} subtarefas`;
}

function todayString() {
  const { year, month, day } = formatLocalDateParts(new Date());
  return `${year}-${month}-${day}`;
}

function getGreetingByHour(hour) {
  if (hour < 12) return "Bom dia, Nicoly!";
  if (hour < 18) return "Boa tarde, Nicoly!";
  return "Boa noite, Nicoly!";
}

function renderGreeting() {
  if (!greetingTitle) return;
  greetingTitle.textContent = getGreetingByHour(new Date().getHours());
}

function normalizePriority(priority) {
  return priorityLabels[priority] ? priority : "media";
}

function matchesDueFilter(task, dueFilter) {
  if (!dueFilter) return true;
  if (dueFilter === "none") return !task.due_date;
  if (!task.due_date) return false;

  const dueDate = parseDateOnly(task.due_date);
  const today = parseDateOnly(todayString());
  if (!dueDate || !today) return false;

  const diffDays = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));

  if (dueFilter === "today") return diffDays === 0;
  if (dueFilter === "week") return diffDays >= 0 && diffDays <= 7;
  if (dueFilter === "late") return diffDays < 0 && task.status !== "finalizada";
  return true;
}

function taskMatchesFilters(task) {
  const normalizedPriority = normalizePriority(task.priority);
  const searchableContent = [
    task.title,
    task.description,
    task.goal,
    task.category
  ]
    .join(" ")
    .toLowerCase();

  if (taskFilters.search && !searchableContent.includes(taskFilters.search)) {
    return false;
  }

  if (taskFilters.status && task.status !== taskFilters.status) {
    return false;
  }

  if (taskFilters.priority && normalizedPriority !== taskFilters.priority) {
    return false;
  }

  if (taskFilters.category) {
    const category = (task.category || "").trim().toLowerCase();
    if (category !== taskFilters.category) {
      return false;
    }
  }

  return matchesDueFilter(task, taskFilters.due);
}

function daysUntil(dateValue) {
  const target = parseDateOnly(dateValue);
  const today = parseDateOnly(todayString());
  if (!target || !today) return null;
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function focusTone(task) {
  const dueInDays = daysUntil(task.due_date);
  if (dueInDays !== null && dueInDays < 0 && task.status !== "finalizada") {
    return "is-urgent";
  }
  if (dueInDays !== null && dueInDays <= 2 && task.status !== "finalizada") {
    return "is-soon";
  }
  return "is-steady";
}

function describeFocus(task) {
  const dueInDays = daysUntil(task.due_date);

  if (dueInDays !== null) {
    if (dueInDays < 0 && task.status !== "finalizada") {
      return `Atrasada ha ${Math.abs(dueInDays)} ${Math.abs(dueInDays) === 1 ? "dia" : "dias"}`;
    }
    if (dueInDays === 0 && task.status !== "finalizada") {
      return "Vence hoje";
    }
    if (dueInDays === 1 && task.status !== "finalizada") {
      return "Vence amanha";
    }
    if (dueInDays > 1 && dueInDays <= 7 && task.status !== "finalizada") {
      return `Vence em ${dueInDays} dias`;
    }
  }

  if (task.status === "execucao") {
    return "Ja esta em execucao";
  }
  if (normalizePriority(task.priority) === "alta") {
    return "Prioridade alta";
  }
  if ((task.subtasks_total || 0) > 0 && (task.subtasks_completed || 0) < (task.subtasks_total || 0)) {
    return "Checklist em andamento";
  }
  return "Bom proximo passo";
}

function calculateFocusScore(task) {
  let score = 0;
  const priority = normalizePriority(task.priority);
  const dueInDays = daysUntil(task.due_date);

  if (task.status === "finalizada") {
    return -1;
  }
  if (task.status === "execucao") score += 40;
  if (priority === "alta") score += 30;
  if (priority === "media") score += 12;
  if (task.current_value === 0) score += 4;
  if (task.progress > 0 && task.progress < 100) score += 8;

  if (dueInDays !== null) {
    if (dueInDays < 0) score += 60;
    else if (dueInDays === 0) score += 45;
    else if (dueInDays === 1) score += 34;
    else if (dueInDays <= 3) score += 22;
    else if (dueInDays <= 7) score += 12;
  } else {
    score += 2;
  }

  return score;
}

function getTodayFocusTasks() {
  return tasks
    .map((task) => ({
      ...task,
      focus_score: calculateFocusScore(task),
      due_in_days: daysUntil(task.due_date)
    }))
    .filter((task) => task.focus_score >= 0)
    .sort((left, right) => {
      if (right.focus_score !== left.focus_score) {
        return right.focus_score - left.focus_score;
      }
      return left.title.localeCompare(right.title, "pt-BR", { sensitivity: "base" });
    })
    .slice(0, 6);
}

function getFilteredTasks() {
  return tasks.filter(taskMatchesFilters);
}

function buildTaskInsights(taskList) {
  const total = taskList.length;
  const ideas = taskList.filter((task) => task.status === "ideia").length;
  const execution = taskList.filter((task) => task.status === "execucao").length;
  const finished = taskList.filter((task) => task.status === "finalizada").length;
  const averageProgress = total
    ? Math.round(taskList.reduce((sum, task) => sum + task.progress, 0) / total)
    : 0;

  return {
    totals: {
      total,
      ideas,
      execution,
      finished,
      averageProgress
    },
    statusChart: [
      { label: "Ideias", value: ideas },
      { label: "Execucao", value: execution },
      { label: "Finalizadas", value: finished }
    ],
    progressChart: taskList.map((task) => ({
      label: task.title,
      value: task.progress
    })),
    goalTable: taskList.map((task) => ({
      title: task.title,
      goal: task.goal || "Sem meta definida",
      priority: normalizePriority(task.priority),
      status: task.status,
      progress: task.progress,
      current_value: task.current_value,
      target_value: task.target_value,
      start_date: task.start_date,
      end_date: task.end_date,
      duration_days: task.duration_days
    }))
  };
}

function resetTaskForm() {
  taskForm.reset();
  document.getElementById("task-id").value = "";
  document.getElementById("target_value").value = 100;
  document.getElementById("current_value").value = 0;
  document.getElementById("status").value = "ideia";
  document.getElementById("priority").value = "media";
  document.getElementById("start_date").value = todayString();
  document.getElementById("end_date").value = "";
  cancelEditButton.classList.add("hidden");
}

function resetReminderForm() {
  reminderForm.reset();
  document.getElementById("reminder-id").value = "";
  document.getElementById("reminder-date").value = todayString();
  document.getElementById("reminder-time").value = "";
  cancelReminderEditButton.classList.add("hidden");
}

function updateNotificationStatus() {
  if (!("Notification" in window)) {
    notificationStatus.textContent = "Este navegador nao suporta notificacoes.";
    enableNotificationsButton.disabled = true;
    return;
  }

  if (Notification.permission === "granted") {
    notificationStatus.textContent = "Notificacoes ativadas. Os alertas vao aparecer no horario dos lembretes.";
    enableNotificationsButton.textContent = "Notificacoes ativas";
    enableNotificationsButton.disabled = true;
    return;
  }

  if (Notification.permission === "denied") {
    notificationStatus.textContent = "As notificacoes foram bloqueadas no navegador. Libere a permissao para voltar a receber alertas.";
    enableNotificationsButton.textContent = "Notificacoes bloqueadas";
    enableNotificationsButton.disabled = true;
    return;
  }

  notificationStatus.textContent = "Ative para receber alertas no horario dos lembretes.";
  enableNotificationsButton.textContent = "Ativar notificacoes";
  enableNotificationsButton.disabled = false;
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    alert("Este navegador nao suporta notificacoes.");
    return;
  }

  const permission = await Notification.requestPermission();
  updateNotificationStatus();

  if (permission !== "granted") {
    alert("As notificacoes nao foram autorizadas.");
    return;
  }

  checkReminderNotifications();
}

async function markReminderAsNotified(reminder) {
  await fetchJson(`/api/reminders/${reminder.id}`, {
    method: "PUT",
    body: JSON.stringify({
      notified_at: new Date().toISOString()
    })
  });
}

async function showReminderNotification(reminder) {
  const notification = new Notification(reminder.title, {
    body: reminder.notes || `Lembrete agendado para ${normalizeDate(reminder.reminder_date)} as ${formatReminderTime(reminder.reminder_time)}.`,
    tag: `reminder-${reminder.id}`,
    requireInteraction: true
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  await markReminderAsNotified(reminder);
  reminder.notified_at = new Date().toISOString();
}

async function checkReminderNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const now = new Date();
  const dueReminders = reminders.filter((reminder) => {
    if (reminder.completed || reminder.notified_at || !reminder.reminder_time) {
      return false;
    }

    const scheduledAt = reminderDateTime(reminder);
    return scheduledAt && scheduledAt <= now;
  });

  for (const reminder of dueReminders) {
    try {
      await showReminderNotification(reminder);
    } catch (error) {
      console.error("Falha ao disparar notificacao do lembrete:", error);
    }
  }
}

function startReminderNotificationLoop() {
  if (reminderNotificationTimer) {
    window.clearInterval(reminderNotificationTimer);
  }

  reminderNotificationTimer = window.setInterval(() => {
    checkReminderNotifications().catch((error) => {
      console.error("Falha ao verificar notificacoes:", error);
    });
  }, 30000);
}

function renderStats(totals, remindersTotal) {
  const cards = [
    { label: "Total de tarefas", value: totals.total },
    { label: "Em execucao", value: totals.execution },
    { label: "Finalizadas", value: totals.finished },
    { label: "Media de progresso", value: `${totals.averageProgress}%` },
    { label: "Lembretes salvos", value: remindersTotal }
  ];

  statsGrid.innerHTML = cards
    .map(
      (card) => `
        <div class="stat-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
        </div>
      `
    )
    .join("");
}

function renderTodayFocus() {
  const today = todayString();
  const focusTasks = getTodayFocusTasks();
  const pendingReminders = reminders.filter((reminder) => !reminder.completed);
  const summaryCards = [
    {
      label: "Atrasadas",
      value: tasks.filter((task) => {
        const dueInDays = daysUntil(task.due_date);
        return task.status !== "finalizada" && dueInDays !== null && dueInDays < 0;
      }).length
    },
    {
      label: "Vencem hoje",
      value: tasks.filter((task) => task.status !== "finalizada" && daysUntil(task.due_date) === 0).length
    },
    {
      label: "Prioridade alta",
      value: tasks.filter((task) => task.status !== "finalizada" && normalizePriority(task.priority) === "alta").length
    },
    {
      label: "Lembretes de hoje",
      value: pendingReminders.filter((reminder) => reminder.reminder_date === today).length
    }
  ];

  focusSummary.innerHTML = summaryCards
    .map(
      (item) => `
        <div class="summary-card stat-card">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `
    )
    .join("");

  if (!focusTasks.length) {
    focusList.innerHTML = `<p class="empty-state">Nada urgente por agora. Voce pode usar este espaco como radar para o que entra em foco ao longo do dia.</p>`;
    return;
  }

  focusList.innerHTML = focusTasks
    .map(
      (task) => `
        <article class="focus-item ${focusTone(task)}">
          <div class="focus-header">
            <div>
              <h3>${escapeHtml(task.title)}</h3>
              <p>${escapeHtml(describeFocus(task))}</p>
            </div>
            <span class="focus-score">Foco ${escapeHtml(task.focus_score)}</span>
          </div>
          <div class="pill-row">
            <span class="pill ${statusClass(task.status)}">${escapeHtml(statusLabels[task.status])}</span>
            <span class="pill ${priorityClass(normalizePriority(task.priority))}">${escapeHtml(priorityLabels[normalizePriority(task.priority)])}</span>
            <span class="pill neutral">${escapeHtml(`${task.progress}% concluido`)}</span>
          </div>
          <div class="focus-meta">
            <span><strong>Prazo:</strong> ${escapeHtml(normalizeDate(task.due_date))}</span>
            <span><strong>Categoria:</strong> ${escapeHtml(task.category || "Sem categoria")}</span>
            <span><strong>Meta:</strong> ${escapeHtml(task.goal || "Sem meta definida")}</span>
            <span><strong>Checklist:</strong> ${escapeHtml(formatSubtaskSummary(task))}</span>
          </div>
        </article>
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
          : item.label === "Execucao"
            ? "var(--execution)"
            : "var(--done)";
      const width = `${(item.value / maxValue) * 100}%`;

      return `
        <div class="status-row">
          <div class="status-label">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
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
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}%</strong>
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
    goalTableBody.innerHTML = `<tr><td colspan="8" class="empty-state">Nenhuma tarefa encontrada com os filtros atuais.</td></tr>`;
    return;
  }

  goalTableBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.title)}</td>
          <td>${escapeHtml(row.goal)}</td>
          <td>${escapeHtml(priorityLabels[row.priority] || priorityLabels.media)}</td>
          <td>${escapeHtml(statusLabels[row.status] || row.status)}</td>
          <td>${escapeHtml(normalizeDate(row.start_date))}</td>
          <td>${escapeHtml(normalizeDate(row.end_date))}</td>
          <td>${escapeHtml(formatDuration(row.duration_days))}</td>
          <td>${escapeHtml(`${row.progress}% (${row.current_value}/${row.target_value})`)}</td>
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
  const filteredTasks = getFilteredTasks();

  taskColumns.innerHTML = columns
    .map(({ status, title }) => {
      const items = filteredTasks.filter((task) => task.status === status);

      return `
        <div class="task-column">
          <h3>${escapeHtml(`${title} (${items.length})`)}</h3>
          <div class="task-list">
            ${
              items.length
                ? items
                    .map(
                      (task) => `
                        <article class="task-card">
                          <div>
                            <h4>${escapeHtml(task.title)}</h4>
                            <p>${escapeHtml(task.description || "Sem descricao informada.")}</p>
                          </div>

                          <div class="pill-row">
                            <span class="pill ${statusClass(task.status)}">${escapeHtml(statusLabels[task.status])}</span>
                            <span class="pill ${priorityClass(normalizePriority(task.priority))}">${escapeHtml(priorityLabels[normalizePriority(task.priority)])}</span>
                            <span class="pill ${statusClass(task.status)}">${escapeHtml(`${task.progress}%`)}</span>
                            <span class="pill neutral">${escapeHtml(`${task.current_value}/${task.target_value}`)}</span>
                          </div>

                          <p><strong>Meta:</strong> ${escapeHtml(task.goal || "Sem meta definida")}</p>
                          <p><strong>Categoria:</strong> ${escapeHtml(task.category || "Sem categoria")}</p>
                          <p><strong>Inicio:</strong> ${escapeHtml(normalizeDate(task.start_date))}</p>
                          <p><strong>Fim:</strong> ${escapeHtml(normalizeDate(task.end_date))}</p>
                          <p><strong>Prazo:</strong> ${escapeHtml(normalizeDate(task.due_date))}</p>
                          <p><strong>Duracao:</strong> ${escapeHtml(formatDuration(task.duration_days))}</p>
                          <p><strong>Checklist:</strong> ${escapeHtml(formatSubtaskSummary(task))}</p>

                          <div class="subtask-section">
                            <div class="subtask-header">
                              <strong>Subtarefas</strong>
                              <span>${escapeHtml(formatSubtaskSummary(task))}</span>
                            </div>
                            ${
                              (task.subtasks || []).length
                                ? `
                                  <div class="subtask-list">
                                    ${task.subtasks
                                      .map(
                                        (subtask) => `
                                          <label class="subtask-item ${subtask.completed ? "is-complete" : ""}">
                                            <input
                                              type="checkbox"
                                              data-action="toggle-subtask"
                                              data-id="${task.id}"
                                              data-subtask-id="${subtask.id}"
                                              ${subtask.completed ? "checked" : ""}
                                            />
                                            <span>${escapeHtml(subtask.title)}</span>
                                            <button
                                              type="button"
                                              class="subtask-delete"
                                              data-action="delete-subtask"
                                              data-id="${task.id}"
                                              data-subtask-id="${subtask.id}"
                                            >
                                              Excluir
                                            </button>
                                          </label>
                                        `
                                      )
                                      .join("")}
                                  </div>
                                `
                                : `<p class="empty-state">Nenhuma subtarefa criada ainda.</p>`
                            }
                            <form class="subtask-form" data-action="add-subtask" data-id="${task.id}">
                              <input
                                type="text"
                                name="subtask-title"
                                placeholder="Adicionar uma subtarefa"
                                maxlength="120"
                              />
                              <button type="submit" class="mini-btn">Adicionar</button>
                            </form>
                          </div>

                          <div class="task-actions">
                            <button class="mini-btn" data-action="edit" data-id="${task.id}">Editar</button>
                            <button class="mini-btn" data-action="advance" data-id="${task.id}">Avancar</button>
                            <button class="danger-btn" data-action="delete" data-id="${task.id}">Excluir</button>
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

function renderAgendaSummary() {
  const today = todayString();
  const pendingReminders = reminders.filter((reminder) => !reminder.completed);
  const todaysReminders = pendingReminders.filter((reminder) => reminder.reminder_date === today).length;
  const upcoming = pendingReminders.filter((reminder) => reminder.reminder_date > today).length;
  const past = pendingReminders.filter((reminder) => reminder.reminder_date < today).length;
  const completed = reminders.filter((reminder) => reminder.completed).length;

  agendaSummary.innerHTML = [
    { label: "Para hoje", value: todaysReminders },
    { label: "Proximos", value: upcoming },
    { label: "Anteriores", value: past },
    { label: "Feitos", value: completed }
  ]
    .map(
      (item) => `
        <div class="summary-card stat-card">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `
    )
    .join("");
}

function renderReminders() {
  if (!reminders.length) {
    reminderList.innerHTML = `<p class="empty-state">Nenhum lembrete cadastrado ainda.</p>`;
    return;
  }

  reminderList.innerHTML = reminders
    .map(
      (reminder) => `
        <article class="reminder-card ${reminder.completed ? "is-complete" : ""}">
          <div>
            <h3>${escapeHtml(reminder.title)}</h3>
            <p>${escapeHtml(reminder.notes || "Sem observacoes.")}</p>
          </div>
          <div class="pill-row">
            <span class="pill neutral">${escapeHtml(normalizeDate(reminder.reminder_date))}</span>
            <span class="pill neutral">${escapeHtml(formatReminderTime(reminder.reminder_time))}</span>
            <span class="pill ${reminder.completed ? "done" : "idea"}">
              ${escapeHtml(reminder.completed ? "[x] Feito" : "[ ] Pendente")}
            </span>
          </div>
          <div class="task-actions">
            <button class="mini-btn" data-reminder-action="toggle-complete" data-id="${reminder.id}">
              ${reminder.completed ? "Desmarcar" : "Marcar como feito"}
            </button>
            <button class="mini-btn" data-reminder-action="edit" data-id="${reminder.id}">Editar</button>
            <button class="danger-btn" data-reminder-action="delete" data-id="${reminder.id}">Excluir lembrete</button>
          </div>
        </article>
      `
    )
    .join("");
}

function fillTaskForm(task) {
  document.getElementById("task-id").value = task.id;
  document.getElementById("title").value = task.title;
  document.getElementById("description").value = task.description;
  document.getElementById("goal").value = task.goal;
  document.getElementById("category").value = task.category;
  document.getElementById("priority").value = normalizePriority(task.priority);
  document.getElementById("status").value = task.status;
  document.getElementById("current_value").value = task.current_value;
  document.getElementById("target_value").value = task.target_value;
  document.getElementById("due_date").value = task.due_date ? task.due_date.slice(0, 10) : "";
  document.getElementById("start_date").value = task.start_date ? task.start_date.slice(0, 10) : "";
  document.getElementById("end_date").value = task.end_date ? task.end_date.slice(0, 10) : "";
  cancelEditButton.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function fillReminderForm(reminder) {
  document.getElementById("reminder-id").value = reminder.id;
  document.getElementById("reminder-title").value = reminder.title;
  document.getElementById("reminder-notes").value = reminder.notes;
  document.getElementById("reminder-date").value = reminder.reminder_date ? reminder.reminder_date.slice(0, 10) : "";
  document.getElementById("reminder-time").value = reminder.reminder_time || "";
  cancelReminderEditButton.classList.remove("hidden");
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

function syncCategoryFilterOptions() {
  const categories = [...new Set(tasks
    .map((task) => (task.category || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" })))];

  const currentValue = taskFilters.category;
  filterCategoryInput.innerHTML = [
    `<option value="">Todas</option>`,
    ...categories.map((category) => `<option value="${escapeHtml(category.toLowerCase())}">${escapeHtml(category)}</option>`)
  ].join("");
  filterCategoryInput.value = currentValue;
}

function updateTaskResultsCount(filteredTasks) {
  if (!tasks.length) {
    taskResultsCount.textContent = "Nenhuma tarefa cadastrada ainda.";
    return;
  }

  if (!filteredTasks.length) {
    taskResultsCount.textContent = "Nenhuma tarefa encontrada com os filtros atuais.";
    return;
  }

  if (filteredTasks.length === tasks.length) {
    taskResultsCount.textContent = `Mostrando todas as ${tasks.length} tarefas.`;
    return;
  }

  taskResultsCount.textContent = `Mostrando ${filteredTasks.length} de ${tasks.length} tarefas.`;
}

function refreshTaskViews() {
  const filteredTasks = getFilteredTasks();
  const insights = buildTaskInsights(filteredTasks);

  renderStats(insights.totals, reminders.length);
  renderTodayFocus();
  renderStatusChart(insights.statusChart);
  renderProgressChart(insights.progressChart);
  renderTasks();
  renderTable(insights.goalTable);
  updateTaskResultsCount(filteredTasks);
}

async function loadData() {
  const [taskData, reminderData] = await Promise.all([
    fetchJson("/api/tasks"),
    fetchJson("/api/reminders")
  ]);

  tasks = taskData.map((task) => ({
    ...task,
    priority: normalizePriority(task.priority)
  }));
  reminders = reminderData;
  syncCategoryFilterOptions();
  refreshTaskViews();
  renderAgendaSummary();
  renderReminders();
  updateNotificationStatus();
  await checkReminderNotifications();
}

async function handleTaskSubmit(event) {
  event.preventDefault();

  const taskId = document.getElementById("task-id").value;
  const status = document.getElementById("status").value;
  const payload = {
    title: document.getElementById("title").value.trim(),
    description: document.getElementById("description").value.trim(),
    goal: document.getElementById("goal").value.trim(),
    category: document.getElementById("category").value.trim(),
    priority: document.getElementById("priority").value,
    status,
    current_value: Number(document.getElementById("current_value").value),
    target_value: Number(document.getElementById("target_value").value),
    due_date: document.getElementById("due_date").value || null,
    start_date: document.getElementById("start_date").value || null,
    end_date: document.getElementById("end_date").value || (status === "finalizada" ? todayString() : null)
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

    resetTaskForm();
    await loadData();
  } catch (error) {
    alert(error.message);
  }
}

async function handleReminderSubmit(event) {
  event.preventDefault();

  const reminderId = document.getElementById("reminder-id").value;
  const payload = {
    title: document.getElementById("reminder-title").value.trim(),
    notes: document.getElementById("reminder-notes").value.trim(),
    reminder_date: document.getElementById("reminder-date").value,
    reminder_time: document.getElementById("reminder-time").value || null
  };

  try {
    if (reminderId) {
      await fetchJson(`/api/reminders/${reminderId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    } else {
      await fetchJson("/api/reminders", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    resetReminderForm();
    await loadData();
  } catch (error) {
    alert(error.message);
  }
}

async function handleTaskAction(event) {
  const subtaskForm = event.target.closest("form[data-action='add-subtask']");
  if (subtaskForm) {
    event.preventDefault();
    const taskId = Number(subtaskForm.dataset.id);
    const input = subtaskForm.querySelector("input[name='subtask-title']");
    const title = input?.value.trim();

    if (!title) {
      alert("Digite o titulo da subtarefa.");
      return;
    }

    try {
      await fetchJson(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        body: JSON.stringify({ title })
      });
      await loadData();
    } catch (error) {
      alert(error.message);
    }

    return;
  }

  const button = event.target.closest("button[data-action]");
  const checkbox = event.target.closest("input[data-action='toggle-subtask']");
  if (!button && !checkbox) return;

  if (checkbox) {
    try {
      await fetchJson(`/api/subtasks/${Number(checkbox.dataset.subtaskId)}`, {
        method: "PUT",
        body: JSON.stringify({
          completed: checkbox.checked
        })
      });
      await loadData();
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      alert(error.message);
    }
    return;
  }

  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  const task = tasks.find((item) => item.id === id);
  if (action !== "delete-subtask" && !task) return;

  try {
    if (action === "edit") {
      fillTaskForm(task);
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm("Deseja excluir esta tarefa do banco de dados?");
      if (!confirmed) return;
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
        body: JSON.stringify({
          status: nextStatus,
          start_date: task.start_date || todayString(),
          end_date: nextStatus === "finalizada" ? task.end_date || todayString() : task.end_date
        })
      });
    }

    if (action === "delete-subtask") {
      const confirmed = window.confirm("Deseja excluir esta subtarefa?");
      if (!confirmed) return;
      await fetchJson(`/api/subtasks/${Number(button.dataset.subtaskId)}`, {
        method: "DELETE"
      });
    }

    await loadData();
  } catch (error) {
    alert(error.message);
  }
}

async function handleReminderAction(event) {
  const button = event.target.closest("button[data-reminder-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.reminderAction;
  const reminder = reminders.find((item) => item.id === id);
  if (!reminder) return;

  try {
    if (action === "edit") {
      fillReminderForm(reminder);
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm("Deseja excluir este lembrete da agenda?");
      if (!confirmed) return;
      await fetchJson(`/api/reminders/${id}`, { method: "DELETE" });
      await loadData();
      return;
    }

    if (action === "toggle-complete") {
      await fetchJson(`/api/reminders/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          completed: !reminder.completed
        })
      });
      await loadData();
    }
  } catch (error) {
    alert(error.message);
  }
}

function handleTabChange(event) {
  const button = event.target.closest(".tab-btn");
  if (!button) return;

  const nextTab = button.dataset.tab;
  document.querySelectorAll(".tab-btn").forEach((tabButton) => {
    tabButton.classList.toggle("active", tabButton.dataset.tab === nextTab);
  });
  document.querySelectorAll(".tab-view").forEach((view) => {
    view.classList.toggle("active", view.dataset.view === nextTab);
  });
}

function handleTaskFilterChange() {
  taskFilters.search = taskSearchInput.value.trim().toLowerCase();
  taskFilters.status = filterStatusInput.value;
  taskFilters.priority = filterPriorityInput.value;
  taskFilters.category = filterCategoryInput.value;
  taskFilters.due = filterDueInput.value;
  refreshTaskViews();
}

function clearTaskFilters() {
  taskFilters.search = "";
  taskFilters.status = "";
  taskFilters.priority = "";
  taskFilters.category = "";
  taskFilters.due = "";
  taskSearchInput.value = "";
  filterStatusInput.value = "";
  filterPriorityInput.value = "";
  filterCategoryInput.value = "";
  filterDueInput.value = "";
  refreshTaskViews();
}

function applyFocusFilter(event) {
  const button = event.target.closest("button[data-focus-filter]");
  if (!button) return;

  const focusFilter = button.dataset.focusFilter;

  if (focusFilter === "today") {
    filterDueInput.value = "today";
  }
  if (focusFilter === "late") {
    filterDueInput.value = "late";
  }
  if (focusFilter === "high") {
    filterPriorityInput.value = "alta";
  }
  if (focusFilter === "execution") {
    filterStatusInput.value = "execucao";
  }

  handleTaskFilterChange();
  taskColumns.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.querySelector(".tab-nav").addEventListener("click", handleTabChange);
document.querySelector(".dashboard").addEventListener("click", applyFocusFilter);
taskForm.addEventListener("submit", handleTaskSubmit);
reminderForm.addEventListener("submit", handleReminderSubmit);
cancelEditButton.addEventListener("click", resetTaskForm);
cancelReminderEditButton.addEventListener("click", resetReminderForm);
taskColumns.addEventListener("click", handleTaskAction);
reminderList.addEventListener("click", handleReminderAction);
taskSearchInput.addEventListener("input", handleTaskFilterChange);
filterStatusInput.addEventListener("change", handleTaskFilterChange);
filterPriorityInput.addEventListener("change", handleTaskFilterChange);
filterCategoryInput.addEventListener("change", handleTaskFilterChange);
filterDueInput.addEventListener("change", handleTaskFilterChange);
clearTaskFiltersButton.addEventListener("click", clearTaskFilters);
enableNotificationsButton.addEventListener("click", () => {
  requestNotificationPermission().catch((error) => {
    console.error(error);
    alert("Nao foi possivel ativar as notificacoes.");
  });
});

resetTaskForm();
resetReminderForm();
renderGreeting();
updateNotificationStatus();
startReminderNotificationLoop();
loadData().catch((error) => {
  console.error(error);
  alert("Nao foi possivel carregar os dados da aplicacao.");
});

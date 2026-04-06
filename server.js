const express = require("express");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const dataDir =
  process.env.ORGANIZADOR_DATA_DIR ||
  path.join(process.env.LOCALAPPDATA || __dirname, "OrganizadorDoSucesso");
const dbPath = path.join(dataDir, "organizador.db");

fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(dbPath);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), { index: false }));

db.pragma("journal_mode = DELETE");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    goal TEXT DEFAULT '',
    category TEXT DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'media',
    status TEXT NOT NULL CHECK(status IN ('ideia', 'execucao', 'finalizada')),
    progress INTEGER NOT NULL DEFAULT 0,
    target_value INTEGER NOT NULL DEFAULT 100,
    current_value INTEGER NOT NULL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    due_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    notes TEXT DEFAULT '',
    reminder_date TEXT NOT NULL,
    reminder_time TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    notified_at TEXT
  );
`);

function ensureColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

ensureColumn("tasks", "start_date", "TEXT");
ensureColumn("tasks", "end_date", "TEXT");
ensureColumn("tasks", "priority", "TEXT NOT NULL DEFAULT 'media'");
ensureColumn("reminders", "completed", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("reminders", "completed_at", "TEXT");
ensureColumn("reminders", "reminder_time", "TEXT");
ensureColumn("reminders", "notified_at", "TEXT");

const allowedStatus = new Set(["ideia", "execucao", "finalizada"]);
const allowedPriority = new Set(["baixa", "media", "alta"]);

function mapTask(row) {
  return {
    ...row,
    priority: allowedPriority.has(row.priority) ? row.priority : "media",
    progress: Number(row.progress),
    target_value: Number(row.target_value),
    current_value: Number(row.current_value),
    duration_days: calculateDurationDays(row.start_date, row.end_date || row.completed_at)
  };
}

function mapReminder(row) {
  return {
    ...row,
    completed: Boolean(row.completed)
  };
}

function calculateDurationDays(startDate, endDate) {
  if (!startDate) {
    return null;
  }

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.ceil((end - start) / msPerDay));
}

function computeProgress(currentValue, targetValue, status) {
  if (status === "finalizada") {
    return 100;
  }

  if (!targetValue || targetValue <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((currentValue / targetValue) * 100)));
}

app.get("/api/tasks", (_req, res) => {
  const rows = db
    .prepare(`
      SELECT *
      FROM tasks
      ORDER BY
        CASE status WHEN 'execucao' THEN 1 WHEN 'ideia' THEN 2 ELSE 3 END,
        CASE priority WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
        updated_at DESC
    `)
    .all();

  res.json(rows.map(mapTask));
});

app.get("/api/stats", (_req, res) => {
  const tasks = db.prepare("SELECT * FROM tasks").all().map(mapTask);
  const total = tasks.length;
  const ideas = tasks.filter((task) => task.status === "ideia").length;
  const execution = tasks.filter((task) => task.status === "execucao").length;
  const finished = tasks.filter((task) => task.status === "finalizada").length;
  const averageProgress = total
    ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / total)
    : 0;

  const goalTable = tasks.map((task) => ({
    title: task.title,
    goal: task.goal || "Sem meta definida",
    priority: task.priority,
    status: task.status,
    progress: task.progress,
    current_value: task.current_value,
    target_value: task.target_value,
    start_date: task.start_date,
    end_date: task.end_date,
    duration_days: task.duration_days
  }));

  res.json({
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
    progressChart: tasks.map((task) => ({
      label: task.title,
      value: task.progress
    })),
    goalTable,
    remindersTotal: db.prepare("SELECT COUNT(*) AS total FROM reminders").get().total
  });
});

app.post("/api/tasks", (req, res) => {
  const {
    title,
    description = "",
    goal = "",
    category = "",
    priority = "media",
    status = "ideia",
    target_value = 100,
    current_value = 0,
    start_date = null,
    end_date = null,
    due_date = null
  } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: "O titulo da tarefa e obrigatorio." });
  }

  if (!allowedStatus.has(status)) {
    return res.status(400).json({ error: "Status invalido." });
  }

  if (!allowedPriority.has(priority)) {
    return res.status(400).json({ error: "Prioridade invalida." });
  }

  const numericTarget = Math.max(1, Number(target_value) || 100);
  const numericCurrent = Math.max(0, Number(current_value) || 0);
  const progress = computeProgress(numericCurrent, numericTarget, status);
  const completedAt = status === "finalizada" ? new Date().toISOString() : null;
  const normalizedStartDate = start_date || new Date().toISOString().slice(0, 10);
  const normalizedEndDate = status === "finalizada" ? end_date || new Date().toISOString().slice(0, 10) : end_date;

  const result = db
    .prepare(`
      INSERT INTO tasks (
        title, description, goal, category, priority, status, progress, target_value, current_value, start_date, end_date, due_date, completed_at
      ) VALUES (
        @title, @description, @goal, @category, @priority, @status, @progress, @target_value, @current_value, @start_date, @end_date, @due_date, @completed_at
      )
    `)
    .run({
      title: String(title).trim(),
      description: String(description).trim(),
      goal: String(goal).trim(),
      category: String(category).trim(),
      priority,
      status,
      progress,
      target_value: numericTarget,
      current_value: numericCurrent,
      start_date: normalizedStartDate,
      end_date: normalizedEndDate,
      due_date,
      completed_at: completedAt
    });

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid);
  return res.status(201).json(mapTask(task));
});

app.put("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);

  if (!existing) {
    return res.status(404).json({ error: "Tarefa nao encontrada." });
  }

  const next = {
    title: req.body.title ?? existing.title,
    description: req.body.description ?? existing.description,
    goal: req.body.goal ?? existing.goal,
    category: req.body.category ?? existing.category,
    priority: req.body.priority ?? existing.priority,
    status: req.body.status ?? existing.status,
    target_value: req.body.target_value ?? existing.target_value,
    current_value: req.body.current_value ?? existing.current_value,
    start_date: req.body.start_date ?? existing.start_date,
    end_date: req.body.end_date ?? existing.end_date,
    due_date: req.body.due_date ?? existing.due_date
  };

  if (!String(next.title).trim()) {
    return res.status(400).json({ error: "O titulo da tarefa e obrigatorio." });
  }

  if (!allowedStatus.has(next.status)) {
    return res.status(400).json({ error: "Status invalido." });
  }

  if (!allowedPriority.has(next.priority)) {
    return res.status(400).json({ error: "Prioridade invalida." });
  }

  const numericTarget = Math.max(1, Number(next.target_value) || 100);
  const numericCurrent = Math.max(0, Number(next.current_value) || 0);
  const progress = computeProgress(numericCurrent, numericTarget, next.status);
  const normalizedStartDate = next.start_date || existing.start_date || existing.created_at?.slice(0, 10);
  const normalizedEndDate =
    next.status === "finalizada"
      ? next.end_date || existing.end_date || new Date().toISOString().slice(0, 10)
      : next.end_date || null;
  const completedAt =
    next.status === "finalizada"
      ? existing.completed_at || new Date().toISOString()
      : null;

  db.prepare(`
    UPDATE tasks
    SET
      title = @title,
      description = @description,
      goal = @goal,
      category = @category,
      priority = @priority,
      status = @status,
      progress = @progress,
      target_value = @target_value,
      current_value = @current_value,
      start_date = @start_date,
      end_date = @end_date,
      due_date = @due_date,
      updated_at = CURRENT_TIMESTAMP,
      completed_at = @completed_at
    WHERE id = @id
  `).run({
    id,
    title: String(next.title).trim(),
    description: String(next.description).trim(),
    goal: String(next.goal).trim(),
    category: String(next.category).trim(),
    priority: next.priority,
    status: next.status,
    progress,
    target_value: numericTarget,
    current_value: numericCurrent,
    start_date: normalizedStartDate,
    end_date: normalizedEndDate,
    due_date: next.due_date,
    completed_at: completedAt
  });

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  return res.json(mapTask(task));
});

app.delete("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);

  if (!result.changes) {
    return res.status(404).json({ error: "Tarefa nao encontrada." });
  }

  return res.status(204).send();
});

app.get("/api/reminders", (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM reminders ORDER BY completed ASC, reminder_date ASC, COALESCE(reminder_time, '99:99') ASC, created_at DESC")
    .all();

  res.json(rows.map(mapReminder));
});

app.post("/api/reminders", (req, res) => {
  const { title, notes = "", reminder_date, reminder_time = null } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: "O titulo do lembrete e obrigatorio." });
  }

  if (!reminder_date) {
    return res.status(400).json({ error: "A data do lembrete e obrigatoria." });
  }

  const result = db
    .prepare(`
      INSERT INTO reminders (title, notes, reminder_date, reminder_time, completed, completed_at, notified_at)
      VALUES (@title, @notes, @reminder_date, @reminder_time, @completed, @completed_at, @notified_at)
    `)
    .run({
      title: String(title).trim(),
      notes: String(notes).trim(),
      reminder_date,
      reminder_time: reminder_time || null,
      completed: 0,
      completed_at: null,
      notified_at: null
    });

  const reminder = db.prepare("SELECT * FROM reminders WHERE id = ?").get(result.lastInsertRowid);
  return res.status(201).json(mapReminder(reminder));
});

app.put("/api/reminders/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM reminders WHERE id = ?").get(id);

  if (!existing) {
    return res.status(404).json({ error: "Lembrete nao encontrado." });
  }

  const next = {
    title: req.body.title ?? existing.title,
    notes: req.body.notes ?? existing.notes,
    reminder_date: req.body.reminder_date ?? existing.reminder_date,
    reminder_time: req.body.reminder_time ?? existing.reminder_time,
    completed: req.body.completed ?? existing.completed,
    notified_at: req.body.notified_at ?? undefined
  };

  if (!String(next.title).trim()) {
    return res.status(400).json({ error: "O titulo do lembrete e obrigatorio." });
  }

  if (!next.reminder_date) {
    return res.status(400).json({ error: "A data do lembrete e obrigatoria." });
  }

  const completed = Number(next.completed) ? 1 : 0;
  const completedAt = completed ? existing.completed_at || new Date().toISOString() : null;
  const normalizedReminderTime = next.reminder_time || null;
  const scheduleChanged =
    next.reminder_date !== existing.reminder_date ||
    normalizedReminderTime !== existing.reminder_time;
  const notifiedAt =
    next.notified_at !== undefined
      ? next.notified_at || null
      : scheduleChanged || completed
        ? null
        : existing.notified_at;

  db.prepare(`
    UPDATE reminders
    SET
      title = @title,
      notes = @notes,
      reminder_date = @reminder_date,
      reminder_time = @reminder_time,
      completed = @completed,
      updated_at = CURRENT_TIMESTAMP,
      completed_at = @completed_at,
      notified_at = @notified_at
    WHERE id = @id
  `).run({
    id,
    title: String(next.title).trim(),
    notes: String(next.notes).trim(),
    reminder_date: next.reminder_date,
    reminder_time: normalizedReminderTime,
    completed,
    completed_at: completedAt,
    notified_at: notifiedAt
  });

  const reminder = db.prepare("SELECT * FROM reminders WHERE id = ?").get(id);
  return res.json(mapReminder(reminder));
});

app.delete("/api/reminders/:id", (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare("DELETE FROM reminders WHERE id = ?").run(id);

  if (!result.changes) {
    return res.status(404).json({ error: "Lembrete nao encontrado." });
  }

  return res.status(204).send();
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "app-shell.html"));
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "app-shell.html"));
});

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && !process.env.PORT) {
      console.warn(`A porta ${port} ja esta em uso. Tentando ${port + 1}...`);
      startServer(port + 1);
      return;
    }

    if (error.code === "EADDRINUSE") {
      console.error(`A porta ${port} ja esta em uso.`);
      process.exit(1);
    }

    console.error("Falha ao iniciar o servidor:", error);
    process.exit(1);
  });
}

startServer(DEFAULT_PORT);

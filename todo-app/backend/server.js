"use strict";

const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const DEFAULT_DATA_FILE = path.join(__dirname, "data", "tasks.json");
const MAX_BODY_BYTES = 16 * 1024;
const VALID_PRIORITIES = new Set(["low", "medium", "high"]);

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isTaskRecord(task) {
  return Boolean(
    task &&
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.completed === "boolean" &&
    VALID_PRIORITIES.has(task.priority) &&
    (task.dueDate === null || typeof task.dueDate === "string") &&
    typeof task.createdAt === "string"
  );
}

async function readTasks(dataFile) {
  let contents;
  try {
    contents = await fs.readFile(dataFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const tasks = JSON.parse(contents);
  if (!Array.isArray(tasks) || tasks.some((task) => !isTaskRecord(task))) {
    throw new Error("The task data file must contain a valid task list.");
  }
  return tasks;
}

async function writeTasks(dataFile, tasks) {
  const directory = path.dirname(dataFile);
  const temporaryFile = `${dataFile}.${process.pid}.${randomUUID()}.tmp`;
  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.writeFile(temporaryFile, `${JSON.stringify(tasks, null, 2)}\n`, { flag: "wx" });
    await fs.rename(temporaryFile, dataFile);
  } catch (error) {
    await fs.rm(temporaryFile, { force: true });
    throw error;
  }
}

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new ApiError(413, "Request body is too large.");
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    throw new ApiError(400, "Request body must contain valid JSON.");
  }
}

function isValidDueDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateNewTask(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "Task details must be an object.");
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 120) {
    throw new ApiError(400, "Task title must contain 1 to 120 characters.");
  }

  const priority = body.priority === undefined ? "medium" : body.priority;
  if (!VALID_PRIORITIES.has(priority)) {
    throw new ApiError(400, "Priority must be low, medium, or high.");
  }

  const dueDate = body.dueDate === undefined || body.dueDate === "" ? null : body.dueDate;
  if (dueDate !== null && !isValidDueDate(dueDate)) {
    throw new ApiError(400, "Due date must be a valid YYYY-MM-DD date.");
  }

  return { title, priority, dueDate };
}

function createServer({ dataFile = DEFAULT_DATA_FILE } = {}) {
  const resolvedDataFile = path.resolve(dataFile);
  let mutationQueue = Promise.resolve();

  function mutateTasks(update) {
    const operation = mutationQueue.then(async () => {
      const tasks = await readTasks(resolvedDataFile);
      const result = update(tasks);
      await writeTasks(resolvedDataFile, tasks);
      return result;
    });
    mutationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async function handleRequest(request, response) {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    try {
      const url = new URL(request.url, "http://localhost");
      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, { status: "ok" });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/tasks") {
        sendJson(response, 200, { tasks: await readTasks(resolvedDataFile) });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/tasks") {
        const details = validateNewTask(await readJsonBody(request));
        const task = {
          id: randomUUID(),
          ...details,
          completed: false,
          createdAt: new Date().toISOString(),
        };
        await mutateTasks((tasks) => tasks.unshift(task));
        sendJson(response, 201, { task });
        return;
      }

      if (
        request.method === "DELETE" &&
        url.pathname === "/api/tasks" &&
        url.searchParams.get("completed") === "true"
      ) {
        const deleted = await mutateTasks((tasks) => {
          const remaining = tasks.filter((task) => !task.completed);
          const count = tasks.length - remaining.length;
          tasks.splice(0, tasks.length, ...remaining);
          return count;
        });
        sendJson(response, 200, { deleted });
        return;
      }

      const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
      if (taskMatch) {
        const id = decodeURIComponent(taskMatch[1]);
        if (request.method === "PATCH") {
          const body = await readJsonBody(request);
          if (!body || typeof body !== "object" || typeof body.completed !== "boolean") {
            throw new ApiError(400, "Task completion must be a boolean.");
          }
          const task = await mutateTasks((tasks) => {
            const existing = tasks.find((item) => item.id === id);
            if (!existing) throw new ApiError(404, "Task not found.");
            existing.completed = body.completed;
            return existing;
          });
          sendJson(response, 200, { task });
          return;
        }

        if (request.method === "DELETE") {
          const deleted = await mutateTasks((tasks) => {
            const index = tasks.findIndex((item) => item.id === id);
            if (index === -1) return false;
            tasks.splice(index, 1);
            return true;
          });
          if (!deleted) throw new ApiError(404, "Task not found.");
          sendJson(response, 200, { deleted: true });
          return;
        }
      }

      throw new ApiError(404, "Route not found.");
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500;
      if (status === 500) console.error("Todo API request failed.", error);
      if (!response.headersSent) sendJson(response, status, { error: status === 500 ? "Internal server error." : error.message });
      else response.end();
    }
  }

  return http.createServer((request, response) => {
    void handleRequest(request, response);
  });
}

function startServer() {
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || "127.0.0.1";
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("PORT must be an integer between 0 and 65535.");
  }

  const server = createServer({
    dataFile: process.env.TODO_DATA_FILE || DEFAULT_DATA_FILE,
  });
  server.on("error", (error) => {
    console.error("Could not start the todo backend.", error);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    const address = server.address();
    console.log(`Todo API listening at http://${host}:${address.port}`);
  });
  return server;
}

if (require.main === module) startServer();

module.exports = { createServer };

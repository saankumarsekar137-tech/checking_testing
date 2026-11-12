"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { createServer } = require("./server");

test("task API validates input and persists CRUD operations", async (t) => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "daylight-todo-"));
  const dataFile = path.join(temporaryDirectory, "tasks.json");
  const server = createServer({ dataFile });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const getTasks = () => fetch(`${baseUrl}/api/tasks`).then((response) => response.json());

  const initialResponse = await fetch(`${baseUrl}/api/tasks`);
  assert.equal(initialResponse.status, 200);
  assert.equal(initialResponse.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual((await initialResponse.json()).tasks, []);

  const invalidResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "   ", priority: "urgent" }),
  });
  assert.equal(invalidResponse.status, 400);

  const createResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Prepare demo", priority: "high", dueDate: "2026-11-20" }),
  });
  assert.equal(createResponse.status, 201);
  const { task } = await createResponse.json();
  assert.equal(task.title, "Prepare demo");
  assert.equal(task.completed, false);

  const savedTasks = JSON.parse(await fs.readFile(dataFile, "utf8"));
  assert.equal(savedTasks[0].id, task.id);

  const updateResponse = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed: true }),
  });
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).task.completed, true);

  const clearResponse = await fetch(`${baseUrl}/api/tasks?completed=true`, { method: "DELETE" });
  assert.equal((await clearResponse.json()).deleted, 1);
  assert.deepEqual((await getTasks()).tasks, []);
});

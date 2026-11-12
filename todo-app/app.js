(() => {
  "use strict";

  const STORAGE_KEY = "daylight-todo-tasks-v1";
  const filters = ["all", "today", "upcoming", "completed"];
  const elements = {
    taskForm: document.querySelector("#task-form"),
    taskInput: document.querySelector("#task-input"),
    dueDateInput: document.querySelector("#due-date-input"),
    priorityInput: document.querySelector("#priority-input"),
    taskList: document.querySelector("#task-list"),
    emptyState: document.querySelector("#empty-state"),
    emptyTitle: document.querySelector("#empty-title"),
    emptyDescription: document.querySelector("#empty-description"),
    searchInput: document.querySelector("#search-input"),
    priorityFilter: document.querySelector("#priority-filter"),
    clearCompleted: document.querySelector("#clear-completed"),
    todayLabel: document.querySelector("#today-label"),
    greeting: document.querySelector("#greeting"),
    pageTitle: document.querySelector("#page-title"),
    activeViewLabel: document.querySelector("#active-view-label"),
    tasksHeading: document.querySelector("#tasks-heading"),
    listSubtitle: document.querySelector("#list-subtitle"),
    listLabel: document.querySelector("#list-label"),
    visibleCount: document.querySelector("#visible-count"),
    footerCount: document.querySelector("#footer-count"),
    totalStat: document.querySelector("#stat-total"),
    completedStat: document.querySelector("#stat-completed"),
    progressStat: document.querySelector("#stat-progress"),
    progressBar: document.querySelector("#progress-bar"),
    progressDescription: document.querySelector("#progress-description"),
    allCount: document.querySelector("#all-count"),
    todayCount: document.querySelector("#today-count"),
    completedCount: document.querySelector("#completed-count"),
    toast: document.querySelector("#toast"),
  };

  let tasks = loadTasks();
  let activeFilter = "all";
  let priorityOnly = false;
  let toastTimer;

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function loadTasks() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error("Saved tasks are not a list.");
      return parsed.filter(isValidTask);
    } catch (error) {
      console.error("Could not load saved tasks.", error);
      return [];
    }
  }

  function isValidTask(task) {
    return Boolean(
      task &&
      typeof task.id === "string" &&
      typeof task.title === "string" &&
      typeof task.completed === "boolean" &&
      ["low", "medium", "high"].includes(task.priority) &&
      (task.dueDate === null || typeof task.dueDate === "string") &&
      typeof task.createdAt === "string"
    );
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      return true;
    } catch (error) {
      console.error("Could not save tasks in this browser.", error);
      showToast("Could not save changes. Check your browser storage.");
      return false;
    }
  }

  function formatDate(dateString, options = { month: "short", day: "numeric" }) {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined, options).format(new Date(year, month - 1, day));
  }

  function setDateAndGreeting() {
    const today = new Date();
    elements.todayLabel.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(today);

    const hour = today.getHours();
    elements.greeting.textContent = hour < 12 ? "A FRESH START" : hour < 18 ? "MAKE TODAY COUNT" : "A MOMENT TO RESET";
  }

  function getVisibleTasks() {
    const searchTerm = elements.searchInput.value.trim().toLocaleLowerCase();
    const today = localDateString();

    return tasks
      .filter((task) => {
        if (activeFilter === "today" && (task.completed || task.dueDate !== today)) return false;
        if (activeFilter === "upcoming" && (task.completed || !task.dueDate || task.dueDate <= today)) return false;
        if (activeFilter === "completed" && !task.completed) return false;
        if (priorityOnly && task.priority !== "high") return false;
        if (searchTerm && !task.title.toLocaleLowerCase().includes(searchTerm)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate !== b.dueDate) return a.dueDate ? -1 : 1;
        return a.createdAt.localeCompare(b.createdAt);
      });
  }

  function iconSvg(pathMarkup) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = pathMarkup;
    return svg;
  }

  function createTaskRow(task, index) {
    const row = document.createElement("article");
    row.className = `task-row${task.completed ? " is-completed" : ""}`;
    row.style.animationDelay = `${Math.min(index, 8) * 25}ms`;

    const check = document.createElement("button");
    check.className = "task-check";
    check.type = "button";
    check.setAttribute("aria-label", task.completed ? `Mark ${task.title} as not completed` : `Complete ${task.title}`);
    check.setAttribute("aria-pressed", String(task.completed));
    if (task.completed) check.append(iconSvg('<path d="m5 12 4 4L19 6"/>'));
    check.addEventListener("click", () => toggleTask(task.id));

    const copy = document.createElement("div");
    copy.className = "task-copy";
    const title = document.createElement("p");
    title.className = "task-title";
    title.textContent = task.title;
    copy.append(title);

    const detail = document.createElement("div");
    detail.className = "task-detail";
    if (task.dueDate) {
      const dueDate = document.createElement("span");
      dueDate.className = "task-date";
      if (!task.completed && task.dueDate < localDateString()) dueDate.classList.add("overdue");
      dueDate.append(iconSvg('<rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M7.5 3v4M16.5 3v4M4 10h16"/>'));
      dueDate.append(document.createTextNode(task.dueDate < localDateString() && !task.completed ? "Overdue" : formatDate(task.dueDate)));
      detail.append(dueDate);
    }
    const created = new Date(task.createdAt);
    if (!Number.isNaN(created.getTime())) {
      const createdLabel = document.createElement("span");
      createdLabel.textContent = `Added ${formatDate(localDateString(created))}`;
      detail.append(createdLabel);
    }
    copy.append(detail);

    const priority = document.createElement("span");
    priority.className = `priority-tag ${task.priority}`;
    priority.textContent = `${task.priority[0].toUpperCase()}${task.priority.slice(1)}`;

    const remove = document.createElement("button");
    remove.className = "delete-task";
    remove.type = "button";
    remove.setAttribute("aria-label", `Delete ${task.title}`);
    remove.append(iconSvg('<path d="M4 7h16M10 11v6m4-6v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/>'));
    remove.addEventListener("click", () => deleteTask(task.id));

    row.append(check, copy, priority, remove);
    return row;
  }

  function render() {
    const visibleTasks = getVisibleTasks();
    const today = localDateString();
    const completed = tasks.filter((task) => task.completed).length;
    const remaining = tasks.length - completed;
    const todayTasks = tasks.filter((task) => !task.completed && task.dueDate === today).length;
    const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

    elements.taskList.replaceChildren(...visibleTasks.map(createTaskRow));
    elements.emptyState.hidden = visibleTasks.length > 0;
    elements.visibleCount.textContent = String(visibleTasks.length);
    elements.totalStat.textContent = String(tasks.length);
    elements.completedStat.textContent = String(completed);
    elements.progressStat.innerHTML = `${progress}<span class="percent">%</span>`;
    elements.progressBar.style.width = `${progress}%`;
    elements.progressDescription.textContent = tasks.length
      ? `${remaining} ${remaining === 1 ? "task" : "tasks"} left to go`
      : "Every task is a step forward";
    elements.allCount.textContent = String(tasks.length);
    elements.todayCount.textContent = String(todayTasks);
    elements.completedCount.textContent = String(completed);
    elements.footerCount.textContent = `${remaining} ${remaining === 1 ? "task" : "tasks"} left`;
    elements.clearCompleted.hidden = completed === 0;

    const labels = {
      all: ["All tasks", "Your tasks", "One thing at a time. You’ve got this.", "TODAY’S FOCUS"],
      today: ["Today", "Today’s tasks", "A little progress makes a lovely day.", "DUE TODAY"],
      upcoming: ["Upcoming", "Coming up", "A little planning goes a long way.", "UP NEXT"],
      completed: ["Completed", "Completed tasks", "Look at all the things you’ve done.", "LITTLE WINS"],
    };
    const [view, heading, subtitle, listLabel] = labels[activeFilter];
    elements.activeViewLabel.textContent = view;
    elements.tasksHeading.textContent = heading;
    elements.listSubtitle.textContent = subtitle;
    elements.listLabel.textContent = listLabel;
    elements.pageTitle.innerHTML = activeFilter === "today"
      ? "Make today <span>count.</span>"
      : activeFilter === "upcoming"
        ? "A little planning, <span>a lot of ease.</span>"
        : activeFilter === "completed"
          ? "Look at you <span>go.</span>"
          : "Make room for <span>what matters.</span>";

    document.querySelectorAll(".nav-item").forEach((item) => {
      const isActive = item.dataset.filter === activeFilter;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-current", isActive ? "page" : "false");
    });

    const noTasks = tasks.length === 0;
    elements.emptyTitle.textContent = noTasks
      ? "A clear mind starts here"
      : activeFilter === "completed"
        ? "Your next little win is waiting"
        : "Nothing on this list right now";
    elements.emptyDescription.textContent = noTasks
      ? "Add your first task above and make today yours."
      : elements.searchInput.value.trim()
        ? "Try a different search or clear the search field."
        : activeFilter === "today"
          ? "No tasks due today. Enjoy the breathing room."
          : activeFilter === "upcoming"
            ? "No upcoming tasks yet. Add a due date to plan ahead."
            : activeFilter === "completed"
              ? "Complete a task and it’ll show up here."
              : "You’re all caught up. Add a task whenever you’re ready.";
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
  }

  function addTask(event) {
    event.preventDefault();
    const title = elements.taskInput.value.trim();
    if (!title) {
      elements.taskInput.focus();
      return;
    }

    const task = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      completed: false,
      priority: elements.priorityInput.value,
      dueDate: elements.dueDateInput.value || null,
      createdAt: new Date().toISOString(),
    };
    tasks = [task, ...tasks];
    if (saveTasks()) {
      elements.taskForm.reset();
      elements.taskInput.focus();
      showToast("Task added. You’ve got this!");
    }
    render();
  }

  function toggleTask(id) {
    tasks = tasks.map((task) => task.id === id ? { ...task, completed: !task.completed } : task);
    const changedTask = tasks.find((task) => task.id === id);
    if (saveTasks() && changedTask?.completed) showToast("A little win, beautifully done!");
    render();
  }

  function deleteTask(id) {
    tasks = tasks.filter((task) => task.id !== id);
    saveTasks();
    render();
    showToast("Task removed.");
  }

  function clearCompleted() {
    tasks = tasks.filter((task) => !task.completed);
    saveTasks();
    render();
    showToast("Completed tasks cleared.");
  }

  elements.taskForm.addEventListener("submit", addTask);
  elements.searchInput.addEventListener("input", render);
  elements.priorityFilter.addEventListener("click", () => {
    priorityOnly = !priorityOnly;
    elements.priorityFilter.classList.toggle("selected", priorityOnly);
    elements.priorityFilter.setAttribute("aria-pressed", String(priorityOnly));
    render();
  });
  elements.clearCompleted.addEventListener("click", clearCompleted);
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      if (filters.includes(item.dataset.filter)) {
        activeFilter = item.dataset.filter;
        render();
      }
    });
  });

  setDateAndGreeting();
  render();
})();

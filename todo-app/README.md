# Daylight Todo

Daylight is a responsive todo app split into a static frontend and a Node.js JSON API backend.

## Run locally

Start the backend in one terminal:

```sh
cd todo-app/backend
node server.js
```

In another terminal, serve the frontend:

```sh
cd todo-app/frontend
python3 -m http.server 5500
```

Open `http://localhost:5500`. The frontend connects to `http://localhost:3001/api` by default. The backend stores tasks in `backend/data/tasks.json`; set `PORT`, `HOST`, or `TODO_DATA_FILE` to change its defaults.

## Build and test

The frontend build copies the browser assets into `frontend/dist`. The backend build copies its runnable server into `backend/dist`, and the backend test uses only Node.js built-in modules.

```sh
cd todo-app/frontend && node build.js
cd ../backend && node build.js && node --test
```

The Jenkins pipeline runs the frontend and backend builds in separate stages and runs the backend API tests.

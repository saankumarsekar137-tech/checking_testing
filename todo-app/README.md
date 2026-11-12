# Daylight Todo

A standalone, responsive todo app built with vanilla HTML, CSS, and JavaScript. No build step or package installation is required.

## Run it

Open `index.html` in a modern browser. Tasks are saved in that browser's local storage and stay on the current device.

The Jenkins pipeline also includes a `todo app stage` that checks the app files and validates `app.js` with Node.js. The Jenkins agent needs Node.js available on its `PATH` for that stage.

## Features

- Add tasks with optional due dates and low, medium, or high priority
- Mark tasks complete, delete tasks, or clear completed tasks
- Filter by all tasks, today, upcoming, or completed
- Search task titles and filter for high-priority items
- Track completion progress, with a responsive glossy interface and subtle transitions

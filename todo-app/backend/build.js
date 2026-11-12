"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const outputDirectory = path.join(__dirname, "dist");

async function build() {
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.copyFile(path.join(__dirname, "server.js"), path.join(outputDirectory, "server.js"));
  console.log(`Backend built to ${outputDirectory}`);
}

build().catch((error) => {
  console.error("Backend build failed.", error);
  process.exitCode = 1;
});

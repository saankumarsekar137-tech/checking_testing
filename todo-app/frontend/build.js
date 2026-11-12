"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const outputDirectory = path.join(__dirname, "dist");
const assets = ["index.html", "styles.css", "app.js"];

async function build() {
  await fs.mkdir(outputDirectory, { recursive: true });
  for (const asset of assets) {
    await fs.copyFile(path.join(__dirname, asset), path.join(outputDirectory, asset));
  }
  console.log(`Frontend built to ${outputDirectory}`);
}

build().catch((error) => {
  console.error("Frontend build failed.", error);
  process.exitCode = 1;
});

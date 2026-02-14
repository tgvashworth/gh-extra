import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync, existsSync, cpSync } from "fs";

const isWatch = process.argv.includes("--watch");

const commonOptions = {
  bundle: true,
  sourcemap: true,
  target: "chrome120",
  minify: !isWatch,
  logLevel: "info",
};

const entryPoints = [
  {
    entryPoints: ["src/background.ts"],
    outfile: "dist/background.js",
    format: "esm",
  },
  {
    entryPoints: ["src/content.ts"],
    outfile: "dist/content.js",
    format: "iife",
  },
  {
    entryPoints: ["src/options/options.ts"],
    outfile: "dist/options/options.js",
    format: "iife",
  },
];

function copyStaticFiles() {
  mkdirSync("dist/options", { recursive: true });
  mkdirSync("dist/icons", { recursive: true });

  copyFileSync("manifest.json", "dist/manifest.json");
  copyFileSync("src/options/options.html", "dist/options/options.html");

  if (existsSync("icons")) {
    cpSync("icons", "dist/icons", { recursive: true });
  }
}

async function build() {
  copyStaticFiles();

  if (isWatch) {
    const contexts = await Promise.all(
      entryPoints.map((ep) => esbuild.context({ ...commonOptions, ...ep }))
    );
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log("Watching for changes...");
  } else {
    await Promise.all(
      entryPoints.map((ep) => esbuild.build({ ...commonOptions, ...ep }))
    );
    console.log("Build complete.");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});

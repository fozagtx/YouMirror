import { cpSync, mkdirSync } from "node:fs";

mkdirSync("public/mediapipe", { recursive: true });
cpSync("node_modules/@mediapipe/tasks-vision/wasm", "public/mediapipe", { recursive: true });

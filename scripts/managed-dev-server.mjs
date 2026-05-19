import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { Socket } from "node:net";
import { dirname, resolve } from "node:path";

const serverRoot = resolve(process.env.DEV_SERVER_CWD ?? process.cwd());
const sessionName = process.env.DEV_SERVER_SESSION;
const label = process.env.DEV_SERVER_LABEL ?? "dev-server";
const logPath = resolve(serverRoot, process.env.DEV_SERVER_LOG ?? "logs/dev-server.log");
const host = process.env.DEV_SERVER_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.DEV_SERVER_PORT ?? "", 10);
const serveCommand = process.env.DEV_SERVER_COMMAND;
const action = process.argv[2] ?? "status";

if (!sessionName || !serveCommand || !Number.isInteger(port)) {
  console.error(
    `[${label}] DEV_SERVER_SESSION, DEV_SERVER_COMMAND, and DEV_SERVER_PORT must be set`
  );
  process.exit(1);
}

const command = [
  `cd ${shellQuote(serverRoot)}`,
  `${serveCommand} 2>&1 | tee -a ${shellQuote(logPath)}`
].join(" && ");

switch (action) {
  case "dev":
    await dev();
    break;
  case "start":
    start();
    break;
  case "stop":
    stop();
    break;
  case "restart":
    stop({ quiet: true });
    start();
    break;
  case "status":
    status();
    break;
  case "logs":
    logs(false);
    break;
  case "tail":
    logs(true);
    break;
  case "attach":
    attach();
    break;
  default:
    usage();
    process.exit(1);
}

async function dev() {
  if (await isListening()) {
    if (!hasSession()) {
      console.log(`[${label}] ${host}:${port} is listening without tmux session ${sessionName}`);
      await killPortListeners();
      await waitForPort(false);
      await startAndAttach();
      return;
    }
    attach();
    return;
  }

  stop({ quiet: true });
  await startAndAttach();
}

async function startAndAttach() {
  start();
  await waitForStartup();
  attach();
}

function start() {
  mkdirSync(dirname(logPath), { recursive: true });

  if (hasSession()) {
    console.log(`[${label}] already running in tmux session ${sessionName}`);
    console.log(`[${label}] logs: ${logPath}`);
    return;
  }

  run("tmux", ["new-session", "-d", "-s", sessionName, "zsh", "-lc", command]);
  console.log(`[${label}] started tmux session ${sessionName}`);
  console.log(`[${label}] logs: ${logPath}`);
}

function stop({ quiet = false } = {}) {
  if (!hasSession()) {
    if (!quiet) {
      console.log(`[${label}] not running: ${sessionName}`);
    }
    return;
  }

  run("tmux", ["kill-session", "-t", sessionName]);
  if (!quiet) {
    console.log(`[${label}] stopped tmux session ${sessionName}`);
  }
}

function status() {
  if (hasSession()) {
    console.log(`[${label}] running: ${sessionName}`);
    console.log(`[${label}] logs: ${logPath}`);
    return;
  }
  console.log(`[${label}] stopped: ${sessionName}`);
}

function logs(follow) {
  mkdirSync(dirname(logPath), { recursive: true });
  const args = follow ? ["-n", "200", "-f", logPath] : ["-n", "200", logPath];
  run("tail", args, { inherit: true });
}

function attach() {
  if (!hasSession()) {
    console.error(`[${label}] not running: ${sessionName}`);
    process.exit(1);
  }
  run("tmux", ["attach-session", "-t", sessionName], { inherit: true });
}

async function killPortListeners() {
  const pids = listPortListenerPids();

  if (pids.length === 0) {
    console.log(`[${label}] no listener pids found for ${host}:${port}`);
    return;
  }

  console.log(`[${label}] killing stale listener pid${pids.length === 1 ? "" : "s"} ${pids.join(", ")}`);
  sendSignal(pids, "TERM");

  if (await waitForPort(false, { exitOnTimeout: false, attempts: 20 })) {
    return;
  }

  const remainingPids = listPortListenerPids();
  if (remainingPids.length === 0) {
    return;
  }

  console.log(`[${label}] force killing stale listener pid${remainingPids.length === 1 ? "" : "s"} ${remainingPids.join(", ")}`);
  sendSignal(remainingPids, "KILL");
}

function listPortListenerPids() {
  const result = spawnSync("lsof", ["-tiTCP:" + String(port), "-sTCP:LISTEN"], {
    cwd: serverRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return [...new Set(result.stdout
    .split(/\s+/)
    .map((pid) => pid.trim())
    .filter(Boolean))];
}

function sendSignal(pids, signal) {
  const killResult = spawnSync("kill", [`-${signal}`, ...pids], {
    cwd: serverRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (killResult.status !== 0) {
    const stderr = killResult.stderr?.trim();
    if (stderr) {
      console.error(stderr);
    }
    process.exit(killResult.status ?? 1);
  }
}

function hasSession() {
  const result = spawnSync("tmux", ["has-session", "-t", sessionName], {
    cwd: serverRoot,
    stdio: "ignore"
  });
  return result.status === 0;
}

function run(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: serverRoot,
    stdio: options.inherit ? "inherit" : "pipe",
    encoding: "utf8"
  });
  if (result.status === 0) {
    return result;
  }

  const stderr = result.stderr?.trim();
  if (stderr) {
    console.error(stderr);
  }
  process.exit(result.status ?? 1);
}

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function isListening() {
  return new Promise((resolveListening) => {
    const socket = new Socket();

    socket.once("connect", () => {
      socket.destroy();
      resolveListening(true);
    });

    socket.once("error", () => {
      socket.destroy();
      resolveListening(false);
    });

    socket.connect(port, host);
  });
}

async function waitForPort(expectedListening, options = {}) {
  const attempts = options.attempts ?? 50;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if ((await isListening()) === expectedListening) {
      return true;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }

  if (options.exitOnTimeout === false) {
    return false;
  }

  const state = expectedListening ? "start listening" : "stop listening";
  console.error(`[${label}] timed out waiting for ${host}:${port} to ${state}`);
  process.exit(1);
}

async function waitForStartup() {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (await isListening()) {
      return;
    }

    if (!hasSession()) {
      console.error(`[${label}] tmux session ${sessionName} exited before ${host}:${port} started`);
      logs(false);
      process.exit(1);
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }

  console.error(`[${label}] timed out waiting for ${host}:${port} to start`);
  logs(false);
  process.exit(1);
}

function usage() {
  console.error("Usage: managed-dev-server <dev|start|stop|restart|status|logs|tail|attach>");
}

// src/service-contender.ts
import { spawn } from "node:child_process";
var stderrLimit = 8 * 1024;
function spawnServiceContender2(command, args, env) {
  const child = spawn(command, args, {
    detached: true,
    stdio: ["ignore", "ignore", "pipe"],
    env: { ...process.env, ...env }
  });
  let error;
  let closed = false;
  let stderr = Buffer.alloc(0);
  const onStderr = (chunk) => {
    const tail = chunk.subarray(-stderrLimit);
    stderr = tail.length === stderrLimit ? Buffer.from(tail) : Buffer.concat([stderr.subarray(-(stderrLimit - tail.length)), tail]);
  };
  child.stderr?.on("data", onStderr);
  if (child.stderr !== null && "unref" in child.stderr && typeof child.stderr.unref === "function")
    child.stderr.unref();
  child.once("error", (cause) => {
    error = new Error("Failed to start server", { cause });
  });
  child.once("close", () => {
    closed = true;
  });
  child.unref();
  return {
    child,
    error: () => error,
    closed: () => closed,
    stderr: () => stderr.toString("utf8").trim(),
    release: () => {
      child.stderr?.off("data", onStderr);
      child.stderr?.resume();
      stderr = Buffer.alloc(0);
    }
  };
}
function contenderFailure2(contender) {
  const error = contender.error();
  if (error !== undefined)
    return error;
  if (contender.child.exitCode !== null && contender.child.exitCode !== 0)
    return startupError(`Server process exited with code ${contender.child.exitCode}`, contender.stderr());
  if (contender.child.signalCode !== null)
    return startupError(`Server process terminated by ${contender.child.signalCode}`, contender.stderr());
  return;
}
function contenderFinished2(contender) {
  return contender.error() !== undefined || contender.closed();
}
function startupError(message, stderr) {
  return new Error(stderr ? `${message}
${stderr}` : message);
}

export { spawnServiceContender2, contenderFailure2, contenderFinished2 };

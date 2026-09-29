import { spawn } from "node:child_process";
import { platform } from "node:os";

const child = spawn("npm", ["run", "dev"], { stdio: "inherit", shell: true });
const opener = platform() === "darwin" ? ["open"] : platform() === "win32" ? ["cmd", "/c", "start"] : ["xdg-open"];
setTimeout(() => spawn(opener[0], [...opener.slice(1), "http://localhost:3000"], { stdio: "ignore" }), 2500);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 0));

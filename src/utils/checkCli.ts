import { spawn, exec } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { BeLinkReviewEnsureResult } from "@/types";

const execAsync = promisify(exec);

interface CheckCliInstallOptions {
  apiKey: string;
  silent?: boolean;
  agentPath?: string;
}

// Cursor 官方安装脚本默认将 agent 放在 ~/.local/bin
const LOCAL_BIN = join(homedir(), ".local", "bin");

// 常见的 Cursor CLI 安装路径
const COMMON_AGENT_PATHS = [
  join(LOCAL_BIN, "agent"),             // Cursor 官方安装脚本默认路径
  join(homedir(), ".cursor", "agent"),
  "/usr/local/bin/agent",
  "/opt/homebrew/bin/agent",
];

/**
 * 将 ~/.local/bin 写入用户 shell 配置文件（.zshrc / .bashrc），
 * 并立即注入当前进程的 PATH，确保安装后无需重启终端即可使用。
 */
function setupLocalBinPath(silent: boolean): void {
  // 立即让当前进程能找到 agent
  if (!process.env.PATH?.includes(LOCAL_BIN)) {
    process.env.PATH = `${LOCAL_BIN}:${process.env.PATH}`;
  }

  const exportLine = `\nexport PATH="$HOME/.local/bin:$PATH"`;
  const shell = process.env.SHELL ?? "";
  const rcFiles: string[] = [];

  if (shell.includes("zsh")) {
    rcFiles.push(join(homedir(), ".zshrc"));
  } else if (shell.includes("bash")) {
    rcFiles.push(join(homedir(), ".bashrc"));
  } else {
    // 两个都写，保证覆盖
    rcFiles.push(join(homedir(), ".zshrc"), join(homedir(), ".bashrc"));
  }

  for (const rc of rcFiles) {
    try {
      const content = existsSync(rc)
        ? require("node:fs").readFileSync(rc, "utf-8")
        : "";
      if (!content.includes(".local/bin")) {
        appendFileSync(rc, exportLine);
        if (!silent) {
          console.log(`[review-mark] 已将 ~/.local/bin 写入 ${rc}`);
        }
      }
    } catch {
      // 写入失败不阻断流程
    }
  }
}

async function findAgentExecutable(
  userAgentPath?: string
): Promise<string | null> {
  // 1. 优先使用用户指定的路径
  if (userAgentPath && existsSync(userAgentPath)) {
    return userAgentPath;
  }

  // 2. 尝试通过 which 命令在 PATH 中查找
  try {
    const { stdout } = await execAsync("which agent");
    const pathFromWhich = stdout.trim();
    if (pathFromWhich && existsSync(pathFromWhich)) {
      return pathFromWhich;
    }
  } catch (error) {
    // ignore error, continue to next method
  }

  // 3. 检查常见安装路径
  for (const path of COMMON_AGENT_PATHS) {
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

export async function isCheckCliInstall(
  options: CheckCliInstallOptions
): Promise<BeLinkReviewEnsureResult> {
  const { silent = false, agentPath: userAgentPath } = options;

  let actualAgentPath = await findAgentExecutable(userAgentPath);

  if (actualAgentPath) {
    if (!silent) {
      console.log(
        `[review-mark] Cursor CLI (agent) 已在 ${actualAgentPath} 找到。`
      );
    }
    return { isInstalled: true, message: "Cursor CLI 已安装", actualAgentPath };
  }

  if (!silent) {
    console.log("[review-mark] Cursor CLI (agent) 未找到，正在尝试安装...");
    console.log(
      "[review-mark] 执行安装命令: curl https://cursor.com/install -fsS | bash"
    );
  }

  return new Promise((resolve, reject) => {
    const installProcess = spawn(
      "bash",
      ["-c", "curl https://cursor.com/install -fsS | bash"],
      {
        stdio: "inherit", // 将安装过程的输出直接显示给用户
      }
    );

    installProcess.on("close", async (code) => {
      if (code === 0) {
        // 安装完成后自动配置 PATH（写入 rc 文件 + 注入当前进程）
        setupLocalBinPath(silent);

        // 再次检查 agent 命令是否可用
        actualAgentPath = await findAgentExecutable(userAgentPath);
        if (actualAgentPath) {
          if (!silent) {
            console.log("[review-mark] Cursor CLI 安装成功。");
          }
          resolve({
            isInstalled: true,
            message: "Cursor CLI 安装成功",
            actualAgentPath,
          });
        } else {
          reject(
            new Error(
              `[review-mark] Cursor CLI 安装命令执行成功，但未找到 agent 可执行文件。请手动检查安装：curl https://cursor.com/install -fsS | bash。`
            )
          );
        }
      } else {
        reject(
          new Error(
            `[review-mark] Cursor CLI 安装失败，退出码 ${code}。请手动安装：curl https://cursor.com/install -fsS | bash。`
          )
        );
      }
    });

    installProcess.on("error", (err) => {
      reject(
        new Error(
          `[review-mark] 无法启动安装进程：${err.message}。请手动安装：curl https://cursor.com/install -fsS | bash`
        )
      );
    });
  });
}

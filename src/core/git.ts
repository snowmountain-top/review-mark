import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// 固定的忽略文件模式，这些文件将永远不会被审查
const FIXED_IGNORE_PATTERNS = ["package.json"];

async function runGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

export async function getGitDiff(
  userIgnorePatterns: string[] = [],
  cwd: string = process.cwd()
): Promise<string> {
  // 检查是否在 git 仓库中
  try {
    await runGit(["rev-parse", "--git-dir"], cwd);
  } catch (error) {
    console.error(`[review-mark] 当前目录不是 git 仓库: ${cwd}`);
    return "";
  }

  // 合并固定忽略模式和用户提供的忽略模式
  const allIgnorePatterns = [
    ...new Set([...FIXED_IGNORE_PATTERNS, ...userIgnorePatterns]),
  ];
  // 使用 execFile 直接传参，完全绕过 shell，:(exclude) 不会被解析
  // git 参数顺序：git diff [options] [commit] -- [pathspec]
  // options/commit 必须在 -- 和 pathspec 之前
  const excludeArgs = allIgnorePatterns.map((p) => `:(exclude)${p}`);

  let diff = "";

  try {
    // 优先使用 git diff --cached 获取暂存区的改动
    diff = await runGit(
      ["diff", "--no-color", "--relative", "--cached", "--", ...excludeArgs],
      cwd
    );
    if (diff) {
      console.log("[review-mark] 检测到暂存区改动");
    }
  } catch (error: any) {
    console.warn(`[review-mark] 获取暂存区 diff 失败: ${error.message}`);
  }

  if (!diff) {
    try {
      // 如果暂存区没有改动，则获取工作区和 HEAD 的改动
      diff = await runGit(
        ["diff", "--no-color", "--relative", "HEAD", "--", ...excludeArgs],
        cwd
      );
      if (diff) {
        console.log("[review-mark] 检测到工作区改动（相对于 HEAD）");
      }
    } catch (error: any) {
      console.warn(`[review-mark] 获取工作区 diff 失败: ${error.message}`);
    }
  }

  if (!diff) {
    console.log("[review-mark] 未检测到代码改动（已检查暂存区和工作区）");
  }

  return diff;
}

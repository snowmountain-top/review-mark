import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  BeLinkReviewOptions,
  BeLinkReviewChatOptions,
  BeLinkReviewEnsureResult,
} from "../types";
import { isCheckCliInstall } from "../utils/checkCli";
import { getGitDiff } from "./git";
import { generateAIPrompt } from "./prompt";
import { sendReviewToFeishu } from "./feishu";

export class BeLinkReview {
  static #instance: BeLinkReview | null = null;
  #apiKey: string | undefined;
  #agentPath: string | undefined;
  #ignorePatterns: string[] | undefined;
  #enableFeishu: boolean;

  private constructor(
    apiKey?: string,
    agentPath?: string,
    ignorePatterns?: string[],
    enableFeishu: boolean = true
  ) {
    this.#apiKey = apiKey;
    this.#agentPath = agentPath;
    this.#ignorePatterns = ignorePatterns;
    this.#enableFeishu = enableFeishu;
  }

  /**
   * 初始化单例并注入参数，在项目入口调用一次即可。
   * 负责保存 apiKey 和自动写入 package.json 脚本。
   * 此方法主要用于在用户项目中设置 apiKey 和脚本，CLI 运行时会优先从环境变量或命令行参数获取。
   */
  static init(options: BeLinkReviewOptions = {}): BeLinkReview {
    if (BeLinkReview.#instance === null) {
      BeLinkReview.#instance = new BeLinkReview(
        options.apiKey,
        options.agentPath,
        options.ignore,
        options.enableFeishu ?? true
      );
    } else {
      BeLinkReview.#instance.#apiKey = options.apiKey; // 允许重新初始化时更新 apiKey
      BeLinkReview.#instance.#agentPath = options.agentPath; // 允许重新初始化时更新 agentPath
      BeLinkReview.#instance.#ignorePatterns = options.ignore; // 允许重新初始化时更新 ignorePatterns
      BeLinkReview.#instance.#enableFeishu = options.enableFeishu ?? true; // 允许重新初始化时更新飞书开关
    }
    BeLinkReview.#instance.#setupProjectScript();
    return BeLinkReview.#instance;
  }

  /**
   * 获取单例实例。如果未通过 init() 初始化，则尝试从环境变量 CURSOR_API_KEY 获取。
   * @param cliApiKey 可选的命令行传入的 apiKey
   * @param cliAgentPath 可选的命令行传入的 agentPath
   * @param cliIgnorePatterns 可选的命令行传入的 ignorePatterns
   * @param cliEnableFeishu 可选的命令行传入的飞书开关
   */
  static getInstance(
    cliApiKey?: string,
    cliAgentPath?: string,
    cliIgnorePatterns?: string[],
    cliEnableFeishu?: boolean
  ): BeLinkReview {
    if (BeLinkReview.#instance === null) {
      const apiKey = cliApiKey || process.env.CURSOR_API_KEY;
      const agentPath = cliAgentPath || process.env.CURSOR_AGENT_PATH;
      const ignorePatterns =
        cliIgnorePatterns ||
        (process.env.BE_LINK_REVIEW_IGNORE
          ? process.env.BE_LINK_REVIEW_IGNORE.split(",")
          : undefined);
      const enableFeishu =
        cliEnableFeishu ?? process.env.FEISHU_ENABLED !== "false";

      if (!apiKey) {
        throw new Error(
          '[review-mark] 请先调用 BeLinkReview.init({ apiKey: "..." }) 初始化，或设置环境变量 CURSOR_API_KEY，或通过命令行参数 --apiKey 传入。'
        );
      }
      BeLinkReview.#instance = new BeLinkReview(
        apiKey,
        agentPath,
        ignorePatterns,
        enableFeishu
      );
    } else {
      // 如果单例已存在，但参数未设置，且命令行传入了，则更新
      if (cliApiKey && !BeLinkReview.#instance.#apiKey) {
        BeLinkReview.#instance.#apiKey = cliApiKey;
      }
      if (cliAgentPath && !BeLinkReview.#instance.#agentPath) {
        BeLinkReview.#instance.#agentPath = cliAgentPath;
      }
      if (cliIgnorePatterns && !BeLinkReview.#instance.#ignorePatterns) {
        BeLinkReview.#instance.#ignorePatterns = cliIgnorePatterns;
      }
      if (cliEnableFeishu !== undefined) {
        BeLinkReview.#instance.#enableFeishu = cliEnableFeishu;
      }
    }
    return BeLinkReview.#instance;
  }

  #getApiKey(): string {
    const apiKey = this.#apiKey || process.env.CURSOR_API_KEY;
    if (!apiKey) {
      throw new Error(
        '[review-mark] 请先在 init({ apiKey: "..." }) 中传入 apiKey，或设置环境变量 CURSOR_API_KEY，或通过命令行参数 --apiKey 传入。'
      );
    }
    return apiKey;
  }

  #getAgentPath(): string | undefined {
    return this.#agentPath || process.env.CURSOR_AGENT_PATH;
  }

  #getIgnorePatterns(): string[] {
    const envIgnore = process.env.BE_LINK_REVIEW_IGNORE
      ? process.env.BE_LINK_REVIEW_IGNORE.split(",")
      : [];
    return this.#ignorePatterns || envIgnore;
  }

  #isFeishuEnabled(): boolean {
    return this.#enableFeishu;
  }

  /**
   * 自动往用户项目 package.json 写入 script
   */
  async #setupProjectScript() {
    try {
      const packageJsonPath = join(process.cwd(), "package.json");
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      if (!packageJson.scripts["review-mark"]) {
        packageJson.scripts["review-mark"] = "review-mark";
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log(
          "[review-mark] 已在 package.json 中添加 'review-mark' 脚本。"
        );
      } else {
        console.log("[review-mark] 'review-mark' 脚本已存在，跳过添加。");
      }
    } catch (error) {
      console.error("[review-mark] 无法更新 package.json: ", error);
    }
  }

  /**
   * 执行一次完整 CLI 流程：获取 git diff → 生成 prompt → 检查/安装 CLI → 与 Cursor 对话并打印结果。
   */
  async goCli(): Promise<string> {
    const apiKey = this.#getApiKey();
    const agentPath = this.#getAgentPath();
    const ignorePatterns = this.#getIgnorePatterns();

    const ensureResult = await this.ensureAgentInstalled(false, agentPath);

    if (!ensureResult.isInstalled) {
      throw new Error(
        "[review-mark] Cursor CLI 未安装且自动安装失败，请手动安装。"
      );
    }

    console.log("[review-mark] Getting git diff...");
    const diff = await getGitDiff(ignorePatterns, process.cwd());

    if (!diff) {
      console.log("[review-mark] No code changes detected");
      return "No code changes detected";
    }

    const prompt = generateAIPrompt(diff);
    console.log("[review-mark] Sending to AI...");
    const response = await this.chat(prompt, {
      agentPath: ensureResult.actualAgentPath,
      force: true,
    });
    console.log("===== AI Review =====");
    console.log(response);

    // 如果启用了飞书，发送到飞书
    if (this.#isFeishuEnabled()) {
      try {
        await sendReviewToFeishu(response);
      } catch (error: any) {
        console.error(
          `[review-mark] 飞书通知发送失败，但不影响 review 结果: ${error.message}`
        );
      }
    }

    return response;
  }

  /**
   * 检查 Cursor CLI 是否已安装；未安装则自动安装（需网络）。
   * @param silent 为 true 时不打印「已安装」等提示
   * @param agentPath 可选的 agent 可执行文件路径
   */
  async ensureAgentInstalled(
    silent = false,
    agentPath?: string
  ): Promise<BeLinkReviewEnsureResult> {
    return isCheckCliInstall({ apiKey: this.#getApiKey(), silent, agentPath });
  }

  /**
   * 通过 Cursor Headless CLI 与 Cursor 对话（发送 prompt，拿到回复）。
   * 默认会先执行 ensureAgentInstalled（检查/安装 CLI），再启动 agent 执行提问。
   * 参考：https://cursor.com/cn/docs/cli/headless
   */
  async chat(
    prompt: string,
    options: BeLinkReviewChatOptions = {}
  ): Promise<string> {
    const actualAgentPath =
      options.agentPath || this.#getAgentPath() || "agent";
    const args: string[] = ["--yolo", "-p", prompt];
    if (options.outputFormat === "json") args.push("--output-format", "json");

    return new Promise((resolve, reject) => {
      const env = { ...process.env, CURSOR_API_KEY: this.#getApiKey() };
      const proc = spawn(actualAgentPath, args, {
        env,
        cwd: process.cwd(),
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      proc.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      proc.on("error", (err) => {
        reject(
          new Error(
            `[review-mark] 无法启动 Cursor CLI (${actualAgentPath})，请先安装：curl https://cursor.com/install -fsS | bash。原始错误: ${err.message}`
          )
        );
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `[review-mark] agent 退出码 ${code}${
                stderr ? `: ${stderr.trim()}` : ""
              }`
            )
          );
          return;
        }
        resolve(stdout.trim());
      });
    });
  }
}

import { Command } from "commander";
import { BeLinkReview } from "../core/BeLinkReview";

const program = new Command();

program
  .name("review-mark")
  .description("AI-powered code review tool")
  .version("1.0.0")
  .option(
    "--apiKey <key>",
    "Cursor API Key (overrides CURSOR_API_KEY environment variable)"
  )
  .option(
    "--agentPath <path>",
    "Path to the Cursor CLI agent executable (overrides CURSOR_AGENT_PATH environment variable)"
  )
  .option(
    "--ignore <patterns>",
    "Comma-separated list of glob patterns to ignore (e.g., *.lock,dist/**)"
  )
  .option(
    "--feishu-app-id <appId>",
    "Feishu App ID (overrides FEISHU_APP_ID environment variable)"
  )
  .option(
    "--feishu-app-secret <appSecret>",
    "Feishu App Secret (overrides FEISHU_APP_SECRET environment variable)"
  )
  .option(
    "--feishu-receive-id <receiveId>",
    "Feishu Receive ID - user open_id or chat_id (overrides FEISHU_RECEIVE_ID environment variable)"
  )
  .option(
    "--feishu-receive-id-type <type>",
    "Feishu Receive ID Type: open_id, user_id, chat_id, email, union_id (default: chat_id)"
  )
  .option(
    "--feishu-type <type>",
    "Feishu message type: text, post, or interactive (default: interactive)"
  )
  .option(
    "--feishu-title <title>",
    "Feishu message title (default: 🔍 Code Review 结果)"
  )
  .option("--no-feishu", "Disable Feishu notification")
  .action(async (options) => {
    try {
      const ignorePatterns = options.ignore
        ? options.ignore.split(",")
        : undefined;

      const instance = BeLinkReview.getInstance(
        options.apiKey,
        options.agentPath,
        ignorePatterns,
        options.feishu !== false
      );
      await instance.goCli();
    } catch (error: any) {
      console.error(`[review-mark] Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command("review")
  .description("Perform an AI code review on git diff")
  .option(
    "--apiKey <key>",
    "Cursor API Key (overrides CURSOR_API_KEY environment variable)"
  )
  .option(
    "--agentPath <path>",
    "Path to the Cursor CLI agent executable (overrides CURSOR_AGENT_PATH environment variable)"
  )
  .option(
    "--ignore <patterns>",
    "Comma-separated list of glob patterns to ignore (e.g., *.lock,dist/**)"
  )
  .option(
    "--feishu-app-id <appId>",
    "Feishu App ID (overrides FEISHU_APP_ID environment variable)"
  )
  .option(
    "--feishu-app-secret <appSecret>",
    "Feishu App Secret (overrides FEISHU_APP_SECRET environment variable)"
  )
  .option(
    "--feishu-receive-id <receiveId>",
    "Feishu Receive ID - user open_id or chat_id (overrides FEISHU_RECEIVE_ID environment variable)"
  )
  .option(
    "--feishu-receive-id-type <type>",
    "Feishu Receive ID Type: open_id, user_id, chat_id, email, union_id (default: chat_id)"
  )
  .option(
    "--feishu-type <type>",
    "Feishu message type: text, post, or interactive (default: interactive)"
  )
  .option(
    "--feishu-title <title>",
    "Feishu message title (default: 🔍 Code Review 结果)"
  )
  .option("--no-feishu", "Disable Feishu notification")
  .action(async (options) => {
    try {
      const ignorePatterns = options.ignore
        ? options.ignore.split(",")
        : undefined;

      const instance = BeLinkReview.getInstance(
        options.apiKey,
        options.agentPath,
        ignorePatterns,
        options.feishu !== false
      );
      await instance.goCli();
    } catch (error: any) {
      console.error(`[review-mark] Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);

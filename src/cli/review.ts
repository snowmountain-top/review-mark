import { Command } from "commander";
import { BeLinkReview } from "../core/BeLinkReview";

const program = new Command();

const sharedOptions = (cmd: Command) =>
  cmd
    .option(
      "--apiKey <key>",
      "Cursor API Key (overrides CURSOR_API_KEY environment variable)"
    )
    .option(
      "--agentPath <path>",
      "Path to the Cursor CLI agent executable (overrides CURSOR_AGENT_PATH environment variable)"
    )
    .option(
      "--model <model>",
      "AI model to use, e.g. claude-3-5-sonnet (overrides CURSOR_MODEL environment variable)"
    )
    .option(
      "--ignore <patterns>",
      "Comma-separated list of glob patterns to ignore (e.g., *.lock,dist/**)"
    )
    .option("--no-feishu", "Disable Feishu notification");

const runAction = async (options: any) => {
  try {
    const ignorePatterns = options.ignore
      ? options.ignore.split(",")
      : undefined;

    const instance = BeLinkReview.getInstance(
      options.apiKey,
      options.agentPath,
      ignorePatterns,
      options.feishu !== false,
      options.model
    );
    await instance.goCli();
  } catch (error: any) {
    console.error(`[review-mark] Error: ${error.message}`);
    process.exit(1);
  }
};

sharedOptions(
  program
    .name("review-mark")
    .description("AI-powered code review tool")
    .version("1.0.0")
).action(runAction);

sharedOptions(
  program.command("review").description("Perform an AI code review on git diff")
).action(runAction);

program.parse(process.argv);

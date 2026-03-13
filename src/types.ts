export interface BeLinkReviewOptions {
  apiKey?: string;
  agentPath?: string;
  ignore?: string[];
  enableFeishu?: boolean;
  model?: string; // 指定 AI 模型，默认 composer-1，可选值见 agent --list-models
}

export interface BeLinkReviewChatOptions {
  agentPath?: string;
  force?: boolean;
  outputFormat?: "json" | "text";
  model?: string;
}

export interface BeLinkReviewEnsureResult {
  isInstalled: boolean;
  message: string;
  actualAgentPath?: string; // 实际找到的 agent 路径
}

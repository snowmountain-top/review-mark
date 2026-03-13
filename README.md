# review-mark

A powerful CLI tool for AI-powered code review using Git diffs.

## 目标

`review-mark` 旨在提供一个自动化 AI 代码审查解决方案。用户可以在自己的项目中初始化该工具后，通过简单的 CLI 命令自动获取 `git diff`，并将其发送给 AI 进行代码审查，从而帮助开发者发现潜在的 bug、逻辑问题、性能问题和代码风格问题，并获得优化建议。

## 特性

- **TypeScript 支持**: 整个项目使用 TypeScript 编写，提供强大的类型安全和开发体验。
- **ESM + CommonJS**: 支持现代 Node.js 环境下的 ESM 和 CommonJS 模块系统。
- **CLI 工具**: 基于 `commander` 构建，提供友好的命令行接口。
- **自动化 Git Diff**: 自动检测并获取 Git 仓库中的代码变更（包括暂存区和工作区）。
- **AI 代码审查**: 将 Git diff 发送给 Cursor CLI 进行 AI 驱动的代码审查。
- **Cursor CLI 自动检测与安装**: 自动检测 `agent` 命令是否存在，如果不存在则提示并提供安装指引。
- **易于集成**: 通过简单的 `init` 方法即可在用户项目中配置 `review` 脚本。
- **可发布到 npm**: 完整的项目结构和打包配置，方便发布到 npm。

## 项目结构

```
review-mark
│
├─ src
│ ├─ core
│ │ ├─ BeLinkReview.ts
│ │ ├─ git.ts
│ │ └─ prompt.ts
│ │
│ ├─ cli
│ │ └─ review.ts
│ │
│ ├─ utils
│ │ └─ checkCli.ts
│ │
│ └─ index.ts
│
├─ package.json
├─ tsconfig.json
├─ tsup.config.ts
└─ README.md
```

## 技术栈

- **语言**: TypeScript
- **运行时**: Node.js 18+
- **CLI 框架**: [commander](https://www.npmjs.com/package/commander)
- **打包工具**: [tsup](https://www.npmjs.com/package/tsup)
- **AI 引擎**: [Cursor CLI](https://cursor.com/cn/docs/cli/headless)

## 安装

首先，在你的项目根目录安装 `review-mark` 作为开发依赖：

```bash
pnpm add -D review-mark
```

## 使用

### 1. 初始化

在你的项目入口文件（例如 `src/main.ts` 或 `app.ts`）中，调用 `BeLinkReview.init()` 方法进行初始化。你需要提供一个 `apiKey`，这将用于 Cursor CLI 的认证。

```typescript
// src/main.ts (或你的项目入口文件)
import { BeLinkReview } from "review-mark";

BeLinkReview.init({
  apiKey: process.env.CURSOR_API_KEY || "YOUR_CURSOR_API_KEY", // 建议从环境变量获取
});

// 你可以在这里继续你的应用逻辑
```

`BeLinkReview.init()` 会自动检测并向你的 `package.json` 文件中添加一个 `review-mark` 脚本：

```json
// package.json
{
  "scripts": {
    "review-mark": "review-mark"
  }
}
```

如果 `review` 脚本已存在，则会跳过添加。

### 2. 执行代码审查

初始化完成后，你可以在项目根目录执行以下命令来运行 AI 代码审查：

```bash
pnpm run review-mark
```

CLI 将会执行以下步骤：

1. **获取 Git Diff**: 优先获取 `git diff --cached`（暂存区改动），如果为空则获取 `git diff HEAD`（工作区改动）。
2. **检测 Cursor CLI**: 检查 `agent` 命令是否存在。如果不存在，将提示你安装 Cursor CLI。
3. **生成 AI Prompt**: 根据获取到的 Git diff 生成 AI 审查提示。
4. **发送给 AI**: 调用 Cursor CLI (`agent -p prompt`) 并设置 `CURSOR_API_KEY` 环境变量。
5. **输出结果**: 捕获 AI 的返回结果并格式化输出。

#### CLI 输出示例

```
[review-mark] Getting git diff...
[review-mark] Sending to AI...
===== AI Review =====
(这里是 AI 返回结果)
```

如果检测到没有代码变更，则会输出：

```
[review-mark] No code changes detected
```

## 配置

### 基础配置

`BeLinkReview.init()` 接受一个配置对象：

```typescript
interface BeLinkReviewOptions {
  apiKey?: string; // 你的 Cursor API Key
  agentPath?: string; // Cursor CLI agent 可执行文件路径
  ignore?: string[]; // 需要忽略的文件模式
  feishu?: FeiShuConfig; // 飞书机器人配置
}
```

建议将 `apiKey` 作为环境变量 `CURSOR_API_KEY` 进行管理，以避免将其硬编码到代码中。

### 飞书机器人集成

`review-mark` 已**完全内置**飞书机器人功能，所有飞书配置已写死在代码中，**无需任何配置即可使用**！

#### 1. 开箱即用

✅ 飞书配置已完全内置，包括：

- App ID 和 App Secret
- 接收者 ID (群聊/用户)
- 消息类型和标题

**直接使用，无需配置：**

```bash
# 只需配置 Cursor API Key
CURSOR_API_KEY=your_api_key pnpm run review
```

代码审查结果会自动发送到预配置的飞书群聊！

#### 2. 禁用飞书通知（可选）

如果需要禁用飞书通知，可以通过以下方式：

**方式一：环境变量**

```bash
FEISHU_ENABLED=false pnpm run review
```

**方式二：CLI 参数**

```bash
pnpm run review --no-feishu
```

**方式三：代码配置**

```typescript
BeLinkReview.init({
  apiKey: process.env.CURSOR_API_KEY,
  enableFeishu: false,
});
```

#### 3. 修改内置配置

如果需要修改飞书配置（如更换群聊、修改消息格式等），可以直接编辑 `src/constants.ts` 文件：

```typescript
// src/constants.ts
export const appId = "cli_a93822da7238dbb5";
export const appSecret = "ZQdcpLUHFb4gFa8cGfrlJfVfSSyGtyzF";
export const receiveId = "oc_482b6a04f95f4206c4fa9bc61829fd17"; // 修改为你的群聊 ID
export const receiveIdType = "chat_id";
export const messageType = "interactive"; // text | post | interactive
export const messageTitle = "🔍 Code Review 结果";
```

#### 4. 常见问题

**Q: 飞书通知会发送到哪里？**  
A: 发送到 `constants.ts` 中配置的 `receiveId` 对应的群聊或用户。

**Q: 如何更换接收群聊？**  
A: 修改 `src/constants.ts` 中的 `receiveId` 为新的群聊 chat_id，然后重新构建项目。

**Q: 支持哪些消息格式？**  
A: 支持三种格式：

- `interactive` (默认): 美观的消息卡片，支持 Markdown
- `post`: 富文本格式
- `text`: 纯文本格式

**Q: 如何完全禁用飞书功能？**  
A: 使用 `--no-feishu` 参数或设置 `FEISHU_ENABLED=false` 环境变量。

## 开发

### 构建项目

```bash
cd review-mark
pnpm install
pnpm run build
```

这将使用 `tsup` 将 TypeScript 代码编译为 `dist/index.js` (ESM) 和 `dist/index.cjs` (CommonJS)。

### 运行 CLI (开发模式)

```bash
pnpm run start
```

这将直接运行 `dist/cli/review.js`。

## 贡献

欢迎提交 Issue 或 Pull Request。

## 许可证

ISC License

---

**Manus AI** 生成

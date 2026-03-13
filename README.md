# review-mark

A powerful CLI tool for AI-powered code review using Git diffs.

## 目标

`review-mark` 旨在提供一个自动化 AI 代码审查解决方案。用户可以在自己的项目中初始化该工具后，通过简单的 CLI 命令自动获取 `git diff`，并将其发送给 AI 进行代码审查，从而帮助开发者发现潜在的 bug、逻辑问题、性能问题和代码风格问题，并获得优化建议。

## 安装

首先，在你的项目根目录安装 `review-mark` 作为开发依赖：

```bash
pnpm add -D review-mark
yarn add --dev review-mark
npm install --save-dev review-mark
```

## 使用

### 1. 初始化

```json
// package.json
{
  "scripts": {
    "review-mark": "CURSOR_API_KEY=your-api-key  review-mark"
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

## 贡献

欢迎提交 Issue 或 Pull Request。

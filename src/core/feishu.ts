import * as lark from "@larksuiteoapi/node-sdk";
import {
  appId,
  appSecret,
  receiveId,
  receiveIdType,
  messageType,
  messageTitle,
} from "../constants";

/**
 * 发送 Code Review 结果到飞书
 * 使用飞书官方 Node.js SDK，所有配置从 constants.ts 读取
 */
export async function sendReviewToFeishu(reviewContent: string): Promise<void> {
  console.log("[review-mark] 正在发送消息到飞书...");
  console.log(`[review-mark] 消息类型: ${messageType}`);

  try {
    // 初始化飞书客户端
    const client = new lark.Client({
      appId,
      appSecret,
      domain: lark.Domain.Feishu,
    });

    // 根据消息类型构造消息内容
    let msgContent: string;
    let msgType: string;

    if (messageType === "interactive") {
      // Interactive 卡片消息（支持 Markdown 渲染）
      msgContent = JSON.stringify({
        config: {
          wide_screen_mode: true,
        },
        header: {
          title: {
            tag: "plain_text",
            content: messageTitle,
          },
          template: "blue",
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: reviewContent,
            },
          },
          {
            tag: "hr",
          },
          {
            tag: "note",
            elements: [
              {
                tag: "plain_text",
                content: `生成时间: ${new Date().toLocaleString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                })}`,
              },
            ],
          },
        ],
      });
      msgType = "interactive";
    } else if (messageType === "post") {
      // Post 富文本消息
      msgContent = JSON.stringify({
        zh_cn: {
          title: messageTitle,
          content: convertMarkdownToFeishuPost(reviewContent),
        },
      });
      msgType = "post";
    } else if (messageType === "text") {
      // Text 纯文本消息
      msgContent = JSON.stringify({
        text: `${messageTitle}\n\n${reviewContent}`,
      });
      msgType = "text";
    } else {
      throw new Error(`[review-mark] 不支持的消息类型: ${messageType}`);
    }

    // 调试日志
    console.log(`[review-mark] 发送参数:`);
    console.log(`  - receive_id_type: ${receiveIdType}`);
    console.log(`  - receive_id: ${receiveId}`);
    console.log(`  - msg_type: ${msgType}`);

    // 调用发送消息接口
    const response = await client.im.message.create({
      params: {
        receive_id_type: receiveIdType,
      },
      data: {
        receive_id: receiveId,
        msg_type: msgType,
        content: msgContent,
      },
    });

    if (response.code !== 0) {
      throw new Error(
        `[review-mark] 飞书 API 返回错误: ${response.msg || "未知错误"}`
      );
    }

    console.log("[review-mark] ✅ 飞书消息发送成功");
    console.log(
      `[review-mark] 消息 ID: ${response.data?.message_id || "未知"}`
    );
  } catch (error: any) {
    console.error(`[review-mark] ❌ 飞书消息发送失败: ${error.message}`);
    throw error;
  }
}

/**
 * 将 Markdown 格式转换为飞书 post 格式
 * 飞书 post 格式支持富文本样式
 */
function convertMarkdownToFeishuPost(markdown: string): any[][] {
  const lines = markdown.split("\n");
  const result: any[][] = [];

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  for (const line of lines) {
    // 处理代码块
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        // 代码块结束
        if (codeBlockContent.length > 0) {
          result.push([
            {
              tag: "text",
              text: codeBlockContent.join("\n"),
              style: ["code"],
            },
          ]);
          codeBlockContent = [];
        }
        inCodeBlock = false;
      } else {
        // 代码块开始
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // 空行
    if (!line.trim()) {
      result.push([{ tag: "text", text: "" }]);
      continue;
    }

    // 标题（加粗 + 加大）
    if (line.startsWith("#")) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const text = line.replace(/^#+\s*/, "");
      result.push([
        {
          tag: "text",
          text: text,
          style: level <= 2 ? ["bold", "underline"] : ["bold"],
        },
      ]);
      continue;
    }

    // 解析行内样式（加粗、链接等）
    const parsedLine = parseLineStyles(line);
    result.push(parsedLine);
  }

  // 如果还在代码块中，添加剩余内容
  if (codeBlockContent.length > 0) {
    result.push([
      {
        tag: "text",
        text: codeBlockContent.join("\n"),
        style: ["code"],
      },
    ]);
  }

  return result;
}

/**
 * 解析行内样式（加粗、链接、代码等）
 */
function parseLineStyles(line: string): any[] {
  const elements: any[] = [];
  let currentText = "";
  let i = 0;

  while (i < line.length) {
    // 处理加粗 **text**
    if (line[i] === "*" && line[i + 1] === "*") {
      if (currentText) {
        elements.push({ tag: "text", text: currentText });
        currentText = "";
      }
      const endIndex = line.indexOf("**", i + 2);
      if (endIndex !== -1) {
        const boldText = line.substring(i + 2, endIndex);
        elements.push({ tag: "text", text: boldText, style: ["bold"] });
        i = endIndex + 2;
        continue;
      }
    }

    // 处理行内代码 `code`
    if (line[i] === "`" && line[i + 1] !== "`") {
      if (currentText) {
        elements.push({ tag: "text", text: currentText });
        currentText = "";
      }
      const endIndex = line.indexOf("`", i + 1);
      if (endIndex !== -1) {
        const codeText = line.substring(i + 1, endIndex);
        elements.push({
          tag: "text",
          text: codeText,
          style: ["code"],
        });
        i = endIndex + 1;
        continue;
      }
    }

    // 处理链接 [text](url)
    if (line[i] === "[") {
      const textEnd = line.indexOf("](", i);
      const urlEnd = line.indexOf(")", textEnd + 2);
      if (textEnd !== -1 && urlEnd !== -1) {
        if (currentText) {
          elements.push({ tag: "text", text: currentText });
          currentText = "";
        }
        const linkText = line.substring(i + 1, textEnd);
        const url = line.substring(textEnd + 2, urlEnd);
        elements.push({
          tag: "a",
          text: linkText,
          href: url,
        });
        i = urlEnd + 1;
        continue;
      }
    }

    currentText += line[i];
    i++;
  }

  if (currentText) {
    elements.push({ tag: "text", text: currentText });
  }

  return elements.length > 0 ? elements : [{ tag: "text", text: line }];
}

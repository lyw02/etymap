import { GraphEdge, GraphNode } from "./graph.models";
import type { NodeContent, RichTextSpan } from "./types";

function parseGraphStructure(plainText: string) {
  // 1. 从<structure>标签中提取内容
  const match = plainText.match(/<structure>([\s\S]*?)<\/structure>/);
  if (!match || !match[1]) {
    // 如果没有匹配项或内容为空，返回空数组
    return { nodes: [], edges: [] };
  }

  // 2. 按行分割并过滤空行
  const lines = match[1]
    .trim()
    .split("\n")
    .filter((line) => line.trim() !== "");

  const nodeLabels = new Set<string>();
  const edges = [];

  // 3. 遍历每一行
  for (const line of lines) {
    // 3.1 根据 " - " 分割成一个关系链
    const parts = line.split(" - ").map((p) => p.trim());

    // 3.2 从右到左处理关系链，建立边
    // 例如 A - B - C， 先处理 C -> B，再处理 B -> A
    for (let i = parts.length - 1; i > 0; i--) {
      const currentTarget = parts[i - 1];
      let sourcesExpr = parts[i];

      // 目标节点不可能是节点组，直接添加
      nodeLabels.add(currentTarget);

      let sourceLabels;

      // 3.3 检查是否为括号内的节点组
      if (sourcesExpr.startsWith("(") && sourcesExpr.endsWith(")")) {
        // 如果是，移除括号并只按 '+' 分割
        const innerExpr = sourcesExpr.slice(1, -1).trim();
        sourceLabels = innerExpr.split(/\s*\+\s*/);
      } else {
        // 否则，整个表达式（包括'&'）是单个节点的标签
        sourceLabels = [sourcesExpr];
      }

      // 3.4 为每个源节点创建一条边
      for (const sourceLabel of sourceLabels) {
        const trimmedSource = sourceLabel.trim();
        if (trimmedSource) {
          nodeLabels.add(trimmedSource);
          edges.push(new GraphEdge(trimmedSource, currentTarget));
        }
      }
    }
  }

  // 4. 将Set转换为要求的格式
  const nodes = Array.from(nodeLabels).map((label) => new GraphNode(label));

  return { nodes, edges };
}

function parseGraphContent(plainText: string): NodeContent[] {
  const match = plainText.match(/<content>([\s\S]*?)<\/content>/);
  if (!match || !match[1]) {
    return [];
  }

  const results: NodeContent[] = [];
  const sections = match[1].trim().split(/\n@/);

  if (sections.length > 0 && sections[0].startsWith("@")) {
    sections[0] = sections[0].substring(1);
  }

  for (const section of sections) {
    const firstColonIndex = section.indexOf(":");
    if (firstColonIndex === -1) {
      continue;
    }

    const label = section.substring(0, firstColonIndex).trim();
    const contentString = section.substring(firstColonIndex + 1).trim();

    // --- 全新的解析逻辑开始 ---

    let generatedSpans: RichTextSpan[] = [];

    // 1. 定义基础样式和样式栈
    const baseStyle: RichTextSpan = {
      text: "",
      font: "Times New Roman",
      weight: "normal",
      fontStyle: "normal",
      size: 14,
      color: "#000000",
    };
    const styleStack: RichTextSpan[] = [baseStyle];

    let processedContent = contentString
      .replace(/>\s*</g, "> & <") // <> 和 <> 之间用 ' & '
      .replace(/\}\}\s*\{\{/g, "}} {{"); // {{}} 和 {{}} 之间用 ' '

    // 2. 新的分词正则表达式：它会切分字符串，并保留所有的标记作为独立的词元
    const tokens = processedContent
      .split(/(\{\{|\}\}|<|>|\(\(|\)\)|@\(|\)|\({|}\)|\[|\])/g)
      .filter(Boolean); // filter(Boolean) 用于移除分割产生的空字符串

    // --- 新增(2): 使用新的、更清晰的状态机 ---
    // 'start': 内容开始
    // 'opening': 上一个有意义的词元是开标签
    // 'closing': 上一个有-意义的词元是闭标签
    // 'text':    上一个有意义的词元是文本
    let lastSignificantTokenType: "start" | "opening" | "closing" | "text" =
      "start";
    let lastOpeningToken = "";

    // 3. 遍历所有词元（包括标记和文本）
    for (const token of tokens) {
      const currentStyle = styleStack[styleStack.length - 1]; // 获取栈顶的当前样式

      switch (token) {
        // --- 处理开启标记 ---
        case "<":
        case "{{":
        case "[":
        // case "@(": // @( 也视为一种开标签
        case "((":
        case "({":
          // --- 新增(3): 全新的换行判断逻辑 ---
          // 如果上一个有意义的词元是“闭标签”，则在此“开标签”前换行
          if (
            lastSignificantTokenType === "closing" &&
            (token === "{{" ||
              token === "[" ||
              (token === "<" && lastOpeningToken !== "<"))
          ) {
            const styleForNewline = styleStack[styleStack.length - 1];
            generatedSpans.push({ ...styleForNewline, text: "\n" });
          }

          if (token === "[") {
            const styleForNewline = styleStack[styleStack.length - 1];
            generatedSpans.push({ ...styleForNewline, text: "- " });
          }

          if (token === "({") {
            const styleForNewline = styleStack[styleStack.length - 1];
            generatedSpans.push({ ...styleForNewline, text: " (" });
          }

          // 应用样式
          if (
            token === "<"
            // || token === "@("
          ) {
            styleStack.push({ ...currentStyle, weight: "bold" });
          } else if (token === "{{") {
            styleStack.push({ ...currentStyle, fontStyle: "italic" });
          } else if (token === "((") {
            styleStack.push({ ...currentStyle, weight: "lighter" });
          } else if (token === "({") {
            styleStack.push({ ...currentStyle, weight: 100 });
          } else if (token === "[") {
            styleStack.push({ ...currentStyle });
          }

          // 更新状态
          lastSignificantTokenType = "opening";
          lastOpeningToken = token;
          break;

        // --- 处理闭合标记 ---
        case ">":
        case "}}":
        case "))":
        case "})":
        case "]":
          if (styleStack.length > 1) {
            styleStack.pop();
          }

          if (token === "})") {
            const styleForNewline = styleStack[styleStack.length - 1];
            generatedSpans.push({ ...styleForNewline, text: ") " });
          }

          // 更新状态
          lastSignificantTokenType = "closing";
          break;

        // --- 处理纯文本 ---
        default:
          if (token.trim()) {
            // 使用栈顶的样式创建文本片段
            generatedSpans.push({ ...currentStyle, text: token });
          }
          break;
      }
    }

    // 4. 合并逻辑：在所有片段生成后，进行最后一次合并
    const content: RichTextSpan[] = [];
    for (const span of generatedSpans) {
      const lastSpan = content.length > 0 ? content[content.length - 1] : null;
      if (
        lastSpan &&
        lastSpan.font === span.font &&
        lastSpan.weight === span.weight &&
        lastSpan.fontStyle === span.fontStyle &&
        lastSpan.size === span.size &&
        lastSpan.color === span.color
      ) {
        // 如果样式完全相同，则合并文本
        lastSpan.text += span.text;
      } else {
        // 否则，添加一个新的片段
        content.push(span);
      }
    }

    results.push({
      label,
      content,
    });
  }
  return results;
}

export { parseGraphStructure, parseGraphContent };

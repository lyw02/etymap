import type { RichTextSpan, RichTextWordChunk } from "./types";

function calculateRectLayout(
  ctx: CanvasRenderingContext2D,
  textSpans: RichTextSpan[],
  // x: number,
  // y: number,
  options = {}
) {
  ctx.save();

  // --- 设置默认值和配置 ---
  const config = {
    maxWidth: 100,
    padding: 15,
    defaultFont: "Times New Roman",
    defaultSize: 14,
    defaultWeight: "normal",
    defaultFontStyle: "normal",
    defaultColor: "#111827",
    bgColor: "#e5e7eb",
    lineHeightRatio: 1.4,
    borderRadius: 8,
    ...options,
  };

  const getFontString = (style: RichTextWordChunk["style"]) => {
    // 从 style 对象中获取各个属性，如果未提供，则使用 config 中的默认值
    const size = style.size || config.defaultSize;
    const fontFamily = style.font || config.defaultFont;

    // 关键改动：直接使用 weight 属性，可以是关键字或数字
    const weight = style.weight || config.defaultWeight;

    // 关键改动：新增 fontStyle 属性来专门控制斜体
    const fontStyle = style.fontStyle || config.defaultFontStyle;

    // 按照 CSS font 属性的正确顺序构建字符串
    // 顺序: font-style | font-variant | font-weight | font-size/line-height | font-family
    // 这里我们简化为: style weight size family
    console.log(`${fontStyle} ${weight} ${size}px ${fontFamily}`);
    return `${fontStyle} ${weight} ${size}px ${fontFamily}`;
  };

  // --- 2. 预处理文本：将输入片段分解为带样式的单个单词 ---
  const wordChunks: RichTextWordChunk[] = [];
  console.log("wordChunks", wordChunks);
  for (const span of textSpans) {
    // 支持用户在文本中通过 '\n' 手动换行
    const paragraphs = span.text.split("\n");
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      paragraph.split(" ").forEach((word) => {
        if (word) {
          // 过滤掉连续空格产生的空字符串
          wordChunks.push({ text: word, style: span });
        }
      });
      // 在段落之间添加一个换行标记
      if (i < paragraphs.length - 1) {
        wordChunks.push({ text: "\n", style: {} });
      }
    }
  }

  // --- 处理文本换行（核心逻辑） ---
  // lines 数组将存储每一行，每一行又是一个包含多个单词块（chunk）的数组
  const lines: RichTextWordChunk[][] = [[]];
  let currentLine = lines[0];
  let currentLineWidth = 0;

  for (const chunk of wordChunks) {
    // 如果是手动换行符，则直接创建新行
    if (chunk.text === "\n") {
      lines.push([]);
      currentLine = lines[lines.length - 1];
      currentLineWidth = 0;
      continue;
    }

    ctx.font = getFontString(chunk.style);
    const wordWidth = ctx.measureText(chunk.text).width; // 测量文字尺寸，实现自适应的核心方法
    const spaceWidth = currentLine.length > 0 ? ctx.measureText(" ").width : 0;

    if (
      currentLineWidth + spaceWidth + wordWidth > config.maxWidth &&
      currentLine.length > 0
    ) {
      // 当前行太长了，开始一个新行
      lines.push([]);
      currentLine = lines[lines.length - 1];
      currentLineWidth = 0;
    }

    // 将单词块添加到当前行
    currentLine.push(chunk);
    currentLineWidth += (currentLineWidth === 0 ? 0 : spaceWidth) + wordWidth;
  }

  // --- 4. 计算整体尺寸 ---
  const lineDimensions = [];
  let maxContentWidth = 0;
  let totalContentHeight = 0;

  for (const line of lines) {
    let lineWidth = 0;
    let maxLineHeight = 0; // 一行的高度由该行中最大的字体决定
    if (line.length === 0) {
      // 处理空行（由连续的'\n'产生）
      maxLineHeight = config.defaultSize * config.lineHeightRatio;
    } else {
      for (let i = 0; i < line.length; i++) {
        const chunk = line[i];
        const style = chunk.style;
        ctx.font = getFontString(style);

        // 计算行高
        const fontSize = style.size || config.defaultSize;
        const currentChunkHeight = fontSize * config.lineHeightRatio;
        if (currentChunkHeight > maxLineHeight) {
          maxLineHeight = currentChunkHeight;
        }

        // 计算行宽
        const space = i > 0 ? " " : "";
        lineWidth += ctx.measureText(space + chunk.text).width;
      }
    }

    if (lineWidth > maxContentWidth) {
      maxContentWidth = lineWidth;
    }
    totalContentHeight += maxLineHeight;
    lineDimensions.push({ width: lineWidth, height: maxLineHeight });
  }

  const rectWidth = maxContentWidth + config.padding * 2;
  const rectHeight = totalContentHeight + config.padding * 2;

  // // --- 计算矩形左上角坐标（根据中心点）---
  // const rectX = x - rectWidth / 2;
  // const rectY = y - rectHeight / 2;

  // // --- 绘制带圆角的背景矩形 ---
  // drawRoundedRect(ctx, rectX, rectY, rectWidth, rectHeight, config);

  // // --- 6. 逐行逐块地绘制文字 ---
  // ctx.textBaseline = "top";
  // let currentY = rectY + config.padding;

  // for (let i = 0; i < lines.length; i++) {
  //   const line = lines[i];
  //   const lineDim = lineDimensions[i];
  //   let currentX = rectX + config.padding;

  //   for (const chunk of line) {
  //     const style = chunk.style;
  //     ctx.font = getFontString(style);
  //     // ctx.font = "italic 16px Times New Roman";
  //     ctx.fillStyle = style.color || config.defaultColor;

  //     // 绘制文字
  //     ctx.fillText(chunk.text, currentX, currentY);

  //     // 更新 X 坐标，准备绘制下一个单词块
  //     currentX += ctx.measureText(chunk.text + " ").width;
  //   }

  //   // 更新 Y 坐标，准备绘制下一行
  //   currentY += lineDim.height;
  // }

  // ctx.restore();

  return { rectHeight, rectWidth, lines, lineDimensions, config };
}

/**
 * 新函数 2: 根据计算好的布局在指定中心点进行绘制
 */
function drawRectFromLayout(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  layout: ReturnType<typeof calculateRectLayout>
) {
  const { rectWidth, rectHeight, lines, lineDimensions, config } = layout;

  ctx.save();

  const rectX = centerX - rectWidth / 2;
  const rectY = centerY - rectHeight / 2;

  // 绘制背景矩形
  drawRoundedRect(ctx, rectX, rectY, rectWidth, rectHeight, config);

  // 绘制文字
  ctx.textBaseline = "top";
  let currentY = rectY + config.padding;

  const getFontString = (style: RichTextWordChunk["style"]) => {
    // 从 style 对象中获取各个属性，如果未提供，则使用 config 中的默认值
    const size = style.size || config.defaultSize;
    const fontFamily = style.font || config.defaultFont;

    // 关键改动：直接使用 weight 属性，可以是关键字或数字
    const weight = style.weight || config.defaultWeight;

    // 关键改动：新增 fontStyle 属性来专门控制斜体
    const fontStyle = style.fontStyle || config.defaultFontStyle;

    // 按照 CSS font 属性的正确顺序构建字符串
    // 顺序: font-style | font-variant | font-weight | font-size/line-height | font-family
    // 这里我们简化为: style weight size family
    console.log(`${fontStyle} ${weight} ${size}px ${fontFamily}`);
    return `${fontStyle} ${weight} ${size}px ${fontFamily}`;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineDim = lineDimensions[i];
    let currentX = rectX + config.padding;

    for (const chunk of line) {
      const style = chunk.style;
      ctx.font = getFontString(style);
      // ctx.font = "italic 16px Times New Roman";
      ctx.fillStyle = style.color || config.defaultColor;

      // 绘制文字
      ctx.fillText(chunk.text, currentX, currentY);

      // 更新 X 坐标，准备绘制下一个单词块
      currentX += ctx.measureText(chunk.text + " ").width;
    }
    currentY += lineDim.height;
  }

  ctx.restore();
}

function drawRectWithText(
  ctx: CanvasRenderingContext2D,
  textSpans: RichTextSpan[],
  x: number,
  y: number,
  options = {}
) {
  const layout = calculateRectLayout(ctx, textSpans, options);
  drawRectFromLayout(ctx, x, y, layout);
  return { rectHeight: layout.rectHeight, rectWidth: layout.rectWidth };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  config: { bgColor: string; borderRadius: number }
) {
  ctx.save();
  ctx.fillStyle = config.bgColor;
  ctx.beginPath();
  ctx.moveTo(x + config.borderRadius, y);
  ctx.lineTo(x + width - config.borderRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + config.borderRadius);
  ctx.lineTo(x + width, y + height - config.borderRadius);
  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - config.borderRadius,
    y + height
  );
  ctx.lineTo(x + config.borderRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - config.borderRadius);
  ctx.lineTo(x, y + config.borderRadius);
  ctx.quadraticCurveTo(x, y, x + config.borderRadius, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export { drawRectWithText, calculateRectLayout, drawRectFromLayout };

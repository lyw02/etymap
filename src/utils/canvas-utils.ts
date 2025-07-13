function drawRectWithText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options = {}
) {
  ctx.save();

  // --- 设置默认值和配置 ---
  const config = {
    maxWidth: 100,
    padding: 15,
    font: "16px sans-serif",
    lineHeightRatio: 1.4,
    textColor: "#111827",
    bgColor: "#e5e7eb",
    borderRadius: 8,
    ...options,
  };

  // 应用字体设置，这对于准确测量至关重要
  ctx.font = config.font;

  // 高度测量比较复杂，一个简便且有效的方法是直接使用字体大小
  // 'actualBoundingBoxAscent' 和 'actualBoundingBoxDescent' 可以提供更精确的高度，但为了简单起见，我们用字体大小
  const fontHeight = parseInt(config.font, 10);
  const lineHeight = fontHeight * config.lineHeightRatio;

  // --- 处理文本换行（核心逻辑） ---
  const lines = [];
  const paragraphs = text.split("\n"); // 首先按用户指定的换行符分割

  for (const paragraph of paragraphs) {
    const words = paragraph.split(" ");
    let currentLine = words[0] || "";

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + " " + word;
      const testWidth = ctx.measureText(testLine).width; // 测量文字尺寸，实现自适应的核心方法

      if (testWidth > config.maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
  }

  // --- 计算整体尺寸 ---
  // 找到最长的一行来确定矩形宽度
  let maxTextWidth = 0;
  for (const line of lines) {
    const lineWidth = ctx.measureText(line).width;
    if (lineWidth > maxTextWidth) {
      maxTextWidth = lineWidth;
    }
  }

  const rectWidth = maxTextWidth + config.padding * 2;
  const rectHeight = lines.length * lineHeight + config.padding * 2;

  // this.nodeWidth = rectWidth;
  // this.nodeHeight = rectHeight;

  // --- 计算矩形左上角坐标（根据中心点）---
  const rectX = x - rectWidth / 2;
  const rectY = y - rectHeight / 2;

  // --- 绘制带圆角的背景矩形 ---
  ctx.fillStyle = config.bgColor;
  ctx.beginPath();
  ctx.moveTo(rectX + config.borderRadius, rectY);
  ctx.lineTo(rectX + rectWidth - config.borderRadius, rectY);
  ctx.quadraticCurveTo(
    rectX + rectWidth,
    rectY,
    rectX + rectWidth,
    rectY + config.borderRadius
  );
  ctx.lineTo(rectX + rectWidth, rectY + rectHeight - config.borderRadius);
  ctx.quadraticCurveTo(
    rectX + rectWidth,
    rectY + rectHeight,
    rectX + rectWidth - config.borderRadius,
    rectY + rectHeight
  );
  ctx.lineTo(rectX + config.borderRadius, rectY + rectHeight);
  ctx.quadraticCurveTo(
    rectX,
    rectY + rectHeight,
    rectX,
    rectY + rectHeight - config.borderRadius
  );
  ctx.lineTo(rectX, rectY + config.borderRadius);
  ctx.quadraticCurveTo(rectX, rectY, rectX + config.borderRadius, rectY);
  ctx.closePath();
  ctx.fill();

  // --- 6. 逐行绘制文字 ---
  ctx.fillStyle = config.textColor;
  ctx.textBaseline = "top"; // 基线设置为顶部，方便计算

  const initialTextY = rectY + config.padding;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const textX = rectX + config.padding;
    // 每行的 Y 坐标 = 初始Y + 行数 * 行高
    const textY = initialTextY + i * lineHeight;
    ctx.fillText(line, textX, textY);
  }

  ctx.restore();

  return { rectHeight, rectWidth };
}

export { drawRectWithText };

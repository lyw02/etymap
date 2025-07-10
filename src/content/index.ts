import "./highlight.css";

const currentUrl = window.location.href;
const isOed = currentUrl.startsWith("https://www.oed.com/dictionary/");

let headword = "";
let partsOfSpeech = "";
const allFoundTexts: string[] = [];

if (isOed) {
  // Find target elements on page
  const headwordClass = "headword";
  const partsOfSpeechClass = ".headword-parts-of-speech .part-of-speech";
  const targetElementIds = ["etymology_summary", "main_etymology_complete"];

  headword =
    document.getElementsByClassName(headwordClass).item(0)?.textContent || "";

  partsOfSpeech = Array.from(document.querySelectorAll(partsOfSpeechClass))
    .map((e) => e.textContent?.trim())
    .join(" & ");

  targetElementIds.forEach((id) => {
    const targetElement = document.getElementById(id);

    if (targetElement) {
      console.log(`Found element with id: #${id}`);
      const texts = processAndHighlightElement(targetElement);
      allFoundTexts.push(...texts);
    } else {
      console.log(`Element with id: #${id} not found.`);
    }
  });
}

const finalConcatenatedString = allFoundTexts.join(" ").trim();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 检查消息的类型，确保是我们想要处理的请求
  if (request.type === "GET_ETY_TEXT_FROM_CONTENT") {
    console.log("Content script received a message from popup.");

    // 将我们已经计算好的字符串作为响应发送回去
    sendResponse({
      headword,
      partsOfSpeech,
      data: finalConcatenatedString,
    });
  }

  // 它能保持消息通道开放，直到 sendResponse 被调用。
  return true;
});

function processAndHighlightElement(element: HTMLElement): string[] {
  const texts = [];

  // TreeWalker 是遍历DOM节点的强大工具
  // NodeFilter.SHOW_TEXT 表示我们只关心文本节点
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

  let node: Node | null;
  const nodesToWrap = [];

  // 第1轮遍历：收集所有非空的文本节点
  while ((node = walker.nextNode())) {
    // 忽略只包含空白的文本节点
    if (node && node.nodeValue && node.nodeValue.trim() !== "") {
      nodesToWrap.push(node);
      texts.push(node.nodeValue.trim());
    }
  }

  // 第2轮遍历：对收集到的节点进行包裹操作
  // 之所以分两步，是为了避免在遍历过程中修改DOM树导致TreeWalker行为异常
  nodesToWrap.forEach((textNode: Node) => {
    const span = document.createElement("span");
    span.className = "text-highlight-wrapper"; // 应用CSS样式
    span.textContent = textNode.nodeValue; // 将文本内容放入span

    // 用新的span节点替换掉原来的文本节点
    textNode.parentNode?.replaceChild(span, textNode);
  });

  return texts;
}

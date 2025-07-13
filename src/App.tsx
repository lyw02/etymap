import { useState, useEffect } from "react";
import Canvas from "./components/Canvas";
import { GraphNode, GraphEdge } from "./utils/graph.types";

const graphNodeData = [
  { label: "PIE" },
  { label: "Latin" },
  { label: "French" },
  { label: "English" },
];

const graphEdgeData: GraphEdge[] = [
  { source: "PIE", target: "Latin" },
  { source: "Latin", target: "English" },
  { source: "French", target: "English" },
];

const graphNodes: GraphNode[] = graphNodeData.map(
  (item) => new GraphNode(item.label)
);

const graphEdges: GraphEdge[] = graphEdgeData.map(
  (item) => new GraphEdge(item.source, item.target)
);

function App() {
  const [isOed, setIsOed] = useState(false);
  const [headword, setHeadword] = useState("");
  const [partsOfSpeech, setPartsOfSpeech] = useState("");
  const [etymologyText, setEtymologyText] = useState(
    "Loading data from page..."
  );

  useEffect(() => {
    // 1. 查询当前激活的标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];

      if (
        activeTab &&
        activeTab.url?.startsWith("https://www.oed.com/dictionary/")
      ) {
        setIsOed(true);
        if (activeTab.id) {
          // 2. 向该标签页的 Content Script 发送消息
          chrome.tabs.sendMessage(
            activeTab.id,
            { type: "GET_ETY_TEXT_FROM_CONTENT" }, // 我们定义的消息体
            (response) => {
              // 3. 这是处理响应的回调函数
              // 检查响应是否有效
              if (chrome.runtime.lastError) {
                // 如果 Content Script 不存在于当前页面，可能会报错
                setEtymologyText(
                  "Could not connect to the content script on this page."
                );
                console.error(chrome.runtime.lastError.message);
              } else if (response) {
                setHeadword(response.headword);
                setPartsOfSpeech(response.partsOfSpeech);
                setEtymologyText(response.data);
              } else {
                setEtymologyText("No data received from content script.");
              }
            }
          );
        }
      }
    });
  }, []);

  return (
    <div className="max-w-[1280px] p-8 m-auto">
      {isOed ? (
        <>
          <h1>{headword}</h1>
          <p>{partsOfSpeech}</p>
          {/* {etymologyText} */}
          <Canvas graphNodes={graphNodes} graphEdges={graphEdges} />
        </>
      ) : (
        <p>No data</p>
      )}
    </div>
  );
}

export default App;

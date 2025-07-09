import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [headword, setHeadword] = useState("");
  const [partsOfSpeech, setPartsOfSpeech] = useState("");
  const [etymologyText, setEtymologyText] = useState(
    "Loading data from page..."
  );

  useEffect(() => {
    // 1. 查询当前激活的标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
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
              console.log("Popup received data:", response.data);
              setHeadword(response.headword);
              setPartsOfSpeech(response.partsOfSpeech);
              setEtymologyText(response.data);
            } else {
              setEtymologyText("No data received from content script.");
            }
          }
        );
      }
    });
  }, []);

  return (
    <div className="App">
      <h1>{headword}</h1>
      <p>{partsOfSpeech}</p>
      {etymologyText}
    </div>
  );
}

export default App;

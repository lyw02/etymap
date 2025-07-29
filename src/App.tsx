import { useState, useEffect, useRef } from "react";
import Canvas from "@/components/Canvas";
import {
  parseGraphContent,
  parseGraphStructure,
} from "@/utils/convert-structure";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const plainTextData = `
<structure>
English - Anglo-Norman & Old French & Middle French
English - Classical Latin 1 - (Classical Latin 2 + Classical Latin 3)
</structure>
<content>
@English: {{spirit}}
@Anglo-Norman & Old French & Middle French: <Anglo-Norman> {{esperite}} {{espirite}} {{espirith}} {{(rare) spirit}} <Anglo-Norman> <Old French> <Middle French> {{esperit}} {{espirit}} [animating or vital principle, wind, breath, air, action of breathing, divine inspiration, consciousness, emotion, the Holy Spirit, the third person of the Trinity] ({all early 12th cent.}) [intelligence] ({mid 12th cent.}) [imaginary being, fairy] ({mid 12th cent.}) [incorporeal or immaterial being, soul of a dead person, ghost, demon] ({all late 12th cent.}) [angel] ({13th cent.}) [mind as opposed to body] ({late 13th cent. in Anglo-Norman, late 14th cent. in continental French}) [volatile substance] ({early 14th cent. or earlier}) [one or other of four substances so named by medieval alchemists] ({1354}) [rarefied substance believed to be carried in the blood] ({1370}) [disposition of a person, intention, emotional state] ({late 14th cent.}) [deeper meaning of a text] ({late 14th cent.; rare before 1547})
@Classical Latin 1: {{spīritus}} [(u-stem) action of breathing, respiration, breath, (final) breath, (in grammar) aspiration, air, life, consciousness, soul, vital principle animating the world, divine inspiration, essential quality, nature, disposition, ardent disposition, enthusiasm, vigour, arrogance, pride, wind, breeze, wind in the stomach or bowels, scent, perfume, odour] ((in @(Post-classical Latin) also [the Holy Spirit, evil spirit, demon (Vetus Latina), soul of a dead person, ghost, angel, incorporeal or immaterial being, courage, tendency, inclination, emotional part of a person as the seat of hostile or angry feeling (Vulgate)] [intelligence] ({5th cent.})[ (in plural) morale] ({12th cent. in a British source}) [one or other of four substances so named by medieval alchemists] ({13th cent. in British sources}) [liquid produced by distillation] ({13th cent. in a British source}) [(in spiritus vitae, literally ‘spirit of life’) mercury] ({15th cent. in a British source})))
@Classical Latin 2: {{spīrāre}} [to breathe]
@Classical Latin 3: {{‑tus}} [suffix forming verbal nouns]
</content>
`;

const { nodes: graphNodes, edges: graphEdges } =
  parseGraphStructure(plainTextData);

const nodeContents = parseGraphContent(plainTextData);

function App() {
  const [isOed, setIsOed] = useState(false);
  const [headword, setHeadword] = useState("");
  const [partsOfSpeech, setPartsOfSpeech] = useState("");
  const [etymologyText, setEtymologyText] = useState(
    "Loading data from page..."
  );
  const [progress, setProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [infRes, setInfRes] = useState("");

  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const downloadProgressBarRef = useRef<HTMLDivElement>(null);

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
            { type: "getPageContent" }, // 我们定义的消息体
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
                // 将获取到的内容发送到 Background Script 进行推理
                // chrome.runtime.sendMessage(
                //   { action: "infer", text: `${response.data}` },
                //   (inferenceResponse) => {
                //     if (inferenceResponse.error) {
                //       //
                //     } else {
                //       console.log("===============", inferenceResponse.result)
                //       setInfRes(inferenceResponse.result);
                //     }
                //   }
                // );
              } else {
                setEtymologyText("No data received from content script.");
              }
            }
          );
        }
      }
    });
  }, []);

  useEffect(() => {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!downloadButtonRef.current || !downloadProgressBarRef.current) return;

      if (message.action === "downloadProgress") {
        downloadProgressBarRef.current.style.display = "block";
        setDownloadStatus(message.message);

        switch (message.status) {
          case "downloading":
            setProgress(message.progress);
            downloadButtonRef.current.disabled = true;
            break;
          case "complete":
            setProgress(100);
            downloadButtonRef.current.disabled = false;
            setDownloadStatus("Download complete");
            break;
          case "error":
            setDownloadStatus(`Error: ${message.message}`);
            downloadProgressBarRef.current.style.display = "none";
            downloadButtonRef.current.disabled = false;
            break;
        }
      }
    });
  }, []);

  function handleDownloadModel() {
    if (!downloadButtonRef.current || !downloadProgressBarRef.current) return;

    setDownloadStatus("Starting download...");
    downloadButtonRef.current.disabled = true;
    downloadProgressBarRef.current.style.display = "block";
    setProgress(0);

    // 发送开始下载的消息
    chrome.runtime.sendMessage({ action: "downloadModel" });

    // chrome.runtime.sendMessage({ action: "downloadModel" }, (response) => {
    //   if (response && response.status === "success") {
    //     setDownloadStatus(response.message);
    //   } else {
    //     setDownloadStatus(`Error: ${response.message}`);
    //   }

    //   if (!downloadButtonRef.current) return;
    //   downloadButtonRef.current.disabled = false;
    // });
  }

  return (
    <div className="w-[1280px] p-8 m-auto">
      <Tabs defaultValue="graph-view" className="w-full">
        <TabsList>
          <TabsTrigger value="graph-view">Graph View</TabsTrigger>
          <TabsTrigger value="model">Model</TabsTrigger>
        </TabsList>
        <TabsContent value="graph-view">
          {isOed ? (
            <>
              <h1>{headword}</h1>
              <p>{partsOfSpeech}</p>
              {/* {etymologyText} */}
              <Canvas
               graphNodes={graphNodes}
               graphEdges={graphEdges}
               nodeContents={nodeContents}
                // graphNodes={parseGraphStructure(infRes).nodes}
                // graphEdges={parseGraphStructure(infRes).edges}
                // nodeContents={parseGraphContent(infRes)}
              />
            </>
          ) : (
            <p>No data</p>
          )}
        </TabsContent>
        <TabsContent value="model">
          <Button
            variant="outline"
            onClick={handleDownloadModel}
            ref={downloadButtonRef}
          >
            Download Model
          </Button>
          <Progress
            value={progress}
            className="w-50 my-3"
            ref={downloadProgressBarRef}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default App;

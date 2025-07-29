// // src/background.ts

// import { systemPrompt } from "@/utils/prompt";
// import {
//   pipeline,
//   env,
//   AutoTokenizer,
//   AutoModelForCausalLM,
// } from "@huggingface/transformers";

// // 为了优化，我们禁用本地模型检查，因为我们总是从 Hugging Face 下载
// env.allowLocalModels = false;

// // 你的模型在 Hugging Face Hub 上的标识符
// const MODEL_NAME = "lyw02/EtymologyLM"; // 替换成你自己的！

// // Transformers.js 使用的缓存名称
// const CACHE_NAME = `transformers-js-cache-${MODEL_NAME}`;

// /**
//  * 使用单例模式管理模型加载和推理
//  * 这样可以确保在整个插件生命周期中只有一个实例，避免重复加载。
//  */
// class ModelManager {
//   private static instance: ModelManager | null = null;
//   private pipe: any = null; // 用于存储 pipeline 实例
//   private model_info: { model: any; tokenizer: any } | null = null; // 用于存储模型和分词器

//   // 私有构造函数，防止外部直接实例化
//   private constructor() {}

//   // 获取单例实例的静态方法
//   public static getInstance(): ModelManager {
//     if (!ModelManager.instance) {
//       ModelManager.instance = new ModelManager();
//     }
//     return ModelManager.instance;
//   }

//   /**
//    * 加载模型和分词器。Transformers.js 会自动处理下载和缓存。
//    * 第一次调用会下载，后续调用会直接从浏览器缓存加载。
//    * @param progress_callback 用于向UI报告下载进度的回调函数
//    */
//   public async loadModel(progress_callback?: (progress: any) => void) {
//     if (this.model_info) {
//       console.log("Model is already loaded.");
//       return;
//     }

//     console.log("Loading model and tokenizer...");

//     // 我们使用 from_pretrained 分别加载，以便更好地控制
//     const tokenizer = await AutoTokenizer.from_pretrained(MODEL_NAME, {
//       progress_callback,
//     });
//     const model = await AutoModelForCausalLM.from_pretrained(MODEL_NAME, {
//       progress_callback,
//       // 注意：对于0.6B模型，量化可能是必要的以在浏览器中流畅运行
//       // 如果性能不佳，可以考虑加载量化版本
//       // quantized: true,
//     });

//     this.model_info = { model, tokenizer };
//     console.log("Model and tokenizer loaded successfully.");
//   }

//   /**
//    * 手动触发模型下载（如果尚未缓存）。
//    * 这与 loadModel 本质上是相同的，只是由用户显式调用。
//    */
//   public async downloadModel(progress_callback?: (progress: any) => void) {
//     await this.loadModel(progress_callback);
//   }

//   /**
//    * 使用加载的模型进行推理
//    * @param text 输入的提示
//    * @param generation_options 生成选项
//    * @returns 生成的文本
//    */
//   public async infer(
//     text: string,
//     generation_options: any = {}
//   ): Promise<string> {
//     if (!this.model_info) {
//       await this.loadModel();
//     }

//     if (!this.model_info) {
//       throw new Error("Model not loaded!");
//     }

//     const { model, tokenizer } = this.model_info;

//     const messages = [
//       { role: "system", content: systemPrompt },
//       { role: "user", content: text },
//     ];

//     const prompt = tokenizer.apply_chat_template(messages, {
//       tokenize: false,
//       add_generation_prompt: true,
//     });

//     const inputs = tokenizer(prompt);

//     const { input_ids } = inputs;
//     const outputs = await model.generate(input_ids, {
//       max_new_tokens: 256,
//       ...generation_options,
//     });

//     const result = tokenizer.decode(outputs[0], { skip_special_tokens: true });

//     // Qwen模型的输出可能包含原始prompt，需要清理
//     return result.replace(prompt, "").trim();
//   }

//   /**
//    * 检查模型是否已经被缓存
//    * @returns Promise<boolean>
//    */
//   public async isModelCached(): Promise<boolean> {
//     try {
//       const cache = await caches.open(CACHE_NAME);
//       const keys = await cache.keys();
//       // 如果缓存中存在 model.safetensors，我们就认为模型已缓存
//       return keys.some((key) => key.url.endsWith("model.safetensors"));
//     } catch (error) {
//       console.error("Error checking cache:", error);
//       return false;
//     }
//   }

//   /**
//    * 获取缓存模型的版本（即 Hugging Face 上的 commit hash）
//    * @returns Promise<string | null>
//    */
//   public async getCachedModelVersion(): Promise<string | null> {
//     if (!(await this.isModelCached())) {
//       return null;
//     }

//     try {
//       const cache = await caches.open(CACHE_NAME);
//       const configRequest = new Request(
//         new URL(`https://huggingface.co/${MODEL_NAME}/raw/main/config.json`)
//       );
//       const configResponse = await cache.match(configRequest);

//       if (configResponse) {
//         const config = await configResponse.json();
//         // _commit_hash 是 Hugging Face 添加的元数据
//         return config._commit_hash || "Unknown";
//       }
//       return null;
//     } catch (error) {
//       console.error("Error getting model version:", error);
//       return null;
//     }
//   }

//   /**
//    * 清除模型的缓存
//    * @returns Promise<boolean>
//    */
//   public async clearCache(): Promise<boolean> {
//     const wasCached = await this.isModelCached();
//     if (wasCached) {
//       await caches.delete(CACHE_NAME);
//       // 重置内部状态
//       this.pipe = null;
//       this.model_info = null;
//       console.log("Cache cleared.");
//       return true;
//     }
//     console.log("No cache to clear.");
//     return false;
//   }
// }

// // 监听来自 popup 的消息
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   const modelManager = ModelManager.getInstance();

//   // 使用异步IIFE来处理异步操作
//   (async () => {
//     try {
//       if (request.action === "checkCache") {
//         const isCached = await modelManager.isModelCached();
//         const version = await modelManager.getCachedModelVersion();
//         sendResponse({ isCached, version });
//       } else if (request.action === "downloadModel") {
//         // 无法直接将回调函数传递过去，但可以轮询状态
//         modelManager.downloadModel().then(() => {
//           sendResponse({
//             success: true,
//             message: "Download completed or already cached.",
//           });
//         });
//         // 立即返回true表示我们将异步发送响应
//         return true;
//       } else if (request.action === "clearCache") {
//         const success = await modelManager.clearCache();
//         sendResponse({ success });
//       } else if (request.action === "infer") {
//         const result = await modelManager.infer(request.text);
//         sendResponse({ result });
//       }
//     } catch (e: any) {
//       sendResponse({ error: e.message });
//     }
//   })();

//   // 返回 true 表示我们将异步地调用 sendResponse
//   return true;
// });

import {
  pipeline,
  AutoTokenizer,
  type TextGenerationPipeline,
  type PipelineType,
  type ProgressCallback,
} from "@huggingface/transformers";
import { systemPrompt } from "@/utils/prompt";

class PipelineSingleton {
  static task: PipelineType = "text-generation";
  static model = "lyw02/EtymologyLM";
  static instance: TextGenerationPipeline | null = null;
  // static tokenizerInstance: AutoTokenizer | null = null;

  static async getInstance(
    progress_callback?: ProgressCallback
  ): Promise<TextGenerationPipeline> {
    this.instance ??= (await pipeline(this.task, this.model, {
      progress_callback,
    })) as TextGenerationPipeline;

    return this.instance;
  }

  // static async getTokenizer() {
  //   this.tokenizerInstance ??= await AutoTokenizer.from_pretrained(this.model);
  //   return this.tokenizerInstance;
  // }
}

const infer = async (text: string) => {
  // Get the pipeline instance. This will load and build the model when run for the first time.
  const model = await PipelineSingleton.getInstance((data) => {
    // You can track the progress of the pipeline creation here.
    // e.g., you can send `data` back to the UI to indicate a progress bar
    console.log("progress", data);
  });

  const result = await model([
    { role: "system", content: systemPrompt },
    { role: "user", content: text },
  ]);

  return result;
};

////////////////////// 2. Message Events /////////////////////
//
// Listen for messages from the UI, process it, and send the result back.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("sender", sender);
  console.log("message", message);
  if (message.action !== "infer") return; // Ignore messages that are not meant for classification.

  // Run model prediction asynchronously
  (async function () {
    // Perform classification
    let result = await infer(message.text);

    // Send response back to UI
    sendResponse(result);
  })();

  // return true to indicate we will send a response asynchronously
  // see https://stackoverflow.com/a/46628145 for more information
  return true;
});

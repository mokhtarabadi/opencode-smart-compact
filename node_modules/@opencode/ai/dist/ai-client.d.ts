import { Layer } from "effect";
import { RequestExecutor } from "./route/executor.js";
/** Every modality client over `executor`, which stays in the output so `asset.bytes()` and `Media.write` resolve. */
export declare const layerWith: <E, R>(executor: Layer.Layer<RequestExecutor.Service, E, R>) => Layer.Layer<import("./route/executor-service.js").RequestExecutorService | import("./route/client.js").LLMClientService | import("./image-client.js").ImageClientService | import("./speech-client.js").SpeechClientService | import("./transcription-client.js").TranscriptionClientService | import("./video-client.js").VideoClientService, E, R>;
/** Every modality client plus the executor over `RequestExecutor.fetchLayer`: the one layer most programs need. */
export declare const layer: Layer.Layer<import("./route/executor-service.js").RequestExecutorService | import("./route/client.js").LLMClientService | import("./image-client.js").ImageClientService | import("./speech-client.js").SpeechClientService | import("./transcription-client.js").TranscriptionClientService | import("./video-client.js").VideoClientService, never, never>;
export type Services = Layer.Success<typeof layer>;
export * as AIClient from "./ai-client.js";

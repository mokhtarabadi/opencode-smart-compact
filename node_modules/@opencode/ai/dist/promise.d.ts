import { Effect, Layer } from "effect";
import { AIClient } from "./ai-client.js";
import type { AwaitOptions, Event, Snapshot } from "./generation.js";
import { type ImageModel, type ImageRequest, type ImageRequestInput } from "./image.js";
import { Media } from "./media.js";
import { RequestExecutor } from "./route/executor.js";
import { LanguageModel, LLMRequest } from "./schema/index.js";
import type { RequestInput } from "./llm.js";
import { type SpeechModel, type SpeechRequest, type SpeechRequestInput } from "./speech.js";
import { type TranscriptionModel, type TranscriptionRequest, type TranscriptionRequestInput } from "./transcription.js";
import { type VideoModel, type VideoRequest, type VideoRequestInput } from "./video.js";
/**
 * Promise-first entrypoint for scripts and non-Effect callers. One `ManagedRuntime` hosts the LLM, image, video, speech,
 * and transcription clients over a request executor; every method runs the corresponding Effect API and rethrows
 * `AIError` unchanged. `file` and `write` load `node:fs/promises` on first use, so importing this module does not.
 */
export interface Options {
    /** Executor layer; defaults to `RequestExecutor.fetchLayer`. Inject a recorder or `RequestExecutor.middleware(fn)` here. */
    readonly layer?: Layer.Layer<RequestExecutor.Service>;
}
export interface RunOptions {
    readonly signal?: AbortSignal;
}
export type Services = AIClient.Services;
/**
 * Promise view of a `Generation`. Its fields are a snapshot taken when the handle was created; `refresh()` resolves to a
 * new handle rather than updating this one.
 */
export type GenerationHandle<Response> = Snapshot & {
    /** Serializable JSON; pass it back to `resume` from another process. */
    readonly token: unknown;
    readonly await: (options?: AwaitOptions & RunOptions) => Promise<Response>;
    /** Status observations until the first terminal one, polling like `await`; abort throws `signal.reason`. */
    readonly events: (options?: AwaitOptions & RunOptions) => AsyncIterable<Event>;
    /** The result without polling; fails when the generation has not completed. */
    readonly result: (options?: RunOptions) => Promise<Response>;
    readonly refresh: (options?: RunOptions) => Promise<GenerationHandle<Response>>;
    readonly cancel: (options?: RunOptions) => Promise<void>;
};
export declare const make: (options?: Options) => {
    run: <A, E>(effect: Effect.Effect<A, E, Services>, options?: RunOptions) => Promise<A>;
    /** Decoded asset bytes, downloading `url` sources through the executor. */
    bytes: (asset: Media.Asset, options?: RunOptions) => Promise<Uint8Array<ArrayBufferLike>>;
    base64: (asset: Media.Asset, options?: RunOptions) => Promise<string>;
    /** Pull a `url` asset into owned bytes before the provider URL expires. */
    materialize: (asset: Media.Asset, options?: RunOptions) => Promise<Media.Asset>;
    /** Read a file into an asset like `Media.file`: sniffed media type, then the extension's. */
    file: (path: string, options?: Media.AssetOptions & RunOptions) => Promise<Media.Asset>;
    /** Write an asset's bytes like `Media.write`, downloading `url` sources through the executor. */
    write: (asset: Media.Asset, path: string, options?: RunOptions) => Promise<void>;
    llm: {
        request: <const SelectedLanguageModel extends LanguageModel>(input: RequestInput<SelectedLanguageModel>) => LLMRequest<SelectedLanguageModel>;
        generate: <const Model extends LanguageModel>(input: RequestInput<Model> | LLMRequest, options?: RunOptions) => Promise<import("./index.js").LLMResponse>;
        stream: <const Model extends LanguageModel>(input: RequestInput<Model> | LLMRequest, options?: RunOptions) => AsyncIterable<({
            readonly type: "compaction";
            readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
            readonly id?: string | undefined;
            readonly text?: string | null | undefined;
            readonly encrypted?: string | undefined;
        } & ({
            readonly encrypted: string;
            readonly text?: never;
        } | {
            readonly text: string | null;
            readonly encrypted?: never;
        })) | {
            readonly type: "step-start";
            readonly index: number;
        } | {
            readonly id: string;
            readonly type: "text-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        } | {
            readonly id: string;
            readonly type: "text-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        } | {
            readonly id: string;
            readonly type: "text-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        } | {
            readonly id: string;
            readonly type: "reasoning-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        } | {
            readonly id: string;
            readonly type: "reasoning-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        } | {
            readonly id: string;
            readonly type: "reasoning-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        } | {
            readonly id: string;
            readonly type: "tool-input-start";
            readonly name: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
            readonly providerExecuted?: boolean | undefined;
        } | {
            readonly id: string;
            readonly type: "tool-input-delta";
            readonly name: string;
            readonly text: string;
            readonly input?: unknown;
            readonly namespace?: string | undefined;
        } | {
            readonly id: string;
            readonly type: "tool-input-end";
            readonly name: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
        } | {
            readonly id: string;
            readonly type: "tool-input-error";
            readonly name: string;
            readonly raw: string;
            readonly namespace?: string | undefined;
        } | {
            readonly id: string;
            readonly type: "tool-call";
            readonly name: string;
            readonly input: unknown;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
            readonly providerExecuted?: boolean | undefined;
        } | {
            readonly id: string;
            readonly type: "tool-result";
            readonly name: string;
            readonly result: {
                readonly type: "json";
                readonly value: unknown;
            } | {
                readonly type: "text";
                readonly value: unknown;
            } | {
                readonly type: "error";
                readonly value: unknown;
            } | {
                readonly type: "content";
                readonly value: readonly ({
                    readonly type: "text";
                    readonly text: string;
                } | {
                    readonly type: "file";
                    readonly uri: string;
                    readonly mime: string;
                    readonly name?: string | undefined;
                })[];
            };
            readonly output?: {
                readonly structured: unknown;
                readonly content: readonly ({
                    readonly type: "text";
                    readonly text: string;
                } | {
                    readonly type: "file";
                    readonly uri: string;
                    readonly mime: string;
                    readonly name?: string | undefined;
                })[];
            } | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
            readonly providerExecuted?: boolean | undefined;
        } | {
            readonly id: string;
            readonly type: "tool-error";
            readonly message: string;
            readonly name: string;
            readonly error?: unknown;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
        } | {
            readonly type: "media";
            readonly media: Media.Asset;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        } | {
            readonly type: "step-finish";
            readonly reason: {
                readonly normalized: "length" | "stop" | "tool-calls" | "content-filter" | "error" | "unknown";
                readonly raw?: string | undefined;
                readonly category?: string | undefined;
                readonly explanation?: string | undefined;
            };
            readonly index: number;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly usage?: import("./index.js").Usage | undefined;
        } | {
            readonly type: "finish";
            readonly reason: {
                readonly normalized: "length" | "stop" | "tool-calls" | "content-filter" | "error" | "unknown";
                readonly raw?: string | undefined;
                readonly category?: string | undefined;
                readonly explanation?: string | undefined;
            };
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly usage?: import("./index.js").Usage | undefined;
        } | {
            readonly type: "provider-error";
            readonly message: string;
            readonly classification?: "context-overflow" | "payload-too-large" | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }>;
    };
    image: {
        request: typeof import("./image.js").request;
        generate: <const Model extends ImageModel>(input: ImageRequestInput<Model> | ImageRequest, options?: AwaitOptions & RunOptions) => Promise<import("./image.js").ImageResponse>;
        stream: <const Model extends ImageModel>(input: ImageRequestInput<Model> | ImageRequest, options?: AwaitOptions & RunOptions) => AsyncIterable<{
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        } | {
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        } | {
            readonly type: "image-partial";
            readonly index: number;
            readonly image: Media.Asset;
        } | {
            readonly type: "image";
            readonly index: number;
            readonly image: Media.Asset;
        } | {
            readonly type: "finish";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly usage?: {
                readonly type: "tokens";
                readonly input?: number | undefined;
                readonly output?: number | undefined;
                readonly total?: number | undefined;
                readonly details?: {
                    readonly [x: string]: unknown;
                } | undefined;
            } | {
                readonly type: "seconds";
                readonly seconds: number;
            } | {
                readonly type: "characters";
                readonly characters: number;
            } | {
                readonly type: "credits";
                readonly credits: number;
            } | {
                readonly type: "compute";
                readonly seconds: number;
            } | undefined;
            readonly notices?: readonly {
                readonly type: "other" | "moderated" | "filtered";
                readonly message: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }[] | undefined;
        }>;
        start: <const Model extends ImageModel>(input: ImageRequestInput<Model> | ImageRequest, options?: RunOptions) => Promise<GenerationHandle<import("./image.js").ImageResponse>>;
        resume: (model: ImageModel, token: unknown, options?: RunOptions) => Promise<GenerationHandle<import("./image.js").ImageResponse>>;
    };
    video: {
        request: typeof import("./video.js").request;
        start: <const Model extends VideoModel>(input: VideoRequestInput<Model> | VideoRequest, options?: RunOptions) => Promise<GenerationHandle<import("./video.js").VideoResponse>>;
        generate: <const Model extends VideoModel>(input: VideoRequestInput<Model> | VideoRequest, options?: AwaitOptions & RunOptions) => Promise<import("./video.js").VideoResponse>;
        resume: (model: VideoModel, token: unknown, options?: RunOptions) => Promise<GenerationHandle<import("./video.js").VideoResponse>>;
        stream: <const Model extends VideoModel>(input: VideoRequestInput<Model> | VideoRequest, options?: AwaitOptions & RunOptions) => AsyncIterable<{
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        } | {
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        } | {
            readonly type: "video";
            readonly index: number;
            readonly video: Media.Asset;
        } | {
            readonly type: "finish";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly usage?: {
                readonly type: "tokens";
                readonly input?: number | undefined;
                readonly output?: number | undefined;
                readonly total?: number | undefined;
                readonly details?: {
                    readonly [x: string]: unknown;
                } | undefined;
            } | {
                readonly type: "seconds";
                readonly seconds: number;
            } | {
                readonly type: "characters";
                readonly characters: number;
            } | {
                readonly type: "credits";
                readonly credits: number;
            } | {
                readonly type: "compute";
                readonly seconds: number;
            } | undefined;
            readonly notices?: readonly {
                readonly type: "other" | "moderated" | "filtered";
                readonly message: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }[] | undefined;
        }>;
    };
    speech: {
        request: typeof import("./speech.js").request;
        generate: <const Model extends SpeechModel>(input: SpeechRequestInput<Model> | SpeechRequest, options?: RunOptions) => Promise<import("./speech.js").SpeechResponse>;
        stream: <const Model extends SpeechModel>(input: SpeechRequestInput<Model> | SpeechRequest, options?: RunOptions) => AsyncIterable<{
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        } | {
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        } | {
            readonly type: "audio-delta";
            readonly chunk: Uint8Array<ArrayBufferLike>;
        } | {
            readonly type: "timestamps";
            readonly items: readonly {
                readonly text: string;
                readonly startSeconds: number;
                readonly endSeconds: number;
            }[];
        } | {
            readonly type: "finish";
            readonly audio: Media.Asset;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly usage?: {
                readonly type: "tokens";
                readonly input?: number | undefined;
                readonly output?: number | undefined;
                readonly total?: number | undefined;
                readonly details?: {
                    readonly [x: string]: unknown;
                } | undefined;
            } | {
                readonly type: "seconds";
                readonly seconds: number;
            } | {
                readonly type: "characters";
                readonly characters: number;
            } | {
                readonly type: "credits";
                readonly credits: number;
            } | {
                readonly type: "compute";
                readonly seconds: number;
            } | undefined;
            readonly notices?: readonly {
                readonly type: "other" | "moderated" | "filtered";
                readonly message: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }[] | undefined;
        }>;
    };
    transcription: {
        request: typeof import("./transcription.js").request;
        generate: <const Model extends TranscriptionModel>(input: TranscriptionRequestInput<Model> | TranscriptionRequest, options?: AwaitOptions & RunOptions) => Promise<import("./transcription.js").TranscriptionResponse>;
        stream: <const Model extends TranscriptionModel>(input: TranscriptionRequestInput<Model> | TranscriptionRequest, options?: AwaitOptions & RunOptions) => AsyncIterable<{
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        } | {
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        } | {
            readonly type: "text-delta";
            readonly delta: string;
        } | {
            readonly type: "segment";
            readonly segment: {
                readonly text: string;
                readonly startSeconds: number;
                readonly endSeconds: number;
                readonly speaker?: string | undefined;
            };
        } | {
            readonly type: "finish";
            readonly text: string;
            readonly durationSeconds?: number | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly usage?: {
                readonly type: "tokens";
                readonly input?: number | undefined;
                readonly output?: number | undefined;
                readonly total?: number | undefined;
                readonly details?: {
                    readonly [x: string]: unknown;
                } | undefined;
            } | {
                readonly type: "seconds";
                readonly seconds: number;
            } | {
                readonly type: "characters";
                readonly characters: number;
            } | {
                readonly type: "credits";
                readonly credits: number;
            } | {
                readonly type: "compute";
                readonly seconds: number;
            } | undefined;
            readonly notices?: readonly {
                readonly type: "other" | "moderated" | "filtered";
                readonly message: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }[] | undefined;
            readonly language?: string | undefined;
            readonly segments?: readonly {
                readonly text: string;
                readonly startSeconds: number;
                readonly endSeconds: number;
                readonly speaker?: string | undefined;
            }[] | undefined;
            readonly words?: readonly {
                readonly text: string;
                readonly startSeconds: number;
                readonly endSeconds: number;
                readonly speaker?: string | undefined;
                readonly confidence?: number | undefined;
            }[] | undefined;
        }>;
        start: <const Model extends TranscriptionModel>(input: TranscriptionRequestInput<Model> | TranscriptionRequest, options?: RunOptions) => Promise<GenerationHandle<import("./transcription.js").TranscriptionResponse>>;
        resume: (model: TranscriptionModel, token: unknown, options?: RunOptions) => Promise<GenerationHandle<import("./transcription.js").TranscriptionResponse>>;
    };
    dispose: () => Promise<void>;
};
export type Client = ReturnType<typeof make>;
/** Default client over `RequestExecutor.fetchLayer` for scripts; the runtime builds its layer on first use. */
export declare const ai: {
    run: <A, E>(effect: Effect.Effect<A, E, Services>, options?: RunOptions) => Promise<A>;
    /** Decoded asset bytes, downloading `url` sources through the executor. */
    bytes: (asset: Media.Asset, options?: RunOptions) => Promise<Uint8Array<ArrayBufferLike>>;
    base64: (asset: Media.Asset, options?: RunOptions) => Promise<string>;
    /** Pull a `url` asset into owned bytes before the provider URL expires. */
    materialize: (asset: Media.Asset, options?: RunOptions) => Promise<Media.Asset>;
    /** Read a file into an asset like `Media.file`: sniffed media type, then the extension's. */
    file: (path: string, options?: Media.AssetOptions & RunOptions) => Promise<Media.Asset>;
    /** Write an asset's bytes like `Media.write`, downloading `url` sources through the executor. */
    write: (asset: Media.Asset, path: string, options?: RunOptions) => Promise<void>;
    llm: {
        request: <const SelectedLanguageModel extends LanguageModel>(input: RequestInput<SelectedLanguageModel>) => LLMRequest<SelectedLanguageModel>;
        generate: <const Model extends LanguageModel>(input: RequestInput<Model> | LLMRequest, options?: RunOptions) => Promise<import("./index.js").LLMResponse>;
        stream: <const Model extends LanguageModel>(input: RequestInput<Model> | LLMRequest, options?: RunOptions) => AsyncIterable<({
            readonly type: "compaction";
            readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
            readonly id?: string | undefined;
            readonly text?: string | null | undefined;
            readonly encrypted?: string | undefined;
        } & ({
            readonly encrypted: string;
            readonly text?: never;
        } | {
            readonly text: string | null;
            readonly encrypted?: never;
        })) | {
            readonly type: "step-start";
            readonly index: number;
        } | {
            readonly id: string;
            readonly type: "text-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        } | {
            readonly id: string;
            readonly type: "text-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        } | {
            readonly id: string;
            readonly type: "text-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        } | {
            readonly id: string;
            readonly type: "reasoning-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        } | {
            readonly id: string;
            readonly type: "reasoning-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        } | {
            readonly id: string;
            readonly type: "reasoning-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        } | {
            readonly id: string;
            readonly type: "tool-input-start";
            readonly name: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
            readonly providerExecuted?: boolean | undefined;
        } | {
            readonly id: string;
            readonly type: "tool-input-delta";
            readonly name: string;
            readonly text: string;
            readonly input?: unknown;
            readonly namespace?: string | undefined;
        } | {
            readonly id: string;
            readonly type: "tool-input-end";
            readonly name: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
        } | {
            readonly id: string;
            readonly type: "tool-input-error";
            readonly name: string;
            readonly raw: string;
            readonly namespace?: string | undefined;
        } | {
            readonly id: string;
            readonly type: "tool-call";
            readonly name: string;
            readonly input: unknown;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
            readonly providerExecuted?: boolean | undefined;
        } | {
            readonly id: string;
            readonly type: "tool-result";
            readonly name: string;
            readonly result: {
                readonly type: "json";
                readonly value: unknown;
            } | {
                readonly type: "text";
                readonly value: unknown;
            } | {
                readonly type: "error";
                readonly value: unknown;
            } | {
                readonly type: "content";
                readonly value: readonly ({
                    readonly type: "text";
                    readonly text: string;
                } | {
                    readonly type: "file";
                    readonly uri: string;
                    readonly mime: string;
                    readonly name?: string | undefined;
                })[];
            };
            readonly output?: {
                readonly structured: unknown;
                readonly content: readonly ({
                    readonly type: "text";
                    readonly text: string;
                } | {
                    readonly type: "file";
                    readonly uri: string;
                    readonly mime: string;
                    readonly name?: string | undefined;
                })[];
            } | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
            readonly providerExecuted?: boolean | undefined;
        } | {
            readonly id: string;
            readonly type: "tool-error";
            readonly message: string;
            readonly name: string;
            readonly error?: unknown;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
        } | {
            readonly type: "media";
            readonly media: Media.Asset;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        } | {
            readonly type: "step-finish";
            readonly reason: {
                readonly normalized: "length" | "stop" | "tool-calls" | "content-filter" | "error" | "unknown";
                readonly raw?: string | undefined;
                readonly category?: string | undefined;
                readonly explanation?: string | undefined;
            };
            readonly index: number;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly usage?: import("./index.js").Usage | undefined;
        } | {
            readonly type: "finish";
            readonly reason: {
                readonly normalized: "length" | "stop" | "tool-calls" | "content-filter" | "error" | "unknown";
                readonly raw?: string | undefined;
                readonly category?: string | undefined;
                readonly explanation?: string | undefined;
            };
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly usage?: import("./index.js").Usage | undefined;
        } | {
            readonly type: "provider-error";
            readonly message: string;
            readonly classification?: "context-overflow" | "payload-too-large" | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }>;
    };
    image: {
        request: typeof import("./image.js").request;
        generate: <const Model extends ImageModel>(input: ImageRequestInput<Model> | ImageRequest, options?: AwaitOptions & RunOptions) => Promise<import("./image.js").ImageResponse>;
        stream: <const Model extends ImageModel>(input: ImageRequestInput<Model> | ImageRequest, options?: AwaitOptions & RunOptions) => AsyncIterable<{
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        } | {
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        } | {
            readonly type: "image-partial";
            readonly index: number;
            readonly image: Media.Asset;
        } | {
            readonly type: "image";
            readonly index: number;
            readonly image: Media.Asset;
        } | {
            readonly type: "finish";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly usage?: {
                readonly type: "tokens";
                readonly input?: number | undefined;
                readonly output?: number | undefined;
                readonly total?: number | undefined;
                readonly details?: {
                    readonly [x: string]: unknown;
                } | undefined;
            } | {
                readonly type: "seconds";
                readonly seconds: number;
            } | {
                readonly type: "characters";
                readonly characters: number;
            } | {
                readonly type: "credits";
                readonly credits: number;
            } | {
                readonly type: "compute";
                readonly seconds: number;
            } | undefined;
            readonly notices?: readonly {
                readonly type: "other" | "moderated" | "filtered";
                readonly message: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }[] | undefined;
        }>;
        start: <const Model extends ImageModel>(input: ImageRequestInput<Model> | ImageRequest, options?: RunOptions) => Promise<GenerationHandle<import("./image.js").ImageResponse>>;
        resume: (model: ImageModel, token: unknown, options?: RunOptions) => Promise<GenerationHandle<import("./image.js").ImageResponse>>;
    };
    video: {
        request: typeof import("./video.js").request;
        start: <const Model extends VideoModel>(input: VideoRequestInput<Model> | VideoRequest, options?: RunOptions) => Promise<GenerationHandle<import("./video.js").VideoResponse>>;
        generate: <const Model extends VideoModel>(input: VideoRequestInput<Model> | VideoRequest, options?: AwaitOptions & RunOptions) => Promise<import("./video.js").VideoResponse>;
        resume: (model: VideoModel, token: unknown, options?: RunOptions) => Promise<GenerationHandle<import("./video.js").VideoResponse>>;
        stream: <const Model extends VideoModel>(input: VideoRequestInput<Model> | VideoRequest, options?: AwaitOptions & RunOptions) => AsyncIterable<{
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        } | {
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        } | {
            readonly type: "video";
            readonly index: number;
            readonly video: Media.Asset;
        } | {
            readonly type: "finish";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly usage?: {
                readonly type: "tokens";
                readonly input?: number | undefined;
                readonly output?: number | undefined;
                readonly total?: number | undefined;
                readonly details?: {
                    readonly [x: string]: unknown;
                } | undefined;
            } | {
                readonly type: "seconds";
                readonly seconds: number;
            } | {
                readonly type: "characters";
                readonly characters: number;
            } | {
                readonly type: "credits";
                readonly credits: number;
            } | {
                readonly type: "compute";
                readonly seconds: number;
            } | undefined;
            readonly notices?: readonly {
                readonly type: "other" | "moderated" | "filtered";
                readonly message: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }[] | undefined;
        }>;
    };
    speech: {
        request: typeof import("./speech.js").request;
        generate: <const Model extends SpeechModel>(input: SpeechRequestInput<Model> | SpeechRequest, options?: RunOptions) => Promise<import("./speech.js").SpeechResponse>;
        stream: <const Model extends SpeechModel>(input: SpeechRequestInput<Model> | SpeechRequest, options?: RunOptions) => AsyncIterable<{
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        } | {
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        } | {
            readonly type: "audio-delta";
            readonly chunk: Uint8Array<ArrayBufferLike>;
        } | {
            readonly type: "timestamps";
            readonly items: readonly {
                readonly text: string;
                readonly startSeconds: number;
                readonly endSeconds: number;
            }[];
        } | {
            readonly type: "finish";
            readonly audio: Media.Asset;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly usage?: {
                readonly type: "tokens";
                readonly input?: number | undefined;
                readonly output?: number | undefined;
                readonly total?: number | undefined;
                readonly details?: {
                    readonly [x: string]: unknown;
                } | undefined;
            } | {
                readonly type: "seconds";
                readonly seconds: number;
            } | {
                readonly type: "characters";
                readonly characters: number;
            } | {
                readonly type: "credits";
                readonly credits: number;
            } | {
                readonly type: "compute";
                readonly seconds: number;
            } | undefined;
            readonly notices?: readonly {
                readonly type: "other" | "moderated" | "filtered";
                readonly message: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }[] | undefined;
        }>;
    };
    transcription: {
        request: typeof import("./transcription.js").request;
        generate: <const Model extends TranscriptionModel>(input: TranscriptionRequestInput<Model> | TranscriptionRequest, options?: AwaitOptions & RunOptions) => Promise<import("./transcription.js").TranscriptionResponse>;
        stream: <const Model extends TranscriptionModel>(input: TranscriptionRequestInput<Model> | TranscriptionRequest, options?: AwaitOptions & RunOptions) => AsyncIterable<{
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        } | {
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        } | {
            readonly type: "text-delta";
            readonly delta: string;
        } | {
            readonly type: "segment";
            readonly segment: {
                readonly text: string;
                readonly startSeconds: number;
                readonly endSeconds: number;
                readonly speaker?: string | undefined;
            };
        } | {
            readonly type: "finish";
            readonly text: string;
            readonly durationSeconds?: number | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly usage?: {
                readonly type: "tokens";
                readonly input?: number | undefined;
                readonly output?: number | undefined;
                readonly total?: number | undefined;
                readonly details?: {
                    readonly [x: string]: unknown;
                } | undefined;
            } | {
                readonly type: "seconds";
                readonly seconds: number;
            } | {
                readonly type: "characters";
                readonly characters: number;
            } | {
                readonly type: "credits";
                readonly credits: number;
            } | {
                readonly type: "compute";
                readonly seconds: number;
            } | undefined;
            readonly notices?: readonly {
                readonly type: "other" | "moderated" | "filtered";
                readonly message: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }[] | undefined;
            readonly language?: string | undefined;
            readonly segments?: readonly {
                readonly text: string;
                readonly startSeconds: number;
                readonly endSeconds: number;
                readonly speaker?: string | undefined;
            }[] | undefined;
            readonly words?: readonly {
                readonly text: string;
                readonly startSeconds: number;
                readonly endSeconds: number;
                readonly speaker?: string | undefined;
                readonly confidence?: number | undefined;
            }[] | undefined;
        }>;
        start: <const Model extends TranscriptionModel>(input: TranscriptionRequestInput<Model> | TranscriptionRequest, options?: RunOptions) => Promise<GenerationHandle<import("./transcription.js").TranscriptionResponse>>;
        resume: (model: TranscriptionModel, token: unknown, options?: RunOptions) => Promise<GenerationHandle<import("./transcription.js").TranscriptionResponse>>;
    };
    dispose: () => Promise<void>;
};
export * as AI from "./promise.js";

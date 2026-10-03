import { Effect, JsonSchema, Schema, Stream } from "effect";
import { Service, type StreamOptions } from "./route/client.js";
import { GenerationOptions, HttpOptions, AIError, LLMEvent, LLMRequest, LLMResponse, Message, LanguageModel, SystemPart, ToolChoice, type ContentPart, type LanguageModelProviderOptions, type ToolEntryInput } from "./schema/index.js";
import { type ToolSchema } from "./tool.js";
/** Input accepted by `LLM.request`, normalized into the canonical `LLMRequest` class. */
export type RequestInput<SelectedLanguageModel extends LanguageModel = LanguageModel> = Omit<ConstructorParameters<typeof LLMRequest>[0], "model" | "system" | "messages" | "tools" | "toolChoice" | "generation" | "http" | "providerOptions"> & {
    readonly model: SelectedLanguageModel;
    readonly system?: string | SystemPart | ReadonlyArray<SystemPart>;
    readonly prompt?: string | ContentPart | ReadonlyArray<ContentPart>;
    readonly messages?: ReadonlyArray<Message | Message.Input>;
    readonly tools?: ReadonlyArray<ToolEntryInput>;
    readonly toolChoice?: ToolChoice.Input;
    readonly generation?: GenerationOptions.Input;
    readonly providerOptions?: NoInfer<LanguageModelProviderOptions<SelectedLanguageModel>>;
    readonly http?: HttpOptions.Input;
};
export declare function generate<const Model extends LanguageModel>(input: RequestInput<Model>, options?: StreamOptions): Effect.Effect<LLMResponse, AIError, Service>;
export declare function generate(input: LLMRequest, options?: StreamOptions): Effect.Effect<LLMResponse, AIError, Service>;
export declare function stream<const Model extends LanguageModel>(input: RequestInput<Model>, options?: StreamOptions): Stream.Stream<LLMEvent, AIError, Service>;
export declare function stream(input: LLMRequest, options?: StreamOptions): Stream.Stream<LLMEvent, AIError, Service>;
export declare const request: <const SelectedLanguageModel extends LanguageModel>(input: RequestInput<SelectedLanguageModel>) => LLMRequest<SelectedLanguageModel>;
type GenerateObjectBase<SelectedLanguageModel extends LanguageModel = LanguageModel> = Omit<RequestInput<SelectedLanguageModel>, "tools" | "toolChoice">;
export declare class GenerateObjectResponse<T> {
    readonly object: T;
    readonly response: LLMResponse;
    constructor(object: T, response: LLMResponse);
    get events(): readonly (({
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
        readonly media: import("./media.js").Asset;
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
        readonly usage?: import("./schema/events.js").Usage | undefined;
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
        readonly usage?: import("./schema/events.js").Usage | undefined;
    } | {
        readonly type: "provider-error";
        readonly message: string;
        readonly classification?: "context-overflow" | "payload-too-large" | undefined;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    })[];
    get usage(): import("./schema/events.js").Usage | undefined;
}
export interface GenerateObjectOptions<S extends ToolSchema<any>, SelectedLanguageModel extends LanguageModel = LanguageModel> extends GenerateObjectBase<SelectedLanguageModel> {
    readonly schema: S;
}
export interface GenerateObjectDynamicOptions<SelectedLanguageModel extends LanguageModel = LanguageModel> extends GenerateObjectBase<SelectedLanguageModel> {
    /** Raw JSON Schema object describing the expected output shape. */
    readonly jsonSchema: JsonSchema.JsonSchema;
}
/**
 * Run a model and decode its output against `schema`. Works on every protocol
 * because it forces a synthetic tool call internally — provider-native JSON
 * modes are intentionally avoided so behaviour is uniform.
 *
 * Two input modes:
 *
 * 1. `schema: EffectSchema<T>` — `.object` is decoded and typed as `T`.
 *    Decode failures surface as `AIError`.
 * 2. `jsonSchema: JsonSchema.JsonSchema` — `.object` is `unknown`. Use when
 *    the schema is only available at runtime (MCP, plugin manifests). Caller validates.
 */
export declare function generateObject<const SelectedLanguageModel extends LanguageModel, S extends ToolSchema<any>>(options: GenerateObjectOptions<S, SelectedLanguageModel>): Effect.Effect<GenerateObjectResponse<Schema.Schema.Type<S>>, AIError, Service>;
export declare function generateObject<const SelectedLanguageModel extends LanguageModel>(options: GenerateObjectDynamicOptions<SelectedLanguageModel>): Effect.Effect<GenerateObjectResponse<unknown>, AIError, Service>;
export {};

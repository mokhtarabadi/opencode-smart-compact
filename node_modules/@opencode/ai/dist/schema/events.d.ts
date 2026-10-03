import { Schema } from "effect";
import { ContentBlockID, ToolCallID } from "./ids.js";
import { Message, CompactionPart, ToolOutput, ToolResultValue } from "./messages.js";
import { ProviderMetadata } from "./options.js";
import { Media } from "../media.js";
export declare const FinishReason: Schema.Literals<readonly ["stop", "length", "tool-calls", "content-filter", "error", "unknown"]>;
export type FinishReason = Schema.Schema.Type<typeof FinishReason>;
declare const Usage_base: Schema.Class<Usage, Schema.Struct<{
    /** Effective input size of the final message iteration, when reported; not billed totals. */
    readonly contextTokens: Schema.optional<Schema.Number>;
    readonly inputTokens: Schema.optional<Schema.Number>;
    readonly outputTokens: Schema.optional<Schema.Number>;
    readonly nonCachedInputTokens: Schema.optional<Schema.Number>;
    readonly cacheReadInputTokens: Schema.optional<Schema.Number>;
    readonly cacheWriteInputTokens: Schema.optional<Schema.Number>;
    readonly reasoningTokens: Schema.optional<Schema.Number>;
    readonly totalTokens: Schema.optional<Schema.Number>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, {}>;
/**
 * Token usage reported by an LLM provider.
 *
 * **Inclusive totals** (match AI SDK / OpenAI / LangChain convention — a
 * reader from any of those ecosystems sees the number they expect):
 *
 * - `inputTokens` — total prompt tokens, *including* cached reads/writes.
 * - `outputTokens` — total output tokens, *including* reasoning.
 * - `totalTokens` — provider-supplied total, or `inputTokens + outputTokens`.
 *
 * **Non-overlapping breakdown** (every field is independently meaningful;
 * consumers never have to subtract):
 *
 * - `nonCachedInputTokens` — the "fresh" portion of the prompt.
 * - `cacheReadInputTokens` — input tokens served from cache.
 * - `cacheWriteInputTokens` — input tokens written to cache.
 * - `reasoningTokens` — subset of `outputTokens` spent on hidden reasoning.
 *
 * **Invariant**: `nonCachedInputTokens + cacheReadInputTokens +
 * cacheWriteInputTokens = inputTokens`, and `reasoningTokens ≤ outputTokens`.
 * Each protocol mapper computes whichever side it doesn't get natively,
 * with `Math.max(0, …)` clamping for defense against provider bugs. Because
 * every breakdown field is stored independently, downstream consumers can
 * read whatever they need (cost-by-category, context-pressure, AI-SDK-style
 * inclusive total) without ever subtracting — eliminating the underflow
 * class of bug where a clamped difference would silently store the wrong
 * value.
 *
 * **Semantics by provider**:
 *
 * - OpenAI Chat / Responses / Gemini: provider reports inclusive
 *   `inputTokens` and an inclusive `outputTokens`; mapper subtracts to
 *   derive the breakdown.
 * - Anthropic and Bedrock report the input breakdown natively: Anthropic's
 *   `input_tokens` and Bedrock's `inputTokens` are non-cached only. Their
 *   mappers sum the breakdown to derive the inclusive `inputTokens`.
 *   Anthropic's `outputTokens` includes extended thinking. Newer responses
 *   expose that subset as `output_tokens_details.thinking_tokens`, which maps
 *   to `reasoningTokens`; older responses leave it undefined.
 *
 * `providerMetadata` always carries the provider's raw usage payload —
 * keyed by provider name (`{ openai: ... }`, `{ anthropic: ... }`, etc.)
 * — for fields we don't normalize and for billing-level audit trails.
 * Matches the same escape-hatch field on `LLMEvent`.
 */
export declare class Usage extends Usage_base {
    /**
     * Non-reasoning output tokens (including compaction summaries) — `outputTokens` minus `reasoningTokens`, clamped
     * to zero. The one place subtraction happens in this contract; the clamp
     * means a provider reporting `reasoningTokens > outputTokens` produces a
     * harmless zero rather than a negative that crashes downstream schemas.
     */
    get visibleOutputTokens(): number;
    static from(input: UsageInput): Usage;
}
export type UsageInput = Usage | ConstructorParameters<typeof Usage>[0];
/**
 * Usage reported by media routes. Providers bill images, video, speech, and transcription in different units, so
 * each response carries the unit it was actually metered in instead of forcing everything into tokens.
 */
export declare const MediaUsage: Schema.Union<readonly [Schema.Struct<{
    readonly type: Schema.Literal<"tokens">;
    readonly input: Schema.optional<Schema.Number>;
    readonly output: Schema.optional<Schema.Number>;
    readonly total: Schema.optional<Schema.Number>;
    readonly details: Schema.optional<Schema.$Record<Schema.String, Schema.Unknown>>;
}>, Schema.Struct<{
    readonly type: Schema.Literal<"seconds">;
    readonly seconds: Schema.Number;
}>, Schema.Struct<{
    readonly type: Schema.Literal<"characters">;
    readonly characters: Schema.Number;
}>, Schema.Struct<{
    readonly type: Schema.Literal<"credits">;
    readonly credits: Schema.Number;
}>, Schema.Struct<{
    readonly type: Schema.Literal<"compute">;
    readonly seconds: Schema.Number;
}>]>;
export type MediaUsage = Schema.Schema.Type<typeof MediaUsage>;
declare const CompactionResponse_base: Schema.Class<CompactionResponse, Schema.Struct<{
    readonly replacement: Schema.$Array<typeof Message>;
    readonly usage: Schema.optional<typeof Usage>;
}>, {}>;
/** A replacement context window, not an assistant message to append to prior history. */
export declare class CompactionResponse extends CompactionResponse_base {
}
declare const CompactionCheckpointResponse_base: Schema.Class<CompactionCheckpointResponse, Schema.Struct<{
    readonly checkpoint: Schema.refine<{
        readonly type: "compaction";
        readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
        readonly id?: string | undefined;
        readonly text?: string | null | undefined;
        readonly encrypted?: string | undefined;
    } & {
        readonly encrypted: string;
        readonly text?: never;
    } & {
        readonly encrypted: string;
        readonly text?: never;
    }, Schema.refine<{
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
    }), Schema.Struct<{
        readonly type: Schema.Literal<"compaction">;
        readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
        readonly id: Schema.optional<Schema.String>;
        readonly encrypted: Schema.optional<Schema.String>;
        readonly text: Schema.optional<Schema.NullOr<Schema.String>>;
    }>> & {
        make: (input: Omit<CompactionPart, "type" | "encrypted" | "text"> & ({
            readonly encrypted: string;
            readonly text?: never;
        } | {
            readonly text: string | null;
            readonly encrypted?: never;
        })) => CompactionPart;
    }>;
    readonly responseID: Schema.String;
    readonly usage: Schema.optional<typeof Usage>;
}>, {}>;
/** A checkpoint only; retained history and replacement-window construction belong to the caller. */
export declare class CompactionCheckpointResponse extends CompactionCheckpointResponse_base {
}
export declare const StepStart: Schema.Struct<{
    readonly type: Schema.tag<"step-start">;
    readonly index: Schema.Number;
}>;
export type StepStart = Schema.Schema.Type<typeof StepStart>;
export declare const TextStart: Schema.Struct<{
    readonly type: Schema.tag<"text-start">;
    readonly id: Schema.String;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
export type TextStart = Schema.Schema.Type<typeof TextStart>;
export declare const TextDelta: Schema.Struct<{
    readonly type: Schema.tag<"text-delta">;
    readonly id: Schema.String;
    readonly text: Schema.String;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
export type TextDelta = Schema.Schema.Type<typeof TextDelta>;
export declare const TextEnd: Schema.Struct<{
    readonly type: Schema.tag<"text-end">;
    readonly id: Schema.String;
    /** Authoritative complete value; replaces accumulated deltas when present. */
    readonly text: Schema.optional<Schema.String>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
export type TextEnd = Schema.Schema.Type<typeof TextEnd>;
export declare const ReasoningStart: Schema.Struct<{
    readonly type: Schema.tag<"reasoning-start">;
    readonly id: Schema.String;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
export type ReasoningStart = Schema.Schema.Type<typeof ReasoningStart>;
export declare const ReasoningDelta: Schema.Struct<{
    readonly type: Schema.tag<"reasoning-delta">;
    readonly id: Schema.String;
    readonly text: Schema.String;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
export type ReasoningDelta = Schema.Schema.Type<typeof ReasoningDelta>;
export declare const ReasoningEnd: Schema.Struct<{
    readonly type: Schema.tag<"reasoning-end">;
    readonly id: Schema.String;
    /** Authoritative complete value; replaces accumulated deltas when present. */
    readonly text: Schema.optional<Schema.String>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
export type ReasoningEnd = Schema.Schema.Type<typeof ReasoningEnd>;
export declare const ToolInputStart: Schema.Struct<{
    readonly type: Schema.tag<"tool-input-start">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly providerExecuted: Schema.optional<Schema.Boolean>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
export type ToolInputStart = Schema.Schema.Type<typeof ToolInputStart>;
export declare const ToolInputDelta: Schema.Struct<{
    readonly type: Schema.tag<"tool-input-delta">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly text: Schema.String;
    /** Best-effort parse of all input fragments received through this delta. */
    readonly input: Schema.optional<Schema.Unknown>;
}>;
export type ToolInputDelta = Schema.Schema.Type<typeof ToolInputDelta>;
export declare const ToolInputEnd: Schema.Struct<{
    readonly type: Schema.tag<"tool-input-end">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
export type ToolInputEnd = Schema.Schema.Type<typeof ToolInputEnd>;
/** A local tool call whose final input could not be decoded. */
export declare const ToolInputError: Schema.Struct<{
    readonly type: Schema.tag<"tool-input-error">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly raw: Schema.String;
}>;
export type ToolInputError = Schema.Schema.Type<typeof ToolInputError>;
export declare const ToolCall: Schema.Struct<{
    readonly type: Schema.tag<"tool-call">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly input: Schema.Unknown;
    readonly providerExecuted: Schema.optional<Schema.Boolean>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
export type ToolCall = Schema.Schema.Type<typeof ToolCall>;
export declare const ToolResult: Schema.Struct<{
    readonly type: Schema.tag<"tool-result">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly result: Schema.Union<readonly [Schema.Struct<{
        readonly type: Schema.Literal<"json">;
        readonly value: Schema.Unknown;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"text">;
        readonly value: Schema.Unknown;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"error">;
        readonly value: Schema.Unknown;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"content">;
        readonly value: Schema.$Array<Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"text">;
            readonly text: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"file">;
            readonly uri: Schema.String;
            readonly mime: Schema.String;
            readonly name: Schema.optional<Schema.String>;
        }>]>>;
    }>]> & {
        is: <I>(input: I) => input is I & ({
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
        });
        make: (value: unknown, type?: ToolResultValue["type"]) => ToolResultValue;
    };
    readonly output: Schema.optional<Schema.Struct<{
        readonly structured: Schema.Unknown;
        readonly content: Schema.$Array<Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"text">;
            readonly text: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"file">;
            readonly uri: Schema.String;
            readonly mime: Schema.String;
            readonly name: Schema.optional<Schema.String>;
        }>]>>;
    }> & {
        make: (structured: unknown, content?: ReadonlyArray<import("@opencode/schema/tool").Content>) => ToolOutput;
        fromResultValue: (result: ToolResultValue) => ToolOutput | undefined;
        toResultValue: (output: ToolOutput) => ToolResultValue;
    }>;
    readonly providerExecuted: Schema.optional<Schema.Boolean>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
export type ToolResult = Schema.Schema.Type<typeof ToolResult>;
export declare const ToolError: Schema.Struct<{
    readonly type: Schema.tag<"tool-error">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly message: Schema.String;
    readonly error: Schema.optional<Schema.Defect>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
export type ToolError = Schema.Schema.Type<typeof ToolError>;
export declare const FinishReasonDetails: Schema.Struct<{
    readonly normalized: Schema.Literals<readonly ["stop", "length", "tool-calls", "content-filter", "error", "unknown"]>;
    readonly raw: Schema.optional<Schema.String>;
    /** The provider's policy area for a content-filter finish, such as `cyber`. */
    readonly category: Schema.optional<Schema.String>;
    /** The provider's human-readable reason for a content-filter finish. */
    readonly explanation: Schema.optional<Schema.String>;
}>;
export type FinishReasonDetails = Schema.Schema.Type<typeof FinishReasonDetails>;
export declare const StepFinish: Schema.Struct<{
    readonly type: Schema.tag<"step-finish">;
    readonly index: Schema.Number;
    readonly reason: Schema.Struct<{
        readonly normalized: Schema.Literals<readonly ["stop", "length", "tool-calls", "content-filter", "error", "unknown"]>;
        readonly raw: Schema.optional<Schema.String>;
        /** The provider's policy area for a content-filter finish, such as `cyber`. */
        readonly category: Schema.optional<Schema.String>;
        /** The provider's human-readable reason for a content-filter finish. */
        readonly explanation: Schema.optional<Schema.String>;
    }>;
    readonly usage: Schema.optional<typeof Usage>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
export type StepFinish = Schema.Schema.Type<typeof StepFinish>;
export declare const Finish: Schema.Struct<{
    readonly type: Schema.tag<"finish">;
    readonly reason: Schema.Struct<{
        readonly normalized: Schema.Literals<readonly ["stop", "length", "tool-calls", "content-filter", "error", "unknown"]>;
        readonly raw: Schema.optional<Schema.String>;
        /** The provider's policy area for a content-filter finish, such as `cyber`. */
        readonly category: Schema.optional<Schema.String>;
        /** The provider's human-readable reason for a content-filter finish. */
        readonly explanation: Schema.optional<Schema.String>;
    }>;
    readonly usage: Schema.optional<typeof Usage>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
export type Finish = Schema.Schema.Type<typeof Finish>;
/** A generated media asset (image, audio, …) emitted by the model as first-class output rather than a tool result. */
export declare const MediaEvent: Schema.Struct<{
    readonly type: Schema.tag<"media">;
    readonly media: Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
        readonly source: Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"bytes">;
            readonly data: Schema.Uint8Array;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"base64">;
            readonly data: Schema.String;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"url">;
            readonly url: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
            readonly expiresAt: Schema.optional<Schema.Number>;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"ref">;
            readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
            readonly id: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
        }>]>;
        readonly info: Schema.optional<Schema.Struct<{
            readonly width: Schema.optional<Schema.Number>;
            readonly height: Schema.optional<Schema.Number>;
            readonly durationSeconds: Schema.optional<Schema.Number>;
            readonly sampleRate: Schema.optional<Schema.Number>;
            readonly channels: Schema.optional<Schema.Number>;
            readonly encoding: Schema.optional<Schema.String>;
            readonly format: Schema.optional<Schema.String>;
        }>>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, never, never>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
export type MediaEvent = Schema.Schema.Type<typeof MediaEvent>;
export declare const ProviderErrorEvent: Schema.Struct<{
    readonly type: Schema.tag<"provider-error">;
    readonly message: Schema.String;
    readonly classification: Schema.optional<Schema.Literals<readonly ["context-overflow", "payload-too-large"]>>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
export type ProviderErrorEvent = Schema.Schema.Type<typeof ProviderErrorEvent>;
declare const llmEventTagged: Schema.toTaggedUnion<"type", readonly [Schema.refine<{
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
}), Schema.Struct<{
    readonly type: Schema.Literal<"compaction">;
    readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
    readonly id: Schema.optional<Schema.String>;
    readonly encrypted: Schema.optional<Schema.String>;
    readonly text: Schema.optional<Schema.NullOr<Schema.String>>;
}>> & {
    make: (input: Omit<CompactionPart, "type" | "encrypted" | "text"> & ({
        readonly encrypted: string;
        readonly text?: never;
    } | {
        readonly text: string | null;
        readonly encrypted?: never;
    })) => CompactionPart;
}, Schema.Struct<{
    readonly type: Schema.tag<"step-start">;
    readonly index: Schema.Number;
}>, Schema.Struct<{
    readonly type: Schema.tag<"text-start">;
    readonly id: Schema.String;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"text-delta">;
    readonly id: Schema.String;
    readonly text: Schema.String;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"text-end">;
    readonly id: Schema.String;
    /** Authoritative complete value; replaces accumulated deltas when present. */
    readonly text: Schema.optional<Schema.String>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"reasoning-start">;
    readonly id: Schema.String;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"reasoning-delta">;
    readonly id: Schema.String;
    readonly text: Schema.String;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"reasoning-end">;
    readonly id: Schema.String;
    /** Authoritative complete value; replaces accumulated deltas when present. */
    readonly text: Schema.optional<Schema.String>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"tool-input-start">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly providerExecuted: Schema.optional<Schema.Boolean>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"tool-input-delta">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly text: Schema.String;
    /** Best-effort parse of all input fragments received through this delta. */
    readonly input: Schema.optional<Schema.Unknown>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"tool-input-end">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"tool-input-error">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly raw: Schema.String;
}>, Schema.Struct<{
    readonly type: Schema.tag<"tool-call">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly input: Schema.Unknown;
    readonly providerExecuted: Schema.optional<Schema.Boolean>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"tool-result">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly result: Schema.Union<readonly [Schema.Struct<{
        readonly type: Schema.Literal<"json">;
        readonly value: Schema.Unknown;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"text">;
        readonly value: Schema.Unknown;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"error">;
        readonly value: Schema.Unknown;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"content">;
        readonly value: Schema.$Array<Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"text">;
            readonly text: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"file">;
            readonly uri: Schema.String;
            readonly mime: Schema.String;
            readonly name: Schema.optional<Schema.String>;
        }>]>>;
    }>]> & {
        is: <I>(input: I) => input is I & ({
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
        });
        make: (value: unknown, type?: ToolResultValue["type"]) => ToolResultValue;
    };
    readonly output: Schema.optional<Schema.Struct<{
        readonly structured: Schema.Unknown;
        readonly content: Schema.$Array<Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"text">;
            readonly text: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"file">;
            readonly uri: Schema.String;
            readonly mime: Schema.String;
            readonly name: Schema.optional<Schema.String>;
        }>]>>;
    }> & {
        make: (structured: unknown, content?: ReadonlyArray<import("@opencode/schema/tool").Content>) => ToolOutput;
        fromResultValue: (result: ToolResultValue) => ToolOutput | undefined;
        toResultValue: (output: ToolOutput) => ToolResultValue;
    }>;
    readonly providerExecuted: Schema.optional<Schema.Boolean>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"tool-error">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly message: Schema.String;
    readonly error: Schema.optional<Schema.Defect>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"media">;
    readonly media: Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
        readonly source: Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"bytes">;
            readonly data: Schema.Uint8Array;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"base64">;
            readonly data: Schema.String;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"url">;
            readonly url: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
            readonly expiresAt: Schema.optional<Schema.Number>;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"ref">;
            readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
            readonly id: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
        }>]>;
        readonly info: Schema.optional<Schema.Struct<{
            readonly width: Schema.optional<Schema.Number>;
            readonly height: Schema.optional<Schema.Number>;
            readonly durationSeconds: Schema.optional<Schema.Number>;
            readonly sampleRate: Schema.optional<Schema.Number>;
            readonly channels: Schema.optional<Schema.Number>;
            readonly encoding: Schema.optional<Schema.String>;
            readonly format: Schema.optional<Schema.String>;
        }>>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, never, never>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"step-finish">;
    readonly index: Schema.Number;
    readonly reason: Schema.Struct<{
        readonly normalized: Schema.Literals<readonly ["stop", "length", "tool-calls", "content-filter", "error", "unknown"]>;
        readonly raw: Schema.optional<Schema.String>;
        /** The provider's policy area for a content-filter finish, such as `cyber`. */
        readonly category: Schema.optional<Schema.String>;
        /** The provider's human-readable reason for a content-filter finish. */
        readonly explanation: Schema.optional<Schema.String>;
    }>;
    readonly usage: Schema.optional<typeof Usage>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"finish">;
    readonly reason: Schema.Struct<{
        readonly normalized: Schema.Literals<readonly ["stop", "length", "tool-calls", "content-filter", "error", "unknown"]>;
        readonly raw: Schema.optional<Schema.String>;
        /** The provider's policy area for a content-filter finish, such as `cyber`. */
        readonly category: Schema.optional<Schema.String>;
        /** The provider's human-readable reason for a content-filter finish. */
        readonly explanation: Schema.optional<Schema.String>;
    }>;
    readonly usage: Schema.optional<typeof Usage>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"provider-error">;
    readonly message: Schema.String;
    readonly classification: Schema.optional<Schema.Literals<readonly ["context-overflow", "payload-too-large"]>>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>]>;
type WithID<Event extends {
    readonly id: unknown;
}, ID> = Omit<Event, "type" | "id"> & {
    readonly id: ID | string;
};
type WithUsage<Event extends {
    readonly usage?: Usage;
}> = Omit<Event, "type" | "usage"> & {
    readonly usage?: UsageInput;
};
/**
 * camelCase aliases for `LLMEvent.guards` (provided by `Schema.toTaggedUnion`).
 * Lets consumers write `events.filter(LLMEvent.is.toolCall)` instead of
 * `events.filter(LLMEvent.guards["tool-call"])`.
 */
export declare const LLMEvent: Schema.Union<readonly [Schema.refine<{
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
}), Schema.Struct<{
    readonly type: Schema.Literal<"compaction">;
    readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
    readonly id: Schema.optional<Schema.String>;
    readonly encrypted: Schema.optional<Schema.String>;
    readonly text: Schema.optional<Schema.NullOr<Schema.String>>;
}>> & {
    make: (input: Omit<CompactionPart, "type" | "encrypted" | "text"> & ({
        readonly encrypted: string;
        readonly text?: never;
    } | {
        readonly text: string | null;
        readonly encrypted?: never;
    })) => CompactionPart;
}, Schema.Struct<{
    readonly type: Schema.tag<"step-start">;
    readonly index: Schema.Number;
}>, Schema.Struct<{
    readonly type: Schema.tag<"text-start">;
    readonly id: Schema.String;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"text-delta">;
    readonly id: Schema.String;
    readonly text: Schema.String;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"text-end">;
    readonly id: Schema.String;
    /** Authoritative complete value; replaces accumulated deltas when present. */
    readonly text: Schema.optional<Schema.String>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"reasoning-start">;
    readonly id: Schema.String;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"reasoning-delta">;
    readonly id: Schema.String;
    readonly text: Schema.String;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"reasoning-end">;
    readonly id: Schema.String;
    /** Authoritative complete value; replaces accumulated deltas when present. */
    readonly text: Schema.optional<Schema.String>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"tool-input-start">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly providerExecuted: Schema.optional<Schema.Boolean>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"tool-input-delta">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly text: Schema.String;
    /** Best-effort parse of all input fragments received through this delta. */
    readonly input: Schema.optional<Schema.Unknown>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"tool-input-end">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"tool-input-error">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly raw: Schema.String;
}>, Schema.Struct<{
    readonly type: Schema.tag<"tool-call">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly input: Schema.Unknown;
    readonly providerExecuted: Schema.optional<Schema.Boolean>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"tool-result">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly result: Schema.Union<readonly [Schema.Struct<{
        readonly type: Schema.Literal<"json">;
        readonly value: Schema.Unknown;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"text">;
        readonly value: Schema.Unknown;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"error">;
        readonly value: Schema.Unknown;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"content">;
        readonly value: Schema.$Array<Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"text">;
            readonly text: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"file">;
            readonly uri: Schema.String;
            readonly mime: Schema.String;
            readonly name: Schema.optional<Schema.String>;
        }>]>>;
    }>]> & {
        is: <I>(input: I) => input is I & ({
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
        });
        make: (value: unknown, type?: ToolResultValue["type"]) => ToolResultValue;
    };
    readonly output: Schema.optional<Schema.Struct<{
        readonly structured: Schema.Unknown;
        readonly content: Schema.$Array<Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"text">;
            readonly text: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"file">;
            readonly uri: Schema.String;
            readonly mime: Schema.String;
            readonly name: Schema.optional<Schema.String>;
        }>]>>;
    }> & {
        make: (structured: unknown, content?: ReadonlyArray<import("@opencode/schema/tool").Content>) => ToolOutput;
        fromResultValue: (result: ToolResultValue) => ToolOutput | undefined;
        toResultValue: (output: ToolOutput) => ToolResultValue;
    }>;
    readonly providerExecuted: Schema.optional<Schema.Boolean>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"tool-error">;
    readonly id: Schema.String;
    readonly name: Schema.String;
    readonly namespace: Schema.optional<Schema.String>;
    readonly message: Schema.String;
    readonly error: Schema.optional<Schema.Defect>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"media">;
    readonly media: Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
        readonly source: Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"bytes">;
            readonly data: Schema.Uint8Array;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"base64">;
            readonly data: Schema.String;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"url">;
            readonly url: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
            readonly expiresAt: Schema.optional<Schema.Number>;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"ref">;
            readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
            readonly id: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
        }>]>;
        readonly info: Schema.optional<Schema.Struct<{
            readonly width: Schema.optional<Schema.Number>;
            readonly height: Schema.optional<Schema.Number>;
            readonly durationSeconds: Schema.optional<Schema.Number>;
            readonly sampleRate: Schema.optional<Schema.Number>;
            readonly channels: Schema.optional<Schema.Number>;
            readonly encoding: Schema.optional<Schema.String>;
            readonly format: Schema.optional<Schema.String>;
        }>>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, never, never>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"step-finish">;
    readonly index: Schema.Number;
    readonly reason: Schema.Struct<{
        readonly normalized: Schema.Literals<readonly ["stop", "length", "tool-calls", "content-filter", "error", "unknown"]>;
        readonly raw: Schema.optional<Schema.String>;
        /** The provider's policy area for a content-filter finish, such as `cyber`. */
        readonly category: Schema.optional<Schema.String>;
        /** The provider's human-readable reason for a content-filter finish. */
        readonly explanation: Schema.optional<Schema.String>;
    }>;
    readonly usage: Schema.optional<typeof Usage>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"finish">;
    readonly reason: Schema.Struct<{
        readonly normalized: Schema.Literals<readonly ["stop", "length", "tool-calls", "content-filter", "error", "unknown"]>;
        readonly raw: Schema.optional<Schema.String>;
        /** The provider's policy area for a content-filter finish, such as `cyber`. */
        readonly category: Schema.optional<Schema.String>;
        /** The provider's human-readable reason for a content-filter finish. */
        readonly explanation: Schema.optional<Schema.String>;
    }>;
    readonly usage: Schema.optional<typeof Usage>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"provider-error">;
    readonly message: Schema.String;
    readonly classification: Schema.optional<Schema.Literals<readonly ["context-overflow", "payload-too-large"]>>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>]> & {
    readonly discriminants: readonly ["compaction", "step-start", "text-start", "text-delta", "text-end", "reasoning-start", "reasoning-delta", "reasoning-end", "tool-input-start", "tool-input-delta", "tool-input-end", "tool-input-error", "tool-call", "tool-result", "tool-error", "media", "step-finish", "finish", "provider-error"];
    readonly cases: {
        compaction: Schema.refine<{
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
        }), Schema.Struct<{
            readonly type: Schema.Literal<"compaction">;
            readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
            readonly id: Schema.optional<Schema.String>;
            readonly encrypted: Schema.optional<Schema.String>;
            readonly text: Schema.optional<Schema.NullOr<Schema.String>>;
        }>> & {
            make: (input: Omit<CompactionPart, "type" | "encrypted" | "text"> & ({
                readonly encrypted: string;
                readonly text?: never;
            } | {
                readonly text: string | null;
                readonly encrypted?: never;
            })) => CompactionPart;
        };
        "step-start": Schema.Struct<{
            readonly type: Schema.tag<"step-start">;
            readonly index: Schema.Number;
        }>;
        "text-start": Schema.Struct<{
            readonly type: Schema.tag<"text-start">;
            readonly id: Schema.String;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
        "text-delta": Schema.Struct<{
            readonly type: Schema.tag<"text-delta">;
            readonly id: Schema.String;
            readonly text: Schema.String;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
        "text-end": Schema.Struct<{
            readonly type: Schema.tag<"text-end">;
            readonly id: Schema.String;
            /** Authoritative complete value; replaces accumulated deltas when present. */
            readonly text: Schema.optional<Schema.String>;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
        "reasoning-start": Schema.Struct<{
            readonly type: Schema.tag<"reasoning-start">;
            readonly id: Schema.String;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
        "reasoning-delta": Schema.Struct<{
            readonly type: Schema.tag<"reasoning-delta">;
            readonly id: Schema.String;
            readonly text: Schema.String;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
        "reasoning-end": Schema.Struct<{
            readonly type: Schema.tag<"reasoning-end">;
            readonly id: Schema.String;
            /** Authoritative complete value; replaces accumulated deltas when present. */
            readonly text: Schema.optional<Schema.String>;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
        "tool-input-start": Schema.Struct<{
            readonly type: Schema.tag<"tool-input-start">;
            readonly id: Schema.String;
            readonly name: Schema.String;
            readonly namespace: Schema.optional<Schema.String>;
            readonly providerExecuted: Schema.optional<Schema.Boolean>;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
        "tool-input-delta": Schema.Struct<{
            readonly type: Schema.tag<"tool-input-delta">;
            readonly id: Schema.String;
            readonly name: Schema.String;
            readonly namespace: Schema.optional<Schema.String>;
            readonly text: Schema.String;
            /** Best-effort parse of all input fragments received through this delta. */
            readonly input: Schema.optional<Schema.Unknown>;
        }>;
        "tool-input-end": Schema.Struct<{
            readonly type: Schema.tag<"tool-input-end">;
            readonly id: Schema.String;
            readonly name: Schema.String;
            readonly namespace: Schema.optional<Schema.String>;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
        "tool-input-error": Schema.Struct<{
            readonly type: Schema.tag<"tool-input-error">;
            readonly id: Schema.String;
            readonly name: Schema.String;
            readonly namespace: Schema.optional<Schema.String>;
            readonly raw: Schema.String;
        }>;
        "tool-call": Schema.Struct<{
            readonly type: Schema.tag<"tool-call">;
            readonly id: Schema.String;
            readonly name: Schema.String;
            readonly namespace: Schema.optional<Schema.String>;
            readonly input: Schema.Unknown;
            readonly providerExecuted: Schema.optional<Schema.Boolean>;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
        "tool-result": Schema.Struct<{
            readonly type: Schema.tag<"tool-result">;
            readonly id: Schema.String;
            readonly name: Schema.String;
            readonly namespace: Schema.optional<Schema.String>;
            readonly result: Schema.Union<readonly [Schema.Struct<{
                readonly type: Schema.Literal<"json">;
                readonly value: Schema.Unknown;
            }>, Schema.Struct<{
                readonly type: Schema.Literal<"text">;
                readonly value: Schema.Unknown;
            }>, Schema.Struct<{
                readonly type: Schema.Literal<"error">;
                readonly value: Schema.Unknown;
            }>, Schema.Struct<{
                readonly type: Schema.Literal<"content">;
                readonly value: Schema.$Array<Schema.Union<readonly [Schema.Struct<{
                    readonly type: Schema.Literal<"text">;
                    readonly text: Schema.String;
                }>, Schema.Struct<{
                    readonly type: Schema.Literal<"file">;
                    readonly uri: Schema.String;
                    readonly mime: Schema.String;
                    readonly name: Schema.optional<Schema.String>;
                }>]>>;
            }>]> & {
                is: <I>(input: I) => input is I & ({
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
                });
                make: (value: unknown, type?: ToolResultValue["type"]) => ToolResultValue;
            };
            readonly output: Schema.optional<Schema.Struct<{
                readonly structured: Schema.Unknown;
                readonly content: Schema.$Array<Schema.Union<readonly [Schema.Struct<{
                    readonly type: Schema.Literal<"text">;
                    readonly text: Schema.String;
                }>, Schema.Struct<{
                    readonly type: Schema.Literal<"file">;
                    readonly uri: Schema.String;
                    readonly mime: Schema.String;
                    readonly name: Schema.optional<Schema.String>;
                }>]>>;
            }> & {
                make: (structured: unknown, content?: ReadonlyArray<import("@opencode/schema/tool").Content>) => ToolOutput;
                fromResultValue: (result: ToolResultValue) => ToolOutput | undefined;
                toResultValue: (output: ToolOutput) => ToolResultValue;
            }>;
            readonly providerExecuted: Schema.optional<Schema.Boolean>;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
        "tool-error": Schema.Struct<{
            readonly type: Schema.tag<"tool-error">;
            readonly id: Schema.String;
            readonly name: Schema.String;
            readonly namespace: Schema.optional<Schema.String>;
            readonly message: Schema.String;
            readonly error: Schema.optional<Schema.Defect>;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
        media: Schema.Struct<{
            readonly type: Schema.tag<"media">;
            readonly media: Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
                readonly source: Schema.Union<readonly [Schema.Struct<{
                    readonly type: Schema.Literal<"bytes">;
                    readonly data: Schema.Uint8Array;
                    readonly mediaType: Schema.String;
                }>, Schema.Struct<{
                    readonly type: Schema.Literal<"base64">;
                    readonly data: Schema.String;
                    readonly mediaType: Schema.String;
                }>, Schema.Struct<{
                    readonly type: Schema.Literal<"url">;
                    readonly url: Schema.String;
                    readonly mediaType: Schema.optional<Schema.String>;
                    readonly expiresAt: Schema.optional<Schema.Number>;
                }>, Schema.Struct<{
                    readonly type: Schema.Literal<"ref">;
                    readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
                    readonly id: Schema.String;
                    readonly mediaType: Schema.optional<Schema.String>;
                }>]>;
                readonly info: Schema.optional<Schema.Struct<{
                    readonly width: Schema.optional<Schema.Number>;
                    readonly height: Schema.optional<Schema.Number>;
                    readonly durationSeconds: Schema.optional<Schema.Number>;
                    readonly sampleRate: Schema.optional<Schema.Number>;
                    readonly channels: Schema.optional<Schema.Number>;
                    readonly encoding: Schema.optional<Schema.String>;
                    readonly format: Schema.optional<Schema.String>;
                }>>;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>, never, never>;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
        "step-finish": Schema.Struct<{
            readonly type: Schema.tag<"step-finish">;
            readonly index: Schema.Number;
            readonly reason: Schema.Struct<{
                readonly normalized: Schema.Literals<readonly ["stop", "length", "tool-calls", "content-filter", "error", "unknown"]>;
                readonly raw: Schema.optional<Schema.String>;
                /** The provider's policy area for a content-filter finish, such as `cyber`. */
                readonly category: Schema.optional<Schema.String>;
                /** The provider's human-readable reason for a content-filter finish. */
                readonly explanation: Schema.optional<Schema.String>;
            }>;
            readonly usage: Schema.optional<typeof Usage>;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
        finish: Schema.Struct<{
            readonly type: Schema.tag<"finish">;
            readonly reason: Schema.Struct<{
                readonly normalized: Schema.Literals<readonly ["stop", "length", "tool-calls", "content-filter", "error", "unknown"]>;
                readonly raw: Schema.optional<Schema.String>;
                /** The provider's policy area for a content-filter finish, such as `cyber`. */
                readonly category: Schema.optional<Schema.String>;
                /** The provider's human-readable reason for a content-filter finish. */
                readonly explanation: Schema.optional<Schema.String>;
            }>;
            readonly usage: Schema.optional<typeof Usage>;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
        "provider-error": Schema.Struct<{
            readonly type: Schema.tag<"provider-error">;
            readonly message: Schema.String;
            readonly classification: Schema.optional<Schema.Literals<readonly ["context-overflow", "payload-too-large"]>>;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
    };
    readonly isAnyOf: <const Keys>(keys: readonly Keys[]) => (value: ({
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
        readonly usage?: Usage | undefined;
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
        readonly usage?: Usage | undefined;
    } | {
        readonly type: "provider-error";
        readonly message: string;
        readonly classification?: "context-overflow" | "payload-too-large" | undefined;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    }) => value is Extract<{
        readonly type: "compaction";
        readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
        readonly id?: string | undefined;
        readonly text?: string | null | undefined;
        readonly encrypted?: string | undefined;
    } & {
        readonly encrypted: string;
        readonly text?: never;
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly type: "compaction";
        readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
        readonly id?: string | undefined;
        readonly text?: string | null | undefined;
        readonly encrypted?: string | undefined;
    } & {
        readonly text: string | null;
        readonly encrypted?: never;
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly type: "step-start";
        readonly index: number;
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly id: string;
        readonly type: "text-start";
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly id: string;
        readonly type: "text-delta";
        readonly text: string;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly id: string;
        readonly type: "text-end";
        readonly text?: string | undefined;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly id: string;
        readonly type: "reasoning-start";
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly id: string;
        readonly type: "reasoning-delta";
        readonly text: string;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly id: string;
        readonly type: "reasoning-end";
        readonly text?: string | undefined;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    }, {
        readonly type: Keys;
    }> | Extract<{
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
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly id: string;
        readonly type: "tool-input-delta";
        readonly name: string;
        readonly text: string;
        readonly input?: unknown;
        readonly namespace?: string | undefined;
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly id: string;
        readonly type: "tool-input-end";
        readonly name: string;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
        readonly namespace?: string | undefined;
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly id: string;
        readonly type: "tool-input-error";
        readonly name: string;
        readonly raw: string;
        readonly namespace?: string | undefined;
    }, {
        readonly type: Keys;
    }> | Extract<{
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
    }, {
        readonly type: Keys;
    }> | Extract<{
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
    }, {
        readonly type: Keys;
    }> | Extract<{
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
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly type: "media";
        readonly media: Media.Asset;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    }, {
        readonly type: Keys;
    }> | Extract<{
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
        readonly usage?: Usage | undefined;
    }, {
        readonly type: Keys;
    }> | Extract<{
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
        readonly usage?: Usage | undefined;
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly type: "provider-error";
        readonly message: string;
        readonly classification?: "context-overflow" | "payload-too-large" | undefined;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    }, {
        readonly type: Keys;
    }>;
    readonly guards: {
        compaction: (u: unknown) => u is {
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
        });
        "step-start": (u: unknown) => u is {
            readonly type: "step-start";
            readonly index: number;
        };
        "text-start": (u: unknown) => u is {
            readonly id: string;
            readonly type: "text-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        "text-delta": (u: unknown) => u is {
            readonly id: string;
            readonly type: "text-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        "text-end": (u: unknown) => u is {
            readonly id: string;
            readonly type: "text-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        "reasoning-start": (u: unknown) => u is {
            readonly id: string;
            readonly type: "reasoning-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        "reasoning-delta": (u: unknown) => u is {
            readonly id: string;
            readonly type: "reasoning-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        "reasoning-end": (u: unknown) => u is {
            readonly id: string;
            readonly type: "reasoning-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        "tool-input-start": (u: unknown) => u is {
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
        };
        "tool-input-delta": (u: unknown) => u is {
            readonly id: string;
            readonly type: "tool-input-delta";
            readonly name: string;
            readonly text: string;
            readonly input?: unknown;
            readonly namespace?: string | undefined;
        };
        "tool-input-end": (u: unknown) => u is {
            readonly id: string;
            readonly type: "tool-input-end";
            readonly name: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
        };
        "tool-input-error": (u: unknown) => u is {
            readonly id: string;
            readonly type: "tool-input-error";
            readonly name: string;
            readonly raw: string;
            readonly namespace?: string | undefined;
        };
        "tool-call": (u: unknown) => u is {
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
        };
        "tool-result": (u: unknown) => u is {
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
        };
        "tool-error": (u: unknown) => u is {
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
        };
        media: (u: unknown) => u is {
            readonly type: "media";
            readonly media: Media.Asset;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        "step-finish": (u: unknown) => u is {
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
            readonly usage?: Usage | undefined;
        };
        finish: (u: unknown) => u is {
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
            readonly usage?: Usage | undefined;
        };
        "provider-error": (u: unknown) => u is {
            readonly type: "provider-error";
            readonly message: string;
            readonly classification?: "context-overflow" | "payload-too-large" | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
    };
    readonly match: {
        <Cases extends {
            compaction: (value: {
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
            })) => any;
            "step-start": (value: {
                readonly type: "step-start";
                readonly index: number;
            }) => any;
            "text-start": (value: {
                readonly id: string;
                readonly type: "text-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
            "text-delta": (value: {
                readonly id: string;
                readonly type: "text-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
            "text-end": (value: {
                readonly id: string;
                readonly type: "text-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
            "reasoning-start": (value: {
                readonly id: string;
                readonly type: "reasoning-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
            "reasoning-delta": (value: {
                readonly id: string;
                readonly type: "reasoning-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
            "reasoning-end": (value: {
                readonly id: string;
                readonly type: "reasoning-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
            "tool-input-start": (value: {
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
            }) => any;
            "tool-input-delta": (value: {
                readonly id: string;
                readonly type: "tool-input-delta";
                readonly name: string;
                readonly text: string;
                readonly input?: unknown;
                readonly namespace?: string | undefined;
            }) => any;
            "tool-input-end": (value: {
                readonly id: string;
                readonly type: "tool-input-end";
                readonly name: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
                readonly namespace?: string | undefined;
            }) => any;
            "tool-input-error": (value: {
                readonly id: string;
                readonly type: "tool-input-error";
                readonly name: string;
                readonly raw: string;
                readonly namespace?: string | undefined;
            }) => any;
            "tool-call": (value: {
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
            }) => any;
            "tool-result": (value: {
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
            }) => any;
            "tool-error": (value: {
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
            }) => any;
            media: (value: {
                readonly type: "media";
                readonly media: Media.Asset;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
            "step-finish": (value: {
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
                readonly usage?: Usage | undefined;
            }) => any;
            finish: (value: {
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
                readonly usage?: Usage | undefined;
            }) => any;
            "provider-error": (value: {
                readonly type: "provider-error";
                readonly message: string;
                readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
        }>(value: ({
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
            readonly usage?: Usage | undefined;
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
            readonly usage?: Usage | undefined;
        } | {
            readonly type: "provider-error";
            readonly message: string;
            readonly classification?: "context-overflow" | "payload-too-large" | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, cases: Cases): Cases[keyof Cases] extends (value: any) => infer R ? import("effect/Unify").Unify<R> : never;
        <Cases extends {
            compaction: (value: {
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
            })) => any;
            "step-start": (value: {
                readonly type: "step-start";
                readonly index: number;
            }) => any;
            "text-start": (value: {
                readonly id: string;
                readonly type: "text-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
            "text-delta": (value: {
                readonly id: string;
                readonly type: "text-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
            "text-end": (value: {
                readonly id: string;
                readonly type: "text-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
            "reasoning-start": (value: {
                readonly id: string;
                readonly type: "reasoning-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
            "reasoning-delta": (value: {
                readonly id: string;
                readonly type: "reasoning-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
            "reasoning-end": (value: {
                readonly id: string;
                readonly type: "reasoning-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
            "tool-input-start": (value: {
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
            }) => any;
            "tool-input-delta": (value: {
                readonly id: string;
                readonly type: "tool-input-delta";
                readonly name: string;
                readonly text: string;
                readonly input?: unknown;
                readonly namespace?: string | undefined;
            }) => any;
            "tool-input-end": (value: {
                readonly id: string;
                readonly type: "tool-input-end";
                readonly name: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
                readonly namespace?: string | undefined;
            }) => any;
            "tool-input-error": (value: {
                readonly id: string;
                readonly type: "tool-input-error";
                readonly name: string;
                readonly raw: string;
                readonly namespace?: string | undefined;
            }) => any;
            "tool-call": (value: {
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
            }) => any;
            "tool-result": (value: {
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
            }) => any;
            "tool-error": (value: {
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
            }) => any;
            media: (value: {
                readonly type: "media";
                readonly media: Media.Asset;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
            "step-finish": (value: {
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
                readonly usage?: Usage | undefined;
            }) => any;
            finish: (value: {
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
                readonly usage?: Usage | undefined;
            }) => any;
            "provider-error": (value: {
                readonly type: "provider-error";
                readonly message: string;
                readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any;
        }>(cases: Cases): (value: ({
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
            readonly usage?: Usage | undefined;
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
            readonly usage?: Usage | undefined;
        } | {
            readonly type: "provider-error";
            readonly message: string;
            readonly classification?: "context-overflow" | "payload-too-large" | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }) => Cases[keyof Cases] extends (value: any) => infer R ? import("effect/Unify").Unify<R> : never;
    };
    readonly matchOrElse: {
        <Cases extends {
            compaction?: ((value: {
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
            })) => any) | undefined;
            "step-start"?: ((value: {
                readonly type: "step-start";
                readonly index: number;
            }) => any) | undefined;
            "text-start"?: ((value: {
                readonly id: string;
                readonly type: "text-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
            "text-delta"?: ((value: {
                readonly id: string;
                readonly type: "text-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
            "text-end"?: ((value: {
                readonly id: string;
                readonly type: "text-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
            "reasoning-start"?: ((value: {
                readonly id: string;
                readonly type: "reasoning-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
            "reasoning-delta"?: ((value: {
                readonly id: string;
                readonly type: "reasoning-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
            "reasoning-end"?: ((value: {
                readonly id: string;
                readonly type: "reasoning-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
            "tool-input-start"?: ((value: {
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
            }) => any) | undefined;
            "tool-input-delta"?: ((value: {
                readonly id: string;
                readonly type: "tool-input-delta";
                readonly name: string;
                readonly text: string;
                readonly input?: unknown;
                readonly namespace?: string | undefined;
            }) => any) | undefined;
            "tool-input-end"?: ((value: {
                readonly id: string;
                readonly type: "tool-input-end";
                readonly name: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
                readonly namespace?: string | undefined;
            }) => any) | undefined;
            "tool-input-error"?: ((value: {
                readonly id: string;
                readonly type: "tool-input-error";
                readonly name: string;
                readonly raw: string;
                readonly namespace?: string | undefined;
            }) => any) | undefined;
            "tool-call"?: ((value: {
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
            }) => any) | undefined;
            "tool-result"?: ((value: {
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
            }) => any) | undefined;
            "tool-error"?: ((value: {
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
            }) => any) | undefined;
            media?: ((value: {
                readonly type: "media";
                readonly media: Media.Asset;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
            "step-finish"?: ((value: {
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
                readonly usage?: Usage | undefined;
            }) => any) | undefined;
            finish?: ((value: {
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
                readonly usage?: Usage | undefined;
            }) => any) | undefined;
            "provider-error"?: ((value: {
                readonly type: "provider-error";
                readonly message: string;
                readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
        } & { [K in Exclude<keyof Cases, "compaction" | "finish" | "media" | "tool-call" | "tool-result" | "step-start" | "text-start" | "text-delta" | "text-end" | "reasoning-start" | "reasoning-delta" | "reasoning-end" | "tool-input-start" | "tool-input-delta" | "tool-input-end" | "tool-input-error" | "tool-error" | "step-finish" | "provider-error">]: never; }, OrElse extends (value: Exclude<{
            readonly type: "compaction";
            readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
            readonly id?: string | undefined;
            readonly text?: string | null | undefined;
            readonly encrypted?: string | undefined;
        } & {
            readonly encrypted: string;
            readonly text?: never;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly type: "compaction";
            readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
            readonly id?: string | undefined;
            readonly text?: string | null | undefined;
            readonly encrypted?: string | undefined;
        } & {
            readonly text: string | null;
            readonly encrypted?: never;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly type: "step-start";
            readonly index: number;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "text-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "text-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "text-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "reasoning-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "reasoning-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "reasoning-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
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
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "tool-input-delta";
            readonly name: string;
            readonly text: string;
            readonly input?: unknown;
            readonly namespace?: string | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "tool-input-end";
            readonly name: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "tool-input-error";
            readonly name: string;
            readonly raw: string;
            readonly namespace?: string | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
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
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
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
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
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
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly type: "media";
            readonly media: Media.Asset;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
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
            readonly usage?: Usage | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
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
            readonly usage?: Usage | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly type: "provider-error";
            readonly message: string;
            readonly classification?: "context-overflow" | "payload-too-large" | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }>) => any>(value: ({
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
            readonly usage?: Usage | undefined;
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
            readonly usage?: Usage | undefined;
        } | {
            readonly type: "provider-error";
            readonly message: string;
            readonly classification?: "context-overflow" | "payload-too-large" | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, cases: Cases, orElse: OrElse): import("effect/Unify").Unify<{ [K_1 in keyof Cases]-?: NonNullable<Cases[K_1]> extends (...args: Array<any>) => infer R ? R : never; }[keyof Cases] | ReturnType<OrElse>>;
        <Cases extends {
            compaction?: ((value: {
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
            })) => any) | undefined;
            "step-start"?: ((value: {
                readonly type: "step-start";
                readonly index: number;
            }) => any) | undefined;
            "text-start"?: ((value: {
                readonly id: string;
                readonly type: "text-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
            "text-delta"?: ((value: {
                readonly id: string;
                readonly type: "text-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
            "text-end"?: ((value: {
                readonly id: string;
                readonly type: "text-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
            "reasoning-start"?: ((value: {
                readonly id: string;
                readonly type: "reasoning-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
            "reasoning-delta"?: ((value: {
                readonly id: string;
                readonly type: "reasoning-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
            "reasoning-end"?: ((value: {
                readonly id: string;
                readonly type: "reasoning-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
            "tool-input-start"?: ((value: {
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
            }) => any) | undefined;
            "tool-input-delta"?: ((value: {
                readonly id: string;
                readonly type: "tool-input-delta";
                readonly name: string;
                readonly text: string;
                readonly input?: unknown;
                readonly namespace?: string | undefined;
            }) => any) | undefined;
            "tool-input-end"?: ((value: {
                readonly id: string;
                readonly type: "tool-input-end";
                readonly name: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
                readonly namespace?: string | undefined;
            }) => any) | undefined;
            "tool-input-error"?: ((value: {
                readonly id: string;
                readonly type: "tool-input-error";
                readonly name: string;
                readonly raw: string;
                readonly namespace?: string | undefined;
            }) => any) | undefined;
            "tool-call"?: ((value: {
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
            }) => any) | undefined;
            "tool-result"?: ((value: {
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
            }) => any) | undefined;
            "tool-error"?: ((value: {
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
            }) => any) | undefined;
            media?: ((value: {
                readonly type: "media";
                readonly media: Media.Asset;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
            "step-finish"?: ((value: {
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
                readonly usage?: Usage | undefined;
            }) => any) | undefined;
            finish?: ((value: {
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
                readonly usage?: Usage | undefined;
            }) => any) | undefined;
            "provider-error"?: ((value: {
                readonly type: "provider-error";
                readonly message: string;
                readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => any) | undefined;
        } & { [K in Exclude<keyof Cases, "compaction" | "finish" | "media" | "tool-call" | "tool-result" | "step-start" | "text-start" | "text-delta" | "text-end" | "reasoning-start" | "reasoning-delta" | "reasoning-end" | "tool-input-start" | "tool-input-delta" | "tool-input-end" | "tool-input-error" | "tool-error" | "step-finish" | "provider-error">]: never; }, OrElse extends (value: Exclude<{
            readonly type: "compaction";
            readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
            readonly id?: string | undefined;
            readonly text?: string | null | undefined;
            readonly encrypted?: string | undefined;
        } & {
            readonly encrypted: string;
            readonly text?: never;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly type: "compaction";
            readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
            readonly id?: string | undefined;
            readonly text?: string | null | undefined;
            readonly encrypted?: string | undefined;
        } & {
            readonly text: string | null;
            readonly encrypted?: never;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly type: "step-start";
            readonly index: number;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "text-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "text-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "text-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "reasoning-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "reasoning-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "reasoning-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
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
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "tool-input-delta";
            readonly name: string;
            readonly text: string;
            readonly input?: unknown;
            readonly namespace?: string | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "tool-input-end";
            readonly name: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "tool-input-error";
            readonly name: string;
            readonly raw: string;
            readonly namespace?: string | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
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
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
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
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
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
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly type: "media";
            readonly media: Media.Asset;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
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
            readonly usage?: Usage | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
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
            readonly usage?: Usage | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly type: "provider-error";
            readonly message: string;
            readonly classification?: "context-overflow" | "payload-too-large" | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: keyof Cases;
        }>) => any>(cases: Cases, orElse: OrElse): (value: ({
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
            readonly usage?: Usage | undefined;
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
            readonly usage?: Usage | undefined;
        } | {
            readonly type: "provider-error";
            readonly message: string;
            readonly classification?: "context-overflow" | "payload-too-large" | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }) => import("effect/Unify").Unify<{ [K_1 in keyof Cases]-?: NonNullable<Cases[K_1]> extends (...args: Array<any>) => infer R ? R : never; }[keyof Cases] | ReturnType<OrElse>>;
    };
} & {
    compaction: ((input: {
        readonly type: "compaction";
        readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
        readonly id?: string | undefined;
        readonly text?: string | null | undefined;
        readonly encrypted?: string | undefined;
    }, options?: Schema.MakeOptions) => {
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
    })) & ((input: Omit<CompactionPart, "type" | "encrypted" | "text"> & ({
        readonly encrypted: string;
        readonly text?: never;
    } | {
        readonly text: string | null;
        readonly encrypted?: never;
    })) => CompactionPart);
    stepStart: (input: {
        readonly index: number;
        readonly type?: "step-start" | undefined;
    }, options?: Schema.MakeOptions) => {
        readonly type: "step-start";
        readonly index: number;
    };
    textStart: (input: WithID<TextStart, ContentBlockID>) => {
        readonly id: string;
        readonly type: "text-start";
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    };
    textDelta: (input: WithID<TextDelta, ContentBlockID>) => {
        readonly id: string;
        readonly type: "text-delta";
        readonly text: string;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    };
    textEnd: (input: WithID<TextEnd, ContentBlockID>) => {
        readonly id: string;
        readonly type: "text-end";
        readonly text?: string | undefined;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    };
    reasoningStart: (input: WithID<ReasoningStart, ContentBlockID>) => {
        readonly id: string;
        readonly type: "reasoning-start";
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    };
    reasoningDelta: (input: WithID<ReasoningDelta, ContentBlockID>) => {
        readonly id: string;
        readonly type: "reasoning-delta";
        readonly text: string;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    };
    reasoningEnd: (input: WithID<ReasoningEnd, ContentBlockID>) => {
        readonly id: string;
        readonly type: "reasoning-end";
        readonly text?: string | undefined;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    };
    toolInputStart: (input: WithID<ToolInputStart, ToolCallID>) => {
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
    };
    toolInputDelta: (input: WithID<ToolInputDelta, ToolCallID>) => {
        readonly id: string;
        readonly type: "tool-input-delta";
        readonly name: string;
        readonly text: string;
        readonly input?: unknown;
        readonly namespace?: string | undefined;
    };
    toolInputEnd: (input: WithID<ToolInputEnd, ToolCallID>) => {
        readonly id: string;
        readonly type: "tool-input-end";
        readonly name: string;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
        readonly namespace?: string | undefined;
    };
    toolInputError: (input: WithID<ToolInputError, ToolCallID>) => {
        readonly id: string;
        readonly type: "tool-input-error";
        readonly name: string;
        readonly raw: string;
        readonly namespace?: string | undefined;
    };
    toolCall: (input: WithID<ToolCall, ToolCallID>) => {
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
    };
    toolResult: (input: WithID<ToolResult, ToolCallID>) => {
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
    };
    toolError: (input: WithID<ToolError, ToolCallID>) => {
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
    };
    media: (input: {
        readonly media: Media.Asset;
        readonly type?: "media" | undefined;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    }, options?: Schema.MakeOptions) => {
        readonly type: "media";
        readonly media: Media.Asset;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    };
    stepFinish: (input: WithUsage<StepFinish>) => {
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
        readonly usage?: Usage | undefined;
    };
    finish: (input: WithUsage<Finish>) => {
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
        readonly usage?: Usage | undefined;
    };
    providerError: (input: {
        readonly message: string;
        readonly type?: "provider-error" | undefined;
        readonly classification?: "context-overflow" | "payload-too-large" | undefined;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    }, options?: Schema.MakeOptions) => {
        readonly type: "provider-error";
        readonly message: string;
        readonly classification?: "context-overflow" | "payload-too-large" | undefined;
        readonly providerMetadata?: {
            readonly [x: string]: {
                readonly [x: string]: unknown;
            };
        } | undefined;
    };
    is: {
        compaction: (u: unknown) => u is {
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
        });
        stepStart: (u: unknown) => u is {
            readonly type: "step-start";
            readonly index: number;
        };
        textStart: (u: unknown) => u is {
            readonly id: string;
            readonly type: "text-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        textDelta: (u: unknown) => u is {
            readonly id: string;
            readonly type: "text-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        textEnd: (u: unknown) => u is {
            readonly id: string;
            readonly type: "text-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        reasoningStart: (u: unknown) => u is {
            readonly id: string;
            readonly type: "reasoning-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        reasoningDelta: (u: unknown) => u is {
            readonly id: string;
            readonly type: "reasoning-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        reasoningEnd: (u: unknown) => u is {
            readonly id: string;
            readonly type: "reasoning-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        toolInputStart: (u: unknown) => u is {
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
        };
        toolInputDelta: (u: unknown) => u is {
            readonly id: string;
            readonly type: "tool-input-delta";
            readonly name: string;
            readonly text: string;
            readonly input?: unknown;
            readonly namespace?: string | undefined;
        };
        toolInputEnd: (u: unknown) => u is {
            readonly id: string;
            readonly type: "tool-input-end";
            readonly name: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
        };
        toolInputError: (u: unknown) => u is {
            readonly id: string;
            readonly type: "tool-input-error";
            readonly name: string;
            readonly raw: string;
            readonly namespace?: string | undefined;
        };
        toolCall: (u: unknown) => u is {
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
        };
        toolResult: (u: unknown) => u is {
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
        };
        toolError: (u: unknown) => u is {
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
        };
        media: (u: unknown) => u is {
            readonly type: "media";
            readonly media: Media.Asset;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        stepFinish: (u: unknown) => u is {
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
            readonly usage?: Usage | undefined;
        };
        finish: (u: unknown) => u is {
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
            readonly usage?: Usage | undefined;
        };
        providerError: (u: unknown) => u is {
            readonly type: "provider-error";
            readonly message: string;
            readonly classification?: "context-overflow" | "payload-too-large" | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
    };
};
export type LLMEvent = Schema.Schema.Type<typeof llmEventTagged>;
interface ContentAssembly {
    readonly contentIndex: number;
    readonly text: string;
    readonly providerMetadata?: ProviderMetadata;
}
interface ToolInputAssembly {
    readonly name: string;
    readonly namespace?: string;
    readonly text: string;
    readonly providerMetadata?: ProviderMetadata;
}
interface ResponseState {
    readonly events: ReadonlyArray<LLMEvent>;
    readonly message: Message;
    readonly usage?: Usage;
    readonly finishReason?: FinishReasonDetails;
    readonly textParts: Readonly<Record<string, ContentAssembly>>;
    readonly reasoningParts: Readonly<Record<string, ContentAssembly>>;
    readonly toolInputs: Readonly<Record<string, ToolInputAssembly>>;
}
declare const LLMResponse_base: Schema.Class<LLMResponse, Schema.Struct<{
    readonly message: typeof Message;
    readonly events: Schema.$Array<Schema.Union<readonly [Schema.refine<{
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
    }), Schema.Struct<{
        readonly type: Schema.Literal<"compaction">;
        readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
        readonly id: Schema.optional<Schema.String>;
        readonly encrypted: Schema.optional<Schema.String>;
        readonly text: Schema.optional<Schema.NullOr<Schema.String>>;
    }>> & {
        make: (input: Omit<CompactionPart, "type" | "encrypted" | "text"> & ({
            readonly encrypted: string;
            readonly text?: never;
        } | {
            readonly text: string | null;
            readonly encrypted?: never;
        })) => CompactionPart;
    }, Schema.Struct<{
        readonly type: Schema.tag<"step-start">;
        readonly index: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"text-start">;
        readonly id: Schema.String;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"text-delta">;
        readonly id: Schema.String;
        readonly text: Schema.String;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"text-end">;
        readonly id: Schema.String;
        /** Authoritative complete value; replaces accumulated deltas when present. */
        readonly text: Schema.optional<Schema.String>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"reasoning-start">;
        readonly id: Schema.String;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"reasoning-delta">;
        readonly id: Schema.String;
        readonly text: Schema.String;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"reasoning-end">;
        readonly id: Schema.String;
        /** Authoritative complete value; replaces accumulated deltas when present. */
        readonly text: Schema.optional<Schema.String>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"tool-input-start">;
        readonly id: Schema.String;
        readonly name: Schema.String;
        readonly namespace: Schema.optional<Schema.String>;
        readonly providerExecuted: Schema.optional<Schema.Boolean>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"tool-input-delta">;
        readonly id: Schema.String;
        readonly name: Schema.String;
        readonly namespace: Schema.optional<Schema.String>;
        readonly text: Schema.String;
        /** Best-effort parse of all input fragments received through this delta. */
        readonly input: Schema.optional<Schema.Unknown>;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"tool-input-end">;
        readonly id: Schema.String;
        readonly name: Schema.String;
        readonly namespace: Schema.optional<Schema.String>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"tool-input-error">;
        readonly id: Schema.String;
        readonly name: Schema.String;
        readonly namespace: Schema.optional<Schema.String>;
        readonly raw: Schema.String;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"tool-call">;
        readonly id: Schema.String;
        readonly name: Schema.String;
        readonly namespace: Schema.optional<Schema.String>;
        readonly input: Schema.Unknown;
        readonly providerExecuted: Schema.optional<Schema.Boolean>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"tool-result">;
        readonly id: Schema.String;
        readonly name: Schema.String;
        readonly namespace: Schema.optional<Schema.String>;
        readonly result: Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"json">;
            readonly value: Schema.Unknown;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"text">;
            readonly value: Schema.Unknown;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"error">;
            readonly value: Schema.Unknown;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"content">;
            readonly value: Schema.$Array<Schema.Union<readonly [Schema.Struct<{
                readonly type: Schema.Literal<"text">;
                readonly text: Schema.String;
            }>, Schema.Struct<{
                readonly type: Schema.Literal<"file">;
                readonly uri: Schema.String;
                readonly mime: Schema.String;
                readonly name: Schema.optional<Schema.String>;
            }>]>>;
        }>]> & {
            is: <I>(input: I) => input is I & ({
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
            });
            make: (value: unknown, type?: ToolResultValue["type"]) => ToolResultValue;
        };
        readonly output: Schema.optional<Schema.Struct<{
            readonly structured: Schema.Unknown;
            readonly content: Schema.$Array<Schema.Union<readonly [Schema.Struct<{
                readonly type: Schema.Literal<"text">;
                readonly text: Schema.String;
            }>, Schema.Struct<{
                readonly type: Schema.Literal<"file">;
                readonly uri: Schema.String;
                readonly mime: Schema.String;
                readonly name: Schema.optional<Schema.String>;
            }>]>>;
        }> & {
            make: (structured: unknown, content?: ReadonlyArray<import("@opencode/schema/tool").Content>) => ToolOutput;
            fromResultValue: (result: ToolResultValue) => ToolOutput | undefined;
            toResultValue: (output: ToolOutput) => ToolResultValue;
        }>;
        readonly providerExecuted: Schema.optional<Schema.Boolean>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"tool-error">;
        readonly id: Schema.String;
        readonly name: Schema.String;
        readonly namespace: Schema.optional<Schema.String>;
        readonly message: Schema.String;
        readonly error: Schema.optional<Schema.Defect>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"media">;
        readonly media: Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
            readonly source: Schema.Union<readonly [Schema.Struct<{
                readonly type: Schema.Literal<"bytes">;
                readonly data: Schema.Uint8Array;
                readonly mediaType: Schema.String;
            }>, Schema.Struct<{
                readonly type: Schema.Literal<"base64">;
                readonly data: Schema.String;
                readonly mediaType: Schema.String;
            }>, Schema.Struct<{
                readonly type: Schema.Literal<"url">;
                readonly url: Schema.String;
                readonly mediaType: Schema.optional<Schema.String>;
                readonly expiresAt: Schema.optional<Schema.Number>;
            }>, Schema.Struct<{
                readonly type: Schema.Literal<"ref">;
                readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
                readonly id: Schema.String;
                readonly mediaType: Schema.optional<Schema.String>;
            }>]>;
            readonly info: Schema.optional<Schema.Struct<{
                readonly width: Schema.optional<Schema.Number>;
                readonly height: Schema.optional<Schema.Number>;
                readonly durationSeconds: Schema.optional<Schema.Number>;
                readonly sampleRate: Schema.optional<Schema.Number>;
                readonly channels: Schema.optional<Schema.Number>;
                readonly encoding: Schema.optional<Schema.String>;
                readonly format: Schema.optional<Schema.String>;
            }>>;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>, never, never>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"step-finish">;
        readonly index: Schema.Number;
        readonly reason: Schema.Struct<{
            readonly normalized: Schema.Literals<readonly ["stop", "length", "tool-calls", "content-filter", "error", "unknown"]>;
            readonly raw: Schema.optional<Schema.String>;
            /** The provider's policy area for a content-filter finish, such as `cyber`. */
            readonly category: Schema.optional<Schema.String>;
            /** The provider's human-readable reason for a content-filter finish. */
            readonly explanation: Schema.optional<Schema.String>;
        }>;
        readonly usage: Schema.optional<typeof Usage>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"finish">;
        readonly reason: Schema.Struct<{
            readonly normalized: Schema.Literals<readonly ["stop", "length", "tool-calls", "content-filter", "error", "unknown"]>;
            readonly raw: Schema.optional<Schema.String>;
            /** The provider's policy area for a content-filter finish, such as `cyber`. */
            readonly category: Schema.optional<Schema.String>;
            /** The provider's human-readable reason for a content-filter finish. */
            readonly explanation: Schema.optional<Schema.String>;
        }>;
        readonly usage: Schema.optional<typeof Usage>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, Schema.Struct<{
        readonly type: Schema.tag<"provider-error">;
        readonly message: Schema.String;
        readonly classification: Schema.optional<Schema.Literals<readonly ["context-overflow", "payload-too-large"]>>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>]> & {
        readonly discriminants: readonly ["compaction", "step-start", "text-start", "text-delta", "text-end", "reasoning-start", "reasoning-delta", "reasoning-end", "tool-input-start", "tool-input-delta", "tool-input-end", "tool-input-error", "tool-call", "tool-result", "tool-error", "media", "step-finish", "finish", "provider-error"];
        readonly cases: {
            compaction: Schema.refine<{
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
            }), Schema.Struct<{
                readonly type: Schema.Literal<"compaction">;
                readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
                readonly id: Schema.optional<Schema.String>;
                readonly encrypted: Schema.optional<Schema.String>;
                readonly text: Schema.optional<Schema.NullOr<Schema.String>>;
            }>> & {
                make: (input: Omit<CompactionPart, "type" | "encrypted" | "text"> & ({
                    readonly encrypted: string;
                    readonly text?: never;
                } | {
                    readonly text: string | null;
                    readonly encrypted?: never;
                })) => CompactionPart;
            };
            "step-start": Schema.Struct<{
                readonly type: Schema.tag<"step-start">;
                readonly index: Schema.Number;
            }>;
            "text-start": Schema.Struct<{
                readonly type: Schema.tag<"text-start">;
                readonly id: Schema.String;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>;
            "text-delta": Schema.Struct<{
                readonly type: Schema.tag<"text-delta">;
                readonly id: Schema.String;
                readonly text: Schema.String;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>;
            "text-end": Schema.Struct<{
                readonly type: Schema.tag<"text-end">;
                readonly id: Schema.String;
                /** Authoritative complete value; replaces accumulated deltas when present. */
                readonly text: Schema.optional<Schema.String>;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>;
            "reasoning-start": Schema.Struct<{
                readonly type: Schema.tag<"reasoning-start">;
                readonly id: Schema.String;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>;
            "reasoning-delta": Schema.Struct<{
                readonly type: Schema.tag<"reasoning-delta">;
                readonly id: Schema.String;
                readonly text: Schema.String;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>;
            "reasoning-end": Schema.Struct<{
                readonly type: Schema.tag<"reasoning-end">;
                readonly id: Schema.String;
                /** Authoritative complete value; replaces accumulated deltas when present. */
                readonly text: Schema.optional<Schema.String>;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>;
            "tool-input-start": Schema.Struct<{
                readonly type: Schema.tag<"tool-input-start">;
                readonly id: Schema.String;
                readonly name: Schema.String;
                readonly namespace: Schema.optional<Schema.String>;
                readonly providerExecuted: Schema.optional<Schema.Boolean>;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>;
            "tool-input-delta": Schema.Struct<{
                readonly type: Schema.tag<"tool-input-delta">;
                readonly id: Schema.String;
                readonly name: Schema.String;
                readonly namespace: Schema.optional<Schema.String>;
                readonly text: Schema.String;
                /** Best-effort parse of all input fragments received through this delta. */
                readonly input: Schema.optional<Schema.Unknown>;
            }>;
            "tool-input-end": Schema.Struct<{
                readonly type: Schema.tag<"tool-input-end">;
                readonly id: Schema.String;
                readonly name: Schema.String;
                readonly namespace: Schema.optional<Schema.String>;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>;
            "tool-input-error": Schema.Struct<{
                readonly type: Schema.tag<"tool-input-error">;
                readonly id: Schema.String;
                readonly name: Schema.String;
                readonly namespace: Schema.optional<Schema.String>;
                readonly raw: Schema.String;
            }>;
            "tool-call": Schema.Struct<{
                readonly type: Schema.tag<"tool-call">;
                readonly id: Schema.String;
                readonly name: Schema.String;
                readonly namespace: Schema.optional<Schema.String>;
                readonly input: Schema.Unknown;
                readonly providerExecuted: Schema.optional<Schema.Boolean>;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>;
            "tool-result": Schema.Struct<{
                readonly type: Schema.tag<"tool-result">;
                readonly id: Schema.String;
                readonly name: Schema.String;
                readonly namespace: Schema.optional<Schema.String>;
                readonly result: Schema.Union<readonly [Schema.Struct<{
                    readonly type: Schema.Literal<"json">;
                    readonly value: Schema.Unknown;
                }>, Schema.Struct<{
                    readonly type: Schema.Literal<"text">;
                    readonly value: Schema.Unknown;
                }>, Schema.Struct<{
                    readonly type: Schema.Literal<"error">;
                    readonly value: Schema.Unknown;
                }>, Schema.Struct<{
                    readonly type: Schema.Literal<"content">;
                    readonly value: Schema.$Array<Schema.Union<readonly [Schema.Struct<{
                        readonly type: Schema.Literal<"text">;
                        readonly text: Schema.String;
                    }>, Schema.Struct<{
                        readonly type: Schema.Literal<"file">;
                        readonly uri: Schema.String;
                        readonly mime: Schema.String;
                        readonly name: Schema.optional<Schema.String>;
                    }>]>>;
                }>]> & {
                    is: <I>(input: I) => input is I & ({
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
                    });
                    make: (value: unknown, type?: ToolResultValue["type"]) => ToolResultValue;
                };
                readonly output: Schema.optional<Schema.Struct<{
                    readonly structured: Schema.Unknown;
                    readonly content: Schema.$Array<Schema.Union<readonly [Schema.Struct<{
                        readonly type: Schema.Literal<"text">;
                        readonly text: Schema.String;
                    }>, Schema.Struct<{
                        readonly type: Schema.Literal<"file">;
                        readonly uri: Schema.String;
                        readonly mime: Schema.String;
                        readonly name: Schema.optional<Schema.String>;
                    }>]>>;
                }> & {
                    make: (structured: unknown, content?: ReadonlyArray<import("@opencode/schema/tool").Content>) => ToolOutput;
                    fromResultValue: (result: ToolResultValue) => ToolOutput | undefined;
                    toResultValue: (output: ToolOutput) => ToolResultValue;
                }>;
                readonly providerExecuted: Schema.optional<Schema.Boolean>;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>;
            "tool-error": Schema.Struct<{
                readonly type: Schema.tag<"tool-error">;
                readonly id: Schema.String;
                readonly name: Schema.String;
                readonly namespace: Schema.optional<Schema.String>;
                readonly message: Schema.String;
                readonly error: Schema.optional<Schema.Defect>;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>;
            media: Schema.Struct<{
                readonly type: Schema.tag<"media">;
                readonly media: Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
                    readonly source: Schema.Union<readonly [Schema.Struct<{
                        readonly type: Schema.Literal<"bytes">;
                        readonly data: Schema.Uint8Array;
                        readonly mediaType: Schema.String;
                    }>, Schema.Struct<{
                        readonly type: Schema.Literal<"base64">;
                        readonly data: Schema.String;
                        readonly mediaType: Schema.String;
                    }>, Schema.Struct<{
                        readonly type: Schema.Literal<"url">;
                        readonly url: Schema.String;
                        readonly mediaType: Schema.optional<Schema.String>;
                        readonly expiresAt: Schema.optional<Schema.Number>;
                    }>, Schema.Struct<{
                        readonly type: Schema.Literal<"ref">;
                        readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
                        readonly id: Schema.String;
                        readonly mediaType: Schema.optional<Schema.String>;
                    }>]>;
                    readonly info: Schema.optional<Schema.Struct<{
                        readonly width: Schema.optional<Schema.Number>;
                        readonly height: Schema.optional<Schema.Number>;
                        readonly durationSeconds: Schema.optional<Schema.Number>;
                        readonly sampleRate: Schema.optional<Schema.Number>;
                        readonly channels: Schema.optional<Schema.Number>;
                        readonly encoding: Schema.optional<Schema.String>;
                        readonly format: Schema.optional<Schema.String>;
                    }>>;
                    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
                }>, never, never>;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>;
            "step-finish": Schema.Struct<{
                readonly type: Schema.tag<"step-finish">;
                readonly index: Schema.Number;
                readonly reason: Schema.Struct<{
                    readonly normalized: Schema.Literals<readonly ["stop", "length", "tool-calls", "content-filter", "error", "unknown"]>;
                    readonly raw: Schema.optional<Schema.String>;
                    /** The provider's policy area for a content-filter finish, such as `cyber`. */
                    readonly category: Schema.optional<Schema.String>;
                    /** The provider's human-readable reason for a content-filter finish. */
                    readonly explanation: Schema.optional<Schema.String>;
                }>;
                readonly usage: Schema.optional<typeof Usage>;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>;
            finish: Schema.Struct<{
                readonly type: Schema.tag<"finish">;
                readonly reason: Schema.Struct<{
                    readonly normalized: Schema.Literals<readonly ["stop", "length", "tool-calls", "content-filter", "error", "unknown"]>;
                    readonly raw: Schema.optional<Schema.String>;
                    /** The provider's policy area for a content-filter finish, such as `cyber`. */
                    readonly category: Schema.optional<Schema.String>;
                    /** The provider's human-readable reason for a content-filter finish. */
                    readonly explanation: Schema.optional<Schema.String>;
                }>;
                readonly usage: Schema.optional<typeof Usage>;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>;
            "provider-error": Schema.Struct<{
                readonly type: Schema.tag<"provider-error">;
                readonly message: Schema.String;
                readonly classification: Schema.optional<Schema.Literals<readonly ["context-overflow", "payload-too-large"]>>;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>;
        };
        readonly isAnyOf: <const Keys>(keys: readonly Keys[]) => (value: ({
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
            readonly usage?: Usage | undefined;
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
            readonly usage?: Usage | undefined;
        } | {
            readonly type: "provider-error";
            readonly message: string;
            readonly classification?: "context-overflow" | "payload-too-large" | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }) => value is Extract<{
            readonly type: "compaction";
            readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
            readonly id?: string | undefined;
            readonly text?: string | null | undefined;
            readonly encrypted?: string | undefined;
        } & {
            readonly encrypted: string;
            readonly text?: never;
        }, {
            readonly type: Keys;
        }> | Extract<{
            readonly type: "compaction";
            readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
            readonly id?: string | undefined;
            readonly text?: string | null | undefined;
            readonly encrypted?: string | undefined;
        } & {
            readonly text: string | null;
            readonly encrypted?: never;
        }, {
            readonly type: Keys;
        }> | Extract<{
            readonly type: "step-start";
            readonly index: number;
        }, {
            readonly type: Keys;
        }> | Extract<{
            readonly id: string;
            readonly type: "text-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: Keys;
        }> | Extract<{
            readonly id: string;
            readonly type: "text-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: Keys;
        }> | Extract<{
            readonly id: string;
            readonly type: "text-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: Keys;
        }> | Extract<{
            readonly id: string;
            readonly type: "reasoning-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: Keys;
        }> | Extract<{
            readonly id: string;
            readonly type: "reasoning-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: Keys;
        }> | Extract<{
            readonly id: string;
            readonly type: "reasoning-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: Keys;
        }> | Extract<{
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
        }, {
            readonly type: Keys;
        }> | Extract<{
            readonly id: string;
            readonly type: "tool-input-delta";
            readonly name: string;
            readonly text: string;
            readonly input?: unknown;
            readonly namespace?: string | undefined;
        }, {
            readonly type: Keys;
        }> | Extract<{
            readonly id: string;
            readonly type: "tool-input-end";
            readonly name: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
        }, {
            readonly type: Keys;
        }> | Extract<{
            readonly id: string;
            readonly type: "tool-input-error";
            readonly name: string;
            readonly raw: string;
            readonly namespace?: string | undefined;
        }, {
            readonly type: Keys;
        }> | Extract<{
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
        }, {
            readonly type: Keys;
        }> | Extract<{
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
        }, {
            readonly type: Keys;
        }> | Extract<{
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
        }, {
            readonly type: Keys;
        }> | Extract<{
            readonly type: "media";
            readonly media: Media.Asset;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: Keys;
        }> | Extract<{
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
            readonly usage?: Usage | undefined;
        }, {
            readonly type: Keys;
        }> | Extract<{
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
            readonly usage?: Usage | undefined;
        }, {
            readonly type: Keys;
        }> | Extract<{
            readonly type: "provider-error";
            readonly message: string;
            readonly classification?: "context-overflow" | "payload-too-large" | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, {
            readonly type: Keys;
        }>;
        readonly guards: {
            compaction: (u: unknown) => u is {
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
            });
            "step-start": (u: unknown) => u is {
                readonly type: "step-start";
                readonly index: number;
            };
            "text-start": (u: unknown) => u is {
                readonly id: string;
                readonly type: "text-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
            "text-delta": (u: unknown) => u is {
                readonly id: string;
                readonly type: "text-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
            "text-end": (u: unknown) => u is {
                readonly id: string;
                readonly type: "text-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
            "reasoning-start": (u: unknown) => u is {
                readonly id: string;
                readonly type: "reasoning-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
            "reasoning-delta": (u: unknown) => u is {
                readonly id: string;
                readonly type: "reasoning-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
            "reasoning-end": (u: unknown) => u is {
                readonly id: string;
                readonly type: "reasoning-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
            "tool-input-start": (u: unknown) => u is {
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
            };
            "tool-input-delta": (u: unknown) => u is {
                readonly id: string;
                readonly type: "tool-input-delta";
                readonly name: string;
                readonly text: string;
                readonly input?: unknown;
                readonly namespace?: string | undefined;
            };
            "tool-input-end": (u: unknown) => u is {
                readonly id: string;
                readonly type: "tool-input-end";
                readonly name: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
                readonly namespace?: string | undefined;
            };
            "tool-input-error": (u: unknown) => u is {
                readonly id: string;
                readonly type: "tool-input-error";
                readonly name: string;
                readonly raw: string;
                readonly namespace?: string | undefined;
            };
            "tool-call": (u: unknown) => u is {
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
            };
            "tool-result": (u: unknown) => u is {
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
            };
            "tool-error": (u: unknown) => u is {
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
            };
            media: (u: unknown) => u is {
                readonly type: "media";
                readonly media: Media.Asset;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
            "step-finish": (u: unknown) => u is {
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
                readonly usage?: Usage | undefined;
            };
            finish: (u: unknown) => u is {
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
                readonly usage?: Usage | undefined;
            };
            "provider-error": (u: unknown) => u is {
                readonly type: "provider-error";
                readonly message: string;
                readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
        };
        readonly match: {
            <Cases extends {
                compaction: (value: {
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
                })) => any;
                "step-start": (value: {
                    readonly type: "step-start";
                    readonly index: number;
                }) => any;
                "text-start": (value: {
                    readonly id: string;
                    readonly type: "text-start";
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
                "text-delta": (value: {
                    readonly id: string;
                    readonly type: "text-delta";
                    readonly text: string;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
                "text-end": (value: {
                    readonly id: string;
                    readonly type: "text-end";
                    readonly text?: string | undefined;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
                "reasoning-start": (value: {
                    readonly id: string;
                    readonly type: "reasoning-start";
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
                "reasoning-delta": (value: {
                    readonly id: string;
                    readonly type: "reasoning-delta";
                    readonly text: string;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
                "reasoning-end": (value: {
                    readonly id: string;
                    readonly type: "reasoning-end";
                    readonly text?: string | undefined;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
                "tool-input-start": (value: {
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
                }) => any;
                "tool-input-delta": (value: {
                    readonly id: string;
                    readonly type: "tool-input-delta";
                    readonly name: string;
                    readonly text: string;
                    readonly input?: unknown;
                    readonly namespace?: string | undefined;
                }) => any;
                "tool-input-end": (value: {
                    readonly id: string;
                    readonly type: "tool-input-end";
                    readonly name: string;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                    readonly namespace?: string | undefined;
                }) => any;
                "tool-input-error": (value: {
                    readonly id: string;
                    readonly type: "tool-input-error";
                    readonly name: string;
                    readonly raw: string;
                    readonly namespace?: string | undefined;
                }) => any;
                "tool-call": (value: {
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
                }) => any;
                "tool-result": (value: {
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
                }) => any;
                "tool-error": (value: {
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
                }) => any;
                media: (value: {
                    readonly type: "media";
                    readonly media: Media.Asset;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
                "step-finish": (value: {
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
                    readonly usage?: Usage | undefined;
                }) => any;
                finish: (value: {
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
                    readonly usage?: Usage | undefined;
                }) => any;
                "provider-error": (value: {
                    readonly type: "provider-error";
                    readonly message: string;
                    readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
            }>(value: ({
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
                readonly usage?: Usage | undefined;
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
                readonly usage?: Usage | undefined;
            } | {
                readonly type: "provider-error";
                readonly message: string;
                readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, cases: Cases): Cases[keyof Cases] extends (value: any) => infer R ? import("effect/Unify").Unify<R> : never;
            <Cases extends {
                compaction: (value: {
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
                })) => any;
                "step-start": (value: {
                    readonly type: "step-start";
                    readonly index: number;
                }) => any;
                "text-start": (value: {
                    readonly id: string;
                    readonly type: "text-start";
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
                "text-delta": (value: {
                    readonly id: string;
                    readonly type: "text-delta";
                    readonly text: string;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
                "text-end": (value: {
                    readonly id: string;
                    readonly type: "text-end";
                    readonly text?: string | undefined;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
                "reasoning-start": (value: {
                    readonly id: string;
                    readonly type: "reasoning-start";
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
                "reasoning-delta": (value: {
                    readonly id: string;
                    readonly type: "reasoning-delta";
                    readonly text: string;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
                "reasoning-end": (value: {
                    readonly id: string;
                    readonly type: "reasoning-end";
                    readonly text?: string | undefined;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
                "tool-input-start": (value: {
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
                }) => any;
                "tool-input-delta": (value: {
                    readonly id: string;
                    readonly type: "tool-input-delta";
                    readonly name: string;
                    readonly text: string;
                    readonly input?: unknown;
                    readonly namespace?: string | undefined;
                }) => any;
                "tool-input-end": (value: {
                    readonly id: string;
                    readonly type: "tool-input-end";
                    readonly name: string;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                    readonly namespace?: string | undefined;
                }) => any;
                "tool-input-error": (value: {
                    readonly id: string;
                    readonly type: "tool-input-error";
                    readonly name: string;
                    readonly raw: string;
                    readonly namespace?: string | undefined;
                }) => any;
                "tool-call": (value: {
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
                }) => any;
                "tool-result": (value: {
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
                }) => any;
                "tool-error": (value: {
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
                }) => any;
                media: (value: {
                    readonly type: "media";
                    readonly media: Media.Asset;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
                "step-finish": (value: {
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
                    readonly usage?: Usage | undefined;
                }) => any;
                finish: (value: {
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
                    readonly usage?: Usage | undefined;
                }) => any;
                "provider-error": (value: {
                    readonly type: "provider-error";
                    readonly message: string;
                    readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any;
            }>(cases: Cases): (value: ({
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
                readonly usage?: Usage | undefined;
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
                readonly usage?: Usage | undefined;
            } | {
                readonly type: "provider-error";
                readonly message: string;
                readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => Cases[keyof Cases] extends (value: any) => infer R ? import("effect/Unify").Unify<R> : never;
        };
        readonly matchOrElse: {
            <Cases extends {
                compaction?: ((value: {
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
                })) => any) | undefined;
                "step-start"?: ((value: {
                    readonly type: "step-start";
                    readonly index: number;
                }) => any) | undefined;
                "text-start"?: ((value: {
                    readonly id: string;
                    readonly type: "text-start";
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
                "text-delta"?: ((value: {
                    readonly id: string;
                    readonly type: "text-delta";
                    readonly text: string;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
                "text-end"?: ((value: {
                    readonly id: string;
                    readonly type: "text-end";
                    readonly text?: string | undefined;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
                "reasoning-start"?: ((value: {
                    readonly id: string;
                    readonly type: "reasoning-start";
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
                "reasoning-delta"?: ((value: {
                    readonly id: string;
                    readonly type: "reasoning-delta";
                    readonly text: string;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
                "reasoning-end"?: ((value: {
                    readonly id: string;
                    readonly type: "reasoning-end";
                    readonly text?: string | undefined;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
                "tool-input-start"?: ((value: {
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
                }) => any) | undefined;
                "tool-input-delta"?: ((value: {
                    readonly id: string;
                    readonly type: "tool-input-delta";
                    readonly name: string;
                    readonly text: string;
                    readonly input?: unknown;
                    readonly namespace?: string | undefined;
                }) => any) | undefined;
                "tool-input-end"?: ((value: {
                    readonly id: string;
                    readonly type: "tool-input-end";
                    readonly name: string;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                    readonly namespace?: string | undefined;
                }) => any) | undefined;
                "tool-input-error"?: ((value: {
                    readonly id: string;
                    readonly type: "tool-input-error";
                    readonly name: string;
                    readonly raw: string;
                    readonly namespace?: string | undefined;
                }) => any) | undefined;
                "tool-call"?: ((value: {
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
                }) => any) | undefined;
                "tool-result"?: ((value: {
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
                }) => any) | undefined;
                "tool-error"?: ((value: {
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
                }) => any) | undefined;
                media?: ((value: {
                    readonly type: "media";
                    readonly media: Media.Asset;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
                "step-finish"?: ((value: {
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
                    readonly usage?: Usage | undefined;
                }) => any) | undefined;
                finish?: ((value: {
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
                    readonly usage?: Usage | undefined;
                }) => any) | undefined;
                "provider-error"?: ((value: {
                    readonly type: "provider-error";
                    readonly message: string;
                    readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
            } & { [K in Exclude<keyof Cases, "compaction" | "finish" | "media" | "tool-call" | "tool-result" | "step-start" | "text-start" | "text-delta" | "text-end" | "reasoning-start" | "reasoning-delta" | "reasoning-end" | "tool-input-start" | "tool-input-delta" | "tool-input-end" | "tool-input-error" | "tool-error" | "step-finish" | "provider-error">]: never; }, OrElse extends (value: Exclude<{
                readonly type: "compaction";
                readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
                readonly id?: string | undefined;
                readonly text?: string | null | undefined;
                readonly encrypted?: string | undefined;
            } & {
                readonly encrypted: string;
                readonly text?: never;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly type: "compaction";
                readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
                readonly id?: string | undefined;
                readonly text?: string | null | undefined;
                readonly encrypted?: string | undefined;
            } & {
                readonly text: string | null;
                readonly encrypted?: never;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly type: "step-start";
                readonly index: number;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "text-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "text-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "text-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "reasoning-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "reasoning-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "reasoning-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
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
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "tool-input-delta";
                readonly name: string;
                readonly text: string;
                readonly input?: unknown;
                readonly namespace?: string | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "tool-input-end";
                readonly name: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
                readonly namespace?: string | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "tool-input-error";
                readonly name: string;
                readonly raw: string;
                readonly namespace?: string | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
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
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
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
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
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
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly type: "media";
                readonly media: Media.Asset;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
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
                readonly usage?: Usage | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
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
                readonly usage?: Usage | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly type: "provider-error";
                readonly message: string;
                readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }>) => any>(value: ({
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
                readonly usage?: Usage | undefined;
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
                readonly usage?: Usage | undefined;
            } | {
                readonly type: "provider-error";
                readonly message: string;
                readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, cases: Cases, orElse: OrElse): import("effect/Unify").Unify<{ [K_1 in keyof Cases]-?: NonNullable<Cases[K_1]> extends (...args: Array<any>) => infer R ? R : never; }[keyof Cases] | ReturnType<OrElse>>;
            <Cases extends {
                compaction?: ((value: {
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
                })) => any) | undefined;
                "step-start"?: ((value: {
                    readonly type: "step-start";
                    readonly index: number;
                }) => any) | undefined;
                "text-start"?: ((value: {
                    readonly id: string;
                    readonly type: "text-start";
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
                "text-delta"?: ((value: {
                    readonly id: string;
                    readonly type: "text-delta";
                    readonly text: string;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
                "text-end"?: ((value: {
                    readonly id: string;
                    readonly type: "text-end";
                    readonly text?: string | undefined;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
                "reasoning-start"?: ((value: {
                    readonly id: string;
                    readonly type: "reasoning-start";
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
                "reasoning-delta"?: ((value: {
                    readonly id: string;
                    readonly type: "reasoning-delta";
                    readonly text: string;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
                "reasoning-end"?: ((value: {
                    readonly id: string;
                    readonly type: "reasoning-end";
                    readonly text?: string | undefined;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
                "tool-input-start"?: ((value: {
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
                }) => any) | undefined;
                "tool-input-delta"?: ((value: {
                    readonly id: string;
                    readonly type: "tool-input-delta";
                    readonly name: string;
                    readonly text: string;
                    readonly input?: unknown;
                    readonly namespace?: string | undefined;
                }) => any) | undefined;
                "tool-input-end"?: ((value: {
                    readonly id: string;
                    readonly type: "tool-input-end";
                    readonly name: string;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                    readonly namespace?: string | undefined;
                }) => any) | undefined;
                "tool-input-error"?: ((value: {
                    readonly id: string;
                    readonly type: "tool-input-error";
                    readonly name: string;
                    readonly raw: string;
                    readonly namespace?: string | undefined;
                }) => any) | undefined;
                "tool-call"?: ((value: {
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
                }) => any) | undefined;
                "tool-result"?: ((value: {
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
                }) => any) | undefined;
                "tool-error"?: ((value: {
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
                }) => any) | undefined;
                media?: ((value: {
                    readonly type: "media";
                    readonly media: Media.Asset;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
                "step-finish"?: ((value: {
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
                    readonly usage?: Usage | undefined;
                }) => any) | undefined;
                finish?: ((value: {
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
                    readonly usage?: Usage | undefined;
                }) => any) | undefined;
                "provider-error"?: ((value: {
                    readonly type: "provider-error";
                    readonly message: string;
                    readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                    readonly providerMetadata?: {
                        readonly [x: string]: {
                            readonly [x: string]: unknown;
                        };
                    } | undefined;
                }) => any) | undefined;
            } & { [K in Exclude<keyof Cases, "compaction" | "finish" | "media" | "tool-call" | "tool-result" | "step-start" | "text-start" | "text-delta" | "text-end" | "reasoning-start" | "reasoning-delta" | "reasoning-end" | "tool-input-start" | "tool-input-delta" | "tool-input-end" | "tool-input-error" | "tool-error" | "step-finish" | "provider-error">]: never; }, OrElse extends (value: Exclude<{
                readonly type: "compaction";
                readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
                readonly id?: string | undefined;
                readonly text?: string | null | undefined;
                readonly encrypted?: string | undefined;
            } & {
                readonly encrypted: string;
                readonly text?: never;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly type: "compaction";
                readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
                readonly id?: string | undefined;
                readonly text?: string | null | undefined;
                readonly encrypted?: string | undefined;
            } & {
                readonly text: string | null;
                readonly encrypted?: never;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly type: "step-start";
                readonly index: number;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "text-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "text-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "text-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "reasoning-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "reasoning-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "reasoning-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
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
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "tool-input-delta";
                readonly name: string;
                readonly text: string;
                readonly input?: unknown;
                readonly namespace?: string | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "tool-input-end";
                readonly name: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
                readonly namespace?: string | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly id: string;
                readonly type: "tool-input-error";
                readonly name: string;
                readonly raw: string;
                readonly namespace?: string | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
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
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
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
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
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
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly type: "media";
                readonly media: Media.Asset;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
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
                readonly usage?: Usage | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
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
                readonly usage?: Usage | undefined;
            }, {
                readonly type: keyof Cases;
            }> | Exclude<{
                readonly type: "provider-error";
                readonly message: string;
                readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }, {
                readonly type: keyof Cases;
            }>) => any>(cases: Cases, orElse: OrElse): (value: ({
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
                readonly usage?: Usage | undefined;
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
                readonly usage?: Usage | undefined;
            } | {
                readonly type: "provider-error";
                readonly message: string;
                readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            }) => import("effect/Unify").Unify<{ [K_1 in keyof Cases]-?: NonNullable<Cases[K_1]> extends (...args: Array<any>) => infer R ? R : never; }[keyof Cases] | ReturnType<OrElse>>;
        };
    } & {
        compaction: ((input: {
            readonly type: "compaction";
            readonly provider: string & import("effect/Brand").Brand<"AI.ProviderID">;
            readonly id?: string | undefined;
            readonly text?: string | null | undefined;
            readonly encrypted?: string | undefined;
        }, options?: Schema.MakeOptions) => {
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
        })) & ((input: Omit<CompactionPart, "type" | "encrypted" | "text"> & ({
            readonly encrypted: string;
            readonly text?: never;
        } | {
            readonly text: string | null;
            readonly encrypted?: never;
        })) => CompactionPart);
        stepStart: (input: {
            readonly index: number;
            readonly type?: "step-start" | undefined;
        }, options?: Schema.MakeOptions) => {
            readonly type: "step-start";
            readonly index: number;
        };
        textStart: (input: WithID<TextStart, ContentBlockID>) => {
            readonly id: string;
            readonly type: "text-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        textDelta: (input: WithID<TextDelta, ContentBlockID>) => {
            readonly id: string;
            readonly type: "text-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        textEnd: (input: WithID<TextEnd, ContentBlockID>) => {
            readonly id: string;
            readonly type: "text-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        reasoningStart: (input: WithID<ReasoningStart, ContentBlockID>) => {
            readonly id: string;
            readonly type: "reasoning-start";
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        reasoningDelta: (input: WithID<ReasoningDelta, ContentBlockID>) => {
            readonly id: string;
            readonly type: "reasoning-delta";
            readonly text: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        reasoningEnd: (input: WithID<ReasoningEnd, ContentBlockID>) => {
            readonly id: string;
            readonly type: "reasoning-end";
            readonly text?: string | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        toolInputStart: (input: WithID<ToolInputStart, ToolCallID>) => {
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
        };
        toolInputDelta: (input: WithID<ToolInputDelta, ToolCallID>) => {
            readonly id: string;
            readonly type: "tool-input-delta";
            readonly name: string;
            readonly text: string;
            readonly input?: unknown;
            readonly namespace?: string | undefined;
        };
        toolInputEnd: (input: WithID<ToolInputEnd, ToolCallID>) => {
            readonly id: string;
            readonly type: "tool-input-end";
            readonly name: string;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
            readonly namespace?: string | undefined;
        };
        toolInputError: (input: WithID<ToolInputError, ToolCallID>) => {
            readonly id: string;
            readonly type: "tool-input-error";
            readonly name: string;
            readonly raw: string;
            readonly namespace?: string | undefined;
        };
        toolCall: (input: WithID<ToolCall, ToolCallID>) => {
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
        };
        toolResult: (input: WithID<ToolResult, ToolCallID>) => {
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
        };
        toolError: (input: WithID<ToolError, ToolCallID>) => {
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
        };
        media: (input: {
            readonly media: Media.Asset;
            readonly type?: "media" | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, options?: Schema.MakeOptions) => {
            readonly type: "media";
            readonly media: Media.Asset;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        stepFinish: (input: WithUsage<StepFinish>) => {
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
            readonly usage?: Usage | undefined;
        };
        finish: (input: WithUsage<Finish>) => {
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
            readonly usage?: Usage | undefined;
        };
        providerError: (input: {
            readonly message: string;
            readonly type?: "provider-error" | undefined;
            readonly classification?: "context-overflow" | "payload-too-large" | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        }, options?: Schema.MakeOptions) => {
            readonly type: "provider-error";
            readonly message: string;
            readonly classification?: "context-overflow" | "payload-too-large" | undefined;
            readonly providerMetadata?: {
                readonly [x: string]: {
                    readonly [x: string]: unknown;
                };
            } | undefined;
        };
        is: {
            compaction: (u: unknown) => u is {
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
            });
            stepStart: (u: unknown) => u is {
                readonly type: "step-start";
                readonly index: number;
            };
            textStart: (u: unknown) => u is {
                readonly id: string;
                readonly type: "text-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
            textDelta: (u: unknown) => u is {
                readonly id: string;
                readonly type: "text-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
            textEnd: (u: unknown) => u is {
                readonly id: string;
                readonly type: "text-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
            reasoningStart: (u: unknown) => u is {
                readonly id: string;
                readonly type: "reasoning-start";
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
            reasoningDelta: (u: unknown) => u is {
                readonly id: string;
                readonly type: "reasoning-delta";
                readonly text: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
            reasoningEnd: (u: unknown) => u is {
                readonly id: string;
                readonly type: "reasoning-end";
                readonly text?: string | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
            toolInputStart: (u: unknown) => u is {
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
            };
            toolInputDelta: (u: unknown) => u is {
                readonly id: string;
                readonly type: "tool-input-delta";
                readonly name: string;
                readonly text: string;
                readonly input?: unknown;
                readonly namespace?: string | undefined;
            };
            toolInputEnd: (u: unknown) => u is {
                readonly id: string;
                readonly type: "tool-input-end";
                readonly name: string;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
                readonly namespace?: string | undefined;
            };
            toolInputError: (u: unknown) => u is {
                readonly id: string;
                readonly type: "tool-input-error";
                readonly name: string;
                readonly raw: string;
                readonly namespace?: string | undefined;
            };
            toolCall: (u: unknown) => u is {
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
            };
            toolResult: (u: unknown) => u is {
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
            };
            toolError: (u: unknown) => u is {
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
            };
            media: (u: unknown) => u is {
                readonly type: "media";
                readonly media: Media.Asset;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
            stepFinish: (u: unknown) => u is {
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
                readonly usage?: Usage | undefined;
            };
            finish: (u: unknown) => u is {
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
                readonly usage?: Usage | undefined;
            };
            providerError: (u: unknown) => u is {
                readonly type: "provider-error";
                readonly message: string;
                readonly classification?: "context-overflow" | "payload-too-large" | undefined;
                readonly providerMetadata?: {
                    readonly [x: string]: {
                        readonly [x: string]: unknown;
                    };
                } | undefined;
            };
        };
    }>;
    readonly usage: Schema.optional<typeof Usage>;
    readonly finishReason: Schema.Struct<{
        readonly normalized: Schema.Literals<readonly ["stop", "length", "tool-calls", "content-filter", "error", "unknown"]>;
        readonly raw: Schema.optional<Schema.String>;
        /** The provider's policy area for a content-filter finish, such as `cyber`. */
        readonly category: Schema.optional<Schema.String>;
        /** The provider's human-readable reason for a content-filter finish. */
        readonly explanation: Schema.optional<Schema.String>;
    }>;
}>, {}>;
export declare class LLMResponse extends LLMResponse_base {
    /** Concatenated assistant text; each fragment's `text-end` value replaces its accumulated deltas when present. */
    get text(): string;
    /** Concatenated reasoning text; each fragment's `reasoning-end` value replaces its accumulated deltas when present. */
    get reasoning(): string;
    /** Completed tool calls emitted by the provider. */
    get toolCalls(): {
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
    }[];
}
export declare namespace LLMResponse {
    type State = ResponseState;
    type Output = LLMResponse | {
        readonly events: ReadonlyArray<LLMEvent>;
        readonly usage?: Usage;
    };
    /** Initial reducer state for assembling one provider attempt. */
    const empty: () => ResponseState;
    /** Purely fold one provider-neutral event into the attempt assembly state. */
    const reduce: (state: ResponseState, event: LLMEvent) => ResponseState;
    /** Return a completed response only after a terminal finish or provider error. */
    const complete: (state: State) => LLMResponse | undefined;
    /** Convenience reducer for callers that already have a collected event list. */
    const fromEvents: (events: ReadonlyArray<LLMEvent>) => LLMResponse | undefined;
    /** Concatenate assistant text from a response or collected event list. */
    const text: (response: Output) => string;
    /** Return response usage, falling back to the latest usage-bearing event. */
    const usage: (response: Output) => Usage | undefined;
    /** Return completed tool calls from a response or collected event list. */
    const toolCalls: (response: Output) => {
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
    }[];
    /** Concatenate reasoning text from a response or collected event list. */
    const reasoning: (response: Output) => string;
}
export {};

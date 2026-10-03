import { MediaProtocol } from "../route/media-protocol.js";
import { MediaRoute } from "../route/media.js";
import { type MediaUsage } from "../schema/index.js";
import { SpeechModel, type SpeechRequestFor } from "../speech.js";
import { SpeechStream } from "./utils/speech-stream.js";
export declare const DEFAULT_BASE_URL = "https://api.openai.com/v1";
export declare const PATH = "/audio/speech";
/** `voice`, `instructions`, `speed`, and `format` are common request fields; other native body fields pass through. */
export type OpenAISpeechOptions = {
    /** Defaults to `"sse"` in `stream` mode on models that support it; the merged value selects the response framing. */
    readonly stream_format?: "sse" | "audio";
} & Record<string, unknown>;
export type Request = SpeechRequestFor<OpenAISpeechOptions>;
interface State extends SpeechStream.Audio {
    readonly done: boolean;
    readonly usage?: MediaUsage;
}
export declare const protocol: MediaProtocol.Streamed<Request, {
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
    readonly audio: import("../media.js").Asset;
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
}, string | Uint8Array<ArrayBufferLike>, State>;
export declare const model: (input: MediaRoute.ModelInput) => SpeechModel<OpenAISpeechOptions>;
export declare const OpenAISpeech: {
    readonly protocol: MediaProtocol.Streamed<Request, {
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
        readonly audio: import("../media.js").Asset;
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
    }, string | Uint8Array<ArrayBufferLike>, State>;
    readonly model: (input: MediaRoute.ModelInput) => SpeechModel<OpenAISpeechOptions>;
};
export {};

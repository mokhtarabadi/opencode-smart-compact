import { MediaProtocol } from "../route/media-protocol.js";
import { MediaRoute } from "../route/media.js";
import { SpeechModel, type SpeechRequestFor } from "../speech.js";
import { GeminiGenerateContent } from "./utils/gemini-generate-content.js";
import { SpeechStream } from "./utils/speech-stream.js";
export declare const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
/** Style is directed in the text itself, and `speechConfig.multiSpeakerVoiceConfig` excludes `voice`. */
export type GoogleSpeechOptions = {
    readonly temperature?: number;
    readonly seed?: number;
    readonly speechConfig?: {
        readonly multiSpeakerVoiceConfig?: {
            readonly speakerVoiceConfigs: ReadonlyArray<{
                readonly speaker: string;
                readonly voiceConfig: {
                    readonly prebuiltVoiceConfig: {
                        readonly voiceName: string;
                    };
                };
            }>;
        };
    };
} & Record<string, unknown>;
export type Request = SpeechRequestFor<GoogleSpeechOptions>;
interface State extends SpeechStream.Audio, GeminiGenerateContent.Metadata {
    readonly mimeType?: string;
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
}, string, State>;
export declare const model: (input: MediaRoute.ModelInput) => SpeechModel<GoogleSpeechOptions>;
export declare const GoogleSpeech: {
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
    }, string, State>;
    readonly model: (input: MediaRoute.ModelInput) => SpeechModel<GoogleSpeechOptions>;
};
export {};

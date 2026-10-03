import { MediaProtocol } from "../route/media-protocol.js";
import { MediaRoute } from "../route/media.js";
import { type OpenString } from "../schema/index.js";
import { TranscriptionModel, type TranscriptionRequestFor, type TranscriptionSegment, type TranscriptionWord } from "../transcription.js";
import { GeminiGenerateContent } from "./utils/gemini-generate-content.js";
export declare const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
/**
 * Merged into `generationConfig`. The API rejects `customVocabulary` and `mode: "SMART"` alongside diarization or word
 * timestamps.
 */
export type GoogleTranscriptionOptions = {
    readonly audioTranscriptionConfig?: {
        readonly mode?: OpenString<"VERBATIM" | "SMART">;
        readonly customVocabulary?: ReadonlyArray<string>;
        readonly languageCodes?: ReadonlyArray<string>;
    };
} & Record<string, unknown>;
export type Request = TranscriptionRequestFor<GoogleTranscriptionOptions>;
interface State extends GeminiGenerateContent.Metadata {
    readonly text: string;
    readonly segments: Array<TranscriptionSegment>;
    readonly words: Array<TranscriptionWord>;
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
}, string, State>;
export declare const model: (input: MediaRoute.ModelInput) => TranscriptionModel<GoogleTranscriptionOptions>;
export declare const GoogleTranscription: {
    readonly protocol: MediaProtocol.Streamed<Request, {
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
    }, string, State>;
    readonly model: (input: MediaRoute.ModelInput) => TranscriptionModel<GoogleTranscriptionOptions>;
};
export {};

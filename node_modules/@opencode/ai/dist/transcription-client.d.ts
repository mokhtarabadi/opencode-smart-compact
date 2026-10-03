import { Context } from "effect";
import { MediaClient } from "./media-client.js";
import { type TranscriptionEvent, type TranscriptionRequestFor, type TranscriptionResponse } from "./transcription.js";
export type Interface = MediaClient.Interface<TranscriptionRequestFor, TranscriptionEvent, TranscriptionResponse>;
declare const TranscriptionClientService_base: Context.ServiceClass<TranscriptionClientService, "@opencode/TranscriptionClient", Interface>;
export declare class TranscriptionClientService extends TranscriptionClientService_base {
}
export declare const Service: typeof TranscriptionClientService;
export type Service = TranscriptionClientService;
export declare const TranscriptionClient: {
    readonly layer: import("effect/Layer").Layer<TranscriptionClientService, never, import("./route/executor-service.js").RequestExecutorService>;
    readonly generate: (request: TranscriptionRequestFor, options?: import("./generation.js").AwaitOptions) => import("effect/Effect").Effect<TranscriptionResponse, import("./index.js").AIError, TranscriptionClientService>;
    readonly stream: (request: TranscriptionRequestFor, options?: import("./generation.js").AwaitOptions) => import("effect/Stream").Stream<import("./generation.js").Observation | {
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
    }, import("./index.js").AIError, TranscriptionClientService>;
    readonly start: (request: TranscriptionRequestFor) => import("effect/Effect").Effect<import("./generation.js").Generation<TranscriptionResponse>, import("./index.js").AIError, TranscriptionClientService>;
    readonly resume: (model: import("./transcription.js").TranscriptionModel<import("./media-model.js").MediaModel.Options>, token: unknown) => import("effect/Effect").Effect<import("./generation.js").Generation<TranscriptionResponse>, import("./index.js").AIError, TranscriptionClientService>;
    readonly Service: typeof TranscriptionClientService;
};
export {};

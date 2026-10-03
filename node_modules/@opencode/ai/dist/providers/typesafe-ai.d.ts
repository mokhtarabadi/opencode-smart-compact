import { HttpOptions, type ModelID } from "../schema/index.js";
import { type ProviderAuthOption } from "../route/auth-options.js";
export declare const id: string & import("effect/Brand").Brand<"AI.ProviderID">;
export type Options = ProviderAuthOption<"optional"> & {
    readonly baseURL?: string;
    readonly headers?: Record<string, string>;
    readonly http?: HttpOptions.Input;
};
export declare const configure: (input?: Options) => {
    id: string & import("effect/Brand").Brand<"AI.ProviderID">;
    experimental: {
        evaluation: (modelID: string | ModelID) => import("../experimental.js").EvaluationModel<import("../experimental.js").EvaluationOptions>;
    };
    configure: (input?: Options) => /*elided*/ any;
};
export declare const provider: {
    id: string & import("effect/Brand").Brand<"AI.ProviderID">;
    experimental: {
        evaluation: (modelID: string | ModelID) => import("../experimental.js").EvaluationModel<import("../experimental.js").EvaluationOptions>;
    };
    configure: (input?: Options) => {
        id: string & import("effect/Brand").Brand<"AI.ProviderID">;
        experimental: {
            evaluation: (modelID: string | ModelID) => import("../experimental.js").EvaluationModel<import("../experimental.js").EvaluationOptions>;
        };
        configure: /*elided*/ any;
    };
};
export declare const experimental: {
    evaluation: (modelID: string | ModelID) => import("../experimental.js").EvaluationModel<import("../experimental.js").EvaluationOptions>;
};
export * as TypeSafeAI from "./typesafe-ai.js";

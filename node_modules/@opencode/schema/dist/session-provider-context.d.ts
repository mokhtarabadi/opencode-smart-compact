export * as SessionProviderContext from "./session-provider-context.js";
import { Schema } from "effect";
/** Exact producing model/deployment and route identity, never credentials or a connection ID. */
export interface Provenance extends Schema.Schema.Type<typeof Provenance> {
}
export declare const Provenance: Schema.Struct<{
    readonly providerID: Schema.brand<Schema.String, "Provider.ID"> & {
        opencode: string & import("effect/Brand").Brand<"Provider.ID">;
        anthropic: string & import("effect/Brand").Brand<"Provider.ID">;
        openai: string & import("effect/Brand").Brand<"Provider.ID">;
        google: string & import("effect/Brand").Brand<"Provider.ID">;
        googleVertex: string & import("effect/Brand").Brand<"Provider.ID">;
        githubCopilot: string & import("effect/Brand").Brand<"Provider.ID">;
        amazonBedrock: string & import("effect/Brand").Brand<"Provider.ID">;
        azure: string & import("effect/Brand").Brand<"Provider.ID">;
        openrouter: string & import("effect/Brand").Brand<"Provider.ID">;
        mistral: string & import("effect/Brand").Brand<"Provider.ID">;
        gitlab: string & import("effect/Brand").Brand<"Provider.ID">;
    };
    readonly provider: Schema.String;
    readonly modelID: Schema.String;
    readonly route: Schema.String;
    readonly protocol: Schema.String;
    /** Digest of the configured endpoint; raw URLs and query values are not persisted. */
    readonly endpoint: Schema.String;
}>;
/** Core validates the versioned canonical AI Message[] payload on installation and replay. */
export interface Info extends Schema.Schema.Type<typeof Info> {
}
export declare const Info: Schema.Struct<{
    readonly version: Schema.Literal<1>;
    readonly provenance: Schema.Struct<{
        readonly providerID: Schema.brand<Schema.String, "Provider.ID"> & {
            opencode: string & import("effect/Brand").Brand<"Provider.ID">;
            anthropic: string & import("effect/Brand").Brand<"Provider.ID">;
            openai: string & import("effect/Brand").Brand<"Provider.ID">;
            google: string & import("effect/Brand").Brand<"Provider.ID">;
            googleVertex: string & import("effect/Brand").Brand<"Provider.ID">;
            githubCopilot: string & import("effect/Brand").Brand<"Provider.ID">;
            amazonBedrock: string & import("effect/Brand").Brand<"Provider.ID">;
            azure: string & import("effect/Brand").Brand<"Provider.ID">;
            openrouter: string & import("effect/Brand").Brand<"Provider.ID">;
            mistral: string & import("effect/Brand").Brand<"Provider.ID">;
            gitlab: string & import("effect/Brand").Brand<"Provider.ID">;
        };
        readonly provider: Schema.String;
        readonly modelID: Schema.String;
        readonly route: Schema.String;
        readonly protocol: Schema.String;
        /** Digest of the configured endpoint; raw URLs and query values are not persisted. */
        readonly endpoint: Schema.String;
    }>;
    readonly messages: Schema.Codec<Schema.Json, Schema.Json, never, never>;
}>;

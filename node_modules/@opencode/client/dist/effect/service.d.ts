import { Effect, FileSystem, Schema } from "effect";
import type { DiscoverOptions, Endpoint, EnsureOptions, StopOptions } from "../service.js";
export * from "../service.js";
/** Contents of the local service registration file. */
export type Info = import("../service.js").Info;
/** Discover a healthy, compatible local service without starting one. */
export declare const discover: (options?: DiscoverOptions | undefined) => Effect.Effect<{
    url: string;
    auth: {
        type: "basic";
        username: string;
        password: string;
    } | undefined;
} | undefined, never, FileSystem.FileSystem>;
/** Recognize an authenticated compatible service bound to an expected URL, including while it starts or fails. */
export declare const incumbent: (options: DiscoverOptions & {
    readonly url: string;
}) => Effect.Effect<{
    endpoint: {
        url: string;
        auth: {
            type: "basic";
            username: string;
            password: string;
        } | undefined;
    };
    state: "failed" | "ready" | "waiting";
} | undefined, never, FileSystem.FileSystem>;
/** Ensure a healthy, compatible local service is running. */
export declare const ensure: (options?: EnsureOptions | undefined) => Effect.Effect<Endpoint, Error, FileSystem.FileSystem>;
/** Stop the registered local service. */
export declare const stop: (options?: StopOptions | undefined) => Effect.Effect<void, Error, FileSystem.FileSystem>;
/** Create HTTP authentication headers for a service endpoint. */
export declare function headers(endpoint: Endpoint): {
    authorization: string;
} | undefined;
/** Schema for the local service registration file. */
export declare const Info: Schema.Struct<{
    readonly id: Schema.optional<Schema.String>;
    readonly version: Schema.optional<Schema.String>;
    readonly url: Schema.String;
    readonly pid: Schema.Int;
    readonly password: Schema.optional<Schema.String>;
}>;
/** Effect-based local service lifecycle operations. */
export declare const Service: {
    discover: (options?: DiscoverOptions | undefined) => Effect.Effect<{
        url: string;
        auth: {
            type: "basic";
            username: string;
            password: string;
        } | undefined;
    } | undefined, never, FileSystem.FileSystem>;
    incumbent: (options: DiscoverOptions & {
        readonly url: string;
    }) => Effect.Effect<{
        endpoint: {
            url: string;
            auth: {
                type: "basic";
                username: string;
                password: string;
            } | undefined;
        };
        state: "failed" | "ready" | "waiting";
    } | undefined, never, FileSystem.FileSystem>;
    ensure: (options?: EnsureOptions | undefined) => Effect.Effect<Endpoint, Error, FileSystem.FileSystem>;
    stop: (options?: StopOptions | undefined) => Effect.Effect<void, Error, FileSystem.FileSystem>;
    headers: typeof headers;
    Info: Schema.Struct<{
        readonly id: Schema.optional<Schema.String>;
        readonly version: Schema.optional<Schema.String>;
        readonly url: Schema.String;
        readonly pid: Schema.Int;
        readonly password: Schema.optional<Schema.String>;
    }>;
};

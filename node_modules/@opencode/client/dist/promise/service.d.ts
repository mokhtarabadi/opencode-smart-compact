import type { DiscoverOptions, Endpoint, EnsureOptions, StopOptions } from "../service.js";
export * from "../service.js";
/** Discover a healthy, compatible local service without starting one. */
export declare function discover(options?: DiscoverOptions): Promise<{
    url: string;
    auth: {
        type: "basic";
        username: string;
        password: string;
    } | undefined;
} | undefined>;
/** Ensure a healthy, compatible local service is running. */
export declare function ensure(options?: EnsureOptions): Promise<Endpoint>;
/** Stop the registered local service. */
export declare function stop(options?: StopOptions): Promise<void>;
/** Create HTTP authentication headers for a service endpoint. */
export declare function headers(endpoint: Endpoint): {
    authorization: string;
} | undefined;
/** Promise-based local service lifecycle operations. */
export declare const Service: {
    discover: typeof discover;
    ensure: typeof ensure;
    stop: typeof stop;
    headers: typeof headers;
};

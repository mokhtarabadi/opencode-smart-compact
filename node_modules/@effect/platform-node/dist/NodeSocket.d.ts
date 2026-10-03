import type * as Duration from "effect/Duration";
import type * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Socket from "effect/unstable/socket/Socket";
/**
 * @since 4.0.0
 */
export * from "@effect/platform-node-shared/NodeSocket";
/**
 * Provides a `Socket.WebSocketConstructor`, using `globalThis.WebSocket` when
 * available and falling back to the `ws` package otherwise.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerWebSocketConstructor: Layer.Layer<Socket.WebSocketConstructor>;
/**
 * Provides a `Socket.WebSocketConstructor` backed explicitly by the `ws`
 * package.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerWebSocketConstructorWS: Layer.Layer<Socket.WebSocketConstructor>;
/**
 * Creates a `Socket.Socket` layer for a WebSocket URL using the Node WebSocket
 * constructor layer, honoring protocol, open-timeout, and close-code error
 * options.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerWebSocket: (url: string | Effect.Effect<string>, options?: {
    readonly closeCodeIsError?: ((code: number) => boolean) | undefined;
    readonly openTimeout?: Duration.Input | undefined;
    readonly protocols?: string | Array<string> | undefined;
} | undefined) => Layer.Layer<Socket.Socket, never, never>;
//# sourceMappingURL=NodeSocket.d.ts.map
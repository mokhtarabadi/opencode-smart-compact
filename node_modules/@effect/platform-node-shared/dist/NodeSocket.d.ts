/**
 * Node socket adapters for Effect sockets.
 *
 * This module opens `node:net` connections or wraps existing Node `Duplex`
 * streams and presents them as `Socket.Socket` values, socket channels, or
 * layers. It also exposes the current underlying `NetSocket` service for code
 * running inside a socket handler and re-exports the `ws` package namespace.
 *
 * @since 4.0.0
 */
import type { Array } from "effect";
import * as Channel from "effect/Channel";
import * as Context from "effect/Context";
import type * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import * as Socket from "effect/unstable/socket/Socket";
import * as Net from "node:net";
import type { Duplex } from "node:stream";
/**
 * @category re-exports
 * @since 4.0.0
 */
export * as NodeWS from "ws";
declare const NetSocket_base: Context.ServiceClass<NetSocket, "@effect/platform-node/NodeSocket/NetSocket", Net.Socket>;
/**
 * Service tag for the underlying Node `net.Socket` associated with the current
 * socket connection.
 *
 * @category services
 * @since 4.0.0
 */
export declare class NetSocket extends NetSocket_base {
}
/**
 * Opens a Node TCP connection as an Effect socket.
 *
 * **When to use**
 *
 * Use to create a scoped `Socket.Socket` from Node `net.createConnection`.
 *
 * **Details**
 *
 * Supports `openTimeout` and closes or destroys the underlying socket when the
 * enclosing scope is finalized.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const makeNet: (options: Net.NetConnectOpts & {
    readonly openTimeout?: Duration.Input | undefined;
}) => Effect.Effect<Socket.Socket>;
/**
 * Adapts a Node `Duplex` into a `Socket.Socket`, wiring data events to socket
 * handlers, providing a scoped writer, and mapping open, read, write, and close
 * failures to `SocketError`.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const fromDuplex: <RO>(open: Effect.Effect<Duplex, Socket.SocketError, RO>, options?: {
    readonly openTimeout?: Duration.Input | undefined;
}) => Effect.Effect<Socket.Socket, never, Exclude<RO, Scope.Scope>>;
/**
 * Creates a `Channel` over a TCP socket, reading arrays of `Uint8Array`
 * chunks and writing arrays of bytes, strings, or socket close events.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const makeNetChannel: <IE = never>(options: Net.NetConnectOpts) => Channel.Channel<Array.NonEmptyReadonlyArray<Uint8Array>, Socket.SocketError | IE, void, Array.NonEmptyReadonlyArray<Uint8Array | string | Socket.CloseEvent>, IE>;
/**
 * Provides a `Socket.Socket` by opening a TCP connection with the supplied
 * Node `net` connection options.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerNet: (options: Net.NetConnectOpts) => Layer.Layer<Socket.Socket, Socket.SocketError>;
//# sourceMappingURL=NodeSocket.d.ts.map
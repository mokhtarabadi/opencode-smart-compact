import * as Layer from "effect/Layer";
import * as Runners from "effect/unstable/cluster/Runners";
import * as ShardingConfig from "effect/unstable/cluster/ShardingConfig";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";
import type * as SocketServer from "effect/unstable/socket/SocketServer";
/**
 * Provides the cluster `RpcClientProtocol` by opening TCP sockets to runner
 * addresses and using the current RPC serialization service.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerClientProtocol: Layer.Layer<Runners.RpcClientProtocol, never, RpcSerialization.RpcSerialization>;
/**
 * Provides the socket server used by cluster runners, listening on
 * `ShardingConfig.runnerListenAddress` or `runnerAddress`.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerSocketServer: Layer.Layer<SocketServer.SocketServer, SocketServer.SocketServerError, ShardingConfig.ShardingConfig>;
//# sourceMappingURL=NodeClusterSocket.d.ts.map
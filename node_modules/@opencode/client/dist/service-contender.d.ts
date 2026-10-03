import { type ChildProcess } from "node:child_process";
export type ServiceContender = {
    readonly child: ChildProcess;
    readonly error: () => Error | undefined;
    readonly closed: () => boolean;
    readonly stderr: () => string;
    readonly release: () => void;
};
export declare function spawnServiceContender(command: string, args: ReadonlyArray<string>, env?: Readonly<Record<string, string | undefined>>): ServiceContender;
export declare function contenderFailure(contender: ServiceContender): Error | undefined;
export declare function contenderFinished(contender: ServiceContender): boolean;

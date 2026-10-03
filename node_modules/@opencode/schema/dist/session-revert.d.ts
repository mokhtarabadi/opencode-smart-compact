import { Schema } from "effect";
export interface Revert extends Schema.Schema.Type<typeof Revert> {
}
export declare const Revert: Schema.Struct<{
    readonly messageID: Schema.brand<Schema.String, "Session.Message.ID"> & {
        create: () => string & import("effect/Brand").Brand<"Session.Message.ID">;
        fromEvent: (eventID: import("./event.js").ID) => string & import("effect/Brand").Brand<"Session.Message.ID">;
    };
    /** Legacy V1 compatibility state. */
    readonly partID: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
    readonly snapshot: Schema.decodeTo<Schema.optional<Schema.toType<Schema.brand<Schema.String, "Snapshot.ID">>>, Schema.optionalKey<Schema.brand<Schema.String, "Snapshot.ID">>, never, never>;
    readonly files: Schema.decodeTo<Schema.optional<Schema.toType<Schema.$Array<Schema.Struct<{
        readonly file: Schema.String;
        readonly patch: Schema.String;
        readonly additions: Schema.Int;
        readonly deletions: Schema.Int;
        readonly status: Schema.Literals<readonly ["added", "deleted", "modified"]>;
    }>>>>, Schema.optionalKey<Schema.$Array<Schema.Struct<{
        readonly file: Schema.String;
        readonly patch: Schema.String;
        readonly additions: Schema.Int;
        readonly deletions: Schema.Int;
        readonly status: Schema.Literals<readonly ["added", "deleted", "modified"]>;
    }>>>, never, never>;
}>;
export interface RevertV1 extends Schema.Schema.Type<typeof RevertV1> {
}
export declare const RevertV1: Schema.Struct<{
    readonly messageID: Schema.brand<Schema.String, "Session.Message.ID"> & {
        create: () => string & import("effect/Brand").Brand<"Session.Message.ID">;
        fromEvent: (eventID: import("./event.js").ID) => string & import("effect/Brand").Brand<"Session.Message.ID">;
    };
    readonly partID: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
    readonly snapshot: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
    readonly diff: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
    readonly files: Schema.decodeTo<Schema.optional<Schema.toType<Schema.$Array<Schema.Struct<{
        readonly path: Schema.String;
        readonly status: Schema.Literals<readonly ["added", "modified", "deleted"]>;
        readonly additions: Schema.Finite;
        readonly deletions: Schema.Finite;
        readonly patch: Schema.String;
    }>>>>, Schema.optionalKey<Schema.$Array<Schema.Struct<{
        readonly path: Schema.String;
        readonly status: Schema.Literals<readonly ["added", "modified", "deleted"]>;
        readonly additions: Schema.Finite;
        readonly deletions: Schema.Finite;
        readonly patch: Schema.String;
    }>>>, never, never>;
}>;
/** Storage decoder for revert state written before FileDiff became canonical. */
export declare const PersistedRevert: Schema.decodeTo<Schema.toType<Schema.Struct<{
    readonly messageID: Schema.brand<Schema.String, "Session.Message.ID"> & {
        create: () => string & import("effect/Brand").Brand<"Session.Message.ID">;
        fromEvent: (eventID: import("./event.js").ID) => string & import("effect/Brand").Brand<"Session.Message.ID">;
    };
    /** Legacy V1 compatibility state. */
    readonly partID: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
    readonly snapshot: Schema.decodeTo<Schema.optional<Schema.toType<Schema.brand<Schema.String, "Snapshot.ID">>>, Schema.optionalKey<Schema.brand<Schema.String, "Snapshot.ID">>, never, never>;
    readonly files: Schema.decodeTo<Schema.optional<Schema.toType<Schema.$Array<Schema.Struct<{
        readonly file: Schema.String;
        readonly patch: Schema.String;
        readonly additions: Schema.Int;
        readonly deletions: Schema.Int;
        readonly status: Schema.Literals<readonly ["added", "deleted", "modified"]>;
    }>>>>, Schema.optionalKey<Schema.$Array<Schema.Struct<{
        readonly file: Schema.String;
        readonly patch: Schema.String;
        readonly additions: Schema.Int;
        readonly deletions: Schema.Int;
        readonly status: Schema.Literals<readonly ["added", "deleted", "modified"]>;
    }>>>, never, never>;
}>>, Schema.Union<readonly [Schema.decodeTo<Schema.Struct<{
    readonly source: Schema.tag<"current">;
    readonly revert: Schema.toType<Schema.Struct<{
        readonly messageID: Schema.brand<Schema.String, "Session.Message.ID"> & {
            create: () => string & import("effect/Brand").Brand<"Session.Message.ID">;
            fromEvent: (eventID: import("./event.js").ID) => string & import("effect/Brand").Brand<"Session.Message.ID">;
        };
        /** Legacy V1 compatibility state. */
        readonly partID: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
        readonly snapshot: Schema.decodeTo<Schema.optional<Schema.toType<Schema.brand<Schema.String, "Snapshot.ID">>>, Schema.optionalKey<Schema.brand<Schema.String, "Snapshot.ID">>, never, never>;
        readonly files: Schema.decodeTo<Schema.optional<Schema.toType<Schema.$Array<Schema.Struct<{
            readonly file: Schema.String;
            readonly patch: Schema.String;
            readonly additions: Schema.Int;
            readonly deletions: Schema.Int;
            readonly status: Schema.Literals<readonly ["added", "deleted", "modified"]>;
        }>>>>, Schema.optionalKey<Schema.$Array<Schema.Struct<{
            readonly file: Schema.String;
            readonly patch: Schema.String;
            readonly additions: Schema.Int;
            readonly deletions: Schema.Int;
            readonly status: Schema.Literals<readonly ["added", "deleted", "modified"]>;
        }>>>, never, never>;
    }>>;
}>, Schema.Struct<{
    readonly messageID: Schema.brand<Schema.String, "Session.Message.ID"> & {
        create: () => string & import("effect/Brand").Brand<"Session.Message.ID">;
        fromEvent: (eventID: import("./event.js").ID) => string & import("effect/Brand").Brand<"Session.Message.ID">;
    };
    /** Legacy V1 compatibility state. */
    readonly partID: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
    readonly snapshot: Schema.decodeTo<Schema.optional<Schema.toType<Schema.brand<Schema.String, "Snapshot.ID">>>, Schema.optionalKey<Schema.brand<Schema.String, "Snapshot.ID">>, never, never>;
    readonly files: Schema.decodeTo<Schema.optional<Schema.toType<Schema.$Array<Schema.Struct<{
        readonly file: Schema.String;
        readonly patch: Schema.String;
        readonly additions: Schema.Int;
        readonly deletions: Schema.Int;
        readonly status: Schema.Literals<readonly ["added", "deleted", "modified"]>;
    }>>>>, Schema.optionalKey<Schema.$Array<Schema.Struct<{
        readonly file: Schema.String;
        readonly patch: Schema.String;
        readonly additions: Schema.Int;
        readonly deletions: Schema.Int;
        readonly status: Schema.Literals<readonly ["added", "deleted", "modified"]>;
    }>>>, never, never>;
}>, never, never>, Schema.decodeTo<Schema.Struct<{
    readonly source: Schema.tag<"legacy">;
    readonly revert: Schema.toType<Schema.Struct<{
        readonly messageID: Schema.brand<Schema.String, "Session.Message.ID"> & {
            create: () => string & import("effect/Brand").Brand<"Session.Message.ID">;
            fromEvent: (eventID: import("./event.js").ID) => string & import("effect/Brand").Brand<"Session.Message.ID">;
        };
        readonly partID: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
        readonly snapshot: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
        readonly diff: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
        readonly files: Schema.decodeTo<Schema.optional<Schema.toType<Schema.$Array<Schema.Struct<{
            readonly path: Schema.String;
            readonly status: Schema.Literals<readonly ["added", "modified", "deleted"]>;
            readonly additions: Schema.Finite;
            readonly deletions: Schema.Finite;
            readonly patch: Schema.String;
        }>>>>, Schema.optionalKey<Schema.$Array<Schema.Struct<{
            readonly path: Schema.String;
            readonly status: Schema.Literals<readonly ["added", "modified", "deleted"]>;
            readonly additions: Schema.Finite;
            readonly deletions: Schema.Finite;
            readonly patch: Schema.String;
        }>>>, never, never>;
    }>>;
}>, Schema.Struct<{
    readonly messageID: Schema.brand<Schema.String, "Session.Message.ID"> & {
        create: () => string & import("effect/Brand").Brand<"Session.Message.ID">;
        fromEvent: (eventID: import("./event.js").ID) => string & import("effect/Brand").Brand<"Session.Message.ID">;
    };
    readonly partID: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
    readonly snapshot: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
    readonly diff: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
    readonly files: Schema.decodeTo<Schema.optional<Schema.toType<Schema.$Array<Schema.Struct<{
        readonly path: Schema.String;
        readonly status: Schema.Literals<readonly ["added", "modified", "deleted"]>;
        readonly additions: Schema.Finite;
        readonly deletions: Schema.Finite;
        readonly patch: Schema.String;
    }>>>>, Schema.optionalKey<Schema.$Array<Schema.Struct<{
        readonly path: Schema.String;
        readonly status: Schema.Literals<readonly ["added", "modified", "deleted"]>;
        readonly additions: Schema.Finite;
        readonly deletions: Schema.Finite;
        readonly patch: Schema.String;
    }>>>, never, never>;
}>, never, never>]> & {
    readonly discriminants: readonly ["current", "legacy"];
    readonly cases: {
        current: Schema.decodeTo<Schema.Struct<{
            readonly source: Schema.tag<"current">;
            readonly revert: Schema.toType<Schema.Struct<{
                readonly messageID: Schema.brand<Schema.String, "Session.Message.ID"> & {
                    create: () => string & import("effect/Brand").Brand<"Session.Message.ID">;
                    fromEvent: (eventID: import("./event.js").ID) => string & import("effect/Brand").Brand<"Session.Message.ID">;
                };
                /** Legacy V1 compatibility state. */
                readonly partID: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
                readonly snapshot: Schema.decodeTo<Schema.optional<Schema.toType<Schema.brand<Schema.String, "Snapshot.ID">>>, Schema.optionalKey<Schema.brand<Schema.String, "Snapshot.ID">>, never, never>;
                readonly files: Schema.decodeTo<Schema.optional<Schema.toType<Schema.$Array<Schema.Struct<{
                    readonly file: Schema.String;
                    readonly patch: Schema.String;
                    readonly additions: Schema.Int;
                    readonly deletions: Schema.Int;
                    readonly status: Schema.Literals<readonly ["added", "deleted", "modified"]>;
                }>>>>, Schema.optionalKey<Schema.$Array<Schema.Struct<{
                    readonly file: Schema.String;
                    readonly patch: Schema.String;
                    readonly additions: Schema.Int;
                    readonly deletions: Schema.Int;
                    readonly status: Schema.Literals<readonly ["added", "deleted", "modified"]>;
                }>>>, never, never>;
            }>>;
        }>, Schema.Struct<{
            readonly messageID: Schema.brand<Schema.String, "Session.Message.ID"> & {
                create: () => string & import("effect/Brand").Brand<"Session.Message.ID">;
                fromEvent: (eventID: import("./event.js").ID) => string & import("effect/Brand").Brand<"Session.Message.ID">;
            };
            /** Legacy V1 compatibility state. */
            readonly partID: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
            readonly snapshot: Schema.decodeTo<Schema.optional<Schema.toType<Schema.brand<Schema.String, "Snapshot.ID">>>, Schema.optionalKey<Schema.brand<Schema.String, "Snapshot.ID">>, never, never>;
            readonly files: Schema.decodeTo<Schema.optional<Schema.toType<Schema.$Array<Schema.Struct<{
                readonly file: Schema.String;
                readonly patch: Schema.String;
                readonly additions: Schema.Int;
                readonly deletions: Schema.Int;
                readonly status: Schema.Literals<readonly ["added", "deleted", "modified"]>;
            }>>>>, Schema.optionalKey<Schema.$Array<Schema.Struct<{
                readonly file: Schema.String;
                readonly patch: Schema.String;
                readonly additions: Schema.Int;
                readonly deletions: Schema.Int;
                readonly status: Schema.Literals<readonly ["added", "deleted", "modified"]>;
            }>>>, never, never>;
        }>, never, never>;
        legacy: Schema.decodeTo<Schema.Struct<{
            readonly source: Schema.tag<"legacy">;
            readonly revert: Schema.toType<Schema.Struct<{
                readonly messageID: Schema.brand<Schema.String, "Session.Message.ID"> & {
                    create: () => string & import("effect/Brand").Brand<"Session.Message.ID">;
                    fromEvent: (eventID: import("./event.js").ID) => string & import("effect/Brand").Brand<"Session.Message.ID">;
                };
                readonly partID: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
                readonly snapshot: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
                readonly diff: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
                readonly files: Schema.decodeTo<Schema.optional<Schema.toType<Schema.$Array<Schema.Struct<{
                    readonly path: Schema.String;
                    readonly status: Schema.Literals<readonly ["added", "modified", "deleted"]>;
                    readonly additions: Schema.Finite;
                    readonly deletions: Schema.Finite;
                    readonly patch: Schema.String;
                }>>>>, Schema.optionalKey<Schema.$Array<Schema.Struct<{
                    readonly path: Schema.String;
                    readonly status: Schema.Literals<readonly ["added", "modified", "deleted"]>;
                    readonly additions: Schema.Finite;
                    readonly deletions: Schema.Finite;
                    readonly patch: Schema.String;
                }>>>, never, never>;
            }>>;
        }>, Schema.Struct<{
            readonly messageID: Schema.brand<Schema.String, "Session.Message.ID"> & {
                create: () => string & import("effect/Brand").Brand<"Session.Message.ID">;
                fromEvent: (eventID: import("./event.js").ID) => string & import("effect/Brand").Brand<"Session.Message.ID">;
            };
            readonly partID: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
            readonly snapshot: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
            readonly diff: Schema.decodeTo<Schema.optional<Schema.toType<Schema.String>>, Schema.optionalKey<Schema.String>, never, never>;
            readonly files: Schema.decodeTo<Schema.optional<Schema.toType<Schema.$Array<Schema.Struct<{
                readonly path: Schema.String;
                readonly status: Schema.Literals<readonly ["added", "modified", "deleted"]>;
                readonly additions: Schema.Finite;
                readonly deletions: Schema.Finite;
                readonly patch: Schema.String;
            }>>>>, Schema.optionalKey<Schema.$Array<Schema.Struct<{
                readonly path: Schema.String;
                readonly status: Schema.Literals<readonly ["added", "modified", "deleted"]>;
                readonly additions: Schema.Finite;
                readonly deletions: Schema.Finite;
                readonly patch: Schema.String;
            }>>>, never, never>;
        }>, never, never>;
    };
    readonly isAnyOf: <const Keys>(keys: readonly Keys[]) => (value: {
        readonly source: "current";
        readonly revert: {
            readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
            readonly files?: readonly {
                readonly file: string;
                readonly patch: string;
                readonly additions: number;
                readonly deletions: number;
                readonly status: "added" | "deleted" | "modified";
            }[] | undefined;
            readonly snapshot?: (string & import("effect/Brand").Brand<"Snapshot.ID">) | undefined;
            readonly partID?: string | undefined;
        };
    } | {
        readonly source: "legacy";
        readonly revert: {
            readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
            readonly files?: readonly {
                readonly path: string;
                readonly status: "added" | "deleted" | "modified";
                readonly additions: number;
                readonly deletions: number;
                readonly patch: string;
            }[] | undefined;
            readonly snapshot?: string | undefined;
            readonly partID?: string | undefined;
            readonly diff?: string | undefined;
        };
    }) => value is Extract<{
        readonly source: "current";
        readonly revert: {
            readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
            readonly files?: readonly {
                readonly file: string;
                readonly patch: string;
                readonly additions: number;
                readonly deletions: number;
                readonly status: "added" | "deleted" | "modified";
            }[] | undefined;
            readonly snapshot?: (string & import("effect/Brand").Brand<"Snapshot.ID">) | undefined;
            readonly partID?: string | undefined;
        };
    }, {
        readonly source: Keys;
    }> | Extract<{
        readonly source: "legacy";
        readonly revert: {
            readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
            readonly files?: readonly {
                readonly path: string;
                readonly status: "added" | "deleted" | "modified";
                readonly additions: number;
                readonly deletions: number;
                readonly patch: string;
            }[] | undefined;
            readonly snapshot?: string | undefined;
            readonly partID?: string | undefined;
            readonly diff?: string | undefined;
        };
    }, {
        readonly source: Keys;
    }>;
    readonly guards: {
        current: (u: unknown) => u is {
            readonly source: "current";
            readonly revert: {
                readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                readonly files?: readonly {
                    readonly file: string;
                    readonly patch: string;
                    readonly additions: number;
                    readonly deletions: number;
                    readonly status: "added" | "deleted" | "modified";
                }[] | undefined;
                readonly snapshot?: (string & import("effect/Brand").Brand<"Snapshot.ID">) | undefined;
                readonly partID?: string | undefined;
            };
        };
        legacy: (u: unknown) => u is {
            readonly source: "legacy";
            readonly revert: {
                readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                readonly files?: readonly {
                    readonly path: string;
                    readonly status: "added" | "deleted" | "modified";
                    readonly additions: number;
                    readonly deletions: number;
                    readonly patch: string;
                }[] | undefined;
                readonly snapshot?: string | undefined;
                readonly partID?: string | undefined;
                readonly diff?: string | undefined;
            };
        };
    };
    readonly match: {
        <Cases extends {
            current: (value: {
                readonly source: "current";
                readonly revert: {
                    readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                    readonly files?: readonly {
                        readonly file: string;
                        readonly patch: string;
                        readonly additions: number;
                        readonly deletions: number;
                        readonly status: "added" | "deleted" | "modified";
                    }[] | undefined;
                    readonly snapshot?: (string & import("effect/Brand").Brand<"Snapshot.ID">) | undefined;
                    readonly partID?: string | undefined;
                };
            }) => any;
            legacy: (value: {
                readonly source: "legacy";
                readonly revert: {
                    readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                    readonly files?: readonly {
                        readonly path: string;
                        readonly status: "added" | "deleted" | "modified";
                        readonly additions: number;
                        readonly deletions: number;
                        readonly patch: string;
                    }[] | undefined;
                    readonly snapshot?: string | undefined;
                    readonly partID?: string | undefined;
                    readonly diff?: string | undefined;
                };
            }) => any;
        }>(value: {
            readonly source: "current";
            readonly revert: {
                readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                readonly files?: readonly {
                    readonly file: string;
                    readonly patch: string;
                    readonly additions: number;
                    readonly deletions: number;
                    readonly status: "added" | "deleted" | "modified";
                }[] | undefined;
                readonly snapshot?: (string & import("effect/Brand").Brand<"Snapshot.ID">) | undefined;
                readonly partID?: string | undefined;
            };
        } | {
            readonly source: "legacy";
            readonly revert: {
                readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                readonly files?: readonly {
                    readonly path: string;
                    readonly status: "added" | "deleted" | "modified";
                    readonly additions: number;
                    readonly deletions: number;
                    readonly patch: string;
                }[] | undefined;
                readonly snapshot?: string | undefined;
                readonly partID?: string | undefined;
                readonly diff?: string | undefined;
            };
        }, cases: Cases): Cases[keyof Cases] extends (value: any) => infer R ? import("effect/Unify").Unify<R> : never;
        <Cases extends {
            current: (value: {
                readonly source: "current";
                readonly revert: {
                    readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                    readonly files?: readonly {
                        readonly file: string;
                        readonly patch: string;
                        readonly additions: number;
                        readonly deletions: number;
                        readonly status: "added" | "deleted" | "modified";
                    }[] | undefined;
                    readonly snapshot?: (string & import("effect/Brand").Brand<"Snapshot.ID">) | undefined;
                    readonly partID?: string | undefined;
                };
            }) => any;
            legacy: (value: {
                readonly source: "legacy";
                readonly revert: {
                    readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                    readonly files?: readonly {
                        readonly path: string;
                        readonly status: "added" | "deleted" | "modified";
                        readonly additions: number;
                        readonly deletions: number;
                        readonly patch: string;
                    }[] | undefined;
                    readonly snapshot?: string | undefined;
                    readonly partID?: string | undefined;
                    readonly diff?: string | undefined;
                };
            }) => any;
        }>(cases: Cases): (value: {
            readonly source: "current";
            readonly revert: {
                readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                readonly files?: readonly {
                    readonly file: string;
                    readonly patch: string;
                    readonly additions: number;
                    readonly deletions: number;
                    readonly status: "added" | "deleted" | "modified";
                }[] | undefined;
                readonly snapshot?: (string & import("effect/Brand").Brand<"Snapshot.ID">) | undefined;
                readonly partID?: string | undefined;
            };
        } | {
            readonly source: "legacy";
            readonly revert: {
                readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                readonly files?: readonly {
                    readonly path: string;
                    readonly status: "added" | "deleted" | "modified";
                    readonly additions: number;
                    readonly deletions: number;
                    readonly patch: string;
                }[] | undefined;
                readonly snapshot?: string | undefined;
                readonly partID?: string | undefined;
                readonly diff?: string | undefined;
            };
        }) => Cases[keyof Cases] extends (value: any) => infer R ? import("effect/Unify").Unify<R> : never;
    };
    readonly matchOrElse: {
        <Cases extends {
            current?: ((value: {
                readonly source: "current";
                readonly revert: {
                    readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                    readonly files?: readonly {
                        readonly file: string;
                        readonly patch: string;
                        readonly additions: number;
                        readonly deletions: number;
                        readonly status: "added" | "deleted" | "modified";
                    }[] | undefined;
                    readonly snapshot?: (string & import("effect/Brand").Brand<"Snapshot.ID">) | undefined;
                    readonly partID?: string | undefined;
                };
            }) => any) | undefined;
            legacy?: ((value: {
                readonly source: "legacy";
                readonly revert: {
                    readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                    readonly files?: readonly {
                        readonly path: string;
                        readonly status: "added" | "deleted" | "modified";
                        readonly additions: number;
                        readonly deletions: number;
                        readonly patch: string;
                    }[] | undefined;
                    readonly snapshot?: string | undefined;
                    readonly partID?: string | undefined;
                    readonly diff?: string | undefined;
                };
            }) => any) | undefined;
        } & { [K in Exclude<keyof Cases, "legacy" | "current">]: never; }, OrElse extends (value: Exclude<{
            readonly source: "current";
            readonly revert: {
                readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                readonly files?: readonly {
                    readonly file: string;
                    readonly patch: string;
                    readonly additions: number;
                    readonly deletions: number;
                    readonly status: "added" | "deleted" | "modified";
                }[] | undefined;
                readonly snapshot?: (string & import("effect/Brand").Brand<"Snapshot.ID">) | undefined;
                readonly partID?: string | undefined;
            };
        }, {
            readonly source: keyof Cases;
        }> | Exclude<{
            readonly source: "legacy";
            readonly revert: {
                readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                readonly files?: readonly {
                    readonly path: string;
                    readonly status: "added" | "deleted" | "modified";
                    readonly additions: number;
                    readonly deletions: number;
                    readonly patch: string;
                }[] | undefined;
                readonly snapshot?: string | undefined;
                readonly partID?: string | undefined;
                readonly diff?: string | undefined;
            };
        }, {
            readonly source: keyof Cases;
        }>) => any>(value: {
            readonly source: "current";
            readonly revert: {
                readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                readonly files?: readonly {
                    readonly file: string;
                    readonly patch: string;
                    readonly additions: number;
                    readonly deletions: number;
                    readonly status: "added" | "deleted" | "modified";
                }[] | undefined;
                readonly snapshot?: (string & import("effect/Brand").Brand<"Snapshot.ID">) | undefined;
                readonly partID?: string | undefined;
            };
        } | {
            readonly source: "legacy";
            readonly revert: {
                readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                readonly files?: readonly {
                    readonly path: string;
                    readonly status: "added" | "deleted" | "modified";
                    readonly additions: number;
                    readonly deletions: number;
                    readonly patch: string;
                }[] | undefined;
                readonly snapshot?: string | undefined;
                readonly partID?: string | undefined;
                readonly diff?: string | undefined;
            };
        }, cases: Cases, orElse: OrElse): import("effect/Unify").Unify<{ [K_1 in keyof Cases]-?: NonNullable<Cases[K_1]> extends (...args: Array<any>) => infer R ? R : never; }[keyof Cases] | ReturnType<OrElse>>;
        <Cases extends {
            current?: ((value: {
                readonly source: "current";
                readonly revert: {
                    readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                    readonly files?: readonly {
                        readonly file: string;
                        readonly patch: string;
                        readonly additions: number;
                        readonly deletions: number;
                        readonly status: "added" | "deleted" | "modified";
                    }[] | undefined;
                    readonly snapshot?: (string & import("effect/Brand").Brand<"Snapshot.ID">) | undefined;
                    readonly partID?: string | undefined;
                };
            }) => any) | undefined;
            legacy?: ((value: {
                readonly source: "legacy";
                readonly revert: {
                    readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                    readonly files?: readonly {
                        readonly path: string;
                        readonly status: "added" | "deleted" | "modified";
                        readonly additions: number;
                        readonly deletions: number;
                        readonly patch: string;
                    }[] | undefined;
                    readonly snapshot?: string | undefined;
                    readonly partID?: string | undefined;
                    readonly diff?: string | undefined;
                };
            }) => any) | undefined;
        } & { [K in Exclude<keyof Cases, "legacy" | "current">]: never; }, OrElse extends (value: Exclude<{
            readonly source: "current";
            readonly revert: {
                readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                readonly files?: readonly {
                    readonly file: string;
                    readonly patch: string;
                    readonly additions: number;
                    readonly deletions: number;
                    readonly status: "added" | "deleted" | "modified";
                }[] | undefined;
                readonly snapshot?: (string & import("effect/Brand").Brand<"Snapshot.ID">) | undefined;
                readonly partID?: string | undefined;
            };
        }, {
            readonly source: keyof Cases;
        }> | Exclude<{
            readonly source: "legacy";
            readonly revert: {
                readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                readonly files?: readonly {
                    readonly path: string;
                    readonly status: "added" | "deleted" | "modified";
                    readonly additions: number;
                    readonly deletions: number;
                    readonly patch: string;
                }[] | undefined;
                readonly snapshot?: string | undefined;
                readonly partID?: string | undefined;
                readonly diff?: string | undefined;
            };
        }, {
            readonly source: keyof Cases;
        }>) => any>(cases: Cases, orElse: OrElse): (value: {
            readonly source: "current";
            readonly revert: {
                readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                readonly files?: readonly {
                    readonly file: string;
                    readonly patch: string;
                    readonly additions: number;
                    readonly deletions: number;
                    readonly status: "added" | "deleted" | "modified";
                }[] | undefined;
                readonly snapshot?: (string & import("effect/Brand").Brand<"Snapshot.ID">) | undefined;
                readonly partID?: string | undefined;
            };
        } | {
            readonly source: "legacy";
            readonly revert: {
                readonly messageID: string & import("effect/Brand").Brand<"Session.Message.ID">;
                readonly files?: readonly {
                    readonly path: string;
                    readonly status: "added" | "deleted" | "modified";
                    readonly additions: number;
                    readonly deletions: number;
                    readonly patch: string;
                }[] | undefined;
                readonly snapshot?: string | undefined;
                readonly partID?: string | undefined;
                readonly diff?: string | undefined;
            };
        }) => import("effect/Unify").Unify<{ [K_1 in keyof Cases]-?: NonNullable<Cases[K_1]> extends (...args: Array<any>) => infer R ? R : never; }[keyof Cases] | ReturnType<OrElse>>;
    };
}, never, never>;

import { Effect, Schema, Stream } from "effect";
import { Generation, type AwaitOptions } from "./generation.js";
import { Media } from "./media.js";
import { MediaModel } from "./media-model.js";
import { MediaRoute } from "./route/media.js";
import { AIError, HttpOptions, type OpenString } from "./schema/index.js";
import { Service } from "./image-client.js";
export type ImageOptions = MediaModel.Options;
export type ImageRoute = MediaRoute.AnyRoute<ImageRequestFor, ImageEvent, ImageResponse>;
export declare class ImageModel<Options extends ImageOptions = ImageOptions> extends MediaModel<ImageRoute, Options> {
    protected readonly _ImageModel: void;
    /** The number of type arguments selects the kind: `<Options>`, `<Options, Frame, State>`, or `<Options, Token>`. */
    static fromRoute<Options extends ImageOptions>(route: MediaModel.InlineRouteInput<ImageRequestFor<Options>, ImageResponse>, input: MediaRoute.ModelInput): ImageModel<Options>;
    static fromRoute<Options extends ImageOptions, Frame, State>(route: MediaModel.StreamRouteInput<ImageRequestFor<Options>, ImageEvent, Frame, State>, input: MediaRoute.ModelInput): ImageModel<Options>;
    static fromRoute<Options extends ImageOptions, Token>(route: MediaModel.QueuedRouteInput<ImageRequestFor<Options>, ImageResponse, Token>, input: MediaRoute.ModelInput): ImageModel<Options>;
}
export declare const ImageModelSchema: Schema.declare<ImageModel<MediaModel.Options>, ImageModel<MediaModel.Options>>;
export type ImageSize = `${number}x${number}`;
export declare const ImageSize: Schema.declare<`${number}x${number}`, `${number}x${number}`>;
export type ImageAspectRatio = Media.AspectRatio;
export declare const ImageAspectRatio: Schema.declare<`${number}:${number}`, `${number}:${number}`>;
export type ImageFormat = OpenString<"png" | "jpeg" | "webp">;
declare const ImageRequest_base: Schema.Class<ImageRequest, Schema.Struct<{
    readonly model: Schema.declare<ImageModel<MediaModel.Options>, ImageModel<MediaModel.Options>>;
    readonly prompt: Schema.String;
    /** Edit sources or style/subject references, in order. */
    readonly images: Schema.optional<Schema.$Array<Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
        readonly source: Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"bytes">;
            readonly data: Schema.Uint8Array;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"base64">;
            readonly data: Schema.String;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"url">;
            readonly url: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
            readonly expiresAt: Schema.optional<Schema.Number>;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"ref">;
            readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
            readonly id: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
        }>]>;
        readonly info: Schema.optional<Schema.Struct<{
            readonly width: Schema.optional<Schema.Number>;
            readonly height: Schema.optional<Schema.Number>;
            readonly durationSeconds: Schema.optional<Schema.Number>;
            readonly sampleRate: Schema.optional<Schema.Number>;
            readonly channels: Schema.optional<Schema.Number>;
            readonly encoding: Schema.optional<Schema.String>;
            readonly format: Schema.optional<Schema.String>;
        }>>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, never, never>>>;
    /** Inpainting mask; routes that cannot honor it fail with `UnsupportedOperation`. */
    readonly mask: Schema.optional<Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
        readonly source: Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"bytes">;
            readonly data: Schema.Uint8Array;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"base64">;
            readonly data: Schema.String;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"url">;
            readonly url: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
            readonly expiresAt: Schema.optional<Schema.Number>;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"ref">;
            readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
            readonly id: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
        }>]>;
        readonly info: Schema.optional<Schema.Struct<{
            readonly width: Schema.optional<Schema.Number>;
            readonly height: Schema.optional<Schema.Number>;
            readonly durationSeconds: Schema.optional<Schema.Number>;
            readonly sampleRate: Schema.optional<Schema.Number>;
            readonly channels: Schema.optional<Schema.Number>;
            readonly encoding: Schema.optional<Schema.String>;
            readonly format: Schema.optional<Schema.String>;
        }>>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, never, never>>;
    readonly n: Schema.optional<Schema.Int>;
    readonly size: Schema.optional<Schema.declare<`${number}x${number}`, `${number}x${number}`>>;
    readonly aspectRatio: Schema.optional<Schema.declare<`${number}:${number}`, `${number}:${number}`>>;
    readonly seed: Schema.optional<Schema.Number>;
    readonly format: Schema.optional<Schema.String>;
    readonly providerOptions: Schema.optional<Schema.$Record<Schema.String, Schema.Unknown>>;
    readonly http: Schema.optional<typeof HttpOptions>;
}>, {}>;
export declare class ImageRequest extends ImageRequest_base {
    protected readonly _ImageRequest: void;
}
export type ImageRequestFor<Options extends ImageOptions = ImageOptions> = Omit<ImageRequest, "model" | "providerOptions"> & {
    readonly model: ImageModel<Options>;
    readonly providerOptions?: Options;
};
export type ImageModelOptions<Model> = Model extends ImageModel<infer Options> ? Options : never;
export type ImageRequestInput<Model extends ImageModel = ImageModel> = Omit<ConstructorParameters<typeof ImageRequest>[0], "model" | "providerOptions" | "http"> & {
    readonly model: Model;
    readonly format?: ImageFormat;
    readonly providerOptions?: NoInfer<ImageModelOptions<Model>>;
    readonly http?: HttpOptions.Input;
};
declare const ImageResponse_base: Schema.Class<ImageResponse, Schema.Struct<{
    readonly images: Schema.$Array<Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
        readonly source: Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"bytes">;
            readonly data: Schema.Uint8Array;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"base64">;
            readonly data: Schema.String;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"url">;
            readonly url: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
            readonly expiresAt: Schema.optional<Schema.Number>;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"ref">;
            readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
            readonly id: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
        }>]>;
        readonly info: Schema.optional<Schema.Struct<{
            readonly width: Schema.optional<Schema.Number>;
            readonly height: Schema.optional<Schema.Number>;
            readonly durationSeconds: Schema.optional<Schema.Number>;
            readonly sampleRate: Schema.optional<Schema.Number>;
            readonly channels: Schema.optional<Schema.Number>;
            readonly encoding: Schema.optional<Schema.String>;
            readonly format: Schema.optional<Schema.String>;
        }>>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, never, never>>;
    readonly usage: Schema.optional<Schema.Union<readonly [Schema.Struct<{
        readonly type: Schema.Literal<"tokens">;
        readonly input: Schema.optional<Schema.Number>;
        readonly output: Schema.optional<Schema.Number>;
        readonly total: Schema.optional<Schema.Number>;
        readonly details: Schema.optional<Schema.$Record<Schema.String, Schema.Unknown>>;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"seconds">;
        readonly seconds: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"characters">;
        readonly characters: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"credits">;
        readonly credits: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"compute">;
        readonly seconds: Schema.Number;
    }>]>>;
    readonly notices: Schema.optional<Schema.$Array<Schema.Struct<{
        readonly type: Schema.Literals<readonly ["moderated", "filtered", "other"]>;
        readonly message: Schema.String;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>>>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>, {}>;
export declare class ImageResponse extends ImageResponse_base {
    get image(): Media.Asset;
}
/** The `index`-th lower-fidelity preview of an image still generating; the `image` event supersedes it. */
export declare const ImagePartialEvent: Schema.Struct<{
    readonly type: Schema.tag<"image-partial">;
    readonly index: Schema.Number;
    readonly image: Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
        readonly source: Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"bytes">;
            readonly data: Schema.Uint8Array;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"base64">;
            readonly data: Schema.String;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"url">;
            readonly url: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
            readonly expiresAt: Schema.optional<Schema.Number>;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"ref">;
            readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
            readonly id: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
        }>]>;
        readonly info: Schema.optional<Schema.Struct<{
            readonly width: Schema.optional<Schema.Number>;
            readonly height: Schema.optional<Schema.Number>;
            readonly durationSeconds: Schema.optional<Schema.Number>;
            readonly sampleRate: Schema.optional<Schema.Number>;
            readonly channels: Schema.optional<Schema.Number>;
            readonly encoding: Schema.optional<Schema.String>;
            readonly format: Schema.optional<Schema.String>;
        }>>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, never, never>;
}>;
export declare const ImageOutputEvent: Schema.Struct<{
    readonly type: Schema.tag<"image">;
    readonly index: Schema.Number;
    readonly image: Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
        readonly source: Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"bytes">;
            readonly data: Schema.Uint8Array;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"base64">;
            readonly data: Schema.String;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"url">;
            readonly url: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
            readonly expiresAt: Schema.optional<Schema.Number>;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"ref">;
            readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
            readonly id: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
        }>]>;
        readonly info: Schema.optional<Schema.Struct<{
            readonly width: Schema.optional<Schema.Number>;
            readonly height: Schema.optional<Schema.Number>;
            readonly durationSeconds: Schema.optional<Schema.Number>;
            readonly sampleRate: Schema.optional<Schema.Number>;
            readonly channels: Schema.optional<Schema.Number>;
            readonly encoding: Schema.optional<Schema.String>;
            readonly format: Schema.optional<Schema.String>;
        }>>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, never, never>;
}>;
export declare const ImageFinishEvent: Schema.Struct<{
    readonly type: Schema.tag<"finish">;
    readonly usage: Schema.optional<Schema.Union<readonly [Schema.Struct<{
        readonly type: Schema.Literal<"tokens">;
        readonly input: Schema.optional<Schema.Number>;
        readonly output: Schema.optional<Schema.Number>;
        readonly total: Schema.optional<Schema.Number>;
        readonly details: Schema.optional<Schema.$Record<Schema.String, Schema.Unknown>>;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"seconds">;
        readonly seconds: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"characters">;
        readonly characters: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"credits">;
        readonly credits: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"compute">;
        readonly seconds: Schema.Number;
    }>]>>;
    readonly notices: Schema.optional<Schema.$Array<Schema.Struct<{
        readonly type: Schema.Literals<readonly ["moderated", "filtered", "other"]>;
        readonly message: Schema.String;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>>>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>;
declare const imageEventTagged: Schema.toTaggedUnion<"type", readonly [Schema.Struct<{
    readonly type: Schema.tag<"generation-queued">;
    readonly id: Schema.String;
    readonly position: Schema.optional<Schema.Number>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"generation-progress">;
    readonly id: Schema.String;
    readonly progress: Schema.optional<Schema.Number>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"image-partial">;
    readonly index: Schema.Number;
    readonly image: Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
        readonly source: Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"bytes">;
            readonly data: Schema.Uint8Array;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"base64">;
            readonly data: Schema.String;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"url">;
            readonly url: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
            readonly expiresAt: Schema.optional<Schema.Number>;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"ref">;
            readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
            readonly id: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
        }>]>;
        readonly info: Schema.optional<Schema.Struct<{
            readonly width: Schema.optional<Schema.Number>;
            readonly height: Schema.optional<Schema.Number>;
            readonly durationSeconds: Schema.optional<Schema.Number>;
            readonly sampleRate: Schema.optional<Schema.Number>;
            readonly channels: Schema.optional<Schema.Number>;
            readonly encoding: Schema.optional<Schema.String>;
            readonly format: Schema.optional<Schema.String>;
        }>>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, never, never>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"image">;
    readonly index: Schema.Number;
    readonly image: Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
        readonly source: Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"bytes">;
            readonly data: Schema.Uint8Array;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"base64">;
            readonly data: Schema.String;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"url">;
            readonly url: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
            readonly expiresAt: Schema.optional<Schema.Number>;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"ref">;
            readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
            readonly id: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
        }>]>;
        readonly info: Schema.optional<Schema.Struct<{
            readonly width: Schema.optional<Schema.Number>;
            readonly height: Schema.optional<Schema.Number>;
            readonly durationSeconds: Schema.optional<Schema.Number>;
            readonly sampleRate: Schema.optional<Schema.Number>;
            readonly channels: Schema.optional<Schema.Number>;
            readonly encoding: Schema.optional<Schema.String>;
            readonly format: Schema.optional<Schema.String>;
        }>>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, never, never>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"finish">;
    readonly usage: Schema.optional<Schema.Union<readonly [Schema.Struct<{
        readonly type: Schema.Literal<"tokens">;
        readonly input: Schema.optional<Schema.Number>;
        readonly output: Schema.optional<Schema.Number>;
        readonly total: Schema.optional<Schema.Number>;
        readonly details: Schema.optional<Schema.$Record<Schema.String, Schema.Unknown>>;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"seconds">;
        readonly seconds: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"characters">;
        readonly characters: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"credits">;
        readonly credits: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"compute">;
        readonly seconds: Schema.Number;
    }>]>>;
    readonly notices: Schema.optional<Schema.$Array<Schema.Struct<{
        readonly type: Schema.Literals<readonly ["moderated", "filtered", "other"]>;
        readonly message: Schema.String;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>>>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>]>;
export declare const ImageEvent: Schema.Union<readonly [Schema.Struct<{
    readonly type: Schema.tag<"generation-queued">;
    readonly id: Schema.String;
    readonly position: Schema.optional<Schema.Number>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"generation-progress">;
    readonly id: Schema.String;
    readonly progress: Schema.optional<Schema.Number>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"image-partial">;
    readonly index: Schema.Number;
    readonly image: Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
        readonly source: Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"bytes">;
            readonly data: Schema.Uint8Array;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"base64">;
            readonly data: Schema.String;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"url">;
            readonly url: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
            readonly expiresAt: Schema.optional<Schema.Number>;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"ref">;
            readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
            readonly id: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
        }>]>;
        readonly info: Schema.optional<Schema.Struct<{
            readonly width: Schema.optional<Schema.Number>;
            readonly height: Schema.optional<Schema.Number>;
            readonly durationSeconds: Schema.optional<Schema.Number>;
            readonly sampleRate: Schema.optional<Schema.Number>;
            readonly channels: Schema.optional<Schema.Number>;
            readonly encoding: Schema.optional<Schema.String>;
            readonly format: Schema.optional<Schema.String>;
        }>>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, never, never>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"image">;
    readonly index: Schema.Number;
    readonly image: Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
        readonly source: Schema.Union<readonly [Schema.Struct<{
            readonly type: Schema.Literal<"bytes">;
            readonly data: Schema.Uint8Array;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"base64">;
            readonly data: Schema.String;
            readonly mediaType: Schema.String;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"url">;
            readonly url: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
            readonly expiresAt: Schema.optional<Schema.Number>;
        }>, Schema.Struct<{
            readonly type: Schema.Literal<"ref">;
            readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
            readonly id: Schema.String;
            readonly mediaType: Schema.optional<Schema.String>;
        }>]>;
        readonly info: Schema.optional<Schema.Struct<{
            readonly width: Schema.optional<Schema.Number>;
            readonly height: Schema.optional<Schema.Number>;
            readonly durationSeconds: Schema.optional<Schema.Number>;
            readonly sampleRate: Schema.optional<Schema.Number>;
            readonly channels: Schema.optional<Schema.Number>;
            readonly encoding: Schema.optional<Schema.String>;
            readonly format: Schema.optional<Schema.String>;
        }>>;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>, never, never>;
}>, Schema.Struct<{
    readonly type: Schema.tag<"finish">;
    readonly usage: Schema.optional<Schema.Union<readonly [Schema.Struct<{
        readonly type: Schema.Literal<"tokens">;
        readonly input: Schema.optional<Schema.Number>;
        readonly output: Schema.optional<Schema.Number>;
        readonly total: Schema.optional<Schema.Number>;
        readonly details: Schema.optional<Schema.$Record<Schema.String, Schema.Unknown>>;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"seconds">;
        readonly seconds: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"characters">;
        readonly characters: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"credits">;
        readonly credits: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"compute">;
        readonly seconds: Schema.Number;
    }>]>>;
    readonly notices: Schema.optional<Schema.$Array<Schema.Struct<{
        readonly type: Schema.Literals<readonly ["moderated", "filtered", "other"]>;
        readonly message: Schema.String;
        readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
    }>>>;
    readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
}>]> & {
    readonly discriminants: readonly ["generation-queued", "generation-progress", "image-partial", "image", "finish"];
    readonly cases: {
        "generation-queued": Schema.Struct<{
            readonly type: Schema.tag<"generation-queued">;
            readonly id: Schema.String;
            readonly position: Schema.optional<Schema.Number>;
        }>;
        "generation-progress": Schema.Struct<{
            readonly type: Schema.tag<"generation-progress">;
            readonly id: Schema.String;
            readonly progress: Schema.optional<Schema.Number>;
        }>;
        "image-partial": Schema.Struct<{
            readonly type: Schema.tag<"image-partial">;
            readonly index: Schema.Number;
            readonly image: Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
                readonly source: Schema.Union<readonly [Schema.Struct<{
                    readonly type: Schema.Literal<"bytes">;
                    readonly data: Schema.Uint8Array;
                    readonly mediaType: Schema.String;
                }>, Schema.Struct<{
                    readonly type: Schema.Literal<"base64">;
                    readonly data: Schema.String;
                    readonly mediaType: Schema.String;
                }>, Schema.Struct<{
                    readonly type: Schema.Literal<"url">;
                    readonly url: Schema.String;
                    readonly mediaType: Schema.optional<Schema.String>;
                    readonly expiresAt: Schema.optional<Schema.Number>;
                }>, Schema.Struct<{
                    readonly type: Schema.Literal<"ref">;
                    readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
                    readonly id: Schema.String;
                    readonly mediaType: Schema.optional<Schema.String>;
                }>]>;
                readonly info: Schema.optional<Schema.Struct<{
                    readonly width: Schema.optional<Schema.Number>;
                    readonly height: Schema.optional<Schema.Number>;
                    readonly durationSeconds: Schema.optional<Schema.Number>;
                    readonly sampleRate: Schema.optional<Schema.Number>;
                    readonly channels: Schema.optional<Schema.Number>;
                    readonly encoding: Schema.optional<Schema.String>;
                    readonly format: Schema.optional<Schema.String>;
                }>>;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>, never, never>;
        }>;
        image: Schema.Struct<{
            readonly type: Schema.tag<"image">;
            readonly index: Schema.Number;
            readonly image: Schema.decodeTo<Schema.declare<Media.Asset, Media.Asset>, Schema.Struct<{
                readonly source: Schema.Union<readonly [Schema.Struct<{
                    readonly type: Schema.Literal<"bytes">;
                    readonly data: Schema.Uint8Array;
                    readonly mediaType: Schema.String;
                }>, Schema.Struct<{
                    readonly type: Schema.Literal<"base64">;
                    readonly data: Schema.String;
                    readonly mediaType: Schema.String;
                }>, Schema.Struct<{
                    readonly type: Schema.Literal<"url">;
                    readonly url: Schema.String;
                    readonly mediaType: Schema.optional<Schema.String>;
                    readonly expiresAt: Schema.optional<Schema.Number>;
                }>, Schema.Struct<{
                    readonly type: Schema.Literal<"ref">;
                    readonly provider: Schema.brand<Schema.String, "AI.ProviderID">;
                    readonly id: Schema.String;
                    readonly mediaType: Schema.optional<Schema.String>;
                }>]>;
                readonly info: Schema.optional<Schema.Struct<{
                    readonly width: Schema.optional<Schema.Number>;
                    readonly height: Schema.optional<Schema.Number>;
                    readonly durationSeconds: Schema.optional<Schema.Number>;
                    readonly sampleRate: Schema.optional<Schema.Number>;
                    readonly channels: Schema.optional<Schema.Number>;
                    readonly encoding: Schema.optional<Schema.String>;
                    readonly format: Schema.optional<Schema.String>;
                }>>;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>, never, never>;
        }>;
        finish: Schema.Struct<{
            readonly type: Schema.tag<"finish">;
            readonly usage: Schema.optional<Schema.Union<readonly [Schema.Struct<{
                readonly type: Schema.Literal<"tokens">;
                readonly input: Schema.optional<Schema.Number>;
                readonly output: Schema.optional<Schema.Number>;
                readonly total: Schema.optional<Schema.Number>;
                readonly details: Schema.optional<Schema.$Record<Schema.String, Schema.Unknown>>;
            }>, Schema.Struct<{
                readonly type: Schema.Literal<"seconds">;
                readonly seconds: Schema.Number;
            }>, Schema.Struct<{
                readonly type: Schema.Literal<"characters">;
                readonly characters: Schema.Number;
            }>, Schema.Struct<{
                readonly type: Schema.Literal<"credits">;
                readonly credits: Schema.Number;
            }>, Schema.Struct<{
                readonly type: Schema.Literal<"compute">;
                readonly seconds: Schema.Number;
            }>]>>;
            readonly notices: Schema.optional<Schema.$Array<Schema.Struct<{
                readonly type: Schema.Literals<readonly ["moderated", "filtered", "other"]>;
                readonly message: Schema.String;
                readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
            }>>>;
            readonly providerMetadata: Schema.optional<Schema.$Record<Schema.String, Schema.$Record<Schema.String, Schema.Unknown>>>;
        }>;
    };
    readonly isAnyOf: <const Keys>(keys: readonly Keys[]) => (value: {
        readonly id: string;
        readonly type: "generation-queued";
        readonly position?: number | undefined;
    } | {
        readonly id: string;
        readonly type: "generation-progress";
        readonly progress?: number | undefined;
    } | {
        readonly type: "image-partial";
        readonly index: number;
        readonly image: Media.Asset;
    } | {
        readonly type: "image";
        readonly index: number;
        readonly image: Media.Asset;
    } | {
        readonly type: "finish";
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
    }) => value is Extract<{
        readonly id: string;
        readonly type: "generation-queued";
        readonly position?: number | undefined;
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly id: string;
        readonly type: "generation-progress";
        readonly progress?: number | undefined;
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly type: "image-partial";
        readonly index: number;
        readonly image: Media.Asset;
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly type: "image";
        readonly index: number;
        readonly image: Media.Asset;
    }, {
        readonly type: Keys;
    }> | Extract<{
        readonly type: "finish";
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
    }, {
        readonly type: Keys;
    }>;
    readonly guards: {
        "generation-queued": (u: unknown) => u is {
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        };
        "generation-progress": (u: unknown) => u is {
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        };
        "image-partial": (u: unknown) => u is {
            readonly type: "image-partial";
            readonly index: number;
            readonly image: Media.Asset;
        };
        image: (u: unknown) => u is {
            readonly type: "image";
            readonly index: number;
            readonly image: Media.Asset;
        };
        finish: (u: unknown) => u is {
            readonly type: "finish";
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
        };
    };
    readonly match: {
        <Cases extends {
            "generation-queued": (value: {
                readonly id: string;
                readonly type: "generation-queued";
                readonly position?: number | undefined;
            }) => any;
            "generation-progress": (value: {
                readonly id: string;
                readonly type: "generation-progress";
                readonly progress?: number | undefined;
            }) => any;
            "image-partial": (value: {
                readonly type: "image-partial";
                readonly index: number;
                readonly image: Media.Asset;
            }) => any;
            image: (value: {
                readonly type: "image";
                readonly index: number;
                readonly image: Media.Asset;
            }) => any;
            finish: (value: {
                readonly type: "finish";
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
            }) => any;
        }>(value: {
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        } | {
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        } | {
            readonly type: "image-partial";
            readonly index: number;
            readonly image: Media.Asset;
        } | {
            readonly type: "image";
            readonly index: number;
            readonly image: Media.Asset;
        } | {
            readonly type: "finish";
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
        }, cases: Cases): Cases[keyof Cases] extends (value: any) => infer R ? import("effect/Unify").Unify<R> : never;
        <Cases extends {
            "generation-queued": (value: {
                readonly id: string;
                readonly type: "generation-queued";
                readonly position?: number | undefined;
            }) => any;
            "generation-progress": (value: {
                readonly id: string;
                readonly type: "generation-progress";
                readonly progress?: number | undefined;
            }) => any;
            "image-partial": (value: {
                readonly type: "image-partial";
                readonly index: number;
                readonly image: Media.Asset;
            }) => any;
            image: (value: {
                readonly type: "image";
                readonly index: number;
                readonly image: Media.Asset;
            }) => any;
            finish: (value: {
                readonly type: "finish";
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
            }) => any;
        }>(cases: Cases): (value: {
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        } | {
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        } | {
            readonly type: "image-partial";
            readonly index: number;
            readonly image: Media.Asset;
        } | {
            readonly type: "image";
            readonly index: number;
            readonly image: Media.Asset;
        } | {
            readonly type: "finish";
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
        }) => Cases[keyof Cases] extends (value: any) => infer R ? import("effect/Unify").Unify<R> : never;
    };
    readonly matchOrElse: {
        <Cases extends {
            "generation-queued"?: ((value: {
                readonly id: string;
                readonly type: "generation-queued";
                readonly position?: number | undefined;
            }) => any) | undefined;
            "generation-progress"?: ((value: {
                readonly id: string;
                readonly type: "generation-progress";
                readonly progress?: number | undefined;
            }) => any) | undefined;
            "image-partial"?: ((value: {
                readonly type: "image-partial";
                readonly index: number;
                readonly image: Media.Asset;
            }) => any) | undefined;
            image?: ((value: {
                readonly type: "image";
                readonly index: number;
                readonly image: Media.Asset;
            }) => any) | undefined;
            finish?: ((value: {
                readonly type: "finish";
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
            }) => any) | undefined;
        } & { [K in Exclude<keyof Cases, "image" | "finish" | "generation-queued" | "generation-progress" | "image-partial">]: never; }, OrElse extends (value: Exclude<{
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly type: "image-partial";
            readonly index: number;
            readonly image: Media.Asset;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly type: "image";
            readonly index: number;
            readonly image: Media.Asset;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly type: "finish";
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
        }, {
            readonly type: keyof Cases;
        }>) => any>(value: {
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        } | {
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        } | {
            readonly type: "image-partial";
            readonly index: number;
            readonly image: Media.Asset;
        } | {
            readonly type: "image";
            readonly index: number;
            readonly image: Media.Asset;
        } | {
            readonly type: "finish";
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
        }, cases: Cases, orElse: OrElse): import("effect/Unify").Unify<{ [K_1 in keyof Cases]-?: NonNullable<Cases[K_1]> extends (...args: Array<any>) => infer R ? R : never; }[keyof Cases] | ReturnType<OrElse>>;
        <Cases extends {
            "generation-queued"?: ((value: {
                readonly id: string;
                readonly type: "generation-queued";
                readonly position?: number | undefined;
            }) => any) | undefined;
            "generation-progress"?: ((value: {
                readonly id: string;
                readonly type: "generation-progress";
                readonly progress?: number | undefined;
            }) => any) | undefined;
            "image-partial"?: ((value: {
                readonly type: "image-partial";
                readonly index: number;
                readonly image: Media.Asset;
            }) => any) | undefined;
            image?: ((value: {
                readonly type: "image";
                readonly index: number;
                readonly image: Media.Asset;
            }) => any) | undefined;
            finish?: ((value: {
                readonly type: "finish";
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
            }) => any) | undefined;
        } & { [K in Exclude<keyof Cases, "image" | "finish" | "generation-queued" | "generation-progress" | "image-partial">]: never; }, OrElse extends (value: Exclude<{
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly type: "image-partial";
            readonly index: number;
            readonly image: Media.Asset;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly type: "image";
            readonly index: number;
            readonly image: Media.Asset;
        }, {
            readonly type: keyof Cases;
        }> | Exclude<{
            readonly type: "finish";
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
        }, {
            readonly type: keyof Cases;
        }>) => any>(cases: Cases, orElse: OrElse): (value: {
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        } | {
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        } | {
            readonly type: "image-partial";
            readonly index: number;
            readonly image: Media.Asset;
        } | {
            readonly type: "image";
            readonly index: number;
            readonly image: Media.Asset;
        } | {
            readonly type: "finish";
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
        }) => import("effect/Unify").Unify<{ [K_1 in keyof Cases]-?: NonNullable<Cases[K_1]> extends (...args: Array<any>) => infer R ? R : never; }[keyof Cases] | ReturnType<OrElse>>;
    };
} & {
    is: {
        generationQueued: (u: unknown) => u is {
            readonly id: string;
            readonly type: "generation-queued";
            readonly position?: number | undefined;
        };
        generationProgress: (u: unknown) => u is {
            readonly id: string;
            readonly type: "generation-progress";
            readonly progress?: number | undefined;
        };
        imagePartial: (u: unknown) => u is {
            readonly type: "image-partial";
            readonly index: number;
            readonly image: Media.Asset;
        };
        image: (u: unknown) => u is {
            readonly type: "image";
            readonly index: number;
            readonly image: Media.Asset;
        };
        finish: (u: unknown) => u is {
            readonly type: "finish";
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
        };
    };
};
export type ImageEvent = Schema.Schema.Type<typeof imageEventTagged>;
export declare function request<const Model extends ImageModel>(input: ImageRequestInput<Model>): ImageRequestFor<ImageModelOptions<Model>>;
export declare function request(input: ImageRequest): ImageRequest;
export declare function generate<const Model extends ImageModel>(input: ImageRequest | ImageRequestInput<Model>, options?: AwaitOptions): Effect.Effect<ImageResponse, AIError, Service>;
export declare function stream<const Model extends ImageModel>(input: ImageRequest | ImageRequestInput<Model>, options?: AwaitOptions): Stream.Stream<ImageEvent, AIError, Service>;
/** Inline and streaming routes fail with `UnsupportedOperation`. */
export declare function start<const Model extends ImageModel>(input: ImageRequest | ImageRequestInput<Model>): Effect.Effect<Generation<ImageResponse>, AIError, Service>;
export declare const resume: (model: ImageModel, token: unknown) => Effect.Effect<Generation<ImageResponse>, AIError, Service>;
export declare const Image: {
    readonly request: typeof request;
    readonly generate: typeof generate;
    readonly stream: typeof stream;
    readonly start: typeof start;
    readonly resume: (model: ImageModel, token: unknown) => Effect.Effect<Generation<ImageResponse>, AIError, Service>;
};
export {};

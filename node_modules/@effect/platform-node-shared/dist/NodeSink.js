import * as Cause from "effect/Cause";
import * as Channel from "effect/Channel";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Pull from "effect/Pull";
import * as Sink from "effect/Sink";
/**
 * Creates a `Sink` that writes chunks to a Node writable stream, respecting
 * backpressure, mapping writable errors with `onError`, and ending the stream
 * on completion unless `endOnDone` is `false`.
 *
 * @category constructors
 * @since 4.0.0
 */
export const fromWritable = options => Sink.fromChannel(Channel.mapDone(fromWritableChannel(options), _ => [_]));
/**
 * Creates a `Channel` that pulls chunks from upstream and writes them to a
 * Node writable stream, respecting backpressure and optionally ending the
 * writable when upstream is done.
 *
 * @category constructors
 * @since 4.0.0
 */
export const fromWritableChannel = options => Channel.fromTransform(pull => {
  const writable = options.evaluate();
  return Effect.succeed(pullIntoWritable({
    ...options,
    writable,
    pull
  }));
});
/**
 * Writes Effect chunks into a Node writable stream.
 *
 * **When to use**
 *
 * Use to implement custom Node stream adapters that already have an upstream
 * pull and need direct control over a writable stream.
 *
 * **Details**
 *
 * The loop waits for `drain` when needed, fails on writable errors, and ends
 * the writable on upstream completion unless `endOnDone` is `false`.
 *
 * @category converting
 * @since 4.0.0
 */
export const pullIntoWritable = options => options.pull.pipe(Effect.flatMap(chunk => {
  let i = 0;
  return Effect.callback(function loop(resume) {
    for (; i < chunk.length;) {
      const success = options.writable.write(chunk[i++], options.encoding);
      if (!success) {
        options.writable.once("drain", () => loop(resume));
        return;
      }
    }
    resume(Effect.void);
  });
}), Effect.forever({
  disableYield: true
}), Effect.raceFirst(Effect.callback(resume => {
  const onError = error => resume(Effect.fail(options.onError(error)));
  options.writable.once("error", onError);
  return Effect.sync(() => {
    options.writable.off("error", onError);
  });
})), options.endOnDone !== false ? Pull.catchDone(_ => {
  if ("closed" in options.writable && options.writable.closed) {
    return Cause.done(_);
  }
  return Effect.callback(resume => {
    options.writable.once("finish", () => resume(Cause.done(_)));
    options.writable.end();
  });
}) : identity);
//# sourceMappingURL=NodeSink.js.map
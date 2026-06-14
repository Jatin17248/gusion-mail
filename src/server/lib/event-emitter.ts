import { EventEmitter } from "events";

class AppEventEmitter extends EventEmitter {}

const globalForEmitter = global as unknown as { emitter: AppEventEmitter };

export const appEventEmitter = globalForEmitter.emitter || new AppEventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEmitter.emitter = appEventEmitter;
}

import { constants } from "node:fs";
import { safeDenial, REPORTED } from "./appPolicy.mjs";

export function accessMode(flags = "r") {
  if (typeof flags === "string") {
    if (!/^(?:r|rs|sr|w|wx|xw|a|ax|xa|as|sa)\+?$/.test(flags)) throw safeDenial();
    return { read: ["r", "rs", "sr"].includes(flags) || flags.includes("+"),
      write: !["r", "rs", "sr"].includes(flags) };
  }
  if (!Number.isInteger(flags) || flags < 0) throw safeDenial();
  const access = flags & 3;
  const harmless = ["O_SYNC", "O_DSYNC", "O_NOFOLLOW", "O_NONBLOCK", "O_CLOEXEC", "O_DIRECTORY"]
    .reduce((mask, name) => mask | (constants[name] ?? 0), 0);
  return { read: access === 0 || access === 2, write: access !== 0 || (flags & ~harmless) !== 0 };
}
export function createDescriptorRegistry(report) {
  const descriptors = new Map(), handles = new WeakMap(), restores = [];
  const deny = (operation) => {
    report({ type: "ima2-e2e-file-denied", operation, category: "outside-fixture" });
    const error = safeDenial(); error[REPORTED] = true; throw error;
  };
  const register = (fd, flags) => {
    if (!Number.isInteger(fd) || fd < 0) return deny("open");
    const entry = { fd, ...accessMode(flags) }; descriptors.set(fd, entry); return entry;
  };
  const check = (value, operation, mode = "read") => {
    const entry = typeof value === "number" ? descriptors.get(value) : handles.get(value);
    if (!entry || descriptors.get(entry.fd) !== entry || (mode !== "metadata" && !entry[mode])) return deny(operation);
    return entry;
  };
  const forget = (entry) => { if (descriptors.get(entry.fd) === entry) descriptors.delete(entry.fd); };
  const bindHandle = (handle, flags) => {
    const entry = register(handle.fd, flags); handles.set(handle, entry);
    handle.once?.("close", () => forget(entry));
    const wrap = (name, mode) => {
      const original = handle[name];
      if (typeof original !== "function") return;
      const descriptor = Object.getOwnPropertyDescriptor(handle, name);
      Object.defineProperty(handle, name, { configurable: true, writable: true, value: function (...args) {
        let current;
        try { current = check(handle, "FileHandle." + String(name), mode); }
        catch (error) { return ["createReadStream", "createWriteStream", "readLines", "readableWebStream"].includes(name) ? (() => { throw error; })() : Promise.reject(error); }
        if (name === "close") {
          return Promise.resolve().then(() => Reflect.apply(original, handle, args)).finally(() => forget(current));
        }
        return Reflect.apply(original, handle, args);
      } });
      restores.push(() => descriptor ? Object.defineProperty(handle, name, descriptor) : Reflect.deleteProperty(handle, name));
    };
    for (const name of ["read", "readv", "readFile", "readLines", "createReadStream", "readableWebStream"]) wrap(name, "read");
    for (const name of ["write", "writev", "writeFile", "appendFile", "truncate", "chmod", "chown", "utimes", "createWriteStream"]) wrap(name, "write");
    for (const name of ["stat", "datasync", "sync", "close"]) wrap(name, "metadata");
    return handle;
  };
  return { register, check, forget, bindHandle,
    restore() { for (const restore of restores.reverse()) restore(); descriptors.clear(); },
  };
}

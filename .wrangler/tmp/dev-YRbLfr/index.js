var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// .wrangler/tmp/bundle-FEClqE/checked-fetch.js
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
var urls;
var init_checked_fetch = __esm({
  ".wrangler/tmp/bundle-FEClqE/checked-fetch.js"() {
    "use strict";
    urls = /* @__PURE__ */ new Set();
    __name(checkURL, "checkURL");
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        const [request, init] = argArray;
        checkURL(request, init);
        return Reflect.apply(target, thisArg, argArray);
      }
    });
  }
});

// .wrangler/tmp/bundle-FEClqE/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
var init_strip_cf_connecting_ip_header = __esm({
  ".wrangler/tmp/bundle-FEClqE/strip-cf-connecting-ip-header.js"() {
    "use strict";
    __name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        return Reflect.apply(target, thisArg, [
          stripCfConnectingIPHeader.apply(null, argArray)
        ]);
      }
    });
  }
});

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
  }
});

// node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// src/lib/crypto.ts
var crypto_exports = {};
__export(crypto_exports, {
  decryptCredentials: () => decryptCredentials,
  encryptCredentials: () => encryptCredentials
});
async function encryptCredentials(plaintext, key) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoder.encode(plaintext)
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}
async function decryptCredentials(encrypted, key) {
  const decoder = new TextDecoder();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    "AES-GCM",
    false,
    ["decrypt"]
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    ciphertext
  );
  return decoder.decode(plaintext);
}
var init_crypto = __esm({
  "src/lib/crypto.ts"() {
    "use strict";
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    __name(encryptCredentials, "encryptCredentials");
    __name(decryptCredentials, "decryptCredentials");
  }
});

// .wrangler/tmp/bundle-FEClqE/middleware-loader.entry.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// .wrangler/tmp/bundle-FEClqE/middleware-insertion-facade.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// src/index.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/hono/dist/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/hono/dist/hono.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/hono/dist/hono-base.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/hono/dist/compose.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/context.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/hono/dist/request.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/hono/dist/http-exception.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/hono/dist/request/constants.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var GET_MATCH_RESULT = Symbol();

// node_modules/hono/dist/utils/body.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const path = url.slice(start, queryIndex === -1 ? void 0 : queryIndex);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = /* @__PURE__ */ __name(class {
  raw;
  #validatedData;
  #matchResult;
  routeIndex = 0;
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return this.bodyCache.parsedBody ??= await parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  text() {
    return this.#cachedBody("text");
  }
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  blob() {
    return this.#cachedBody("blob");
  }
  formData() {
    return this.#cachedBody("formData");
  }
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
}, "HonoRequest");

// node_modules/hono/dist/utils/html.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var Context = /* @__PURE__ */ __name(class {
  #rawRequest;
  #req;
  env = {};
  #var;
  finalized = false;
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  get res() {
    return this.#res ||= new Response(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  set res(_res) {
    if (this.#res && _res) {
      _res = new Response(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  setLayout = (layout) => this.#layout = layout;
  getLayout = () => this.#layout;
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = new Response(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return new Response(data, { status, headers: responseHeaders });
  }
  newResponse = (...args) => this.#newResponse(...args);
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  notFound = () => {
    this.#notFoundHandler ??= () => new Response();
    return this.#notFoundHandler(this);
  };
}, "Context");

// node_modules/hono/dist/router.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = /* @__PURE__ */ __name(class extends Error {
}, "UnsupportedPathError");

// node_modules/hono/dist/utils/constants.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = /* @__PURE__ */ __name(class {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  router;
  getPath;
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  errorHandler = errorHandler;
  route(path, app7) {
    const subApp = this.basePath(path);
    app7.routes.map((r) => {
      let handler;
      if (app7.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app7.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
}, "Hono");

// node_modules/hono/dist/router/reg-exp-router/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/hono/dist/router/reg-exp-router/router.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/hono/dist/router/reg-exp-router/matcher.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }, "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = /* @__PURE__ */ __name(class {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
}, "Node");

// node_modules/hono/dist/router/reg-exp-router/trie.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var Trie = /* @__PURE__ */ __name(class {
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
}, "Trie");

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = /* @__PURE__ */ __name(class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
}, "RegExpRouter");

// node_modules/hono/dist/router/reg-exp-router/prepared-router.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/hono/dist/router/smart-router/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/hono/dist/router/smart-router/router.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var SmartRouter = /* @__PURE__ */ __name(class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
}, "SmartRouter");

// node_modules/hono/dist/router/trie-router/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/hono/dist/router/trie-router/router.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/hono/dist/router/trie-router/node.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var emptyParams = /* @__PURE__ */ Object.create(null);
var Node2 = /* @__PURE__ */ __name(class {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #getHandlerSets(node, method, nodeParams, params) {
    const handlerSets = [];
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
    return handlerSets;
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              handlerSets.push(
                ...this.#getHandlerSets(nextNode.#children["*"], method, node.#params)
              );
            }
            handlerSets.push(...this.#getHandlerSets(nextNode, method, node.#params));
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              handlerSets.push(...this.#getHandlerSets(astNode, method, node.#params));
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          const restPathString = parts.slice(i).join("/");
          if (matcher instanceof RegExp) {
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              handlerSets.push(...this.#getHandlerSets(child, method, node.#params, params));
              if (Object.keys(child.#children).length) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              handlerSets.push(...this.#getHandlerSets(child, method, params, node.#params));
              if (child.#children["*"]) {
                handlerSets.push(
                  ...this.#getHandlerSets(child.#children["*"], method, params, node.#params)
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      curNodes = tempNodes.concat(curNodesQueue.shift() ?? []);
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
}, "Node");

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = /* @__PURE__ */ __name(class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
}, "TrieRouter");

// node_modules/hono/dist/hono.js
var Hono2 = /* @__PURE__ */ __name(class extends Hono {
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
}, "Hono");

// node_modules/hono/dist/middleware/cors/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var cors = /* @__PURE__ */ __name((options) => {
  const defaults = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: []
  };
  const opts = {
    ...defaults,
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// src/api/volitions.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// src/db.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var DB = class {
  constructor(d1) {
    this.d1 = d1;
  }
  // Volitions
  async getVolition(id) {
    const result = await this.d1.prepare("SELECT * FROM volitions WHERE id = ?").bind(id).first();
    return result || null;
  }
  async listVolitions(filters = {}) {
    let query = "SELECT * FROM volitions";
    const conditions = [];
    const params = [];
    if (filters.root_only) {
      conditions.push("parent_id IS NULL");
    } else if (filters.parent_id) {
      conditions.push("parent_id = ?");
      params.push(filters.parent_id);
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY created_at DESC";
    if (filters.limit) {
      query += " LIMIT ?";
      params.push(filters.limit);
    }
    if (filters.offset) {
      query += " OFFSET ?";
      params.push(filters.offset);
    }
    const stmt = this.d1.prepare(query).bind(...params);
    const result = await stmt.all();
    return result.results || [];
  }
  async createVolition(data) {
    const id = crypto.randomUUID();
    await this.d1.prepare(
      "INSERT INTO volitions (id, name, description, parent_id) VALUES (?, ?, ?, ?)"
    ).bind(id, data.name, data.description || null, data.parent_id || null).run();
    return await this.getVolition(id);
  }
  async updateVolition(id, data) {
    const updates = [];
    const params = [];
    if (data.name !== void 0) {
      updates.push("name = ?");
      params.push(data.name);
    }
    if (data.description !== void 0) {
      updates.push("description = ?");
      params.push(data.description);
    }
    if (data.parent_id !== void 0) {
      updates.push("parent_id = ?");
      params.push(data.parent_id);
    }
    if (updates.length > 0) {
      params.push(id);
      await this.d1.prepare(`UPDATE volitions SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
    }
  }
  async deleteVolition(id) {
    await this.d1.prepare("DELETE FROM volitions WHERE id = ?").bind(id).run();
  }
  async getVolitionChildren(parentId) {
    return this.listVolitions({ parent_id: parentId });
  }
  async getVolitionDescendants(volitionId) {
    const query = `
      WITH RECURSIVE descendants AS (
        SELECT id FROM volitions WHERE id = ?
        UNION ALL
        SELECT v.id FROM volitions v
        JOIN descendants d ON v.parent_id = d.id
      )
      SELECT v.* FROM volitions v
      JOIN descendants d ON v.id = d.id
      WHERE v.id != ?
    `;
    const result = await this.d1.prepare(query).bind(volitionId, volitionId).all();
    return result.results || [];
  }
  // Entangled
  async getEntangled(id) {
    const result = await this.d1.prepare("SELECT * FROM entangled WHERE id = ?").bind(id).first();
    return result || null;
  }
  async listEntangled(filters = {}) {
    let query = "SELECT * FROM entangled";
    const params = [];
    if (filters.type) {
      query += " WHERE type = ?";
      params.push(filters.type);
    }
    query += " ORDER BY name ASC";
    if (filters.limit) {
      query += " LIMIT ?";
      params.push(filters.limit);
    }
    if (filters.offset) {
      query += " OFFSET ?";
      params.push(filters.offset);
    }
    const result = await this.d1.prepare(query).bind(...params).all();
    return result.results || [];
  }
  async createEntangled(data) {
    const id = crypto.randomUUID();
    const metadata = data.metadata ? JSON.stringify(data.metadata) : null;
    await this.d1.prepare("INSERT INTO entangled (id, name, type, metadata) VALUES (?, ?, ?, ?)").bind(id, data.name, data.type, metadata).run();
    return await this.getEntangled(id);
  }
  async updateEntangled(id, data) {
    const updates = [];
    const params = [];
    if (data.name !== void 0) {
      updates.push("name = ?");
      params.push(data.name);
    }
    if (data.metadata !== void 0) {
      updates.push("metadata = ?");
      params.push(JSON.stringify(data.metadata));
    }
    if (updates.length > 0) {
      params.push(id);
      await this.d1.prepare(`UPDATE entangled SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
    }
  }
  async deleteEntangled(id) {
    await this.d1.prepare("DELETE FROM entangled WHERE id = ?").bind(id).run();
  }
  // PASCI Matrix
  async getMatrix(volitionId) {
    const result = await this.d1.prepare(`
        SELECT ve.role, e.* FROM volition_entangled ve
        JOIN entangled e ON ve.entangled_id = e.id
        WHERE ve.volition_id = ?
        ORDER BY ve.role, e.name
      `).bind(volitionId).all();
    const matrix = {
      perform: [],
      accountable: [],
      control: [],
      support: [],
      informed: []
    };
    for (const row of result.results || []) {
      matrix[row.role].push({
        id: row.id,
        name: row.name,
        type: row.type,
        metadata: row.metadata,
        created_at: row.created_at
      });
    }
    return matrix;
  }
  async assignToMatrix(volitionId, entangledId, role) {
    await this.d1.prepare(
      "INSERT OR IGNORE INTO volition_entangled (volition_id, entangled_id, role) VALUES (?, ?, ?)"
    ).bind(volitionId, entangledId, role).run();
  }
  async removeFromMatrix(volitionId, entangledId, role) {
    await this.d1.prepare(
      "DELETE FROM volition_entangled WHERE volition_id = ? AND entangled_id = ? AND role = ?"
    ).bind(volitionId, entangledId, role).run();
  }
  // Qupts
  async getQupt(id) {
    const result = await this.d1.prepare("SELECT * FROM qupts WHERE id = ?").bind(id).first();
    return result || null;
  }
  async listQupts(filters = {}) {
    let query;
    const params = [];
    if (filters.volition_id && filters.recursive) {
      query = `
        WITH RECURSIVE descendants AS (
          SELECT id FROM volitions WHERE id = ?
          UNION ALL
          SELECT v.id FROM volitions v
          JOIN descendants d ON v.parent_id = d.id
        )
        SELECT q.* FROM qupts q
        JOIN descendants d ON q.volition_id = d.id
      `;
      params.push(filters.volition_id);
    } else {
      query = "SELECT * FROM qupts";
      const conditions = [];
      if (filters.volition_id) {
        conditions.push("volition_id = ?");
        params.push(filters.volition_id);
      }
      if (filters.entangled_id) {
        conditions.push("entangled_id = ?");
        params.push(filters.entangled_id);
      }
      if (filters.source) {
        conditions.push("source = ?");
        params.push(filters.source);
      }
      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
    }
    query += " ORDER BY created_at DESC";
    if (filters.limit) {
      query += " LIMIT ?";
      params.push(filters.limit);
    }
    if (filters.offset) {
      query += " OFFSET ?";
      params.push(filters.offset);
    }
    const result = await this.d1.prepare(query).bind(...params).all();
    return result.results || [];
  }
  async createQupt(data) {
    const id = crypto.randomUUID();
    const metadata = data.metadata ? JSON.stringify(data.metadata) : null;
    const createdAt = data.created_at || Math.floor(Date.now() / 1e3);
    await this.d1.prepare(`
        INSERT INTO qupts (id, volition_id, entangled_id, content, source, external_id, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
      id,
      data.volition_id,
      data.entangled_id || null,
      data.content,
      data.source,
      data.external_id || null,
      metadata,
      createdAt
    ).run();
    return await this.getQupt(id);
  }
  async batchCreateQupts(qupts) {
    const batch = qupts.map((q) => {
      const id = crypto.randomUUID();
      const metadata = q.metadata ? JSON.stringify(q.metadata) : null;
      const createdAt = q.created_at || Math.floor(Date.now() / 1e3);
      return this.d1.prepare(`
          INSERT OR IGNORE INTO qupts (id, volition_id, entangled_id, content, source, external_id, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
        id,
        q.volition_id,
        q.entangled_id || null,
        q.content,
        q.source,
        q.external_id || null,
        metadata,
        createdAt
      );
    });
    await this.d1.batch(batch);
  }
  async deleteQupt(id) {
    await this.d1.prepare("DELETE FROM qupts WHERE id = ?").bind(id).run();
  }
  // Sources
  async getSource(id) {
    const result = await this.d1.prepare("SELECT * FROM sources WHERE id = ?").bind(id).first();
    return result || null;
  }
  async listSources(volitionId) {
    let query = "SELECT * FROM sources";
    const params = [];
    if (volitionId) {
      query += " WHERE volition_id = ?";
      params.push(volitionId);
    }
    query += " ORDER BY created_at DESC";
    const result = await this.d1.prepare(query).bind(...params).all();
    return result.results || [];
  }
  async getEnabledSources() {
    const result = await this.d1.prepare("SELECT * FROM sources WHERE enabled = 1").all();
    return result.results || [];
  }
  async createSource(data) {
    const id = crypto.randomUUID();
    const config = JSON.stringify(data.config);
    const credentials = data.credentials ? JSON.stringify(data.credentials) : null;
    await this.d1.prepare(`
        INSERT INTO sources (id, volition_id, type, config, credentials)
        VALUES (?, ?, ?, ?, ?)
      `).bind(id, data.volition_id, data.type, config, credentials).run();
    return await this.getSource(id);
  }
  async updateSource(id, data) {
    const updates = [];
    const params = [];
    if (data.config !== void 0) {
      updates.push("config = ?");
      params.push(JSON.stringify(data.config));
    }
    if (data.credentials !== void 0) {
      updates.push("credentials = ?");
      params.push(JSON.stringify(data.credentials));
    }
    if (data.enabled !== void 0) {
      updates.push("enabled = ?");
      params.push(data.enabled ? 1 : 0);
    }
    if (data.last_sync !== void 0) {
      updates.push("last_sync = ?");
      params.push(data.last_sync);
    }
    if (data.sync_cursor !== void 0) {
      updates.push("sync_cursor = ?");
      params.push(data.sync_cursor);
    }
    if (updates.length > 0) {
      params.push(id);
      await this.d1.prepare(`UPDATE sources SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
    }
  }
  async deleteSource(id) {
    await this.d1.prepare("DELETE FROM sources WHERE id = ?").bind(id).run();
  }
  // Dimensions
  async getDimension(id) {
    const result = await this.d1.prepare("SELECT * FROM dimensions WHERE id = ?").bind(id).first();
    return result || null;
  }
  async listDimensions() {
    const result = await this.d1.prepare("SELECT * FROM dimensions ORDER BY name").all();
    return result.results || [];
  }
  async getDimensionValues(dimensionId) {
    const result = await this.d1.prepare("SELECT * FROM dimension_values WHERE dimension_id = ? ORDER BY sort_order, label").bind(dimensionId).all();
    return result.results || [];
  }
  async getAllDimensionValues() {
    const result = await this.d1.prepare("SELECT * FROM dimension_values ORDER BY dimension_id, sort_order, label").all();
    return result.results || [];
  }
  // Volition Attributes
  async getVolitionAttributes(volitionId) {
    const result = await this.d1.prepare("SELECT * FROM volition_attributes WHERE volition_id = ?").bind(volitionId).all();
    return result.results || [];
  }
  async setVolitionAttributes(volitionId, attributes) {
    await this.d1.prepare("DELETE FROM volition_attributes WHERE volition_id = ?").bind(volitionId).run();
    if (attributes.length > 0) {
      const batch = attributes.map(
        (attr) => this.d1.prepare("INSERT INTO volition_attributes (volition_id, dimension_id, value_id) VALUES (?, ?, ?)").bind(volitionId, attr.dimension_id, attr.value_id)
      );
      await this.d1.batch(batch);
    }
  }
  async addVolitionAttribute(volitionId, dimensionId, valueId) {
    await this.d1.prepare("INSERT OR IGNORE INTO volition_attributes (volition_id, dimension_id, value_id) VALUES (?, ?, ?)").bind(volitionId, dimensionId, valueId).run();
  }
  async removeVolitionAttributes(volitionId, dimensionId) {
    await this.d1.prepare("DELETE FROM volition_attributes WHERE volition_id = ? AND dimension_id = ?").bind(volitionId, dimensionId).run();
  }
};
__name(DB, "DB");

// src/api/volitions.ts
var app = new Hono2();
app.get("/", async (c) => {
  const db = new DB(c.env.DB);
  const rootOnly = c.req.query("root_only") === "true";
  const parentId = c.req.query("parent_id");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")) : 20;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset")) : 0;
  const volitions = await db.listVolitions({
    root_only: rootOnly,
    parent_id: parentId,
    limit,
    offset
  });
  return c.json({ volitions });
});
app.get("/:id", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const volition = await db.getVolition(id);
  if (!volition) {
    return c.json({ error: { code: "NOT_FOUND", message: "Volition not found" } }, 404);
  }
  const children = await db.getVolitionChildren(id);
  const matrix = await db.getMatrix(id);
  const attributes = await db.getVolitionAttributes(id);
  const dimensions = await db.listDimensions();
  const dimensionValues = await db.getAllDimensionValues();
  const attributesMap = {};
  for (const attr of attributes) {
    const dimension = dimensions.find((d) => d.id === attr.dimension_id);
    const value = dimensionValues.find((v) => v.id === attr.value_id);
    if (dimension && value) {
      if (!attributesMap[dimension.name]) {
        attributesMap[dimension.name] = {
          dimension_id: dimension.id,
          label: dimension.label,
          values: []
        };
      }
      attributesMap[dimension.name].values.push({
        id: value.id,
        value: value.value,
        label: value.label
      });
    }
  }
  const includeChildren = c.req.query("include_children_qupts") !== "false";
  const quptsLimit = c.req.query("qupts_limit") ? parseInt(c.req.query("qupts_limit")) : 20;
  const qupts = await db.listQupts({
    volition_id: id,
    recursive: includeChildren,
    limit: quptsLimit
  });
  return c.json({
    ...volition,
    attributes: attributesMap,
    matrix,
    children: children.map((child) => ({
      id: child.id,
      name: child.name,
      created_at: child.created_at
    })),
    qupts
  });
});
app.post("/", async (c) => {
  const db = new DB(c.env.DB);
  const body = await c.req.json();
  if (!body.name) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Name is required" } }, 400);
  }
  if (body.parent_id) {
    const parent = await db.getVolition(body.parent_id);
    if (!parent) {
      return c.json({ error: { code: "PARENT_NOT_FOUND", message: "Parent volition not found" } }, 404);
    }
  }
  const volition = await db.createVolition({
    name: body.name,
    description: body.description,
    parent_id: body.parent_id
  });
  return c.json(volition, 201);
});
app.patch("/:id", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const body = await c.req.json();
  const volition = await db.getVolition(id);
  if (!volition) {
    return c.json({ error: { code: "NOT_FOUND", message: "Volition not found" } }, 404);
  }
  if (body.parent_id !== void 0 && body.parent_id !== null) {
    const parent = await db.getVolition(body.parent_id);
    if (!parent) {
      return c.json({ error: { code: "PARENT_NOT_FOUND", message: "Parent volition not found" } }, 404);
    }
    const descendants = await db.getVolitionDescendants(id);
    if (descendants.some((d) => d.id === body.parent_id)) {
      return c.json({ error: { code: "CIRCULAR_REFERENCE", message: "Cannot set parent: would create circular reference" } }, 400);
    }
  }
  await db.updateVolition(id, {
    name: body.name,
    description: body.description,
    parent_id: body.parent_id
  });
  return c.json({ success: true });
});
app.delete("/:id", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const volition = await db.getVolition(id);
  if (!volition) {
    return c.json({ error: { code: "NOT_FOUND", message: "Volition not found" } }, 404);
  }
  await db.deleteVolition(id);
  return c.json({ success: true });
});
app.get("/:id/matrix", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const volition = await db.getVolition(id);
  if (!volition) {
    return c.json({ error: { code: "NOT_FOUND", message: "Volition not found" } }, 404);
  }
  const matrix = await db.getMatrix(id);
  return c.json({ volition_id: id, matrix });
});
app.post("/:id/matrix", async (c) => {
  const db = new DB(c.env.DB);
  const volitionId = c.req.param("id");
  const body = await c.req.json();
  if (!body.entangled_id || !body.role) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "entangled_id and role are required" } }, 400);
  }
  const validRoles = ["perform", "accountable", "control", "support", "informed"];
  if (!validRoles.includes(body.role)) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid role" } }, 400);
  }
  const volition = await db.getVolition(volitionId);
  if (!volition) {
    return c.json({ error: { code: "NOT_FOUND", message: "Volition not found" } }, 404);
  }
  const entangled = await db.getEntangled(body.entangled_id);
  if (!entangled) {
    return c.json({ error: { code: "NOT_FOUND", message: "Entangled entity not found" } }, 404);
  }
  if (body.role === "accountable") {
    const matrix = await db.getMatrix(volitionId);
    if (matrix.accountable.length > 0 && !matrix.accountable.some((e) => e.id === body.entangled_id)) {
      console.warn(`Multiple accountable entities on volition ${volitionId}`);
    }
  }
  await db.assignToMatrix(volitionId, body.entangled_id, body.role);
  return c.json({ success: true });
});
app.delete("/:id/matrix/:entangled_id/:role", async (c) => {
  const db = new DB(c.env.DB);
  const volitionId = c.req.param("id");
  const entangledId = c.req.param("entangled_id");
  const role = c.req.param("role");
  if (role === "accountable") {
    const matrix = await db.getMatrix(volitionId);
    if (matrix.accountable.length === 1 && matrix.accountable[0].id === entangledId) {
      return c.json({
        error: {
          code: "MATRIX_NO_ACCOUNTABLE",
          message: "Cannot remove last Accountable. Volition must have exactly one Accountable."
        }
      }, 400);
    }
  }
  await db.removeFromMatrix(volitionId, entangledId, role);
  return c.json({ success: true });
});
app.get("/:id/attributes", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const volition = await db.getVolition(id);
  if (!volition) {
    return c.json({ error: { code: "NOT_FOUND", message: "Volition not found" } }, 404);
  }
  const attributes = await db.getVolitionAttributes(id);
  const dimensions = await db.listDimensions();
  const dimensionValues = await db.getAllDimensionValues();
  const attributesMap = {};
  for (const attr of attributes) {
    const dimension = dimensions.find((d) => d.id === attr.dimension_id);
    const value = dimensionValues.find((v) => v.id === attr.value_id);
    if (dimension && value) {
      if (!attributesMap[dimension.name]) {
        attributesMap[dimension.name] = {
          dimension_id: dimension.id,
          label: dimension.label,
          values: []
        };
      }
      attributesMap[dimension.name].values.push({
        id: value.id,
        value: value.value,
        label: value.label
      });
    }
  }
  return c.json({ volition_id: id, attributes: attributesMap });
});
app.put("/:id/attributes", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const body = await c.req.json();
  if (!body.attributes || !Array.isArray(body.attributes)) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "attributes array is required" } }, 400);
  }
  const volition = await db.getVolition(id);
  if (!volition) {
    return c.json({ error: { code: "NOT_FOUND", message: "Volition not found" } }, 404);
  }
  const dimensions = await db.listDimensions();
  const dimensionValues = await db.getAllDimensionValues();
  const attributesToSet = [];
  for (const attr of body.attributes) {
    const dimension = dimensions.find((d) => d.name === attr.dimension);
    if (!dimension) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: `Unknown dimension: ${attr.dimension}` } }, 400);
    }
    const value = dimensionValues.find((v) => v.dimension_id === dimension.id && v.value === attr.value);
    if (!value) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: `Unknown value: ${attr.value} for dimension ${attr.dimension}` } }, 400);
    }
    attributesToSet.push({ dimension_id: dimension.id, value_id: value.id });
  }
  await db.setVolitionAttributes(id, attributesToSet);
  return c.json({ success: true });
});
app.post("/:id/attributes", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const body = await c.req.json();
  if (!body.dimension || !body.value) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "dimension and value are required" } }, 400);
  }
  const volition = await db.getVolition(id);
  if (!volition) {
    return c.json({ error: { code: "NOT_FOUND", message: "Volition not found" } }, 404);
  }
  const dimensions = await db.listDimensions();
  const dimensionValues = await db.getAllDimensionValues();
  const dimension = dimensions.find((d) => d.name === body.dimension);
  if (!dimension) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: `Unknown dimension: ${body.dimension}` } }, 400);
  }
  const value = dimensionValues.find((v) => v.dimension_id === dimension.id && v.value === body.value);
  if (!value) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: `Unknown value: ${body.value} for dimension ${body.dimension}` } }, 400);
  }
  await db.addVolitionAttribute(id, dimension.id, value.id);
  return c.json({ success: true });
});
app.delete("/:id/attributes/:dimension_id", async (c) => {
  const db = new DB(c.env.DB);
  const volitionId = c.req.param("id");
  const dimensionId = c.req.param("dimension_id");
  await db.removeVolitionAttributes(volitionId, dimensionId);
  return c.json({ success: true });
});
app.get("/:id/sources", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const volition = await db.getVolition(id);
  if (!volition) {
    return c.json({ error: { code: "NOT_FOUND", message: "Volition not found" } }, 404);
  }
  const sources = await db.listSources(id);
  const sanitizedSources = sources.map((s) => ({
    id: s.id,
    volition_id: s.volition_id,
    type: s.type,
    config: s.config,
    enabled: s.enabled,
    last_sync: s.last_sync,
    created_at: s.created_at
  }));
  return c.json({ sources: sanitizedSources });
});
app.post("/:id/sources", async (c) => {
  const db = new DB(c.env.DB);
  const volitionId = c.req.param("id");
  const body = await c.req.json();
  if (!body.type || !body.config) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "type and config are required" } }, 400);
  }
  const volition = await db.getVolition(volitionId);
  if (!volition) {
    return c.json({ error: { code: "NOT_FOUND", message: "Volition not found" } }, 404);
  }
  let credentials = body.credentials;
  if (credentials && c.env.ENCRYPTION_KEY) {
    const { encryptCredentials: encryptCredentials2 } = await Promise.resolve().then(() => (init_crypto(), crypto_exports));
    credentials = await encryptCredentials2(JSON.stringify(credentials), c.env.ENCRYPTION_KEY);
  }
  const source = await db.createSource({
    volition_id: volitionId,
    type: body.type,
    config: body.config,
    credentials: credentials ? { encrypted: credentials } : void 0
  });
  return c.json({
    id: source.id,
    volition_id: source.volition_id,
    type: source.type,
    config: source.config,
    enabled: source.enabled,
    created_at: source.created_at
  }, 201);
});
var volitions_default = app;

// src/api/entangled.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var app2 = new Hono2();
app2.get("/", async (c) => {
  const db = new DB(c.env.DB);
  const type = c.req.query("type");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")) : 20;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset")) : 0;
  const entangled = await db.listEntangled({ type, limit, offset });
  return c.json({ entangled });
});
app2.get("/:id", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const entangled = await db.getEntangled(id);
  if (!entangled) {
    return c.json({ error: { code: "NOT_FOUND", message: "Entangled entity not found" } }, 404);
  }
  return c.json(entangled);
});
app2.post("/", async (c) => {
  const db = new DB(c.env.DB);
  const body = await c.req.json();
  if (!body.name || !body.type) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "name and type are required" } }, 400);
  }
  if (!["human", "agent"].includes(body.type)) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "type must be human or agent" } }, 400);
  }
  const entangled = await db.createEntangled({
    name: body.name,
    type: body.type,
    metadata: body.metadata
  });
  return c.json(entangled, 201);
});
app2.patch("/:id", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const body = await c.req.json();
  const entangled = await db.getEntangled(id);
  if (!entangled) {
    return c.json({ error: { code: "NOT_FOUND", message: "Entangled entity not found" } }, 404);
  }
  await db.updateEntangled(id, {
    name: body.name,
    metadata: body.metadata
  });
  return c.json({ success: true });
});
app2.delete("/:id", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const entangled = await db.getEntangled(id);
  if (!entangled) {
    return c.json({ error: { code: "NOT_FOUND", message: "Entangled entity not found" } }, 404);
  }
  await db.deleteEntangled(id);
  return c.json({ success: true });
});
var entangled_default = app2;

// src/api/qupts.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var app3 = new Hono2();
app3.get("/", async (c) => {
  const db = new DB(c.env.DB);
  const volitionId = c.req.query("volition_id");
  const recursive = c.req.query("recursive") === "true";
  const entangledId = c.req.query("entangled_id");
  const source = c.req.query("source");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")) : 20;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset")) : 0;
  const qupts = await db.listQupts({
    volition_id: volitionId,
    recursive,
    entangled_id: entangledId,
    source,
    limit,
    offset
  });
  return c.json({ qupts, total: qupts.length, limit, offset });
});
app3.get("/:id", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const qupt = await db.getQupt(id);
  if (!qupt) {
    return c.json({ error: { code: "NOT_FOUND", message: "Qupt not found" } }, 404);
  }
  return c.json(qupt);
});
app3.post("/", async (c) => {
  const db = new DB(c.env.DB);
  const body = await c.req.json();
  if (!body.volition_id || !body.content) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "volition_id and content are required" } }, 400);
  }
  const volition = await db.getVolition(body.volition_id);
  if (!volition) {
    return c.json({ error: { code: "NOT_FOUND", message: "Volition not found" } }, 404);
  }
  if (body.entangled_id) {
    const entangled = await db.getEntangled(body.entangled_id);
    if (!entangled) {
      return c.json({ error: { code: "NOT_FOUND", message: "Entangled entity not found" } }, 404);
    }
  }
  const qupt = await db.createQupt({
    volition_id: body.volition_id,
    entangled_id: body.entangled_id,
    content: body.content,
    source: body.source || "manual",
    external_id: body.external_id,
    metadata: body.metadata
  });
  return c.json(qupt, 201);
});
app3.post("/batch", async (c) => {
  const db = new DB(c.env.DB);
  const body = await c.req.json();
  if (!body.qupts || !Array.isArray(body.qupts)) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "qupts array is required" } }, 400);
  }
  for (const qupt of body.qupts) {
    if (!qupt.volition_id || !qupt.content) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Each qupt must have volition_id and content" } }, 400);
    }
  }
  await db.batchCreateQupts(body.qupts);
  return c.json({ success: true, count: body.qupts.length }, 201);
});
app3.delete("/:id", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const qupt = await db.getQupt(id);
  if (!qupt) {
    return c.json({ error: { code: "NOT_FOUND", message: "Qupt not found" } }, 404);
  }
  await db.deleteQupt(id);
  return c.json({ success: true });
});
var qupts_default = app3;

// src/api/sources.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_crypto();
var app4 = new Hono2();
app4.get("/:id", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const source = await db.getSource(id);
  if (!source) {
    return c.json({ error: { code: "NOT_FOUND", message: "Source not found" } }, 404);
  }
  return c.json({
    id: source.id,
    volition_id: source.volition_id,
    type: source.type,
    config: source.config,
    enabled: source.enabled,
    last_sync: source.last_sync,
    created_at: source.created_at
  });
});
app4.patch("/:id", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const body = await c.req.json();
  const source = await db.getSource(id);
  if (!source) {
    return c.json({ error: { code: "NOT_FOUND", message: "Source not found" } }, 404);
  }
  let credentials = body.credentials;
  if (credentials && c.env.ENCRYPTION_KEY) {
    credentials = await encryptCredentials(JSON.stringify(credentials), c.env.ENCRYPTION_KEY);
  }
  await db.updateSource(id, {
    config: body.config,
    credentials: credentials ? { encrypted: credentials } : void 0,
    enabled: body.enabled
  });
  return c.json({ success: true });
});
app4.delete("/:id", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const source = await db.getSource(id);
  if (!source) {
    return c.json({ error: { code: "NOT_FOUND", message: "Source not found" } }, 404);
  }
  await db.deleteSource(id);
  return c.json({ success: true });
});
app4.post("/:id/sync", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const source = await db.getSource(id);
  if (!source) {
    return c.json({ error: { code: "NOT_FOUND", message: "Source not found" } }, 404);
  }
  return c.json({ success: true, message: "Sync triggered (not yet implemented)" });
});
var sources_default = app4;

// src/api/dimensions.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var app5 = new Hono2();
app5.get("/", async (c) => {
  const db = new DB(c.env.DB);
  const dimensions = await db.listDimensions();
  const allValues = await db.getAllDimensionValues();
  const result = dimensions.map((dim) => ({
    ...dim,
    values: allValues.filter((v) => v.dimension_id === dim.id)
  }));
  return c.json({ dimensions: result });
});
app5.get("/:id", async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param("id");
  const dimension = await db.getDimension(id);
  if (!dimension) {
    return c.json({ error: { code: "NOT_FOUND", message: "Dimension not found" } }, 404);
  }
  const values = await db.getDimensionValues(id);
  return c.json({ ...dimension, values });
});
var dimensions_default = app5;

// src/index.ts
var app6 = new Hono2();
app6.use("/*", cors());
app6.route("/api/volitions", volitions_default);
app6.route("/api/entangled", entangled_default);
app6.route("/api/qupts", qupts_default);
app6.route("/api/sources", sources_default);
app6.route("/api/dimensions", dimensions_default);
app6.all("/mcp", async (c) => {
  return c.json({ error: "MCP endpoint not yet implemented" }, 501);
});
app6.post("/webhook/:source_id", async (c) => {
  return c.json({ error: "Webhook endpoint not yet implemented" }, 501);
});
app6.get("/health", (c) => {
  return c.json({ status: "ok", service: "zoku" });
});
async function scheduled(event, env, ctx) {
  console.log("Scheduled handler triggered:", event.cron);
}
__name(scheduled, "scheduled");
var src_default = {
  fetch: app6.fetch,
  scheduled
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-scheduled.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var scheduled2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  const url = new URL(request.url);
  if (url.pathname === "/__scheduled") {
    const cron = url.searchParams.get("cron") ?? "";
    await middlewareCtx.dispatch("scheduled", { cron });
    return new Response("Ran scheduled event");
  }
  const resp = await middlewareCtx.next(request, env);
  if (request.headers.get("referer")?.endsWith("/__scheduled") && url.pathname === "/favicon.ico" && resp.status === 500) {
    return new Response(null, { status: 404 });
  }
  return resp;
}, "scheduled");
var middleware_scheduled_default = scheduled2;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-FEClqE/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_scheduled_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-FEClqE/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map

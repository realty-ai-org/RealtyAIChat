function cloneProps(props) {
  const propKeys = Object.keys(props);
  return propKeys.reduce((memo, k) => {
    const prop = props[k];
    memo[k] = Object.assign({}, prop);
    if (isObject$1(prop.value) && !isFunction(prop.value) && !Array.isArray(prop.value)) memo[k].value = Object.assign({}, prop.value);
    if (Array.isArray(prop.value)) memo[k].value = prop.value.slice(0);
    return memo;
  }, {});
}

function normalizePropDefs(props) {
  if (!props) return {};
  const propKeys = Object.keys(props);
  return propKeys.reduce((memo, k) => {
    const v = props[k];
    memo[k] = !(isObject$1(v) && "value" in v) ? {
      value: v
    } : v;
    memo[k].attribute || (memo[k].attribute = toAttribute(k));
    memo[k].parse = "parse" in memo[k] ? memo[k].parse : typeof memo[k].value !== "string";
    return memo;
  }, {});
}
function propValues(props) {
  const propKeys = Object.keys(props);
  return propKeys.reduce((memo, k) => {
    memo[k] = props[k].value;
    return memo;
  }, {});
}
function initializeProps(element, propDefinition) {
  const props = cloneProps(propDefinition),
        propKeys = Object.keys(propDefinition);
  propKeys.forEach(key => {
    const prop = props[key],
          attr = element.getAttribute(prop.attribute),
          value = element[key];
    if (attr) prop.value = prop.parse ? parseAttributeValue(attr) : attr;
    if (value != null) prop.value = Array.isArray(value) ? value.slice(0) : value;
    prop.reflect && reflect(element, prop.attribute, prop.value);
    Object.defineProperty(element, key, {
      get() {
        return prop.value;
      },

      set(val) {
        const oldValue = prop.value;
        prop.value = val;
        prop.reflect && reflect(this, prop.attribute, prop.value);

        for (let i = 0, l = this.__propertyChangedCallbacks.length; i < l; i++) {
          this.__propertyChangedCallbacks[i](key, val, oldValue);
        }
      },

      enumerable: true,
      configurable: true
    });
  });
  return props;
}
function parseAttributeValue(value) {
  if (!value) return;

  try {
    return JSON.parse(value);
  } catch (err) {
    return value;
  }
}
function reflect(node, attribute, value) {
  if (value == null || value === false) return node.removeAttribute(attribute);
  let reflect = JSON.stringify(value);
  node.__updating[attribute] = true;
  if (reflect === "true") reflect = "";
  node.setAttribute(attribute, reflect);
  Promise.resolve().then(() => delete node.__updating[attribute]);
}
function toAttribute(propName) {
  return propName.replace(/\.?([A-Z]+)/g, (x, y) => "-" + y.toLowerCase()).replace("_", "-").replace(/^-/, "");
}
function isObject$1(obj) {
  return obj != null && (typeof obj === "object" || typeof obj === "function");
}
function isFunction(val) {
  return Object.prototype.toString.call(val) === "[object Function]";
}
function isConstructor(f) {
  return typeof f === "function" && f.toString().indexOf("class") === 0;
}

let currentElement;
function createElementType(BaseElement, propDefinition) {
  const propKeys = Object.keys(propDefinition);
  return class CustomElement extends BaseElement {
    static get observedAttributes() {
      return propKeys.map(k => propDefinition[k].attribute);
    }

    constructor() {
      super();
      this.__initialized = false;
      this.__released = false;
      this.__releaseCallbacks = [];
      this.__propertyChangedCallbacks = [];
      this.__updating = {};
      this.props = {};
    }

    connectedCallback() {
      if (this.__initialized) return;
      this.__releaseCallbacks = [];
      this.__propertyChangedCallbacks = [];
      this.__updating = {};
      this.props = initializeProps(this, propDefinition);
      const props = propValues(this.props),
            ComponentType = this.Component,
            outerElement = currentElement;

      try {
        currentElement = this;
        this.__initialized = true;
        if (isConstructor(ComponentType)) new ComponentType(props, {
          element: this
        });else ComponentType(props, {
          element: this
        });
      } finally {
        currentElement = outerElement;
      }
    }

    async disconnectedCallback() {
      // prevent premature releasing when element is only temporarely removed from DOM
      await Promise.resolve();
      if (this.isConnected) return;
      this.__propertyChangedCallbacks.length = 0;
      let callback = null;

      while (callback = this.__releaseCallbacks.pop()) callback(this);

      delete this.__initialized;
      this.__released = true;
    }

    attributeChangedCallback(name, oldVal, newVal) {
      if (!this.__initialized) return;
      if (this.__updating[name]) return;
      name = this.lookupProp(name);

      if (name in propDefinition) {
        if (newVal == null && !this[name]) return;
        this[name] = propDefinition[name].parse ? parseAttributeValue(newVal) : newVal;
      }
    }

    lookupProp(attrName) {
      if (!propDefinition) return;
      return propKeys.find(k => attrName === k || attrName === propDefinition[k].attribute);
    }

    get renderRoot() {
      return this.shadowRoot || this.attachShadow({
        mode: "open"
      });
    }

    addReleaseCallback(fn) {
      this.__releaseCallbacks.push(fn);
    }

    addPropertyChangedCallback(fn) {
      this.__propertyChangedCallbacks.push(fn);
    }

  };
}

function register(tag, props = {}, options = {}) {
  const {
    BaseElement = HTMLElement,
    extension
  } = options;
  return ComponentType => {
    if (!tag) throw new Error("tag is required to register a Component");
    let ElementType = customElements.get(tag);

    if (ElementType) {
      // Consider disabling this in a production mode
      ElementType.prototype.Component = ComponentType;
      return ElementType;
    }

    ElementType = createElementType(BaseElement, normalizePropDefs(props));
    ElementType.prototype.Component = ComponentType;
    ElementType.prototype.registeredTag = tag;
    customElements.define(tag, ElementType, extension);
    return ElementType;
  };
}

const equalFn = (a, b) => a === b;
const $PROXY = Symbol("solid-proxy");
const $TRACK = Symbol("solid-track");
const signalOptions = {
  equals: equalFn
};
let runEffects = runQueue;
const STALE = 1;
const PENDING = 2;
const UNOWNED = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null
};
var Owner = null;
let Transition = null;
let Listener = null;
let Updates = null;
let Effects = null;
let ExecCount = 0;
function createRoot(fn, detachedOwner) {
  const listener = Listener,
    owner = Owner,
    unowned = fn.length === 0,
    root = unowned ? UNOWNED : {
      owned: null,
      cleanups: null,
      context: null,
      owner: detachedOwner === undefined ? owner : detachedOwner
    },
    updateFn = unowned ? fn : () => fn(() => untrack(() => cleanNode(root)));
  Owner = root;
  Listener = null;
  try {
    return runUpdates(updateFn, true);
  } finally {
    Listener = listener;
    Owner = owner;
  }
}
function createSignal(value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const s = {
    value,
    observers: null,
    observerSlots: null,
    comparator: options.equals || undefined
  };
  const setter = value => {
    if (typeof value === "function") {
      value = value(s.value);
    }
    return writeSignal(s, value);
  };
  return [readSignal.bind(s), setter];
}
function createRenderEffect(fn, value, options) {
  const c = createComputation(fn, value, false, STALE);
  updateComputation(c);
}
function createEffect(fn, value, options) {
  runEffects = runUserEffects;
  const c = createComputation(fn, value, false, STALE);
  c.user = true;
  Effects ? Effects.push(c) : updateComputation(c);
}
function createMemo(fn, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const c = createComputation(fn, value, true, 0);
  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || undefined;
  updateComputation(c);
  return readSignal.bind(c);
}
function untrack(fn) {
  if (Listener === null) return fn();
  const listener = Listener;
  Listener = null;
  try {
    return fn();
  } finally {
    Listener = listener;
  }
}
function onMount(fn) {
  createEffect(() => untrack(fn));
}
function onCleanup(fn) {
  if (Owner === null) ;else if (Owner.cleanups === null) Owner.cleanups = [fn];else Owner.cleanups.push(fn);
  return fn;
}
function readSignal() {
  if (this.sources && (this.state)) {
    if ((this.state) === STALE) updateComputation(this);else {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(this), false);
      Updates = updates;
    }
  }
  if (Listener) {
    const sSlot = this.observers ? this.observers.length : 0;
    if (!Listener.sources) {
      Listener.sources = [this];
      Listener.sourceSlots = [sSlot];
    } else {
      Listener.sources.push(this);
      Listener.sourceSlots.push(sSlot);
    }
    if (!this.observers) {
      this.observers = [Listener];
      this.observerSlots = [Listener.sources.length - 1];
    } else {
      this.observers.push(Listener);
      this.observerSlots.push(Listener.sources.length - 1);
    }
  }
  return this.value;
}
function writeSignal(node, value, isComp) {
  let current = node.value;
  if (!node.comparator || !node.comparator(current, value)) {
    node.value = value;
    if (node.observers && node.observers.length) {
      runUpdates(() => {
        for (let i = 0; i < node.observers.length; i += 1) {
          const o = node.observers[i];
          const TransitionRunning = Transition && Transition.running;
          if (TransitionRunning && Transition.disposed.has(o)) ;
          if (TransitionRunning ? !o.tState : !o.state) {
            if (o.pure) Updates.push(o);else Effects.push(o);
            if (o.observers) markDownstream(o);
          }
          if (!TransitionRunning) o.state = STALE;
        }
        if (Updates.length > 10e5) {
          Updates = [];
          if (false) ;
          throw new Error();
        }
      }, false);
    }
  }
  return value;
}
function updateComputation(node) {
  if (!node.fn) return;
  cleanNode(node);
  const owner = Owner,
    listener = Listener,
    time = ExecCount;
  Listener = Owner = node;
  runComputation(node, node.value, time);
  Listener = listener;
  Owner = owner;
}
function runComputation(node, value, time) {
  let nextValue;
  try {
    nextValue = node.fn(value);
  } catch (err) {
    if (node.pure) {
      {
        node.state = STALE;
        node.owned && node.owned.forEach(cleanNode);
        node.owned = null;
      }
    }
    node.updatedAt = time + 1;
    return handleError(err);
  }
  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.updatedAt != null && "observers" in node) {
      writeSignal(node, nextValue);
    } else node.value = nextValue;
    node.updatedAt = time;
  }
}
function createComputation(fn, init, pure, state = STALE, options) {
  const c = {
    fn,
    state: state,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: null,
    pure
  };
  if (Owner === null) ;else if (Owner !== UNOWNED) {
    {
      if (!Owner.owned) Owner.owned = [c];else Owner.owned.push(c);
    }
  }
  return c;
}
function runTop(node) {
  if ((node.state) === 0) return;
  if ((node.state) === PENDING) return lookUpstream(node);
  if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
  const ancestors = [node];
  while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
    if (node.state) ancestors.push(node);
  }
  for (let i = ancestors.length - 1; i >= 0; i--) {
    node = ancestors[i];
    if ((node.state) === STALE) {
      updateComputation(node);
    } else if ((node.state) === PENDING) {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(node, ancestors[0]), false);
      Updates = updates;
    }
  }
}
function runUpdates(fn, init) {
  if (Updates) return fn();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;else Effects = [];
  ExecCount++;
  try {
    const res = fn();
    completeUpdates(wait);
    return res;
  } catch (err) {
    if (!wait) Effects = null;
    Updates = null;
    handleError(err);
  }
}
function completeUpdates(wait) {
  if (Updates) {
    runQueue(Updates);
    Updates = null;
  }
  if (wait) return;
  const e = Effects;
  Effects = null;
  if (e.length) runUpdates(() => runEffects(e), false);
}
function runQueue(queue) {
  for (let i = 0; i < queue.length; i++) runTop(queue[i]);
}
function runUserEffects(queue) {
  let i,
    userLength = 0;
  for (i = 0; i < queue.length; i++) {
    const e = queue[i];
    if (!e.user) runTop(e);else queue[userLength++] = e;
  }
  for (i = 0; i < userLength; i++) runTop(queue[i]);
}
function lookUpstream(node, ignore) {
  node.state = 0;
  for (let i = 0; i < node.sources.length; i += 1) {
    const source = node.sources[i];
    if (source.sources) {
      const state = source.state;
      if (state === STALE) {
        if (source !== ignore && (!source.updatedAt || source.updatedAt < ExecCount)) runTop(source);
      } else if (state === PENDING) lookUpstream(source, ignore);
    }
  }
}
function markDownstream(node) {
  for (let i = 0; i < node.observers.length; i += 1) {
    const o = node.observers[i];
    if (!o.state) {
      o.state = PENDING;
      if (o.pure) Updates.push(o);else Effects.push(o);
      o.observers && markDownstream(o);
    }
  }
}
function cleanNode(node) {
  let i;
  if (node.sources) {
    while (node.sources.length) {
      const source = node.sources.pop(),
        index = node.sourceSlots.pop(),
        obs = source.observers;
      if (obs && obs.length) {
        const n = obs.pop(),
          s = source.observerSlots.pop();
        if (index < obs.length) {
          n.sourceSlots[s] = index;
          obs[index] = n;
          source.observerSlots[index] = s;
        }
      }
    }
  }
  if (node.owned) {
    for (i = node.owned.length - 1; i >= 0; i--) cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (i = node.cleanups.length - 1; i >= 0; i--) node.cleanups[i]();
    node.cleanups = null;
  }
  node.state = 0;
  node.context = null;
}
function handleError(err) {
  throw err;
}

const FALLBACK = Symbol("fallback");
function dispose(d) {
  for (let i = 0; i < d.length; i++) d[i]();
}
function mapArray(list, mapFn, options = {}) {
  let items = [],
    mapped = [],
    disposers = [],
    len = 0,
    indexes = mapFn.length > 1 ? [] : null;
  onCleanup(() => dispose(disposers));
  return () => {
    let newItems = list() || [],
      i,
      j;
    newItems[$TRACK];
    return untrack(() => {
      let newLen = newItems.length,
        newIndices,
        newIndicesNext,
        temp,
        tempdisposers,
        tempIndexes,
        start,
        end,
        newEnd,
        item;
      if (newLen === 0) {
        if (len !== 0) {
          dispose(disposers);
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
          indexes && (indexes = []);
        }
        if (options.fallback) {
          items = [FALLBACK];
          mapped[0] = createRoot(disposer => {
            disposers[0] = disposer;
            return options.fallback();
          });
          len = 1;
        }
      }
      else if (len === 0) {
        mapped = new Array(newLen);
        for (j = 0; j < newLen; j++) {
          items[j] = newItems[j];
          mapped[j] = createRoot(mapper);
        }
        len = newLen;
      } else {
        temp = new Array(newLen);
        tempdisposers = new Array(newLen);
        indexes && (tempIndexes = new Array(newLen));
        for (start = 0, end = Math.min(len, newLen); start < end && items[start] === newItems[start]; start++);
        for (end = len - 1, newEnd = newLen - 1; end >= start && newEnd >= start && items[end] === newItems[newEnd]; end--, newEnd--) {
          temp[newEnd] = mapped[end];
          tempdisposers[newEnd] = disposers[end];
          indexes && (tempIndexes[newEnd] = indexes[end]);
        }
        newIndices = new Map();
        newIndicesNext = new Array(newEnd + 1);
        for (j = newEnd; j >= start; j--) {
          item = newItems[j];
          i = newIndices.get(item);
          newIndicesNext[j] = i === undefined ? -1 : i;
          newIndices.set(item, j);
        }
        for (i = start; i <= end; i++) {
          item = items[i];
          j = newIndices.get(item);
          if (j !== undefined && j !== -1) {
            temp[j] = mapped[i];
            tempdisposers[j] = disposers[i];
            indexes && (tempIndexes[j] = indexes[i]);
            j = newIndicesNext[j];
            newIndices.set(item, j);
          } else disposers[i]();
        }
        for (j = start; j < newLen; j++) {
          if (j in temp) {
            mapped[j] = temp[j];
            disposers[j] = tempdisposers[j];
            if (indexes) {
              indexes[j] = tempIndexes[j];
              indexes[j](j);
            }
          } else mapped[j] = createRoot(mapper);
        }
        mapped = mapped.slice(0, len = newLen);
        items = newItems.slice(0);
      }
      return mapped;
    });
    function mapper(disposer) {
      disposers[j] = disposer;
      if (indexes) {
        const [s, set] = createSignal(j);
        indexes[j] = set;
        return mapFn(newItems[j], s);
      }
      return mapFn(newItems[j]);
    }
  };
}
function createComponent(Comp, props) {
  return untrack(() => Comp(props || {}));
}
function trueFn() {
  return true;
}
const propTraps = {
  get(_, property, receiver) {
    if (property === $PROXY) return receiver;
    return _.get(property);
  },
  has(_, property) {
    if (property === $PROXY) return true;
    return _.has(property);
  },
  set: trueFn,
  deleteProperty: trueFn,
  getOwnPropertyDescriptor(_, property) {
    return {
      configurable: true,
      enumerable: true,
      get() {
        return _.get(property);
      },
      set: trueFn,
      deleteProperty: trueFn
    };
  },
  ownKeys(_) {
    return _.keys();
  }
};
function resolveSource(s) {
  return !(s = typeof s === "function" ? s() : s) ? {} : s;
}
function mergeProps(...sources) {
  let proxy = false;
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    proxy = proxy || !!s && $PROXY in s;
    sources[i] = typeof s === "function" ? (proxy = true, createMemo(s)) : s;
  }
  if (proxy) {
    return new Proxy({
      get(property) {
        for (let i = sources.length - 1; i >= 0; i--) {
          const v = resolveSource(sources[i])[property];
          if (v !== undefined) return v;
        }
      },
      has(property) {
        for (let i = sources.length - 1; i >= 0; i--) {
          if (property in resolveSource(sources[i])) return true;
        }
        return false;
      },
      keys() {
        const keys = [];
        for (let i = 0; i < sources.length; i++) keys.push(...Object.keys(resolveSource(sources[i])));
        return [...new Set(keys)];
      }
    }, propTraps);
  }
  const target = {};
  for (let i = sources.length - 1; i >= 0; i--) {
    if (sources[i]) {
      const descriptors = Object.getOwnPropertyDescriptors(sources[i]);
      for (const key in descriptors) {
        if (key in target) continue;
        Object.defineProperty(target, key, {
          enumerable: true,
          get() {
            for (let i = sources.length - 1; i >= 0; i--) {
              const v = (sources[i] || {})[key];
              if (v !== undefined) return v;
            }
          }
        });
      }
    }
  }
  return target;
}
function splitProps(props, ...keys) {
  const blocked = new Set(keys.flat());
  if ($PROXY in props) {
    const res = keys.map(k => {
      return new Proxy({
        get(property) {
          return k.includes(property) ? props[property] : undefined;
        },
        has(property) {
          return k.includes(property) && property in props;
        },
        keys() {
          return k.filter(property => property in props);
        }
      }, propTraps);
    });
    res.push(new Proxy({
      get(property) {
        return blocked.has(property) ? undefined : props[property];
      },
      has(property) {
        return blocked.has(property) ? false : property in props;
      },
      keys() {
        return Object.keys(props).filter(k => !blocked.has(k));
      }
    }, propTraps));
    return res;
  }
  const descriptors = Object.getOwnPropertyDescriptors(props);
  keys.push(Object.keys(descriptors).filter(k => !blocked.has(k)));
  return keys.map(k => {
    const clone = {};
    for (let i = 0; i < k.length; i++) {
      const key = k[i];
      if (!(key in props)) continue;
      Object.defineProperty(clone, key, descriptors[key] ? descriptors[key] : {
        get() {
          return props[key];
        },
        set() {
          return true;
        },
        enumerable: true
      });
    }
    return clone;
  });
}

const narrowedError = name => `Stale read from <${name}>.`;
function For(props) {
  const fallback = "fallback" in props && {
    fallback: () => props.fallback
  };
  return createMemo(mapArray(() => props.each, props.children, fallback || undefined));
}
function Show(props) {
  const keyed = props.keyed;
  const condition = createMemo(() => props.when, undefined, {
    equals: (a, b) => keyed ? a === b : !a === !b
  });
  return createMemo(() => {
    const c = condition();
    if (c) {
      const child = props.children;
      const fn = typeof child === "function" && child.length > 0;
      return fn ? untrack(() => child(keyed ? c : () => {
        if (!untrack(condition)) throw narrowedError("Show");
        return props.when;
      })) : child;
    }
    return props.fallback;
  }, undefined, undefined);
}

const booleans = ["allowfullscreen", "async", "autofocus", "autoplay", "checked", "controls", "default", "disabled", "formnovalidate", "hidden", "indeterminate", "ismap", "loop", "multiple", "muted", "nomodule", "novalidate", "open", "playsinline", "readonly", "required", "reversed", "seamless", "selected"];
const Properties = /*#__PURE__*/new Set(["className", "value", "readOnly", "formNoValidate", "isMap", "noModule", "playsInline", ...booleans]);
const ChildProperties = /*#__PURE__*/new Set(["innerHTML", "textContent", "innerText", "children"]);
const Aliases = /*#__PURE__*/Object.assign(Object.create(null), {
  className: "class",
  htmlFor: "for"
});
const PropAliases = /*#__PURE__*/Object.assign(Object.create(null), {
  class: "className",
  formnovalidate: {
    $: "formNoValidate",
    BUTTON: 1,
    INPUT: 1
  },
  ismap: {
    $: "isMap",
    IMG: 1
  },
  nomodule: {
    $: "noModule",
    SCRIPT: 1
  },
  playsinline: {
    $: "playsInline",
    VIDEO: 1
  },
  readonly: {
    $: "readOnly",
    INPUT: 1,
    TEXTAREA: 1
  }
});
function getPropAlias(prop, tagName) {
  const a = PropAliases[prop];
  return typeof a === "object" ? a[tagName] ? a["$"] : undefined : a;
}
const DelegatedEvents = /*#__PURE__*/new Set(["beforeinput", "click", "dblclick", "contextmenu", "focusin", "focusout", "input", "keydown", "keyup", "mousedown", "mousemove", "mouseout", "mouseover", "mouseup", "pointerdown", "pointermove", "pointerout", "pointerover", "pointerup", "touchend", "touchmove", "touchstart"]);
const SVGNamespace = {
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace"
};

function reconcileArrays(parentNode, a, b) {
  let bLength = b.length,
    aEnd = a.length,
    bEnd = bLength,
    aStart = 0,
    bStart = 0,
    after = a[aEnd - 1].nextSibling,
    map = null;
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;
      while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart])) a[aStart].remove();
        aStart++;
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parentNode.insertBefore(b[--bEnd], node);
      a[aEnd] = b[bEnd];
    } else {
      if (!map) {
        map = new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart,
            sequence = 1,
            t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index) parentNode.insertBefore(b[bStart++], node);
          } else parentNode.replaceChild(b[bStart++], a[aStart++]);
        } else aStart++;
      } else a[aStart++].remove();
    }
  }
}

const $$EVENTS = "_$DX_DELEGATE";
function template(html, isCE, isSVG) {
  let node;
  const create = () => {
    const t = document.createElement("template");
    t.innerHTML = html;
    return isSVG ? t.content.firstChild.firstChild : t.content.firstChild;
  };
  const fn = isCE ? () => (node || (node = create())).cloneNode(true) : () => untrack(() => document.importNode(node || (node = create()), true));
  fn.cloneNode = fn;
  return fn;
}
function delegateEvents(eventNames, document = window.document) {
  const e = document[$$EVENTS] || (document[$$EVENTS] = new Set());
  for (let i = 0, l = eventNames.length; i < l; i++) {
    const name = eventNames[i];
    if (!e.has(name)) {
      e.add(name);
      document.addEventListener(name, eventHandler);
    }
  }
}
function setAttribute(node, name, value) {
  if (value == null) node.removeAttribute(name);else node.setAttribute(name, value);
}
function setAttributeNS(node, namespace, name, value) {
  if (value == null) node.removeAttributeNS(namespace, name);else node.setAttributeNS(namespace, name, value);
}
function className(node, value) {
  if (value == null) node.removeAttribute("class");else node.className = value;
}
function addEventListener$1(node, name, handler, delegate) {
  if (delegate) {
    if (Array.isArray(handler)) {
      node[`$$${name}`] = handler[0];
      node[`$$${name}Data`] = handler[1];
    } else node[`$$${name}`] = handler;
  } else if (Array.isArray(handler)) {
    const handlerFn = handler[0];
    node.addEventListener(name, handler[0] = e => handlerFn.call(node, handler[1], e));
  } else node.addEventListener(name, handler);
}
function classList(node, value, prev = {}) {
  const classKeys = Object.keys(value || {}),
    prevKeys = Object.keys(prev);
  let i, len;
  for (i = 0, len = prevKeys.length; i < len; i++) {
    const key = prevKeys[i];
    if (!key || key === "undefined" || value[key]) continue;
    toggleClassKey(node, key, false);
    delete prev[key];
  }
  for (i = 0, len = classKeys.length; i < len; i++) {
    const key = classKeys[i],
      classValue = !!value[key];
    if (!key || key === "undefined" || prev[key] === classValue || !classValue) continue;
    toggleClassKey(node, key, true);
    prev[key] = classValue;
  }
  return prev;
}
function style(node, value, prev) {
  if (!value) return prev ? setAttribute(node, "style") : value;
  const nodeStyle = node.style;
  if (typeof value === "string") return nodeStyle.cssText = value;
  typeof prev === "string" && (nodeStyle.cssText = prev = undefined);
  prev || (prev = {});
  value || (value = {});
  let v, s;
  for (s in prev) {
    value[s] == null && nodeStyle.removeProperty(s);
    delete prev[s];
  }
  for (s in value) {
    v = value[s];
    if (v !== prev[s]) {
      nodeStyle.setProperty(s, v);
      prev[s] = v;
    }
  }
  return prev;
}
function spread(node, props = {}, isSVG, skipChildren) {
  const prevProps = {};
  if (!skipChildren) {
    createRenderEffect(() => prevProps.children = insertExpression(node, props.children, prevProps.children));
  }
  createRenderEffect(() => props.ref && props.ref(node));
  createRenderEffect(() => assign(node, props, isSVG, true, prevProps, true));
  return prevProps;
}
function use(fn, element, arg) {
  return untrack(() => fn(element, arg));
}
function insert(parent, accessor, marker, initial) {
  if (marker !== undefined && !initial) initial = [];
  if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
  createRenderEffect(current => insertExpression(parent, accessor(), current, marker), initial);
}
function assign(node, props, isSVG, skipChildren, prevProps = {}, skipRef = false) {
  props || (props = {});
  for (const prop in prevProps) {
    if (!(prop in props)) {
      if (prop === "children") continue;
      prevProps[prop] = assignProp(node, prop, null, prevProps[prop], isSVG, skipRef);
    }
  }
  for (const prop in props) {
    if (prop === "children") {
      if (!skipChildren) insertExpression(node, props.children);
      continue;
    }
    const value = props[prop];
    prevProps[prop] = assignProp(node, prop, value, prevProps[prop], isSVG, skipRef);
  }
}
function toPropertyName(name) {
  return name.toLowerCase().replace(/-([a-z])/g, (_, w) => w.toUpperCase());
}
function toggleClassKey(node, key, value) {
  const classNames = key.trim().split(/\s+/);
  for (let i = 0, nameLen = classNames.length; i < nameLen; i++) node.classList.toggle(classNames[i], value);
}
function assignProp(node, prop, value, prev, isSVG, skipRef) {
  let isCE, isProp, isChildProp, propAlias, forceProp;
  if (prop === "style") return style(node, value, prev);
  if (prop === "classList") return classList(node, value, prev);
  if (value === prev) return prev;
  if (prop === "ref") {
    if (!skipRef) value(node);
  } else if (prop.slice(0, 3) === "on:") {
    const e = prop.slice(3);
    prev && node.removeEventListener(e, prev);
    value && node.addEventListener(e, value);
  } else if (prop.slice(0, 10) === "oncapture:") {
    const e = prop.slice(10);
    prev && node.removeEventListener(e, prev, true);
    value && node.addEventListener(e, value, true);
  } else if (prop.slice(0, 2) === "on") {
    const name = prop.slice(2).toLowerCase();
    const delegate = DelegatedEvents.has(name);
    if (!delegate && prev) {
      const h = Array.isArray(prev) ? prev[0] : prev;
      node.removeEventListener(name, h);
    }
    if (delegate || value) {
      addEventListener$1(node, name, value, delegate);
      delegate && delegateEvents([name]);
    }
  } else if (prop.slice(0, 5) === "attr:") {
    setAttribute(node, prop.slice(5), value);
  } else if ((forceProp = prop.slice(0, 5) === "prop:") || (isChildProp = ChildProperties.has(prop)) || !isSVG && ((propAlias = getPropAlias(prop, node.tagName)) || (isProp = Properties.has(prop))) || (isCE = node.nodeName.includes("-"))) {
    if (forceProp) {
      prop = prop.slice(5);
      isProp = true;
    }
    if (prop === "class" || prop === "className") className(node, value);else if (isCE && !isProp && !isChildProp) node[toPropertyName(prop)] = value;else node[propAlias || prop] = value;
  } else {
    const ns = isSVG && prop.indexOf(":") > -1 && SVGNamespace[prop.split(":")[0]];
    if (ns) setAttributeNS(node, ns, prop, value);else setAttribute(node, Aliases[prop] || prop, value);
  }
  return value;
}
function eventHandler(e) {
  const key = `$$${e.type}`;
  let node = e.composedPath && e.composedPath()[0] || e.target;
  if (e.target !== node) {
    Object.defineProperty(e, "target", {
      configurable: true,
      value: node
    });
  }
  Object.defineProperty(e, "currentTarget", {
    configurable: true,
    get() {
      return node || document;
    }
  });
  while (node) {
    const handler = node[key];
    if (handler && !node.disabled) {
      const data = node[`${key}Data`];
      data !== undefined ? handler.call(node, data, e) : handler.call(node, e);
      if (e.cancelBubble) return;
    }
    node = node._$host || node.parentNode || node.host;
  }
}
function insertExpression(parent, value, current, marker, unwrapArray) {
  while (typeof current === "function") current = current();
  if (value === current) return current;
  const t = typeof value,
    multi = marker !== undefined;
  parent = multi && current[0] && current[0].parentNode || parent;
  if (t === "string" || t === "number") {
    if (t === "number") value = value.toString();
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data = value;
      } else node = document.createTextNode(value);
      current = cleanChildren(parent, current, marker, node);
    } else {
      if (current !== "" && typeof current === "string") {
        current = parent.firstChild.data = value;
      } else current = parent.textContent = value;
    }
  } else if (value == null || t === "boolean") {
    current = cleanChildren(parent, current, marker);
  } else if (t === "function") {
    createRenderEffect(() => {
      let v = value();
      while (typeof v === "function") v = v();
      current = insertExpression(parent, v, current, marker);
    });
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    const currentArray = current && Array.isArray(current);
    if (normalizeIncomingArray(array, value, current, unwrapArray)) {
      createRenderEffect(() => current = insertExpression(parent, array, current, marker, true));
      return () => current;
    }
    if (array.length === 0) {
      current = cleanChildren(parent, current, marker);
      if (multi) return current;
    } else if (currentArray) {
      if (current.length === 0) {
        appendNodes(parent, array, marker);
      } else reconcileArrays(parent, current, array);
    } else {
      current && cleanChildren(parent);
      appendNodes(parent, array);
    }
    current = array;
  } else if (value instanceof Node) {
    if (Array.isArray(current)) {
      if (multi) return current = cleanChildren(parent, current, marker, value);
      cleanChildren(parent, current, null, value);
    } else if (current == null || current === "" || !parent.firstChild) {
      parent.appendChild(value);
    } else parent.replaceChild(value, parent.firstChild);
    current = value;
  } else console.warn(`Unrecognized value. Skipped inserting`, value);
  return current;
}
function normalizeIncomingArray(normalized, array, current, unwrap) {
  let dynamic = false;
  for (let i = 0, len = array.length; i < len; i++) {
    let item = array[i],
      prev = current && current[i];
    if (item instanceof Node) {
      normalized.push(item);
    } else if (item == null || item === true || item === false) ; else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
    } else if ((typeof item) === "function") {
      if (unwrap) {
        while (typeof item === "function") item = item();
        dynamic = normalizeIncomingArray(normalized, Array.isArray(item) ? item : [item], Array.isArray(prev) ? prev : [prev]) || dynamic;
      } else {
        normalized.push(item);
        dynamic = true;
      }
    } else {
      const value = String(item);
      if (prev && prev.nodeType === 3) {
        prev.data = value;
        normalized.push(prev);
      } else normalized.push(document.createTextNode(value));
    }
  }
  return dynamic;
}
function appendNodes(parent, array, marker = null) {
  for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
}
function cleanChildren(parent, current, marker, replacement) {
  if (marker === undefined) return parent.textContent = "";
  const node = replacement || document.createTextNode("");
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1; i >= 0; i--) {
      const el = current[i];
      if (node !== el) {
        const isParent = el.parentNode === parent;
        if (!inserted && !i) isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);else isParent && el.remove();
      } else inserted = true;
    }
  } else parent.insertBefore(node, marker);
  return [node];
}

function createProps(raw) {
    const keys = Object.keys(raw);
    const props = {};
    for (let i = 0; i < keys.length; i++) {
        const [get, set] = createSignal(raw[keys[i]]);
        Object.defineProperty(props, keys[i], {
            get,
            set(v) {
                set(() => v);
            }
        });
    }
    return props;
}
function lookupContext(el) {
    if (el.assignedSlot && el.assignedSlot._$owner)
        return el.assignedSlot._$owner;
    let next = el.parentNode;
    while (next &&
        !next._$owner &&
        !(next.assignedSlot && next.assignedSlot._$owner))
        next = next.parentNode;
    return next && next.assignedSlot
        ? next.assignedSlot._$owner
        : el._$owner;
}
function withSolid(ComponentType) {
    return (rawProps, options) => {
        const { element } = options;
        return createRoot((dispose) => {
            const props = createProps(rawProps);
            element.addPropertyChangedCallback((key, val) => (props[key] = val));
            element.addReleaseCallback(() => {
                element.renderRoot.textContent = "";
                dispose();
            });
            const comp = ComponentType(props, options);
            return insert(element.renderRoot, comp);
        }, lookupContext(element));
    };
}
function customElement(tag, props, ComponentType) {
    if (arguments.length === 2) {
        ComponentType = props;
        props = {};
    }
    return register(tag, props)(withSolid(ComponentType));
}

const defaultBotProps = {
  chatflowid: "",
  loadID: "",
  userID: "",
  includeQuestions: false,
  apiHost: undefined,
  chatflowConfig: undefined,
  theme: undefined,
  defaultOpenDesktop: false,
  defaultOpenMobile: false,
  delayOpenFlag: true,
  delayOpenSeconds: 10,
  stayClosedFlag: false,
  fullScreen: false,
  questions: [],
  maxPopups: 0,
  mobileQuestionFontSize: "10px",
  desktopQuestionFontSize: "12px",
  badgeText: undefined,
  popoutMessageConfig: undefined
};

var css_248z = "/*! tailwindcss v3.3.1 | MIT License | https://tailwindcss.com*/*,:after,:before{border:0 solid #e5e7eb;box-sizing:border-box}:after,:before{--tw-content:\"\"}html{-webkit-text-size-adjust:100%;font-feature-settings:normal;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;font-variation-settings:normal;line-height:1.5;-moz-tab-size:4;-o-tab-size:4;tab-size:4}body{line-height:inherit;margin:0}hr{border-top-width:1px;color:inherit;height:0}abbr:where([title]){-webkit-text-decoration:underline dotted;text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,pre,samp{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;font-size:1em}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}table{border-collapse:collapse;border-color:inherit;text-indent:0}button,input,optgroup,select,textarea{color:inherit;font-family:inherit;font-size:100%;font-weight:inherit;line-height:inherit;margin:0;padding:0}button,select{text-transform:none}[type=button],[type=reset],[type=submit],button{-webkit-appearance:button;background-color:transparent;background-image:none}:-moz-focusring{outline:auto}:-moz-ui-invalid{box-shadow:none}progress{vertical-align:baseline}::-webkit-inner-spin-button,::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}blockquote,dd,dl,figure,h1,h2,h3,h4,h5,h6,hr,p,pre{margin:0}fieldset{margin:0}fieldset,legend{padding:0}menu,ol,ul{list-style:none;margin:0;padding:0}textarea{resize:vertical}input::-moz-placeholder,textarea::-moz-placeholder{color:#9ca3af;opacity:1}input::placeholder,textarea::placeholder{color:#9ca3af;opacity:1}[role=button],button{cursor:pointer}:disabled{cursor:default}audio,canvas,embed,iframe,img,object,svg,video{display:block;vertical-align:middle}img,video{height:auto;max-width:100%}[hidden]{display:none}*,:after,:before{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-pan-x: ;--tw-pan-y: ;--tw-pinch-zoom: ;--tw-scroll-snap-strictness:proximity;--tw-ordinal: ;--tw-slashed-zero: ;--tw-numeric-figure: ;--tw-numeric-spacing: ;--tw-numeric-fraction: ;--tw-ring-inset: ;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;--tw-blur: ;--tw-brightness: ;--tw-contrast: ;--tw-grayscale: ;--tw-hue-rotate: ;--tw-invert: ;--tw-saturate: ;--tw-sepia: ;--tw-drop-shadow: ;--tw-backdrop-blur: ;--tw-backdrop-brightness: ;--tw-backdrop-contrast: ;--tw-backdrop-grayscale: ;--tw-backdrop-hue-rotate: ;--tw-backdrop-invert: ;--tw-backdrop-opacity: ;--tw-backdrop-saturate: ;--tw-backdrop-sepia: }::backdrop{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-pan-x: ;--tw-pan-y: ;--tw-pinch-zoom: ;--tw-scroll-snap-strictness:proximity;--tw-ordinal: ;--tw-slashed-zero: ;--tw-numeric-figure: ;--tw-numeric-spacing: ;--tw-numeric-fraction: ;--tw-ring-inset: ;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;--tw-blur: ;--tw-brightness: ;--tw-contrast: ;--tw-grayscale: ;--tw-hue-rotate: ;--tw-invert: ;--tw-saturate: ;--tw-sepia: ;--tw-drop-shadow: ;--tw-backdrop-blur: ;--tw-backdrop-brightness: ;--tw-backdrop-contrast: ;--tw-backdrop-grayscale: ;--tw-backdrop-hue-rotate: ;--tw-backdrop-invert: ;--tw-backdrop-opacity: ;--tw-backdrop-saturate: ;--tw-backdrop-sepia: }.pointer-events-none{pointer-events:none}.visible{visibility:visible}.fixed{position:fixed}.absolute{position:absolute}.relative{position:relative}.inset-0{inset:0}.bottom-10{bottom:40px}.bottom-24{bottom:96px}.bottom-28{bottom:112px}.left-\\[20px\\]{left:20px}.right-\\[-6px\\]{right:-6px}.right-\\[20px\\]{right:20px}.top-\\[-6px\\]{top:-6px}.z-10{z-index:10}.-ml-1{margin-left:-4px}.mb-2{margin-bottom:8px}.ml-1{margin-left:4px}.ml-2{margin-left:8px}.mr-1{margin-right:4px}.mr-2{margin-right:8px}.mr-3{margin-right:12px}.flex{display:flex}.hidden{display:none}.h-10{height:40px}.h-11{height:44px}.h-16{height:64px}.h-2{height:8px}.h-20{height:80px}.h-32{height:128px}.h-5{height:20px}.h-8{height:32px}.h-9{height:36px}.h-full{height:100%}.max-h-\\[704px\\]{max-height:704px}.min-h-full{min-height:100%}.w-10{width:40px}.w-11{width:44px}.w-16{width:64px}.w-2{width:8px}.w-20{width:80px}.w-5{width:20px}.w-60{width:240px}.w-8{width:32px}.w-9{width:36px}.w-full{width:100%}.min-w-full{min-width:100%}.max-w-full{max-width:100%}.flex-1{flex:1 1 0%}.flex-shrink-0{flex-shrink:0}.-rotate-180{--tw-rotate:-180deg}.-rotate-180,.rotate-0{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.rotate-0{--tw-rotate:0deg}.scale-0{--tw-scale-x:0;--tw-scale-y:0}.scale-0,.scale-100{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.scale-100{--tw-scale-x:1;--tw-scale-y:1}.transform{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}@keyframes fade-in{0%{opacity:0}to{opacity:1}}.animate-fade-in{animation:fade-in .3s ease-out}@keyframes spin{to{transform:rotate(1turn)}}.animate-spin{animation:spin 1s linear infinite}.cursor-pointer{cursor:pointer}.flex-col{flex-direction:column}.items-start{align-items:flex-start}.items-end{align-items:flex-end}.items-center{align-items:center}.justify-start{justify-content:flex-start}.justify-end{justify-content:flex-end}.justify-center{justify-content:center}.justify-between{justify-content:space-between}.gap-2{gap:8px}.gap-3{gap:12px}.overflow-hidden{overflow:hidden}.overflow-y-auto{overflow-y:auto}.overflow-y-scroll{overflow-y:scroll}.scroll-smooth{scroll-behavior:smooth}.whitespace-pre-wrap{white-space:pre-wrap}.rounded-full{border-radius:9999px}.rounded-lg{border-radius:8px}.border{border-width:1px}.bg-black{--tw-bg-opacity:1;background-color:rgb(0 0 0/var(--tw-bg-opacity))}.bg-transparent{background-color:transparent}.bg-opacity-50{--tw-bg-opacity:0.5}.bg-cover{background-size:cover}.bg-center{background-position:50%}.fill-transparent{fill:transparent}.stroke-2{stroke-width:2}.object-cover{-o-object-fit:cover;object-fit:cover}.p-4{padding:16px}.px-2{padding-left:8px;padding-right:8px}.px-3{padding-left:12px;padding-right:12px}.px-4{padding-left:16px;padding-right:16px}.py-1{padding-bottom:4px;padding-top:4px}.py-2{padding-bottom:8px;padding-top:8px}.py-3{padding-bottom:12px;padding-top:12px}.py-4{padding-bottom:16px;padding-top:16px}.pt-10{padding-top:40px}.text-left{text-align:left}.text-center{text-align:center}.text-base{font-size:16px;line-height:24px}.text-sm{font-size:14px;line-height:20px}.text-xl{font-size:20px;line-height:28px}.font-semibold{font-weight:600}.leading-4{line-height:16px}.text-white{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity))}.opacity-0{opacity:0}.opacity-100{opacity:1}.opacity-25{opacity:.25}.opacity-75{opacity:.75}.shadow-md{--tw-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1);--tw-shadow-colored:0 4px 6px -1px var(--tw-shadow-color),0 2px 4px -2px var(--tw-shadow-color)}.shadow-md,.shadow-xl{box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-xl{--tw-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1);--tw-shadow-colored:0 20px 25px -5px var(--tw-shadow-color),0 8px 10px -6px var(--tw-shadow-color)}.filter{filter:var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow)}.transition{transition-duration:.15s;transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,-webkit-backdrop-filter;transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter;transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter,-webkit-backdrop-filter;transition-timing-function:cubic-bezier(.4,0,.2,1)}.transition-all{transition-duration:.15s;transition-property:all;transition-timing-function:cubic-bezier(.4,0,.2,1)}.transition-opacity{transition-duration:.15s;transition-property:opacity;transition-timing-function:cubic-bezier(.4,0,.2,1)}.transition-transform{transition-duration:.15s;transition-property:transform;transition-timing-function:cubic-bezier(.4,0,.2,1)}.duration-100{transition-duration:.1s}.duration-200{transition-duration:.2s}.ease-out{transition-timing-function:cubic-bezier(0,0,.2,1)}:host{--chatbot-container-bg-image:none;--chatbot-container-bg-color:transparent;--chatbot-container-font-family:\"Open Sans\";--chatbot-button-bg-color:#0042da;--chatbot-button-color:#fff;--chatbot-host-bubble-bg-color:#f3f3f3;--chatbot-host-bubble-color:#303235;--chatbot-guest-bubble-bg-color:#3b81f6;--chatbot-guest-bubble-color:#fff;--chatbot-input-bg-color:#fff;--chatbot-input-color:#303235;--chatbot-input-placeholder-color:#9095a0;--chatbot-header-bg-color:#fff;--chatbot-header-color:#303235;--chatbot-border-radius:6px;--PhoneInputCountryFlag-borderColor:transparent;--PhoneInput-color--focus:transparent}a{color:#16bed7;font-weight:500}a:hover{text-decoration:underline}pre{word-wrap:break-word;font-size:13px;margin:5px;overflow:auto;padding:5px;white-space:pre-wrap;white-space:-moz-pre-wrap;white-space:-pre-wrap;white-space:-o-pre-wrap;width:auto}.string{color:green}.number{color:#ff8c00}.boolean{color:blue}.null{color:#f0f}.key{color:#002b36}.scrollable-container::-webkit-scrollbar{display:none}.scrollable-container{-ms-overflow-style:none;scrollbar-width:none}.text-fade-in{transition:opacity .4s ease-in .2s}.bubble-typing{transition:width .4s ease-out,height .4s ease-out}.bubble1,.bubble2,.bubble3{background-color:var(--chatbot-host-bubble-color);opacity:.5}.bubble1,.bubble2{animation:chatBubbles 1s ease-in-out infinite}.bubble2{animation-delay:.3s}.bubble3{animation:chatBubbles 1s ease-in-out infinite;animation-delay:.5s}@keyframes chatBubbles{0%{transform:translateY(0)}50%{transform:translateY(-5px)}to{transform:translateY(0)}}@keyframes pulse{0%{opacity:1}50%{opacity:.5}to{opacity:1}}.animate-pulse{animation:pulse 1.2s cubic-bezier(.5,0,.5,1) infinite}button,input,textarea{font-weight:300}.slate-a{text-decoration:underline}.slate-html-container>div{min-height:24px}.slate-bold{font-weight:700}.slate-italic{font-style:oblique}.slate-underline{text-decoration:underline}.text-input::-moz-placeholder{color:#9095a0!important;opacity:1!important}.text-input::placeholder{color:#9095a0!important;opacity:1!important}.chatbot-welcome-message{animation:pop-in .1s ease-out;font-family:Open Sans,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol;transform-origin:bottom right}@keyframes pop-in{0%{opacity:0;transform:scale(0) translateY(100%)}to{opacity:1;transform:scale(1) translateY(0)}}.chatbot-container{background-color:var(--chatbot-container-bg-color);background-image:var(--chatbot-container-bg-image);font-family:Open Sans,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol}.chatbot-button{background-color:#0042da;border:1px solid #0042da;border-radius:var(--chatbot-border-radius);color:var(--chatbot-button-color)}.chatbot-button.selectable{border:1px solid #0042da}.chatbot-button.selectable,.chatbot-host-bubble{background-color:#f3f3f3;color:var(--chatbot-host-bubble-color)}.chatbot-host-bubble{border-radius:6px}.chatbot-host-bubble>.bubble-typing{border:var(--chatbot-host-bubble-border)}.chatbot-host-bubble iframe,.chatbot-host-bubble img,.chatbot-host-bubble video{border-radius:var(--chatbot-border-radius)}.chatbot-guest-bubble{background-color:#3b81f6;border-radius:6px;color:var(--chatbot-guest-bubble-color)}.chatbot-input{background-color:#fff;border-radius:var(--chatbot-border-radius);box-shadow:0 1px 4px 0 rgba(0,0,0,.15);color:#303235}.chatbot-input-error-message{color:#303235}.chatbot-button>.send-icon{fill:var(--chatbot-button-color)}.chatbot-chat-view{max-width:800px;padding:20px}.ping span{background-color:#0042da}.rating-icon-container svg{stroke:#0042da;fill:#f3f3f3;height:42px;transition:fill .1s ease-out;width:42px}.rating-icon-container.selected svg{fill:#0042da}.rating-icon-container:hover svg{filter:brightness(.9)}.rating-icon-container:active svg{filter:brightness(.75)}.upload-progress-bar{background-color:#0042da;border-radius:var(--chatbot-border-radius)}.total-files-indicator{background-color:#0042da;color:var(--chatbot-button-color);font-size:10px}.chatbot-upload-input{transition:border-color .1s ease-out}.chatbot-upload-input.dragging-over{border-color:#0042da}.secondary-button{background-color:#f7f8ff;border-radius:var(--chatbot-border-radius);color:var(--chatbot-host-bubble-color)}.chatbot-country-select{color:#303235}.chatbot-country-select,.chatbot-date-input{background-color:#fff;border-radius:var(--chatbot-border-radius)}.chatbot-date-input{color:#303235;color-scheme:light}.chatbot-popup-blocked-toast{border-radius:var(--chatbot-border-radius)}.messagelist{border-radius:.5rem;height:100%;overflow-y:scroll;width:100%}.messagelistloading{display:flex;justify-content:center;margin-top:1rem;width:100%}.usermessage{padding:1rem 1.5rem}.usermessagewaiting-light{background:linear-gradient(270deg,#ede7f6,#e3f2fd,#ede7f6);background-position:-100% 0;background-size:200% 200%}.usermessagewaiting-dark,.usermessagewaiting-light{animation:loading-gradient 2s ease-in-out infinite;animation-direction:alternate;animation-name:loading-gradient;padding:1rem 1.5rem}.usermessagewaiting-dark{background:linear-gradient(270deg,#2e2352,#1d3d60,#2e2352);background-position:-100% 0;background-size:200% 200%;color:#ececf1}@keyframes loading-gradient{0%{background-position:-100% 0}to{background-position:100% 0}}.apimessage{animation:fadein .5s;padding:1rem 1.5rem}@keyframes fadein{0%{opacity:0}to{opacity:1}}@keyframes pulse-dot{0%{opacity:1}50%{opacity:0}to{opacity:1}}@keyframes pulse-shadow{0%{box-shadow:0 0 8px 0 rgba(178,255,176,.8)}50%{box-shadow:0 0 0 0 rgba(178,255,176,0)}to{box-shadow:0 0 8px 0 rgba(178,255,176,.8)}}.live-dot{background:radial-gradient(circle,#09ff00 0,#0df106 30%,#16c40d 100%);border-radius:50%;overflow:hidden;position:relative}.live-dot-animate{animation:pulse-shadow 1.5s cubic-bezier(0,0,0,1) infinite;background:radial-gradient(circle,#2ad321 20%,#1e9a18 100%)}.live-dot-animate:after{animation:pulse-dot 1.5s cubic-bezier(0,0,0,1) infinite;background:radial-gradient(circle,#b2ffb0 20%,#0cf200 100%);content:\"\";height:100%;left:0;position:absolute;top:0;width:100%}.apimessage,.usermessage,.usermessagewaiting{display:flex}.markdownanswer{line-height:1.75}.markdownanswer a:hover{opacity:.8}.markdownanswer a{color:#16bed7;font-weight:500}.markdownanswer code{color:#15cb19;font-weight:500;white-space:pre-wrap!important}.markdownanswer ol,.markdownanswer ul{margin:1rem}.boticon,.usericon{border-radius:1rem;margin-right:1rem}.markdownanswer h1,.markdownanswer h2,.markdownanswer h3{font-size:inherit}.center{flex-direction:column;padding:10px;position:relative}.center,.cloud{align-items:center;display:flex;justify-content:center}.cloud{border-radius:.5rem;height:calc(100% - 50px);width:400px}input{background-color:transparent;border:none;padding:10px}.container button{text-align:left}.question-button-old{fill:currentcolor;align-items:center;-webkit-appearance:none;-moz-appearance:none;appearance:none;background-color:#fff;border-radius:24px;border-style:none;box-shadow:0 3px 5px -1px rgba(0,0,0,.2),0 6px 10px 0 rgba(0,0,0,.14),0 1px 18px 0 rgba(0,0,0,.12);box-sizing:border-box;color:#3c4043;cursor:pointer;display:inline-flex;font-family:Open Sans,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol;font-size:10px;font-weight:400;height:30px;justify-content:left;letter-spacing:.25px;line-height:normal;max-width:100%;overflow:visible;padding:2px 24px;position:relative;text-align:left;text-transform:none;touch-action:manipulation;transition:box-shadow .28s cubic-bezier(.4,0,.2,1),opacity 15ms linear 30ms,transform .27s cubic-bezier(0,0,.2,1) 0ms;-moz-user-select:none;user-select:none;-webkit-user-select:none;width:auto;will-change:transform,opacity;z-index:0}.button-17:hover{background:#f6f9fe;color:#174ea6}.button-17:active{box-shadow:0 4px 4px 0 rgba(60,64,67,.3),0 8px 12px 6px rgba(60,64,67,.15);outline:none}.button-17:focus{border:2px solid #4285f4;outline:none}.button-17:not(:disabled){box-shadow:0 1px 3px 0 rgba(60,64,67,.3),0 4px 8px 3px rgba(60,64,67,.15)}.button-17:not(:disabled):hover{box-shadow:0 2px 3px 0 rgba(60,64,67,.3),0 6px 10px 4px rgba(60,64,67,.15)}.button-17:not(:disabled):focus{box-shadow:0 1px 3px 0 rgba(60,64,67,.3),0 4px 8px 3px rgba(60,64,67,.15)}.button-17:not(:disabled):active{box-shadow:0 4px 4px 0 rgba(60,64,67,.3),0 8px 12px 6px rgba(60,64,67,.15)}.button-17:disabled{box-shadow:0 1px 3px 0 rgba(60,64,67,.3),0 4px 8px 3px rgba(60,64,67,.15)}.question-container{flex-direction:row}.outer-questions{display:flex;flex-wrap:wrap;max-width:1000px}.question-button-mobile{line-height:0px;padding:.75rem .65rem}.question-button-desktop,.question-button-mobile{background-color:#fafafa;border:10;border-radius:.5rem;box-shadow:0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px 0 rgba(0,0,0,.06);box-sizing:border-box;color:#3c3c3c;cursor:pointer;font-family:Open Sans,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol;font-weight:400;text-align:center;-webkit-text-decoration:none #b4d2ff solid;text-decoration:none #b4d2ff solid;text-decoration-thickness:auto;touch-action:manipulation;-moz-user-select:none;user-select:none;-webkit-user-select:none}.question-button-desktop{line-height:normal;padding:.75rem 1rem}.button-38:hover{background-color:#1285f8}.button-38:focus{outline:2px solid transparent;outline-offset:2px}.button-38:focus-visible{box-shadow:none}.close-tab-btn{background-color:#fffefee0;border:none;border-radius:50%;color:#3b3b3b;cursor:pointer;font-size:20px;height:20px;position:absolute;right:5px;top:5px;width:20px}.hover\\:scale-110:hover{--tw-scale-x:1.1;--tw-scale-y:1.1}.hover\\:scale-110:hover,.hover\\:scale-125:hover{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.hover\\:scale-125:hover{--tw-scale-x:1.25;--tw-scale-y:1.25}.hover\\:brightness-90:hover{--tw-brightness:brightness(.9);filter:var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow)}.focus\\:outline-none:focus{outline:2px solid transparent;outline-offset:2px}.active\\:scale-90:active{--tw-scale-x:.9;--tw-scale-y:.9}.active\\:scale-90:active,.active\\:scale-95:active{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.active\\:scale-95:active{--tw-scale-x:.95;--tw-scale-y:.95}.active\\:brightness-75:active{--tw-brightness:brightness(.75);filter:var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow)}.disabled\\:cursor-not-allowed:disabled{cursor:not-allowed}.disabled\\:opacity-50:disabled{opacity:.5}.disabled\\:brightness-100:disabled{--tw-brightness:brightness(1);filter:var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow)}@media (min-width:640px){.sm\\:right-5{right:20px}.sm\\:my-8{margin-bottom:32px;margin-top:32px}.sm\\:w-\\[400px\\]{width:400px}.sm\\:w-full{width:100%}.sm\\:max-w-lg{max-width:512px}.sm\\:p-0{padding:0}}";

const isNotDefined = value => value === undefined || value === null;
const isDefined = value => value !== undefined && value !== null;
const sendRequest = async params => {
  try {
    const url = typeof params === "string" ? params : params.url;
    const response = await fetch(url, {
      method: typeof params === "string" ? "GET" : params.method,
      mode: "cors",
      headers: typeof params !== "string" && isDefined(params.body) ? {
        "Content-Type": "application/json"
      } : undefined,
      body: typeof params !== "string" && isDefined(params.body) ? JSON.stringify(params.body) : undefined
    });
    let data;
    const contentType = response.headers.get("Content-Type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    if (!response.ok) {
      let errorMessage;
      if (typeof data === "object" && "error" in data) {
        errorMessage = data.error;
      } else {
        errorMessage = data || response.statusText;
      }
      throw errorMessage;
    }
    return {
      data
    };
  } catch (e) {
    console.error(e);
    return {
      error: e
    };
  }
};
const getCookie = name => {
  const cookieDecoded = decodeURIComponent(document.cookie);
  const cookieArray = cookieDecoded.split("; ");
  let result = "";
  cookieArray.forEach(element => {
    let components = element.split("=");
    if (components[0] == name) {
      result = components[components.length - 1];
    }
  });
  return result;
};
const setCookie = (name, value, daysToLive) => {
  const date = new Date();
  date.setTime(date.getTime() + daysToLive * 24 * 60 * 60 * 1000);
  const expires = "expires=" + date.toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/`;
};
const lightOrDark = color => {
  let r, g, b;
  if (color.match(/^rgb/)) {
    const colorMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/);
    r = parseInt(colorMatch?.[1] || "0");
    g = parseInt(colorMatch?.[2] || "0");
    b = parseInt(colorMatch?.[3] || "0");
  } else {
    const colorHex = +("0x" + color.slice(1).replace(color.length < 5 ? /./g : "", "$&$&"));
    r = colorHex >> 16;
    g = colorHex >> 8 & 255;
    b = colorHex & 255;
  }
  if (Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b)) > 127.5) {
    return "light";
  } else {
    return "dark";
  }
};
const getContrastingColor = color => {
  return lightOrDark(color) === "light" ? "#000" : "#fff";
};

const isMobileCheck = () => {
  let check = false;
  (function (a) {
    if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true;
  })(navigator.userAgent || navigator.vendor);
  return check;
};

const Config = {
  server: {
    userConfigApiUrl: "https://vshdvtqafk.execute-api.us-east-2.amazonaws.com/default/user_config_api",
    messageCollectorApiUrl: "https://kqg01i5ba6.execute-api.us-east-2.amazonaws.com/default/message_collector"
  },
  bot: {
    defaultAvatarSrc: "https://cdn.jsdelivr.net/gh/realty-ai-org/RealtyAIChat@main/images/default_avatar.png"
  },
  theme: {
    messages: {
      bot: {
        defaultBackgroundColor: "#f3f3f3",
        defaultTextColor: "#303235"
      },
      user: {
        defaultBackgroundColor: "#3B81F6",
        defaultTextColor: "#ffffff"
      }
    },
    popoutMessage: {
      defaultBackgroundColor: "#f3f3f3"
    }
  }
};

const _tmpl$$g = /*#__PURE__*/template(`<div>`),
  _tmpl$2$9 = /*#__PURE__*/template(`<figure><img alt="Bot avatar" class="rounded-full object-cover w-full h-full">`);
const Avatar = props => {
  return (() => {
    const _el$ = _tmpl$2$9(),
      _el$2 = _el$.firstChild;
    insert(_el$, createComponent(Show, {
      get when() {
        return props.isLive && props.liveIcon === "dot";
      },
      get children() {
        const _el$3 = _tmpl$$g();
        _el$3.style.setProperty("position", "absolute");
        _el$3.style.setProperty("top", "84%");
        _el$3.style.setProperty("left", "84%");
        _el$3.style.setProperty("transform", "translate(-50%, -50%)");
        _el$3.style.setProperty("height", "33%");
        _el$3.style.setProperty("width", "33%");
        createRenderEffect(() => className(_el$3, `live-dot ${props.animate ? "live-dot-animate" : ""}`));
        return _el$3;
      }
    }), null);
    createRenderEffect(_p$ => {
      const _v$ = "flex justify-center items-center rounded-full text-white relative flex-shrink-0 " + (isMobileCheck() ? "w-8 h-8 text-sm" : "w-10 h-10 text-xl"),
        _v$2 = {
          ...(props.style || {}),
          ...(props.isLive && props.liveIcon === "border" && {
            border: "3px solid #12c92a"
          })
        },
        _v$3 = props.src || Config.bot.defaultAvatarSrc;
      _v$ !== _p$._v$ && className(_el$, _p$._v$ = _v$);
      _p$._v$2 = style(_el$, _v$2, _p$._v$2);
      _v$3 !== _p$._v$3 && setAttribute(_el$2, "src", _p$._v$3 = _v$3);
      return _p$;
    }, {
      _v$: undefined,
      _v$2: undefined,
      _v$3: undefined
    });
    return _el$;
  })();
};

const _tmpl$$f = /*#__PURE__*/template(`<div class="fixed items-end"><div class="w-60 h-32 flex justify-end items-end"><div class="px-4 py-2 ml-2 whitespace-pre-wrap max-w-full chatbot-host-bubble chatbot-welcome-message relative"><button class="absolute top-[-6px] right-[-6px] h-5 w-5 flex justify-center items-center cursor-pointer hover:scale-125 active:scale-90 transition-transform duration-100"><span style="font-size:11pt">&cross;`),
  _tmpl$2$8 = /*#__PURE__*/template(`<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z">`),
  _tmpl$3$5 = /*#__PURE__*/template(`<div class="relative"><button part="button"><svg viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M18.601 8.39897C18.269 8.06702 17.7309 8.06702 17.3989 8.39897L12 13.7979L6.60099 8.39897C6.26904 8.06702 5.73086 8.06702 5.39891 8.39897C5.06696 8.73091 5.06696 9.2691 5.39891 9.60105L11.3989 15.601C11.7309 15.933 12.269 15.933 12.601 15.601L18.601 9.60105C18.9329 9.2691 18.9329 8.73091 18.601 8.39897Z">`),
  _tmpl$4$1 = /*#__PURE__*/template(`<img alt="Bubble button icon">`);
const defaultButtonColor$1 = "#3B81F6";
const defaultIconColor = "white";
const defaultBottom = 20;
const defaultRight = 20;
const BubbleButton = props => {
  const popout_count_cookie_name = `realty-ai-bot-popout-count-${props.userID}`;
  const popout_closed_cookie_name = `realty-ai-bot-popout-closed-${props.userID}`;
  const [popoutMessageVisible, setPopoutMessageVisible] = createSignal(false);
  var popoutOpenCount = Number(getCookie(popout_count_cookie_name));
  if (!popoutOpenCount) {
    popoutOpenCount = 0;
  }
  var popoutClosed = getCookie(popout_closed_cookie_name) === "true";
  const openPopout = () => {
    popoutOpenCount++;
    setCookie(popout_count_cookie_name, popoutOpenCount.toString(), 1 / 48);
    setPopoutMessageVisible(true);
  };
  const closePopout = () => {
    setPopoutMessageVisible(false);
    popoutOpenCount = props.popoutMessageConfig?.maxPopouts || 0;
    popoutClosed = true;
    setCookie(popout_count_cookie_name, (props.popoutMessageConfig?.maxPopouts || 0).toString(), 1 / 48);
    setCookie(popout_closed_cookie_name, "true", 1 / 48);
  };
  onMount(() => {
    if (isMobileCheck() && props.popoutMessageConfig?.show?.mobile || !isMobileCheck() && props.popoutMessageConfig?.show?.desktop) {
      if (props.isBotOpened) {
        setPopoutMessageVisible(false);
      } else if (!popoutClosed) {
        if (!props.popoutMessageConfig.maxPopouts || popoutOpenCount < props.popoutMessageConfig.maxPopouts) {
          setTimeout(() => {
            if (!props.isBotOpened && !popoutMessageVisible()) {
              openPopout();
            }
          }, (props.popoutMessageConfig.delay ?? 2) * 1000);
        }
      }
    }
  });
  return (() => {
    const _el$ = _tmpl$3$5(),
      _el$6 = _el$.firstChild,
      _el$8 = _el$6.firstChild;
    insert(_el$, createComponent(Show, {
      get when() {
        return createMemo(() => !!!props.isBotOpened)() && popoutMessageVisible();
      },
      get children() {
        const _el$2 = _tmpl$$f(),
          _el$3 = _el$2.firstChild,
          _el$4 = _el$3.firstChild,
          _el$5 = _el$4.firstChild;
        _el$2.style.setProperty("z-index", "42424243");
        _el$4.style.setProperty("box-shadow", "0px 0px 10px 0px rgba(0, 0, 0, 0.1)");
        insert(_el$4, () => props.popoutMessageTheme.message, _el$5);
        _el$5.$$click = closePopout;
        _el$5.style.setProperty("z-index", "42424244");
        _el$5.style.setProperty("border-radius", "50%");
        createRenderEffect(_p$ => {
          const _v$ = `${(props.right ? props.right : defaultRight) + (props.size === "large" ? 58 : 48)}px`,
            _v$2 = `${(props.bottom ? props.bottom : defaultBottom) + (props.size === "large" ? 58 : 48)}px`,
            _v$3 = props.popoutMessageTheme.backgroundColor ?? Config.theme.messages.bot.defaultBackgroundColor,
            _v$4 = getContrastingColor(props.popoutMessageTheme.backgroundColor ?? Config.theme.messages.bot.defaultBackgroundColor),
            _v$5 = getContrastingColor(props.popoutMessageTheme.backgroundColor ?? Config.theme.messages.bot.defaultBackgroundColor),
            _v$6 = props.popoutMessageTheme.backgroundColor ?? Config.theme.messages.bot.defaultBackgroundColor;
          _v$ !== _p$._v$ && ((_p$._v$ = _v$) != null ? _el$2.style.setProperty("right", _v$) : _el$2.style.removeProperty("right"));
          _v$2 !== _p$._v$2 && ((_p$._v$2 = _v$2) != null ? _el$2.style.setProperty("bottom", _v$2) : _el$2.style.removeProperty("bottom"));
          _v$3 !== _p$._v$3 && ((_p$._v$3 = _v$3) != null ? _el$4.style.setProperty("background-color", _v$3) : _el$4.style.removeProperty("background-color"));
          _v$4 !== _p$._v$4 && ((_p$._v$4 = _v$4) != null ? _el$4.style.setProperty("color", _v$4) : _el$4.style.removeProperty("color"));
          _v$5 !== _p$._v$5 && ((_p$._v$5 = _v$5) != null ? _el$5.style.setProperty("background-color", _v$5) : _el$5.style.removeProperty("background-color"));
          _v$6 !== _p$._v$6 && ((_p$._v$6 = _v$6) != null ? _el$5.style.setProperty("color", _v$6) : _el$5.style.removeProperty("color"));
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined,
          _v$3: undefined,
          _v$4: undefined,
          _v$5: undefined,
          _v$6: undefined
        });
        return _el$2;
      }
    }), _el$6);
    _el$6.$$touchstart = () => {
      if (isMobileCheck()) {
        props.toggleBot();
        setPopoutMessageVisible(false);
      }
    };
    _el$6.$$click = () => {
      if (!isMobileCheck()) {
        props.toggleBot();
        setPopoutMessageVisible(false);
      }
    };
    _el$6.style.setProperty("z-index", "42424242");
    _el$6.style.setProperty("box-shadow", "0px 0px 10px 0px rgba(0, 0, 0, 0.2)");
    insert(_el$6, createComponent(Show, {
      get when() {
        return createMemo(() => !!props.isBotOpened)() && isNotDefined(props.customIconSrc);
      },
      keyed: true,
      get children() {
        const _el$7 = _tmpl$2$8();
        createRenderEffect(_p$ => {
          const _v$7 = props.iconColor ?? defaultIconColor,
            _v$8 = `stroke-2 fill-transparent absolute duration-200 transition ` + (props.isBotOpened ? "scale-0 opacity-0" : "scale-100 opacity-100") + (props.size === "large" ? " w-11" : " w-9");
          _v$7 !== _p$._v$7 && ((_p$._v$7 = _v$7) != null ? _el$7.style.setProperty("stroke", _v$7) : _el$7.style.removeProperty("stroke"));
          _v$8 !== _p$._v$8 && setAttribute(_el$7, "class", _p$._v$8 = _v$8);
          return _p$;
        }, {
          _v$7: undefined,
          _v$8: undefined
        });
        return _el$7;
      }
    }), _el$8);
    insert(_el$6, createComponent(Show, {
      get when() {
        return !props.isBotOpened;
      },
      get children() {
        return createComponent(Show, {
          get when() {
            return props.showAvatar;
          },
          get fallback() {
            return [createComponent(Show, {
              get when() {
                return isNotDefined(props.customIconSrc);
              },
              keyed: true,
              get children() {
                const _el$9 = _tmpl$2$8();
                createRenderEffect(_p$ => {
                  const _v$15 = props.iconColor ?? defaultIconColor,
                    _v$16 = `stroke-2 fill-transparent absolute duration-200 transition ` + (props.isBotOpened ? "scale-0 opacity-0" : "scale-100 opacity-100") + (props.size === "large" ? " w-11 h-11" : " w-9 h-9");
                  _v$15 !== _p$._v$15 && ((_p$._v$15 = _v$15) != null ? _el$9.style.setProperty("stroke", _v$15) : _el$9.style.removeProperty("stroke"));
                  _v$16 !== _p$._v$16 && setAttribute(_el$9, "class", _p$._v$16 = _v$16);
                  return _p$;
                }, {
                  _v$15: undefined,
                  _v$16: undefined
                });
                return _el$9;
              }
            }), createComponent(Show, {
              get when() {
                return props.customIconSrc;
              },
              get children() {
                const _el$10 = _tmpl$4$1();
                createRenderEffect(_p$ => {
                  const _v$17 = props.customIconSrc,
                    _v$18 = "rounded-full object-cover" + (props.isBotOpened ? "scale-0 opacity-0" : "scale-100 opacity-100") + (props.size === "large" ? " w-11 h-11" : " w-9 h-9");
                  _v$17 !== _p$._v$17 && setAttribute(_el$10, "src", _p$._v$17 = _v$17);
                  _v$18 !== _p$._v$18 && className(_el$10, _p$._v$18 = _v$18);
                  return _p$;
                }, {
                  _v$17: undefined,
                  _v$18: undefined
                });
                return _el$10;
              }
            })];
          },
          get children() {
            return createComponent(Avatar, {
              get src() {
                return props.avatarSrc;
              },
              style: {
                height: "100%",
                width: "100%"
              },
              liveIcon: "dot",
              isLive: true,
              animate: true
            });
          }
        });
      }
    }), _el$8);
    createRenderEffect(_p$ => {
      const _v$9 = `fixed shadow-md rounded-full hover:scale-110 active:scale-95 transition-transform duration-200 flex justify-center items-center animate-fade-in` + (props.size === "large" ? " w-20 h-20" : " w-16 h-16"),
        _v$10 = props.backgroundColor ?? defaultButtonColor$1,
        _v$11 = props.right ? `${props.right.toString()}px` : `${defaultRight}px`,
        _v$12 = props.bottom ? `${props.bottom.toString()}px` : `${defaultBottom}px`,
        _v$13 = props.iconColor ?? "white",
        _v$14 = `absolute duration-200 transition ` + (props.isBotOpened ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-180 opacity-0") + (props.size === "large" ? " w-11" : " w-9");
      _v$9 !== _p$._v$9 && className(_el$6, _p$._v$9 = _v$9);
      _v$10 !== _p$._v$10 && ((_p$._v$10 = _v$10) != null ? _el$6.style.setProperty("background-color", _v$10) : _el$6.style.removeProperty("background-color"));
      _v$11 !== _p$._v$11 && ((_p$._v$11 = _v$11) != null ? _el$6.style.setProperty("right", _v$11) : _el$6.style.removeProperty("right"));
      _v$12 !== _p$._v$12 && ((_p$._v$12 = _v$12) != null ? _el$6.style.setProperty("bottom", _v$12) : _el$6.style.removeProperty("bottom"));
      _v$13 !== _p$._v$13 && ((_p$._v$13 = _v$13) != null ? _el$8.style.setProperty("fill", _v$13) : _el$8.style.removeProperty("fill"));
      _v$14 !== _p$._v$14 && setAttribute(_el$8, "class", _p$._v$14 = _v$14);
      return _p$;
    }, {
      _v$9: undefined,
      _v$10: undefined,
      _v$11: undefined,
      _v$12: undefined,
      _v$13: undefined,
      _v$14: undefined
    });
    return _el$;
  })();
};
delegateEvents(["click", "touchstart"]);

const sendMessageQuery = ({
  chatflowid,
  apiHost = "http://localhost:3000",
  body
}) => sendRequest({
  method: "POST",
  url: `${apiHost}/api/v1/prediction/${chatflowid}`,
  body
});
const sendLogConvoQuery = convo => sendRequest({
  method: "POST",
  url: Config.server.messageCollectorApiUrl,
  body: convo
});
const isStreamAvailableQuery = ({
  chatflowid,
  apiHost = "http://localhost:3000"
}) => sendRequest({
  method: "GET",
  url: `${apiHost}/api/v1/chatflows-streaming/${chatflowid}`
});

const _tmpl$$e = /*#__PURE__*/template(`<input class="focus:outline-none bg-transparent px-4 py-3 flex-1 w-full text-input" type="text">`);
const ShortTextInput = props => {
  const [local, others] = splitProps(props, ["ref", "onInput"]);
  return (() => {
    const _el$ = _tmpl$$e();
    _el$.$$input = e => local.onInput(e.currentTarget.value);
    const _ref$ = props.ref;
    typeof _ref$ === "function" ? use(_ref$, _el$) : props.ref = _el$;
    spread(_el$, mergeProps({
      get style() {
        return {
          "font-size": props.fontSize ? `${props.fontSize}px` : "16px"
        };
      }
    }, others), false, false);
    return _el$;
  })();
};
delegateEvents(["input"]);

const _tmpl$$d = /*#__PURE__*/template(`<svg width="28px" height="28px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.5003 12H5.41872M5.24634 12.7972L4.24158 15.7986C3.69128 17.4424 3.41613 18.2643 3.61359 18.7704C3.78506 19.21 4.15335 19.5432 4.6078 19.6701C5.13111 19.8161 5.92151 19.4604 7.50231 18.7491L17.6367 14.1886C19.1797 13.4942 19.9512 13.1471 20.1896 12.6648C20.3968 12.2458 20.3968 11.7541 20.1896 11.3351C19.9512 10.8529 19.1797 10.5057 17.6367 9.81135L7.48483 5.24303C5.90879 4.53382 5.12078 4.17921 4.59799 4.32468C4.14397 4.45101 3.77572 4.78336 3.60365 5.22209C3.40551 5.72728 3.67772 6.54741 4.22215 8.18767L5.24829 11.2793C5.34179 11.561 5.38855 11.7019 5.407 11.8459C5.42338 11.9738 5.42321 12.1032 5.40651 12.231C5.38768 12.375 5.34057 12.5157 5.24634 12.7972Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`);
const defaultButtonColor = "#3B81F6";
const SendIcon = props => (() => {
  const _el$ = _tmpl$$d();
  spread(_el$, mergeProps({
    get style() {
      return {
        stroke: props.color ?? defaultButtonColor
      };
    }
  }, props), true, true);
  return _el$;
})();

const _tmpl$$c = /*#__PURE__*/template(`<button type="submit">`),
  _tmpl$2$7 = /*#__PURE__*/template(`<svg><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">`);
const SendButton = props => {
  return (() => {
    const _el$ = _tmpl$$c();
    spread(_el$, mergeProps({
      get disabled() {
        return props.isDisabled || props.isLoading;
      }
    }, props, {
      get ["class"]() {
        return 'py-2 px-4 justify-center font-semibold text-white focus:outline-none flex items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:brightness-100 transition-all filter hover:brightness-90 active:brightness-75 chatbot-button ' + props.class;
      },
      "style": {
        background: 'transparent',
        border: 'none'
      }
    }), false, true);
    insert(_el$, createComponent(Show, {
      get when() {
        return !props.isLoading;
      },
      get fallback() {
        return createComponent(Spinner, {
          "class": "text-white"
        });
      },
      get children() {
        return createComponent(SendIcon, {
          get color() {
            return props.sendButtonColor;
          },
          get ["class"]() {
            return 'send-icon flex ' + (props.disableIcon ? 'hidden' : '');
          }
        });
      }
    }));
    return _el$;
  })();
};
const Spinner = props => (() => {
  const _el$2 = _tmpl$2$7();
  spread(_el$2, mergeProps(props, {
    get ["class"]() {
      return 'animate-spin -ml-1 mr-3 h-5 w-5 ' + props.class;
    },
    "xmlns": 'http://www.w3.org/2000/svg',
    "fill": 'none',
    "viewBox": '0 0 24 24',
    "data-testid": 'loading-spinner'
  }), true, true);
  return _el$2;
})();

const _tmpl$$b = /*#__PURE__*/template(`<div class="flex items-center gap-2 justify-between absolute bottom-10 left-[20px] right-[20px] chatbot-input" data-testid="input">`);
const defaultBackgroundColor = "#ffffff";
const defaultTextColor$1 = "#303235";
const TextInput = props => {
  const [inputValue, setInputValue] = createSignal(props.defaultValue ?? "");
  let inputRef;
  const handleInput = inputValue => setInputValue(inputValue);
  const checkIfInputIsValid = () => inputValue() !== "" && inputRef?.reportValidity();
  const submit = () => {
    if (checkIfInputIsValid()) props.onSubmit(inputValue());
    setInputValue("");
  };
  const submitWhenEnter = e => {
    // Check if IME composition is in progress
    const isIMEComposition = e.isComposing || e.keyCode === 229;
    if (e.key === "Enter" && !isIMEComposition) submit();
  };
  onMount(() => {
    if (isMobileCheck() && inputRef) inputRef.focus();
  });
  return (() => {
    const _el$ = _tmpl$$b();
    _el$.$$keydown = submitWhenEnter;
    _el$.style.setProperty("z-index", "1000");
    insert(_el$, createComponent(ShortTextInput, {
      ref(r$) {
        const _ref$ = inputRef;
        typeof _ref$ === "function" ? _ref$(r$) : inputRef = r$;
      },
      onInput: handleInput,
      get value() {
        return inputValue();
      },
      get fontSize() {
        return props.fontSize;
      },
      get placeholder() {
        return props.placeholder ?? "Type your question";
      }
    }), null);
    insert(_el$, createComponent(SendButton, {
      get sendButtonColor() {
        return props.sendButtonColor;
      },
      type: "button",
      get isDisabled() {
        return inputValue() === "";
      },
      "on:click": submit,
      children: "Send"
    }), null);
    createRenderEffect(_p$ => {
      const _v$ = props.backgroundColor ?? defaultBackgroundColor,
        _v$2 = props.textColor ?? defaultTextColor$1;
      _v$ !== _p$._v$ && ((_p$._v$ = _v$) != null ? _el$.style.setProperty("background-color", _v$) : _el$.style.removeProperty("background-color"));
      _v$2 !== _p$._v$2 && ((_p$._v$2 = _v$2) != null ? _el$.style.setProperty("color", _v$2) : _el$.style.removeProperty("color"));
      return _p$;
    }, {
      _v$: undefined,
      _v$2: undefined
    });
    return _el$;
  })();
};
delegateEvents(["keydown"]);

/*
 * @license
 *
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked
 *
 * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
 * https://github.com/ts-stack/markdown
 */
class ExtendRegexp {
    source;
    flags;
    constructor(regex, flags = '') {
        this.source = regex.source;
        this.flags = flags;
    }
    /**
     * Extend regular expression.
     *
     * @param groupName Regular expression for search a group name.
     * @param groupRegexp Regular expression of named group.
     */
    setGroup(groupName, groupRegexp) {
        let newRegexp = typeof groupRegexp == 'string' ? groupRegexp : groupRegexp.source;
        newRegexp = newRegexp.replace(/(^|[^\[])\^/g, '$1');
        // Extend regexp.
        this.source = this.source.replace(groupName, newRegexp);
        return this;
    }
    /**
     * Returns a result of extending a regular expression.
     */
    getRegexp() {
        return new RegExp(this.source, this.flags);
    }
}

/**
 * @license
 *
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked
 *
 * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
 * https://github.com/ts-stack/markdown
 */
const escapeTest = /[&<>"']/;
const escapeReplace = /[&<>"']/g;
const replacements = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    // tslint:disable-next-line:quotemark
    "'": '&#39;',
};
const escapeTestNoEncode = /[<>"']|&(?!#?\w+;)/;
const escapeReplaceNoEncode = /[<>"']|&(?!#?\w+;)/g;
function escape(html, encode) {
    if (encode) {
        if (escapeTest.test(html)) {
            return html.replace(escapeReplace, (ch) => replacements[ch]);
        }
    }
    else {
        if (escapeTestNoEncode.test(html)) {
            return html.replace(escapeReplaceNoEncode, (ch) => replacements[ch]);
        }
    }
    return html;
}
function unescape(html) {
    // Explicitly match decimal, hex, and named HTML entities
    return html.replace(/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/gi, function (_, n) {
        n = n.toLowerCase();
        if (n === 'colon') {
            return ':';
        }
        if (n.charAt(0) === '#') {
            return n.charAt(1) === 'x'
                ? String.fromCharCode(parseInt(n.substring(2), 16))
                : String.fromCharCode(+n.substring(1));
        }
        return '';
    });
}

/**
 * @license
 *
 * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
 * https://github.com/ts-stack/markdown
 */
var TokenType;
(function (TokenType) {
    TokenType[TokenType["space"] = 1] = "space";
    TokenType[TokenType["text"] = 2] = "text";
    TokenType[TokenType["paragraph"] = 3] = "paragraph";
    TokenType[TokenType["heading"] = 4] = "heading";
    TokenType[TokenType["listStart"] = 5] = "listStart";
    TokenType[TokenType["listEnd"] = 6] = "listEnd";
    TokenType[TokenType["looseItemStart"] = 7] = "looseItemStart";
    TokenType[TokenType["looseItemEnd"] = 8] = "looseItemEnd";
    TokenType[TokenType["listItemStart"] = 9] = "listItemStart";
    TokenType[TokenType["listItemEnd"] = 10] = "listItemEnd";
    TokenType[TokenType["blockquoteStart"] = 11] = "blockquoteStart";
    TokenType[TokenType["blockquoteEnd"] = 12] = "blockquoteEnd";
    TokenType[TokenType["code"] = 13] = "code";
    TokenType[TokenType["table"] = 14] = "table";
    TokenType[TokenType["html"] = 15] = "html";
    TokenType[TokenType["hr"] = 16] = "hr";
})(TokenType || (TokenType = {}));
class MarkedOptions {
    gfm = true;
    tables = true;
    breaks = false;
    pedantic = false;
    sanitize = false;
    sanitizer;
    mangle = true;
    smartLists = false;
    silent = false;
    /**
     * @param code The section of code to pass to the highlighter.
     * @param lang The programming language specified in the code block.
     */
    highlight;
    langPrefix = 'lang-';
    smartypants = false;
    headerPrefix = '';
    /**
     * An object containing functions to render tokens to HTML. Default: `new Renderer()`
     */
    renderer;
    /**
     * Self-close the tags for void elements (&lt;br/&gt;, &lt;img/&gt;, etc.)
     * with a "/" as required by XHTML.
     */
    xhtml = false;
    /**
     * The function that will be using to escape HTML entities.
     * By default using inner helper.
     */
    escape = escape;
    /**
     * The function that will be using to unescape HTML entities.
     * By default using inner helper.
     */
    unescape = unescape;
    /**
     * If set to `true`, an inline text will not be taken in paragraph.
     *
     * ```ts
     * // isNoP == false
     * Marked.parse('some text'); // returns '<p>some text</p>'
     *
     * Marked.setOptions({isNoP: true});
     *
     * Marked.parse('some text'); // returns 'some text'
     * ```
     */
    isNoP;
}

/**
 * @license
 *
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked
 *
 * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
 * https://github.com/ts-stack/markdown
 */
class Renderer {
    options;
    constructor(options) {
        this.options = options || Marked.options;
    }
    code(code, lang, escaped, meta) {
        if (this.options.highlight) {
            const out = this.options.highlight(code, lang);
            if (out != null && out !== code) {
                escaped = true;
                code = out;
            }
        }
        const escapedCode = (escaped ? code : this.options.escape(code, true));
        if (!lang) {
            return `\n<pre><code>${escapedCode}\n</code></pre>\n`;
        }
        const className = this.options.langPrefix + this.options.escape(lang, true);
        return `\n<pre><code class="${className}">${escapedCode}\n</code></pre>\n`;
    }
    blockquote(quote) {
        return `<blockquote>\n${quote}</blockquote>\n`;
    }
    html(html) {
        return html;
    }
    heading(text, level, raw) {
        const id = this.options.headerPrefix + raw.toLowerCase().replace(/[^\w]+/g, '-');
        return `<h${level} id="${id}">${text}</h${level}>\n`;
    }
    hr() {
        return this.options.xhtml ? '<hr/>\n' : '<hr>\n';
    }
    list(body, ordered) {
        const type = ordered ? 'ol' : 'ul';
        return `\n<${type}>\n${body}</${type}>\n`;
    }
    listitem(text) {
        return '<li>' + text + '</li>\n';
    }
    paragraph(text) {
        return '<p>' + text + '</p>\n';
    }
    table(header, body) {
        return `
<table>
<thead>
${header}</thead>
<tbody>
${body}</tbody>
</table>
`;
    }
    tablerow(content) {
        return '<tr>\n' + content + '</tr>\n';
    }
    tablecell(content, flags) {
        const type = flags.header ? 'th' : 'td';
        const tag = flags.align ? '<' + type + ' style="text-align:' + flags.align + '">' : '<' + type + '>';
        return tag + content + '</' + type + '>\n';
    }
    // *** Inline level renderer methods. ***
    strong(text) {
        return '<strong>' + text + '</strong>';
    }
    em(text) {
        return '<em>' + text + '</em>';
    }
    codespan(text) {
        return '<code>' + text + '</code>';
    }
    br() {
        return this.options.xhtml ? '<br/>' : '<br>';
    }
    del(text) {
        return '<del>' + text + '</del>';
    }
    link(href, title, text) {
        if (this.options.sanitize) {
            let prot;
            try {
                prot = decodeURIComponent(this.options.unescape(href))
                    .replace(/[^\w:]/g, '')
                    .toLowerCase();
            }
            catch (e) {
                return text;
            }
            if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
                return text;
            }
        }
        let out = '<a href="' + href + '"';
        if (title) {
            out += ' title="' + title + '"';
        }
        out += '>' + text + '</a>';
        return out;
    }
    image(href, title, text) {
        let out = '<img src="' + href + '" alt="' + text + '"';
        if (title) {
            out += ' title="' + title + '"';
        }
        out += this.options.xhtml ? '/>' : '>';
        return out;
    }
    text(text) {
        return text;
    }
}

/**
 * @license
 *
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked
 *
 * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
 * https://github.com/ts-stack/markdown
 */
/**
 * Inline Lexer & Compiler.
 */
class InlineLexer {
    staticThis;
    links;
    options;
    static rulesBase = null;
    /**
     * Pedantic Inline Grammar.
     */
    static rulesPedantic = null;
    /**
     * GFM Inline Grammar
     */
    static rulesGfm = null;
    /**
     * GFM + Line Breaks Inline Grammar.
     */
    static rulesBreaks = null;
    rules;
    renderer;
    inLink;
    hasRulesGfm;
    ruleCallbacks;
    constructor(staticThis, links, options = Marked.options, renderer) {
        this.staticThis = staticThis;
        this.links = links;
        this.options = options;
        this.renderer = renderer || this.options.renderer || new Renderer(this.options);
        if (!this.links) {
            throw new Error("InlineLexer requires 'links' parameter.");
        }
        this.setRules();
    }
    /**
     * Static Lexing/Compiling Method.
     */
    static output(src, links, options) {
        const inlineLexer = new this(this, links, options);
        return inlineLexer.output(src);
    }
    static getRulesBase() {
        if (this.rulesBase) {
            return this.rulesBase;
        }
        /**
         * Inline-Level Grammar.
         */
        const base = {
            escape: /^\\([\\`*{}\[\]()#+\-.!_>])/,
            autolink: /^<([^ <>]+(@|:\/)[^ <>]+)>/,
            tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^<'">])*?>/,
            link: /^!?\[(inside)\]\(href\)/,
            reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
            nolink: /^!?\[((?:\[[^\]]*\]|[^\[\]])*)\]/,
            strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
            em: /^\b_((?:[^_]|__)+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
            code: /^(`+)([\s\S]*?[^`])\1(?!`)/,
            br: /^ {2,}\n(?!\s*$)/,
            text: /^[\s\S]+?(?=[\\<!\[_*`]| {2,}\n|$)/,
            _inside: /(?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*/,
            _href: /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/,
        };
        base.link = new ExtendRegexp(base.link).setGroup('inside', base._inside).setGroup('href', base._href).getRegexp();
        base.reflink = new ExtendRegexp(base.reflink).setGroup('inside', base._inside).getRegexp();
        return (this.rulesBase = base);
    }
    static getRulesPedantic() {
        if (this.rulesPedantic) {
            return this.rulesPedantic;
        }
        return (this.rulesPedantic = {
            ...this.getRulesBase(),
            ...{
                strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
                em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/,
            },
        });
    }
    static getRulesGfm() {
        if (this.rulesGfm) {
            return this.rulesGfm;
        }
        const base = this.getRulesBase();
        const escape = new ExtendRegexp(base.escape).setGroup('])', '~|])').getRegexp();
        const text = new ExtendRegexp(base.text).setGroup(']|', '~]|').setGroup('|', '|https?://|').getRegexp();
        return (this.rulesGfm = {
            ...base,
            ...{
                escape,
                url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
                del: /^~~(?=\S)([\s\S]*?\S)~~/,
                text,
            },
        });
    }
    static getRulesBreaks() {
        if (this.rulesBreaks) {
            return this.rulesBreaks;
        }
        const inline = this.getRulesGfm();
        const gfm = this.getRulesGfm();
        return (this.rulesBreaks = {
            ...gfm,
            ...{
                br: new ExtendRegexp(inline.br).setGroup('{2,}', '*').getRegexp(),
                text: new ExtendRegexp(gfm.text).setGroup('{2,}', '*').getRegexp(),
            },
        });
    }
    setRules() {
        if (this.options.gfm) {
            if (this.options.breaks) {
                this.rules = this.staticThis.getRulesBreaks();
            }
            else {
                this.rules = this.staticThis.getRulesGfm();
            }
        }
        else if (this.options.pedantic) {
            this.rules = this.staticThis.getRulesPedantic();
        }
        else {
            this.rules = this.staticThis.getRulesBase();
        }
        this.hasRulesGfm = this.rules.url !== undefined;
    }
    /**
     * Lexing/Compiling.
     */
    output(nextPart) {
        let execArr;
        let out = '';
        while (nextPart) {
            // escape
            if ((execArr = this.rules.escape.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                out += execArr[1];
                continue;
            }
            // autolink
            if ((execArr = this.rules.autolink.exec(nextPart))) {
                let text;
                let href;
                nextPart = nextPart.substring(execArr[0].length);
                if (execArr[2] === '@') {
                    text = this.options.escape(execArr[1].charAt(6) === ':' ? this.mangle(execArr[1].substring(7)) : this.mangle(execArr[1]));
                    href = this.mangle('mailto:') + text;
                }
                else {
                    text = this.options.escape(execArr[1]);
                    href = text;
                }
                out += this.renderer.link(href, null, text);
                continue;
            }
            // url (gfm)
            if (!this.inLink && this.hasRulesGfm && (execArr = this.rules.url.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                const text = this.options.escape(execArr[1]);
                const href = text;
                out += this.renderer.link(href, null, text);
                continue;
            }
            // tag
            if ((execArr = this.rules.tag.exec(nextPart))) {
                if (!this.inLink && /^<a /i.test(execArr[0])) {
                    this.inLink = true;
                }
                else if (this.inLink && /^<\/a>/i.test(execArr[0])) {
                    this.inLink = false;
                }
                nextPart = nextPart.substring(execArr[0].length);
                out += this.options.sanitize
                    ? this.options.sanitizer
                        ? this.options.sanitizer(execArr[0])
                        : this.options.escape(execArr[0])
                    : execArr[0];
                continue;
            }
            // link
            if ((execArr = this.rules.link.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                this.inLink = true;
                out += this.outputLink(execArr, {
                    href: execArr[2],
                    title: execArr[3],
                });
                this.inLink = false;
                continue;
            }
            // reflink, nolink
            if ((execArr = this.rules.reflink.exec(nextPart)) || (execArr = this.rules.nolink.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                const keyLink = (execArr[2] || execArr[1]).replace(/\s+/g, ' ');
                const link = this.links[keyLink.toLowerCase()];
                if (!link || !link.href) {
                    out += execArr[0].charAt(0);
                    nextPart = execArr[0].substring(1) + nextPart;
                    continue;
                }
                this.inLink = true;
                out += this.outputLink(execArr, link);
                this.inLink = false;
                continue;
            }
            // strong
            if ((execArr = this.rules.strong.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                out += this.renderer.strong(this.output(execArr[2] || execArr[1]));
                continue;
            }
            // em
            if ((execArr = this.rules.em.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                out += this.renderer.em(this.output(execArr[2] || execArr[1]));
                continue;
            }
            // code
            if ((execArr = this.rules.code.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                out += this.renderer.codespan(this.options.escape(execArr[2].trim(), true));
                continue;
            }
            // br
            if ((execArr = this.rules.br.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                out += this.renderer.br();
                continue;
            }
            // del (gfm)
            if (this.hasRulesGfm && (execArr = this.rules.del.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                out += this.renderer.del(this.output(execArr[1]));
                continue;
            }
            // text
            if ((execArr = this.rules.text.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                out += this.renderer.text(this.options.escape(this.smartypants(execArr[0])));
                continue;
            }
            if (nextPart) {
                throw new Error('Infinite loop on byte: ' + nextPart.charCodeAt(0));
            }
        }
        return out;
    }
    /**
     * Compile Link.
     */
    outputLink(execArr, link) {
        const href = this.options.escape(link.href);
        const title = link.title ? this.options.escape(link.title) : null;
        return execArr[0].charAt(0) !== '!'
            ? this.renderer.link(href, title, this.output(execArr[1]))
            : this.renderer.image(href, title, this.options.escape(execArr[1]));
    }
    /**
     * Smartypants Transformations.
     */
    smartypants(text) {
        if (!this.options.smartypants) {
            return text;
        }
        return (text
            // em-dashes
            .replace(/---/g, '\u2014')
            // en-dashes
            .replace(/--/g, '\u2013')
            // opening singles
            .replace(/(^|[-\u2014/([{"\s])'/g, '$1\u2018')
            // closing singles & apostrophes
            .replace(/'/g, '\u2019')
            // opening doubles
            .replace(/(^|[-\u2014/([{\u2018\s])"/g, '$1\u201c')
            // closing doubles
            .replace(/"/g, '\u201d')
            // ellipses
            .replace(/\.{3}/g, '\u2026'));
    }
    /**
     * Mangle Links.
     */
    mangle(text) {
        if (!this.options.mangle) {
            return text;
        }
        let out = '';
        const length = text.length;
        for (let i = 0; i < length; i++) {
            let str;
            if (Math.random() > 0.5) {
                str = 'x' + text.charCodeAt(i).toString(16);
            }
            out += '&#' + str + ';';
        }
        return out;
    }
}

/**
 * @license
 *
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked
 *
 * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
 * https://github.com/ts-stack/markdown
 */
/**
 * Parsing & Compiling.
 */
class Parser {
    simpleRenderers = [];
    tokens;
    token;
    inlineLexer;
    options;
    renderer;
    line = 0;
    constructor(options) {
        this.tokens = [];
        this.token = null;
        this.options = options || Marked.options;
        this.renderer = this.options.renderer || new Renderer(this.options);
    }
    static parse(tokens, links, options) {
        const parser = new this(options);
        return parser.parse(links, tokens);
    }
    parse(links, tokens) {
        this.inlineLexer = new InlineLexer(InlineLexer, links, this.options, this.renderer);
        this.tokens = tokens.reverse();
        let out = '';
        while (this.next()) {
            out += this.tok();
        }
        return out;
    }
    debug(links, tokens) {
        this.inlineLexer = new InlineLexer(InlineLexer, links, this.options, this.renderer);
        this.tokens = tokens.reverse();
        let out = '';
        while (this.next()) {
            const outToken = this.tok();
            this.token.line = this.line += outToken.split('\n').length - 1;
            out += outToken;
        }
        return out;
    }
    next() {
        return (this.token = this.tokens.pop());
    }
    getNextElement() {
        return this.tokens[this.tokens.length - 1];
    }
    parseText() {
        let body = this.token.text;
        let nextElement;
        while ((nextElement = this.getNextElement()) && nextElement.type == TokenType.text) {
            body += '\n' + this.next().text;
        }
        return this.inlineLexer.output(body);
    }
    tok() {
        switch (this.token.type) {
            case TokenType.space: {
                return '';
            }
            case TokenType.paragraph: {
                return this.renderer.paragraph(this.inlineLexer.output(this.token.text));
            }
            case TokenType.text: {
                if (this.options.isNoP) {
                    return this.parseText();
                }
                else {
                    return this.renderer.paragraph(this.parseText());
                }
            }
            case TokenType.heading: {
                return this.renderer.heading(this.inlineLexer.output(this.token.text), this.token.depth, this.token.text);
            }
            case TokenType.listStart: {
                let body = '';
                const ordered = this.token.ordered;
                while (this.next().type != TokenType.listEnd) {
                    body += this.tok();
                }
                return this.renderer.list(body, ordered);
            }
            case TokenType.listItemStart: {
                let body = '';
                while (this.next().type != TokenType.listItemEnd) {
                    body += this.token.type == TokenType.text ? this.parseText() : this.tok();
                }
                return this.renderer.listitem(body);
            }
            case TokenType.looseItemStart: {
                let body = '';
                while (this.next().type != TokenType.listItemEnd) {
                    body += this.tok();
                }
                return this.renderer.listitem(body);
            }
            case TokenType.code: {
                return this.renderer.code(this.token.text, this.token.lang, this.token.escaped, this.token.meta);
            }
            case TokenType.table: {
                let header = '';
                let body = '';
                let cell;
                // header
                cell = '';
                for (let i = 0; i < this.token.header.length; i++) {
                    const flags = { header: true, align: this.token.align[i] };
                    const out = this.inlineLexer.output(this.token.header[i]);
                    cell += this.renderer.tablecell(out, flags);
                }
                header += this.renderer.tablerow(cell);
                for (const row of this.token.cells) {
                    cell = '';
                    for (let j = 0; j < row.length; j++) {
                        cell += this.renderer.tablecell(this.inlineLexer.output(row[j]), {
                            header: false,
                            align: this.token.align[j]
                        });
                    }
                    body += this.renderer.tablerow(cell);
                }
                return this.renderer.table(header, body);
            }
            case TokenType.blockquoteStart: {
                let body = '';
                while (this.next().type != TokenType.blockquoteEnd) {
                    body += this.tok();
                }
                return this.renderer.blockquote(body);
            }
            case TokenType.hr: {
                return this.renderer.hr();
            }
            case TokenType.html: {
                const html = !this.token.pre && !this.options.pedantic ? this.inlineLexer.output(this.token.text) : this.token.text;
                return this.renderer.html(html);
            }
            default: {
                if (this.simpleRenderers.length) {
                    for (let i = 0; i < this.simpleRenderers.length; i++) {
                        if (this.token.type == 'simpleRule' + (i + 1)) {
                            return this.simpleRenderers[i].call(this.renderer, this.token.execArr);
                        }
                    }
                }
                const errMsg = `Token with "${this.token.type}" type was not found.`;
                if (this.options.silent) {
                    console.log(errMsg);
                }
                else {
                    throw new Error(errMsg);
                }
            }
        }
    }
}

/**
 * @license
 *
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked
 *
 * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
 * https://github.com/ts-stack/markdown
 */
class Marked {
    static options = new MarkedOptions();
    static simpleRenderers = [];
    /**
     * Merges the default options with options that will be set.
     *
     * @param options Hash of options.
     */
    static setOptions(options) {
        Object.assign(this.options, options);
        return this;
    }
    /**
     * Setting simple block rule.
     */
    static setBlockRule(regexp, renderer = () => '') {
        BlockLexer.simpleRules.push(regexp);
        this.simpleRenderers.push(renderer);
        return this;
    }
    /**
     * Accepts Markdown text and returns text in HTML format.
     *
     * @param src String of markdown source to be compiled.
     * @param options Hash of options. They replace, but do not merge with the default options.
     * If you want the merging, you can to do this via `Marked.setOptions()`.
     */
    static parse(src, options) {
        try {
            options = { ...this.options, ...options };
            const { tokens, links } = this.callBlockLexer(src, options);
            return this.callParser(tokens, links, options);
        }
        catch (e) {
            return this.callMe(e);
        }
    }
    /**
     * Accepts Markdown text and returns object with text in HTML format,
     * tokens and links from `BlockLexer.parser()`.
     *
     * @param src String of markdown source to be compiled.
     * @param options Hash of options. They replace, but do not merge with the default options.
     * If you want the merging, you can to do this via `Marked.setOptions()`.
     */
    static debug(src, options = this.options) {
        const { tokens, links } = this.callBlockLexer(src, options);
        let origin = tokens.slice();
        const parser = new Parser(options);
        parser.simpleRenderers = this.simpleRenderers;
        const result = parser.debug(links, tokens);
        /**
         * Translates a token type into a readable form,
         * and moves `line` field to a first place in a token object.
         */
        origin = origin.map((token) => {
            token.type = TokenType[token.type] || token.type;
            const line = token.line;
            delete token.line;
            if (line) {
                return { ...{ line }, ...token };
            }
            else {
                return token;
            }
        });
        return { tokens: origin, links, result };
    }
    static callBlockLexer(src = '', options) {
        if (typeof src != 'string') {
            throw new Error(`Expected that the 'src' parameter would have a 'string' type, got '${typeof src}'`);
        }
        // Preprocessing.
        src = src
            .replace(/\r\n|\r/g, '\n')
            .replace(/\t/g, '    ')
            .replace(/\u00a0/g, ' ')
            .replace(/\u2424/g, '\n')
            .replace(/^ +$/gm, '');
        return BlockLexer.lex(src, options, true);
    }
    static callParser(tokens, links, options) {
        if (this.simpleRenderers.length) {
            const parser = new Parser(options);
            parser.simpleRenderers = this.simpleRenderers;
            return parser.parse(links, tokens);
        }
        else {
            return Parser.parse(tokens, links, options);
        }
    }
    static callMe(err) {
        err.message += '\nPlease report this to https://github.com/ts-stack/markdown';
        if (this.options.silent) {
            return '<p>An error occured:</p><pre>' + this.options.escape(err.message + '', true) + '</pre>';
        }
        throw err;
    }
}

/**
 * @license
 *
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked
 *
 * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
 * https://github.com/ts-stack/markdown
 */
class BlockLexer {
    staticThis;
    static simpleRules = [];
    static rulesBase = null;
    /**
     * GFM Block Grammar.
     */
    static rulesGfm = null;
    /**
     * GFM + Tables Block Grammar.
     */
    static rulesTables = null;
    rules;
    options;
    links = {};
    tokens = [];
    hasRulesGfm;
    hasRulesTables;
    constructor(staticThis, options) {
        this.staticThis = staticThis;
        this.options = options || Marked.options;
        this.setRules();
    }
    /**
     * Accepts Markdown text and returns object with tokens and links.
     *
     * @param src String of markdown source to be compiled.
     * @param options Hash of options.
     */
    static lex(src, options, top, isBlockQuote) {
        const lexer = new this(this, options);
        return lexer.getTokens(src, top, isBlockQuote);
    }
    static getRulesBase() {
        if (this.rulesBase) {
            return this.rulesBase;
        }
        const base = {
            newline: /^\n+/,
            code: /^( {4}[^\n]+\n*)+/,
            hr: /^( *[-*_]){3,} *(?:\n+|$)/,
            heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/,
            lheading: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/,
            blockquote: /^( *>[^\n]+(\n[^\n]+)*\n*)+/,
            list: /^( *)(bull) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
            html: /^ *(?:comment *(?:\n|\s*$)|closed *(?:\n{2,}|\s*$)|closing *(?:\n{2,}|\s*$))/,
            def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
            paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
            text: /^[^\n]+/,
            bullet: /(?:[*+-]|\d+\.)/,
            item: /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/,
        };
        base.item = new ExtendRegexp(base.item, 'gm').setGroup(/bull/g, base.bullet).getRegexp();
        base.list = new ExtendRegexp(base.list)
            .setGroup(/bull/g, base.bullet)
            .setGroup('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')
            .setGroup('def', '\\n+(?=' + base.def.source + ')')
            .getRegexp();
        const tag = '(?!(?:' +
            'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code' +
            '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo' +
            '|span|br|wbr|ins|del|img)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b';
        base.html = new ExtendRegexp(base.html)
            .setGroup('comment', /<!--[\s\S]*?-->/)
            .setGroup('closed', /<(tag)[\s\S]+?<\/\1>/)
            .setGroup('closing', /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)
            .setGroup(/tag/g, tag)
            .getRegexp();
        base.paragraph = new ExtendRegexp(base.paragraph)
            .setGroup('hr', base.hr)
            .setGroup('heading', base.heading)
            .setGroup('lheading', base.lheading)
            .setGroup('blockquote', base.blockquote)
            .setGroup('tag', '<' + tag)
            .setGroup('def', base.def)
            .getRegexp();
        return (this.rulesBase = base);
    }
    static getRulesGfm() {
        if (this.rulesGfm) {
            return this.rulesGfm;
        }
        const base = this.getRulesBase();
        const gfm = {
            ...base,
            ...{
                fences: /^ *(`{3,}|~{3,})[ \.]*((\S+)? *[^\n]*)\n([\s\S]*?)\s*\1 *(?:\n+|$)/,
                paragraph: /^/,
                heading: /^ *(#{1,6}) +([^\n]+?) *#* *(?:\n+|$)/,
            },
        };
        const group1 = gfm.fences.source.replace('\\1', '\\2');
        const group2 = base.list.source.replace('\\1', '\\3');
        gfm.paragraph = new ExtendRegexp(base.paragraph).setGroup('(?!', `(?!${group1}|${group2}|`).getRegexp();
        return (this.rulesGfm = gfm);
    }
    static getRulesTable() {
        if (this.rulesTables) {
            return this.rulesTables;
        }
        return (this.rulesTables = {
            ...this.getRulesGfm(),
            ...{
                nptable: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/,
                table: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/,
            },
        });
    }
    setRules() {
        if (this.options.gfm) {
            if (this.options.tables) {
                this.rules = this.staticThis.getRulesTable();
            }
            else {
                this.rules = this.staticThis.getRulesGfm();
            }
        }
        else {
            this.rules = this.staticThis.getRulesBase();
        }
        this.hasRulesGfm = this.rules.fences !== undefined;
        this.hasRulesTables = this.rules.table !== undefined;
    }
    /**
     * Lexing.
     */
    getTokens(src, top, isBlockQuote) {
        let nextPart = src;
        let execArr;
        mainLoop: while (nextPart) {
            // newline
            if ((execArr = this.rules.newline.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                if (execArr[0].length > 1) {
                    this.tokens.push({ type: TokenType.space });
                }
            }
            // code
            if ((execArr = this.rules.code.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                const code = execArr[0].replace(/^ {4}/gm, '');
                this.tokens.push({
                    type: TokenType.code,
                    text: !this.options.pedantic ? code.replace(/\n+$/, '') : code,
                });
                continue;
            }
            // fences code (gfm)
            if (this.hasRulesGfm && (execArr = this.rules.fences.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                this.tokens.push({
                    type: TokenType.code,
                    meta: execArr[2],
                    lang: execArr[3],
                    text: execArr[4] || '',
                });
                continue;
            }
            // heading
            if ((execArr = this.rules.heading.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                this.tokens.push({
                    type: TokenType.heading,
                    depth: execArr[1].length,
                    text: execArr[2],
                });
                continue;
            }
            // table no leading pipe (gfm)
            if (top && this.hasRulesTables && (execArr = this.rules.nptable.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                const item = {
                    type: TokenType.table,
                    header: execArr[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
                    align: execArr[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
                    cells: [],
                };
                for (let i = 0; i < item.align.length; i++) {
                    if (/^ *-+: *$/.test(item.align[i])) {
                        item.align[i] = 'right';
                    }
                    else if (/^ *:-+: *$/.test(item.align[i])) {
                        item.align[i] = 'center';
                    }
                    else if (/^ *:-+ *$/.test(item.align[i])) {
                        item.align[i] = 'left';
                    }
                    else {
                        item.align[i] = null;
                    }
                }
                const td = execArr[3].replace(/\n$/, '').split('\n');
                for (let i = 0; i < td.length; i++) {
                    item.cells[i] = td[i].split(/ *\| */);
                }
                this.tokens.push(item);
                continue;
            }
            // lheading
            if ((execArr = this.rules.lheading.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                this.tokens.push({
                    type: TokenType.heading,
                    depth: execArr[2] === '=' ? 1 : 2,
                    text: execArr[1],
                });
                continue;
            }
            // hr
            if ((execArr = this.rules.hr.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                this.tokens.push({ type: TokenType.hr });
                continue;
            }
            // blockquote
            if ((execArr = this.rules.blockquote.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                this.tokens.push({ type: TokenType.blockquoteStart });
                const str = execArr[0].replace(/^ *> ?/gm, '');
                // Pass `top` to keep the current
                // "toplevel" state. This is exactly
                // how markdown.pl works.
                this.getTokens(str);
                this.tokens.push({ type: TokenType.blockquoteEnd });
                continue;
            }
            // list
            if ((execArr = this.rules.list.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                const bull = execArr[2];
                this.tokens.push({ type: TokenType.listStart, ordered: bull.length > 1 });
                // Get each top-level item.
                const str = execArr[0].match(this.rules.item);
                const length = str.length;
                let next = false;
                let space;
                let blockBullet;
                let loose;
                for (let i = 0; i < length; i++) {
                    let item = str[i];
                    // Remove the list item's bullet so it is seen as the next token.
                    space = item.length;
                    item = item.replace(/^ *([*+-]|\d+\.) +/, '');
                    // Outdent whatever the list item contains. Hacky.
                    if (item.indexOf('\n ') !== -1) {
                        space -= item.length;
                        item = !this.options.pedantic
                            ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
                            : item.replace(/^ {1,4}/gm, '');
                    }
                    // Determine whether the next list item belongs here.
                    // Backpedal if it does not belong in this list.
                    if (this.options.smartLists && i !== length - 1) {
                        blockBullet = this.staticThis.getRulesBase().bullet.exec(str[i + 1])[0];
                        if (bull !== blockBullet && !(bull.length > 1 && blockBullet.length > 1)) {
                            nextPart = str.slice(i + 1).join('\n') + nextPart;
                            i = length - 1;
                        }
                    }
                    // Determine whether item is loose or not.
                    // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
                    // for discount behavior.
                    loose = next || /\n\n(?!\s*$)/.test(item);
                    if (i !== length - 1) {
                        next = item.charAt(item.length - 1) === '\n';
                        if (!loose) {
                            loose = next;
                        }
                    }
                    this.tokens.push({ type: loose ? TokenType.looseItemStart : TokenType.listItemStart });
                    // Recurse.
                    this.getTokens(item, false, isBlockQuote);
                    this.tokens.push({ type: TokenType.listItemEnd });
                }
                this.tokens.push({ type: TokenType.listEnd });
                continue;
            }
            // html
            if ((execArr = this.rules.html.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                const attr = execArr[1];
                const isPre = attr === 'pre' || attr === 'script' || attr === 'style';
                this.tokens.push({
                    type: this.options.sanitize ? TokenType.paragraph : TokenType.html,
                    pre: !this.options.sanitizer && isPre,
                    text: execArr[0],
                });
                continue;
            }
            // def
            if (top && (execArr = this.rules.def.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                this.links[execArr[1].toLowerCase()] = {
                    href: execArr[2],
                    title: execArr[3],
                };
                continue;
            }
            // table (gfm)
            if (top && this.hasRulesTables && (execArr = this.rules.table.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                const item = {
                    type: TokenType.table,
                    header: execArr[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
                    align: execArr[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
                    cells: [],
                };
                for (let i = 0; i < item.align.length; i++) {
                    if (/^ *-+: *$/.test(item.align[i])) {
                        item.align[i] = 'right';
                    }
                    else if (/^ *:-+: *$/.test(item.align[i])) {
                        item.align[i] = 'center';
                    }
                    else if (/^ *:-+ *$/.test(item.align[i])) {
                        item.align[i] = 'left';
                    }
                    else {
                        item.align[i] = null;
                    }
                }
                const td = execArr[3].replace(/(?: *\| *)?\n$/, '').split('\n');
                for (let i = 0; i < td.length; i++) {
                    item.cells[i] = td[i].replace(/^ *\| *| *\| *$/g, '').split(/ *\| */);
                }
                this.tokens.push(item);
                continue;
            }
            // simple rules
            if (this.staticThis.simpleRules.length) {
                const simpleRules = this.staticThis.simpleRules;
                for (let i = 0; i < simpleRules.length; i++) {
                    if ((execArr = simpleRules[i].exec(nextPart))) {
                        nextPart = nextPart.substring(execArr[0].length);
                        const type = 'simpleRule' + (i + 1);
                        this.tokens.push({ type, execArr });
                        continue mainLoop;
                    }
                }
            }
            // top-level paragraph
            if (top && (execArr = this.rules.paragraph.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                if (execArr[1].slice(-1) === '\n') {
                    this.tokens.push({
                        type: TokenType.paragraph,
                        text: execArr[1].slice(0, -1),
                    });
                }
                else {
                    this.tokens.push({
                        type: this.tokens.length > 0 ? TokenType.paragraph : TokenType.text,
                        text: execArr[1],
                    });
                }
                continue;
            }
            // text
            // Top-level should never reach here.
            if ((execArr = this.rules.text.exec(nextPart))) {
                nextPart = nextPart.substring(execArr[0].length);
                this.tokens.push({ type: TokenType.text, text: execArr[0] });
                continue;
            }
            if (nextPart) {
                throw new Error('Infinite loop on byte: ' + nextPart.charCodeAt(0) + `, near text '${nextPart.slice(0, 30)}...'`);
            }
        }
        return { tokens: this.tokens, links: this.links };
    }
}

const _tmpl$$a = /*#__PURE__*/template(`<div class="flex justify-end mb-2 items-end guest-container"><span class="px-4 py-2 mr-2 whitespace-pre-wrap max-w-full chatbot-guest-bubble" data-testid="guest-bubble">`);
Marked.setOptions({
  isNoP: true
});
const GuestBubble = props => {
  let userMessageEl;
  onMount(() => {
    if (userMessageEl) {
      userMessageEl.innerHTML = Marked.parse(props.message);
    }
  });
  return (() => {
    const _el$ = _tmpl$$a(),
      _el$2 = _el$.firstChild;
    _el$.style.setProperty("margin-left", "50px");
    const _ref$ = userMessageEl;
    typeof _ref$ === "function" ? use(_ref$, _el$2) : userMessageEl = _el$2;
    _el$2.style.setProperty("border-radius", "6px");
    insert(_el$, createComponent(Show, {
      get when() {
        return props.showAvatar;
      },
      get children() {
        return createComponent(Avatar, {
          get src() {
            return props.avatarSrc;
          }
        });
      }
    }), null);
    createRenderEffect(_p$ => {
      const _v$ = props.backgroundColor ?? Config.theme.messages.user.defaultBackgroundColor,
        _v$2 = props.textColor ?? Config.theme.messages.user.defaultTextColor;
      _v$ !== _p$._v$ && ((_p$._v$ = _v$) != null ? _el$2.style.setProperty("background-color", _v$) : _el$2.style.removeProperty("background-color"));
      _v$2 !== _p$._v$2 && ((_p$._v$2 = _v$2) != null ? _el$2.style.setProperty("color", _v$2) : _el$2.style.removeProperty("color"));
      return _p$;
    }, {
      _v$: undefined,
      _v$2: undefined
    });
    return _el$;
  })();
};

const _tmpl$$9 = /*#__PURE__*/template(`<div class="flex items-center"><div class="w-2 h-2 mr-1 rounded-full bubble1"></div><div class="w-2 h-2 mr-1 rounded-full bubble2"></div><div class="w-2 h-2 rounded-full bubble3">`);
const TypingBubble = props => (() => {
  const _el$ = _tmpl$$9(),
    _el$2 = _el$.firstChild,
    _el$3 = _el$2.nextSibling,
    _el$4 = _el$3.nextSibling;
  createRenderEffect(_p$ => {
    const _v$ = props.textColor,
      _v$2 = props.textColor,
      _v$3 = props.textColor;
    _v$ !== _p$._v$ && ((_p$._v$ = _v$) != null ? _el$2.style.setProperty("background-color", _v$) : _el$2.style.removeProperty("background-color"));
    _v$2 !== _p$._v$2 && ((_p$._v$2 = _v$2) != null ? _el$3.style.setProperty("background-color", _v$2) : _el$3.style.removeProperty("background-color"));
    _v$3 !== _p$._v$3 && ((_p$._v$3 = _v$3) != null ? _el$4.style.setProperty("background-color", _v$3) : _el$4.style.removeProperty("background-color"));
    return _p$;
  }, {
    _v$: undefined,
    _v$2: undefined,
    _v$3: undefined
  });
  return _el$;
})();

const _tmpl$$8 = /*#__PURE__*/template(`<div class="flex justify-start mb-2 items-start animate-fade-in host-container"><span class="px-4 py-4 ml-2 whitespace-pre-wrap max-w-full chatbot-host-bubble" data-testid="host-bubble">`);
const LoadingBubble = props => (() => {
  const _el$ = _tmpl$$8(),
    _el$2 = _el$.firstChild;
  insert(_el$2, createComponent(TypingBubble, {
    get textColor() {
      return props.textColor;
    }
  }));
  createRenderEffect(() => props.backgroundColor != null ? _el$2.style.setProperty("background-color", props.backgroundColor) : _el$2.style.removeProperty("background-color"));
  return _el$;
})();

const _tmpl$$7 = /*#__PURE__*/template(`<span class="px-4 py-2 ml-2 whitespace-pre-wrap max-w-full chatbot-host-bubble" data-testid="host-bubble">`),
  _tmpl$2$6 = /*#__PURE__*/template(`<div class="flex justify-start mb-2 items-start host-container">`);
Marked.setOptions({
  isNoP: true
});
const update_links = message => {
  const regex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g;
  //const result = message.match(regex);
  const result = regex.exec(message);
  //IF THE REGEX MATCHES, SPLIT STRINGS BY RESULT THEN COMBINE INTO MESSAGE AGAIN WITH INSERTED VALUE.
  if (result) {
    var split = message.split(result[0]);
    const new_message = split[0] + result[0] + ' target="_blank"' + split[1];
    return new_message;
  }
  return message;
};
const BotBubble = props => {
  let botMessageEl;
  onMount(() => {
    if (botMessageEl) {
      botMessageEl.innerHTML = update_links(Marked.parse(props.message));
    }
  });
  const showAvatar = props.showAvatar === undefined ? true : props.showAvatar;
  return (() => {
    const _el$ = _tmpl$2$6();
    _el$.style.setProperty("margin-right", "50px");
    insert(_el$, createComponent(Show, {
      when: showAvatar,
      get children() {
        return createComponent(Avatar, {
          get src() {
            return props.avatarSrc;
          },
          liveIcon: "dot",
          isLive: true
        });
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return !props.loading;
      },
      get fallback() {
        return createComponent(LoadingBubble, {
          get backgroundColor() {
            return props.backgroundColor ?? Config.theme.messages.bot.defaultBackgroundColor;
          },
          get textColor() {
            return props.textColor ?? Config.theme.messages.bot.defaultTextColor;
          }
        });
      },
      get children() {
        const _el$2 = _tmpl$$7();
        const _ref$ = botMessageEl;
        typeof _ref$ === "function" ? use(_ref$, _el$2) : botMessageEl = _el$2;
        createRenderEffect(_p$ => {
          const _v$ = props.backgroundColor ?? Config.theme.messages.bot.defaultBackgroundColor,
            _v$2 = props.textColor ?? Config.theme.messages.bot.defaultTextColor;
          _v$ !== _p$._v$ && ((_p$._v$ = _v$) != null ? _el$2.style.setProperty("background-color", _v$) : _el$2.style.removeProperty("background-color"));
          _v$2 !== _p$._v$2 && ((_p$._v$2 = _v$2) != null ? _el$2.style.setProperty("color", _v$2) : _el$2.style.removeProperty("color"));
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });
        return _el$2;
      }
    }), null);
    return _el$;
  })();
};

const _tmpl$$6 = /*#__PURE__*/template(`<div data-modal-target="defaultModal" data-modal-toggle="defaultModal" class="flex justify-start mb-2 items-start animate-fade-in host-container hover:brightness-90 active:brightness-75"><span class="px-2 py-1 ml-1 whitespace-pre-wrap max-w-full chatbot-host-bubble" data-testid="host-bubble">`);
const SourceBubble = props => (() => {
  const _el$ = _tmpl$$6(),
    _el$2 = _el$.firstChild;
  _el$.$$click = () => props.onSourceClick?.();
  _el$2.style.setProperty("width", "max-content");
  _el$2.style.setProperty("max-width", "80px");
  _el$2.style.setProperty("font-size", "13px");
  _el$2.style.setProperty("border-radius", "15px");
  _el$2.style.setProperty("cursor", "pointer");
  _el$2.style.setProperty("text-overflow", "ellipsis");
  _el$2.style.setProperty("overflow", "hidden");
  _el$2.style.setProperty("white-space", "nowrap");
  insert(_el$2, () => props.pageContent);
  return _el$;
})();
delegateEvents(["click"]);

const _tmpl$$5 = /*#__PURE__*/template(`<div class="w-full h-10 flex items-center justify-center text-center">`),
  _tmpl$2$5 = /*#__PURE__*/template(`<span class="leading-4">`),
  _tmpl$3$4 = /*#__PURE__*/template(`<span class="leading-4">Powered by <a href="https://www.realty-ai.ca" target="_blank" rel="noopener noreferrer" class="lite-badge" id="lite-badge"><span>Realty AI`);
const defaultTextColor = "#303235";
const Badge = props => {
  let liteBadge;
  let observer;
  const appendBadgeIfNecessary = mutations => {
    mutations.forEach(mutation => {
      mutation.removedNodes.forEach(removedNode => {
        if ("id" in removedNode && liteBadge && removedNode.id == "lite-badge") {
          // prettier-ignore
          // console.log("%c[REALTY-AI-BOT]", "color: #3B81F6; font-weight: bold;", "Sorry, you can't remove the brand 😅");
          props.botContainer?.append(liteBadge);
        }
      });
    });
  };
  onMount(() => {
    if (!document || !props.botContainer) return;
    observer = new MutationObserver(appendBadgeIfNecessary);
    observer.observe(props.botContainer, {
      subtree: false,
      childList: true
    });
  });
  onCleanup(() => {
    if (observer) observer.disconnect();
  });
  return (() => {
    const _el$ = _tmpl$$5();
    _el$.style.setProperty("font-size", "13px");
    _el$.style.setProperty("position", "absolute");
    _el$.style.setProperty("bottom", "0");
    insert(_el$, (() => {
      const _c$ = createMemo(() => !!props.badgeText);
      return () => _c$() ? (() => {
        const _el$2 = _tmpl$2$5();
        _el$2.style.setProperty("font-weight", "bold");
        insert(_el$2, () => props.badgeText);
        createRenderEffect(() => (props.poweredByTextColor ?? defaultTextColor) != null ? _el$2.style.setProperty("color", props.poweredByTextColor ?? defaultTextColor) : _el$2.style.removeProperty("color"));
        return _el$2;
      })() : (() => {
        const _el$3 = _tmpl$3$4(),
          _el$4 = _el$3.firstChild,
          _el$6 = _el$4.nextSibling;
        const _ref$ = liteBadge;
        typeof _ref$ === "function" ? use(_ref$, _el$6) : liteBadge = _el$6;
        _el$6.style.setProperty("font-weight", "bold");
        createRenderEffect(() => (props.poweredByTextColor ?? defaultTextColor) != null ? _el$6.style.setProperty("color", props.poweredByTextColor ?? defaultTextColor) : _el$6.style.removeProperty("color"));
        return _el$3;
      })();
    })());
    createRenderEffect(_p$ => {
      const _v$ = props.poweredByTextColor ?? defaultTextColor,
        _v$2 = props.badgeBackgroundColor ?? "#ffffff";
      _v$ !== _p$._v$ && ((_p$._v$ = _v$) != null ? _el$.style.setProperty("color", _v$) : _el$.style.removeProperty("color"));
      _v$2 !== _p$._v$2 && ((_p$._v$2 = _v$2) != null ? _el$.style.setProperty("background-color", _v$2) : _el$.style.removeProperty("background-color"));
      return _p$;
    }, {
      _v$: undefined,
      _v$2: undefined
    });
    return _el$;
  })();
};

const PACKET_TYPES = Object.create(null); // no Map = no polyfill
PACKET_TYPES["open"] = "0";
PACKET_TYPES["close"] = "1";
PACKET_TYPES["ping"] = "2";
PACKET_TYPES["pong"] = "3";
PACKET_TYPES["message"] = "4";
PACKET_TYPES["upgrade"] = "5";
PACKET_TYPES["noop"] = "6";
const PACKET_TYPES_REVERSE = Object.create(null);
Object.keys(PACKET_TYPES).forEach(key => {
    PACKET_TYPES_REVERSE[PACKET_TYPES[key]] = key;
});
const ERROR_PACKET = { type: "error", data: "parser error" };

const withNativeBlob$1 = typeof Blob === "function" ||
    (typeof Blob !== "undefined" &&
        Object.prototype.toString.call(Blob) === "[object BlobConstructor]");
const withNativeArrayBuffer$2 = typeof ArrayBuffer === "function";
// ArrayBuffer.isView method is not defined in IE10
const isView$1 = obj => {
    return typeof ArrayBuffer.isView === "function"
        ? ArrayBuffer.isView(obj)
        : obj && obj.buffer instanceof ArrayBuffer;
};
const encodePacket = ({ type, data }, supportsBinary, callback) => {
    if (withNativeBlob$1 && data instanceof Blob) {
        if (supportsBinary) {
            return callback(data);
        }
        else {
            return encodeBlobAsBase64(data, callback);
        }
    }
    else if (withNativeArrayBuffer$2 &&
        (data instanceof ArrayBuffer || isView$1(data))) {
        if (supportsBinary) {
            return callback(data);
        }
        else {
            return encodeBlobAsBase64(new Blob([data]), callback);
        }
    }
    // plain string
    return callback(PACKET_TYPES[type] + (data || ""));
};
const encodeBlobAsBase64 = (data, callback) => {
    const fileReader = new FileReader();
    fileReader.onload = function () {
        const content = fileReader.result.split(",")[1];
        callback("b" + (content || ""));
    };
    return fileReader.readAsDataURL(data);
};
function toArray(data) {
    if (data instanceof Uint8Array) {
        return data;
    }
    else if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    }
    else {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
}
let TEXT_ENCODER;
function encodePacketToBinary(packet, callback) {
    if (withNativeBlob$1 && packet.data instanceof Blob) {
        return packet.data
            .arrayBuffer()
            .then(toArray)
            .then(callback);
    }
    else if (withNativeArrayBuffer$2 &&
        (packet.data instanceof ArrayBuffer || isView$1(packet.data))) {
        return callback(toArray(packet.data));
    }
    encodePacket(packet, false, encoded => {
        if (!TEXT_ENCODER) {
            TEXT_ENCODER = new TextEncoder();
        }
        callback(TEXT_ENCODER.encode(encoded));
    });
}

// imported from https://github.com/socketio/base64-arraybuffer
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
// Use a lookup table to find the index.
const lookup$1 = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
    lookup$1[chars.charCodeAt(i)] = i;
}
const decode$1 = (base64) => {
    let bufferLength = base64.length * 0.75, len = base64.length, i, p = 0, encoded1, encoded2, encoded3, encoded4;
    if (base64[base64.length - 1] === '=') {
        bufferLength--;
        if (base64[base64.length - 2] === '=') {
            bufferLength--;
        }
    }
    const arraybuffer = new ArrayBuffer(bufferLength), bytes = new Uint8Array(arraybuffer);
    for (i = 0; i < len; i += 4) {
        encoded1 = lookup$1[base64.charCodeAt(i)];
        encoded2 = lookup$1[base64.charCodeAt(i + 1)];
        encoded3 = lookup$1[base64.charCodeAt(i + 2)];
        encoded4 = lookup$1[base64.charCodeAt(i + 3)];
        bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
        bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
    return arraybuffer;
};

const withNativeArrayBuffer$1 = typeof ArrayBuffer === "function";
const decodePacket = (encodedPacket, binaryType) => {
    if (typeof encodedPacket !== "string") {
        return {
            type: "message",
            data: mapBinary(encodedPacket, binaryType)
        };
    }
    const type = encodedPacket.charAt(0);
    if (type === "b") {
        return {
            type: "message",
            data: decodeBase64Packet(encodedPacket.substring(1), binaryType)
        };
    }
    const packetType = PACKET_TYPES_REVERSE[type];
    if (!packetType) {
        return ERROR_PACKET;
    }
    return encodedPacket.length > 1
        ? {
            type: PACKET_TYPES_REVERSE[type],
            data: encodedPacket.substring(1)
        }
        : {
            type: PACKET_TYPES_REVERSE[type]
        };
};
const decodeBase64Packet = (data, binaryType) => {
    if (withNativeArrayBuffer$1) {
        const decoded = decode$1(data);
        return mapBinary(decoded, binaryType);
    }
    else {
        return { base64: true, data }; // fallback for old browsers
    }
};
const mapBinary = (data, binaryType) => {
    switch (binaryType) {
        case "blob":
            if (data instanceof Blob) {
                // from WebSocket + binaryType "blob"
                return data;
            }
            else {
                // from HTTP long-polling or WebTransport
                return new Blob([data]);
            }
        case "arraybuffer":
        default:
            if (data instanceof ArrayBuffer) {
                // from HTTP long-polling (base64) or WebSocket + binaryType "arraybuffer"
                return data;
            }
            else {
                // from WebTransport (Uint8Array)
                return data.buffer;
            }
    }
};

const SEPARATOR = String.fromCharCode(30); // see https://en.wikipedia.org/wiki/Delimiter#ASCII_delimited_text
const encodePayload = (packets, callback) => {
    // some packets may be added to the array while encoding, so the initial length must be saved
    const length = packets.length;
    const encodedPackets = new Array(length);
    let count = 0;
    packets.forEach((packet, i) => {
        // force base64 encoding for binary packets
        encodePacket(packet, false, encodedPacket => {
            encodedPackets[i] = encodedPacket;
            if (++count === length) {
                callback(encodedPackets.join(SEPARATOR));
            }
        });
    });
};
const decodePayload = (encodedPayload, binaryType) => {
    const encodedPackets = encodedPayload.split(SEPARATOR);
    const packets = [];
    for (let i = 0; i < encodedPackets.length; i++) {
        const decodedPacket = decodePacket(encodedPackets[i], binaryType);
        packets.push(decodedPacket);
        if (decodedPacket.type === "error") {
            break;
        }
    }
    return packets;
};
function createPacketEncoderStream() {
    return new TransformStream({
        transform(packet, controller) {
            encodePacketToBinary(packet, encodedPacket => {
                const payloadLength = encodedPacket.length;
                let header;
                // inspired by the WebSocket format: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#decoding_payload_length
                if (payloadLength < 126) {
                    header = new Uint8Array(1);
                    new DataView(header.buffer).setUint8(0, payloadLength);
                }
                else if (payloadLength < 65536) {
                    header = new Uint8Array(3);
                    const view = new DataView(header.buffer);
                    view.setUint8(0, 126);
                    view.setUint16(1, payloadLength);
                }
                else {
                    header = new Uint8Array(9);
                    const view = new DataView(header.buffer);
                    view.setUint8(0, 127);
                    view.setBigUint64(1, BigInt(payloadLength));
                }
                // first bit indicates whether the payload is plain text (0) or binary (1)
                if (packet.data && typeof packet.data !== "string") {
                    header[0] |= 0x80;
                }
                controller.enqueue(header);
                controller.enqueue(encodedPacket);
            });
        }
    });
}
let TEXT_DECODER;
function totalLength(chunks) {
    return chunks.reduce((acc, chunk) => acc + chunk.length, 0);
}
function concatChunks(chunks, size) {
    if (chunks[0].length === size) {
        return chunks.shift();
    }
    const buffer = new Uint8Array(size);
    let j = 0;
    for (let i = 0; i < size; i++) {
        buffer[i] = chunks[0][j++];
        if (j === chunks[0].length) {
            chunks.shift();
            j = 0;
        }
    }
    if (chunks.length && j < chunks[0].length) {
        chunks[0] = chunks[0].slice(j);
    }
    return buffer;
}
function createPacketDecoderStream(maxPayload, binaryType) {
    if (!TEXT_DECODER) {
        TEXT_DECODER = new TextDecoder();
    }
    const chunks = [];
    let state = 0 /* READ_HEADER */;
    let expectedLength = -1;
    let isBinary = false;
    return new TransformStream({
        transform(chunk, controller) {
            chunks.push(chunk);
            while (true) {
                if (state === 0 /* READ_HEADER */) {
                    if (totalLength(chunks) < 1) {
                        break;
                    }
                    const header = concatChunks(chunks, 1);
                    isBinary = (header[0] & 0x80) === 0x80;
                    expectedLength = header[0] & 0x7f;
                    if (expectedLength < 126) {
                        state = 3 /* READ_PAYLOAD */;
                    }
                    else if (expectedLength === 126) {
                        state = 1 /* READ_EXTENDED_LENGTH_16 */;
                    }
                    else {
                        state = 2 /* READ_EXTENDED_LENGTH_64 */;
                    }
                }
                else if (state === 1 /* READ_EXTENDED_LENGTH_16 */) {
                    if (totalLength(chunks) < 2) {
                        break;
                    }
                    const headerArray = concatChunks(chunks, 2);
                    expectedLength = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length).getUint16(0);
                    state = 3 /* READ_PAYLOAD */;
                }
                else if (state === 2 /* READ_EXTENDED_LENGTH_64 */) {
                    if (totalLength(chunks) < 8) {
                        break;
                    }
                    const headerArray = concatChunks(chunks, 8);
                    const view = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length);
                    const n = view.getUint32(0);
                    if (n > Math.pow(2, 53 - 32) - 1) {
                        // the maximum safe integer in JavaScript is 2^53 - 1
                        controller.enqueue(ERROR_PACKET);
                        break;
                    }
                    expectedLength = n * Math.pow(2, 32) + view.getUint32(4);
                    state = 3 /* READ_PAYLOAD */;
                }
                else {
                    if (totalLength(chunks) < expectedLength) {
                        break;
                    }
                    const data = concatChunks(chunks, expectedLength);
                    controller.enqueue(decodePacket(isBinary ? data : TEXT_DECODER.decode(data), binaryType));
                    state = 0 /* READ_HEADER */;
                }
                if (expectedLength === 0 || expectedLength > maxPayload) {
                    controller.enqueue(ERROR_PACKET);
                    break;
                }
            }
        }
    });
}
const protocol$1 = 4;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
}

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  function on() {
    this.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks['$' + event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks['$' + event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }

  // Remove event specific arrays for event types that no
  // one is subscribed for to avoid memory leak.
  if (callbacks.length === 0) {
    delete this._callbacks['$' + event];
  }

  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};

  var args = new Array(arguments.length - 1)
    , callbacks = this._callbacks['$' + event];

  for (var i = 1; i < arguments.length; i++) {
    args[i - 1] = arguments[i];
  }

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

// alias used for reserved events (protected method)
Emitter.prototype.emitReserved = Emitter.prototype.emit;

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks['$' + event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

const globalThisShim = (() => {
    if (typeof self !== "undefined") {
        return self;
    }
    else if (typeof window !== "undefined") {
        return window;
    }
    else {
        return Function("return this")();
    }
})();

function pick(obj, ...attr) {
    return attr.reduce((acc, k) => {
        if (obj.hasOwnProperty(k)) {
            acc[k] = obj[k];
        }
        return acc;
    }, {});
}
// Keep a reference to the real timeout functions so they can be used when overridden
const NATIVE_SET_TIMEOUT = globalThisShim.setTimeout;
const NATIVE_CLEAR_TIMEOUT = globalThisShim.clearTimeout;
function installTimerFunctions(obj, opts) {
    if (opts.useNativeTimers) {
        obj.setTimeoutFn = NATIVE_SET_TIMEOUT.bind(globalThisShim);
        obj.clearTimeoutFn = NATIVE_CLEAR_TIMEOUT.bind(globalThisShim);
    }
    else {
        obj.setTimeoutFn = globalThisShim.setTimeout.bind(globalThisShim);
        obj.clearTimeoutFn = globalThisShim.clearTimeout.bind(globalThisShim);
    }
}
// base64 encoded buffers are about 33% bigger (https://en.wikipedia.org/wiki/Base64)
const BASE64_OVERHEAD = 1.33;
// we could also have used `new Blob([obj]).size`, but it isn't supported in IE9
function byteLength(obj) {
    if (typeof obj === "string") {
        return utf8Length(obj);
    }
    // arraybuffer or blob
    return Math.ceil((obj.byteLength || obj.size) * BASE64_OVERHEAD);
}
function utf8Length(str) {
    let c = 0, length = 0;
    for (let i = 0, l = str.length; i < l; i++) {
        c = str.charCodeAt(i);
        if (c < 0x80) {
            length += 1;
        }
        else if (c < 0x800) {
            length += 2;
        }
        else if (c < 0xd800 || c >= 0xe000) {
            length += 3;
        }
        else {
            i++;
            length += 4;
        }
    }
    return length;
}

// imported from https://github.com/galkn/querystring
/**
 * Compiles a querystring
 * Returns string representation of the object
 *
 * @param {Object}
 * @api private
 */
function encode$1(obj) {
    let str = '';
    for (let i in obj) {
        if (obj.hasOwnProperty(i)) {
            if (str.length)
                str += '&';
            str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
        }
    }
    return str;
}
/**
 * Parses a simple querystring into an object
 *
 * @param {String} qs
 * @api private
 */
function decode(qs) {
    let qry = {};
    let pairs = qs.split('&');
    for (let i = 0, l = pairs.length; i < l; i++) {
        let pair = pairs[i].split('=');
        qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
    }
    return qry;
}

class TransportError extends Error {
    constructor(reason, description, context) {
        super(reason);
        this.description = description;
        this.context = context;
        this.type = "TransportError";
    }
}
class Transport extends Emitter {
    /**
     * Transport abstract constructor.
     *
     * @param {Object} opts - options
     * @protected
     */
    constructor(opts) {
        super();
        this.writable = false;
        installTimerFunctions(this, opts);
        this.opts = opts;
        this.query = opts.query;
        this.socket = opts.socket;
    }
    /**
     * Emits an error.
     *
     * @param {String} reason
     * @param description
     * @param context - the error context
     * @return {Transport} for chaining
     * @protected
     */
    onError(reason, description, context) {
        super.emitReserved("error", new TransportError(reason, description, context));
        return this;
    }
    /**
     * Opens the transport.
     */
    open() {
        this.readyState = "opening";
        this.doOpen();
        return this;
    }
    /**
     * Closes the transport.
     */
    close() {
        if (this.readyState === "opening" || this.readyState === "open") {
            this.doClose();
            this.onClose();
        }
        return this;
    }
    /**
     * Sends multiple packets.
     *
     * @param {Array} packets
     */
    send(packets) {
        if (this.readyState === "open") {
            this.write(packets);
        }
    }
    /**
     * Called upon open
     *
     * @protected
     */
    onOpen() {
        this.readyState = "open";
        this.writable = true;
        super.emitReserved("open");
    }
    /**
     * Called with data.
     *
     * @param {String} data
     * @protected
     */
    onData(data) {
        const packet = decodePacket(data, this.socket.binaryType);
        this.onPacket(packet);
    }
    /**
     * Called with a decoded packet.
     *
     * @protected
     */
    onPacket(packet) {
        super.emitReserved("packet", packet);
    }
    /**
     * Called upon close.
     *
     * @protected
     */
    onClose(details) {
        this.readyState = "closed";
        super.emitReserved("close", details);
    }
    /**
     * Pauses the transport, in order not to lose packets during an upgrade.
     *
     * @param onPause
     */
    pause(onPause) { }
    createUri(schema, query = {}) {
        return (schema +
            "://" +
            this._hostname() +
            this._port() +
            this.opts.path +
            this._query(query));
    }
    _hostname() {
        const hostname = this.opts.hostname;
        return hostname.indexOf(":") === -1 ? hostname : "[" + hostname + "]";
    }
    _port() {
        if (this.opts.port &&
            ((this.opts.secure && Number(this.opts.port !== 443)) ||
                (!this.opts.secure && Number(this.opts.port) !== 80))) {
            return ":" + this.opts.port;
        }
        else {
            return "";
        }
    }
    _query(query) {
        const encodedQuery = encode$1(query);
        return encodedQuery.length ? "?" + encodedQuery : "";
    }
}

// imported from https://github.com/unshiftio/yeast
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'.split(''), length = 64, map = {};
let seed = 0, i = 0, prev;
/**
 * Return a string representing the specified number.
 *
 * @param {Number} num The number to convert.
 * @returns {String} The string representation of the number.
 * @api public
 */
function encode(num) {
    let encoded = '';
    do {
        encoded = alphabet[num % length] + encoded;
        num = Math.floor(num / length);
    } while (num > 0);
    return encoded;
}
/**
 * Yeast: A tiny growing id generator.
 *
 * @returns {String} A unique id.
 * @api public
 */
function yeast() {
    const now = encode(+new Date());
    if (now !== prev)
        return seed = 0, prev = now;
    return now + '.' + encode(seed++);
}
//
// Map each character to its index.
//
for (; i < length; i++)
    map[alphabet[i]] = i;

// imported from https://github.com/component/has-cors
let value = false;
try {
    value = typeof XMLHttpRequest !== 'undefined' &&
        'withCredentials' in new XMLHttpRequest();
}
catch (err) {
    // if XMLHttp support is disabled in IE then it will throw
    // when trying to create
}
const hasCORS = value;

// browser shim for xmlhttprequest module
function XHR(opts) {
    const xdomain = opts.xdomain;
    // XMLHttpRequest can be disabled on IE
    try {
        if ("undefined" !== typeof XMLHttpRequest && (!xdomain || hasCORS)) {
            return new XMLHttpRequest();
        }
    }
    catch (e) { }
    if (!xdomain) {
        try {
            return new globalThisShim[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP");
        }
        catch (e) { }
    }
}
function createCookieJar() { }

function empty() { }
const hasXHR2 = (function () {
    const xhr = new XHR({
        xdomain: false,
    });
    return null != xhr.responseType;
})();
class Polling extends Transport {
    /**
     * XHR Polling constructor.
     *
     * @param {Object} opts
     * @package
     */
    constructor(opts) {
        super(opts);
        this.polling = false;
        if (typeof location !== "undefined") {
            const isSSL = "https:" === location.protocol;
            let port = location.port;
            // some user agents have empty `location.port`
            if (!port) {
                port = isSSL ? "443" : "80";
            }
            this.xd =
                (typeof location !== "undefined" &&
                    opts.hostname !== location.hostname) ||
                    port !== opts.port;
        }
        /**
         * XHR supports binary
         */
        const forceBase64 = opts && opts.forceBase64;
        this.supportsBinary = hasXHR2 && !forceBase64;
        if (this.opts.withCredentials) {
            this.cookieJar = createCookieJar();
        }
    }
    get name() {
        return "polling";
    }
    /**
     * Opens the socket (triggers polling). We write a PING message to determine
     * when the transport is open.
     *
     * @protected
     */
    doOpen() {
        this.poll();
    }
    /**
     * Pauses polling.
     *
     * @param {Function} onPause - callback upon buffers are flushed and transport is paused
     * @package
     */
    pause(onPause) {
        this.readyState = "pausing";
        const pause = () => {
            this.readyState = "paused";
            onPause();
        };
        if (this.polling || !this.writable) {
            let total = 0;
            if (this.polling) {
                total++;
                this.once("pollComplete", function () {
                    --total || pause();
                });
            }
            if (!this.writable) {
                total++;
                this.once("drain", function () {
                    --total || pause();
                });
            }
        }
        else {
            pause();
        }
    }
    /**
     * Starts polling cycle.
     *
     * @private
     */
    poll() {
        this.polling = true;
        this.doPoll();
        this.emitReserved("poll");
    }
    /**
     * Overloads onData to detect payloads.
     *
     * @protected
     */
    onData(data) {
        const callback = (packet) => {
            // if its the first message we consider the transport open
            if ("opening" === this.readyState && packet.type === "open") {
                this.onOpen();
            }
            // if its a close packet, we close the ongoing requests
            if ("close" === packet.type) {
                this.onClose({ description: "transport closed by the server" });
                return false;
            }
            // otherwise bypass onData and handle the message
            this.onPacket(packet);
        };
        // decode payload
        decodePayload(data, this.socket.binaryType).forEach(callback);
        // if an event did not trigger closing
        if ("closed" !== this.readyState) {
            // if we got data we're not polling
            this.polling = false;
            this.emitReserved("pollComplete");
            if ("open" === this.readyState) {
                this.poll();
            }
        }
    }
    /**
     * For polling, send a close packet.
     *
     * @protected
     */
    doClose() {
        const close = () => {
            this.write([{ type: "close" }]);
        };
        if ("open" === this.readyState) {
            close();
        }
        else {
            // in case we're trying to close while
            // handshaking is in progress (GH-164)
            this.once("open", close);
        }
    }
    /**
     * Writes a packets payload.
     *
     * @param {Array} packets - data packets
     * @protected
     */
    write(packets) {
        this.writable = false;
        encodePayload(packets, (data) => {
            this.doWrite(data, () => {
                this.writable = true;
                this.emitReserved("drain");
            });
        });
    }
    /**
     * Generates uri for connection.
     *
     * @private
     */
    uri() {
        const schema = this.opts.secure ? "https" : "http";
        const query = this.query || {};
        // cache busting is forced
        if (false !== this.opts.timestampRequests) {
            query[this.opts.timestampParam] = yeast();
        }
        if (!this.supportsBinary && !query.sid) {
            query.b64 = 1;
        }
        return this.createUri(schema, query);
    }
    /**
     * Creates a request.
     *
     * @param {String} method
     * @private
     */
    request(opts = {}) {
        Object.assign(opts, { xd: this.xd, cookieJar: this.cookieJar }, this.opts);
        return new Request(this.uri(), opts);
    }
    /**
     * Sends data.
     *
     * @param {String} data to send.
     * @param {Function} called upon flush.
     * @private
     */
    doWrite(data, fn) {
        const req = this.request({
            method: "POST",
            data: data,
        });
        req.on("success", fn);
        req.on("error", (xhrStatus, context) => {
            this.onError("xhr post error", xhrStatus, context);
        });
    }
    /**
     * Starts a poll cycle.
     *
     * @private
     */
    doPoll() {
        const req = this.request();
        req.on("data", this.onData.bind(this));
        req.on("error", (xhrStatus, context) => {
            this.onError("xhr poll error", xhrStatus, context);
        });
        this.pollXhr = req;
    }
}
class Request extends Emitter {
    /**
     * Request constructor
     *
     * @param {Object} options
     * @package
     */
    constructor(uri, opts) {
        super();
        installTimerFunctions(this, opts);
        this.opts = opts;
        this.method = opts.method || "GET";
        this.uri = uri;
        this.data = undefined !== opts.data ? opts.data : null;
        this.create();
    }
    /**
     * Creates the XHR object and sends the request.
     *
     * @private
     */
    create() {
        var _a;
        const opts = pick(this.opts, "agent", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "autoUnref");
        opts.xdomain = !!this.opts.xd;
        const xhr = (this.xhr = new XHR(opts));
        try {
            xhr.open(this.method, this.uri, true);
            try {
                if (this.opts.extraHeaders) {
                    xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
                    for (let i in this.opts.extraHeaders) {
                        if (this.opts.extraHeaders.hasOwnProperty(i)) {
                            xhr.setRequestHeader(i, this.opts.extraHeaders[i]);
                        }
                    }
                }
            }
            catch (e) { }
            if ("POST" === this.method) {
                try {
                    xhr.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
                }
                catch (e) { }
            }
            try {
                xhr.setRequestHeader("Accept", "*/*");
            }
            catch (e) { }
            (_a = this.opts.cookieJar) === null || _a === void 0 ? void 0 : _a.addCookies(xhr);
            // ie6 check
            if ("withCredentials" in xhr) {
                xhr.withCredentials = this.opts.withCredentials;
            }
            if (this.opts.requestTimeout) {
                xhr.timeout = this.opts.requestTimeout;
            }
            xhr.onreadystatechange = () => {
                var _a;
                if (xhr.readyState === 3) {
                    (_a = this.opts.cookieJar) === null || _a === void 0 ? void 0 : _a.parseCookies(xhr);
                }
                if (4 !== xhr.readyState)
                    return;
                if (200 === xhr.status || 1223 === xhr.status) {
                    this.onLoad();
                }
                else {
                    // make sure the `error` event handler that's user-set
                    // does not throw in the same tick and gets caught here
                    this.setTimeoutFn(() => {
                        this.onError(typeof xhr.status === "number" ? xhr.status : 0);
                    }, 0);
                }
            };
            xhr.send(this.data);
        }
        catch (e) {
            // Need to defer since .create() is called directly from the constructor
            // and thus the 'error' event can only be only bound *after* this exception
            // occurs.  Therefore, also, we cannot throw here at all.
            this.setTimeoutFn(() => {
                this.onError(e);
            }, 0);
            return;
        }
        if (typeof document !== "undefined") {
            this.index = Request.requestsCount++;
            Request.requests[this.index] = this;
        }
    }
    /**
     * Called upon error.
     *
     * @private
     */
    onError(err) {
        this.emitReserved("error", err, this.xhr);
        this.cleanup(true);
    }
    /**
     * Cleans up house.
     *
     * @private
     */
    cleanup(fromError) {
        if ("undefined" === typeof this.xhr || null === this.xhr) {
            return;
        }
        this.xhr.onreadystatechange = empty;
        if (fromError) {
            try {
                this.xhr.abort();
            }
            catch (e) { }
        }
        if (typeof document !== "undefined") {
            delete Request.requests[this.index];
        }
        this.xhr = null;
    }
    /**
     * Called upon load.
     *
     * @private
     */
    onLoad() {
        const data = this.xhr.responseText;
        if (data !== null) {
            this.emitReserved("data", data);
            this.emitReserved("success");
            this.cleanup();
        }
    }
    /**
     * Aborts the request.
     *
     * @package
     */
    abort() {
        this.cleanup();
    }
}
Request.requestsCount = 0;
Request.requests = {};
/**
 * Aborts pending requests when unloading the window. This is needed to prevent
 * memory leaks (e.g. when using IE) and to ensure that no spurious error is
 * emitted.
 */
if (typeof document !== "undefined") {
    // @ts-ignore
    if (typeof attachEvent === "function") {
        // @ts-ignore
        attachEvent("onunload", unloadHandler);
    }
    else if (typeof addEventListener === "function") {
        const terminationEvent = "onpagehide" in globalThisShim ? "pagehide" : "unload";
        addEventListener(terminationEvent, unloadHandler, false);
    }
}
function unloadHandler() {
    for (let i in Request.requests) {
        if (Request.requests.hasOwnProperty(i)) {
            Request.requests[i].abort();
        }
    }
}

const nextTick = (() => {
    const isPromiseAvailable = typeof Promise === "function" && typeof Promise.resolve === "function";
    if (isPromiseAvailable) {
        return (cb) => Promise.resolve().then(cb);
    }
    else {
        return (cb, setTimeoutFn) => setTimeoutFn(cb, 0);
    }
})();
const WebSocket = globalThisShim.WebSocket || globalThisShim.MozWebSocket;
const usingBrowserWebSocket = true;
const defaultBinaryType = "arraybuffer";

// detect ReactNative environment
const isReactNative = typeof navigator !== "undefined" &&
    typeof navigator.product === "string" &&
    navigator.product.toLowerCase() === "reactnative";
class WS extends Transport {
    /**
     * WebSocket transport constructor.
     *
     * @param {Object} opts - connection options
     * @protected
     */
    constructor(opts) {
        super(opts);
        this.supportsBinary = !opts.forceBase64;
    }
    get name() {
        return "websocket";
    }
    doOpen() {
        if (!this.check()) {
            // let probe timeout
            return;
        }
        const uri = this.uri();
        const protocols = this.opts.protocols;
        // React Native only supports the 'headers' option, and will print a warning if anything else is passed
        const opts = isReactNative
            ? {}
            : pick(this.opts, "agent", "perMessageDeflate", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "localAddress", "protocolVersion", "origin", "maxPayload", "family", "checkServerIdentity");
        if (this.opts.extraHeaders) {
            opts.headers = this.opts.extraHeaders;
        }
        try {
            this.ws =
                usingBrowserWebSocket && !isReactNative
                    ? protocols
                        ? new WebSocket(uri, protocols)
                        : new WebSocket(uri)
                    : new WebSocket(uri, protocols, opts);
        }
        catch (err) {
            return this.emitReserved("error", err);
        }
        this.ws.binaryType = this.socket.binaryType;
        this.addEventListeners();
    }
    /**
     * Adds event listeners to the socket
     *
     * @private
     */
    addEventListeners() {
        this.ws.onopen = () => {
            if (this.opts.autoUnref) {
                this.ws._socket.unref();
            }
            this.onOpen();
        };
        this.ws.onclose = (closeEvent) => this.onClose({
            description: "websocket connection closed",
            context: closeEvent,
        });
        this.ws.onmessage = (ev) => this.onData(ev.data);
        this.ws.onerror = (e) => this.onError("websocket error", e);
    }
    write(packets) {
        this.writable = false;
        // encodePacket efficient as it uses WS framing
        // no need for encodePayload
        for (let i = 0; i < packets.length; i++) {
            const packet = packets[i];
            const lastPacket = i === packets.length - 1;
            encodePacket(packet, this.supportsBinary, (data) => {
                // always create a new object (GH-437)
                const opts = {};
                // Sometimes the websocket has already been closed but the browser didn't
                // have a chance of informing us about it yet, in that case send will
                // throw an error
                try {
                    if (usingBrowserWebSocket) {
                        // TypeError is thrown when passing the second argument on Safari
                        this.ws.send(data);
                    }
                }
                catch (e) {
                }
                if (lastPacket) {
                    // fake drain
                    // defer to next tick to allow Socket to clear writeBuffer
                    nextTick(() => {
                        this.writable = true;
                        this.emitReserved("drain");
                    }, this.setTimeoutFn);
                }
            });
        }
    }
    doClose() {
        if (typeof this.ws !== "undefined") {
            this.ws.close();
            this.ws = null;
        }
    }
    /**
     * Generates uri for connection.
     *
     * @private
     */
    uri() {
        const schema = this.opts.secure ? "wss" : "ws";
        const query = this.query || {};
        // append timestamp to URI
        if (this.opts.timestampRequests) {
            query[this.opts.timestampParam] = yeast();
        }
        // communicate binary support capabilities
        if (!this.supportsBinary) {
            query.b64 = 1;
        }
        return this.createUri(schema, query);
    }
    /**
     * Feature detection for WebSocket.
     *
     * @return {Boolean} whether this transport is available.
     * @private
     */
    check() {
        return !!WebSocket;
    }
}

class WT extends Transport {
    get name() {
        return "webtransport";
    }
    doOpen() {
        // @ts-ignore
        if (typeof WebTransport !== "function") {
            return;
        }
        // @ts-ignore
        this.transport = new WebTransport(this.createUri("https"), this.opts.transportOptions[this.name]);
        this.transport.closed
            .then(() => {
            this.onClose();
        })
            .catch((err) => {
            this.onError("webtransport error", err);
        });
        // note: we could have used async/await, but that would require some additional polyfills
        this.transport.ready.then(() => {
            this.transport.createBidirectionalStream().then((stream) => {
                const decoderStream = createPacketDecoderStream(Number.MAX_SAFE_INTEGER, this.socket.binaryType);
                const reader = stream.readable.pipeThrough(decoderStream).getReader();
                const encoderStream = createPacketEncoderStream();
                encoderStream.readable.pipeTo(stream.writable);
                this.writer = encoderStream.writable.getWriter();
                const read = () => {
                    reader
                        .read()
                        .then(({ done, value }) => {
                        if (done) {
                            return;
                        }
                        this.onPacket(value);
                        read();
                    })
                        .catch((err) => {
                    });
                };
                read();
                const packet = { type: "open" };
                if (this.query.sid) {
                    packet.data = `{"sid":"${this.query.sid}"}`;
                }
                this.writer.write(packet).then(() => this.onOpen());
            });
        });
    }
    write(packets) {
        this.writable = false;
        for (let i = 0; i < packets.length; i++) {
            const packet = packets[i];
            const lastPacket = i === packets.length - 1;
            this.writer.write(packet).then(() => {
                if (lastPacket) {
                    nextTick(() => {
                        this.writable = true;
                        this.emitReserved("drain");
                    }, this.setTimeoutFn);
                }
            });
        }
    }
    doClose() {
        var _a;
        (_a = this.transport) === null || _a === void 0 ? void 0 : _a.close();
    }
}

const transports = {
    websocket: WS,
    webtransport: WT,
    polling: Polling,
};

// imported from https://github.com/galkn/parseuri
/**
 * Parses a URI
 *
 * Note: we could also have used the built-in URL object, but it isn't supported on all platforms.
 *
 * See:
 * - https://developer.mozilla.org/en-US/docs/Web/API/URL
 * - https://caniuse.com/url
 * - https://www.rfc-editor.org/rfc/rfc3986#appendix-B
 *
 * History of the parse() method:
 * - first commit: https://github.com/socketio/socket.io-client/commit/4ee1d5d94b3906a9c052b459f1a818b15f38f91c
 * - export into its own module: https://github.com/socketio/engine.io-client/commit/de2c561e4564efeb78f1bdb1ba39ef81b2822cb3
 * - reimport: https://github.com/socketio/engine.io-client/commit/df32277c3f6d622eec5ed09f493cae3f3391d242
 *
 * @author Steven Levithan <stevenlevithan.com> (MIT license)
 * @api private
 */
const re = /^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
const parts = [
    'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
];
function parse(str) {
    const src = str, b = str.indexOf('['), e = str.indexOf(']');
    if (b != -1 && e != -1) {
        str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
    }
    let m = re.exec(str || ''), uri = {}, i = 14;
    while (i--) {
        uri[parts[i]] = m[i] || '';
    }
    if (b != -1 && e != -1) {
        uri.source = src;
        uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
        uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
        uri.ipv6uri = true;
    }
    uri.pathNames = pathNames(uri, uri['path']);
    uri.queryKey = queryKey(uri, uri['query']);
    return uri;
}
function pathNames(obj, path) {
    const regx = /\/{2,9}/g, names = path.replace(regx, "/").split("/");
    if (path.slice(0, 1) == '/' || path.length === 0) {
        names.splice(0, 1);
    }
    if (path.slice(-1) == '/') {
        names.splice(names.length - 1, 1);
    }
    return names;
}
function queryKey(uri, query) {
    const data = {};
    query.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function ($0, $1, $2) {
        if ($1) {
            data[$1] = $2;
        }
    });
    return data;
}

let Socket$1 = class Socket extends Emitter {
    /**
     * Socket constructor.
     *
     * @param {String|Object} uri - uri or options
     * @param {Object} opts - options
     */
    constructor(uri, opts = {}) {
        super();
        this.binaryType = defaultBinaryType;
        this.writeBuffer = [];
        if (uri && "object" === typeof uri) {
            opts = uri;
            uri = null;
        }
        if (uri) {
            uri = parse(uri);
            opts.hostname = uri.host;
            opts.secure = uri.protocol === "https" || uri.protocol === "wss";
            opts.port = uri.port;
            if (uri.query)
                opts.query = uri.query;
        }
        else if (opts.host) {
            opts.hostname = parse(opts.host).host;
        }
        installTimerFunctions(this, opts);
        this.secure =
            null != opts.secure
                ? opts.secure
                : typeof location !== "undefined" && "https:" === location.protocol;
        if (opts.hostname && !opts.port) {
            // if no port is specified manually, use the protocol default
            opts.port = this.secure ? "443" : "80";
        }
        this.hostname =
            opts.hostname ||
                (typeof location !== "undefined" ? location.hostname : "localhost");
        this.port =
            opts.port ||
                (typeof location !== "undefined" && location.port
                    ? location.port
                    : this.secure
                        ? "443"
                        : "80");
        this.transports = opts.transports || [
            "polling",
            "websocket",
            "webtransport",
        ];
        this.writeBuffer = [];
        this.prevBufferLen = 0;
        this.opts = Object.assign({
            path: "/engine.io",
            agent: false,
            withCredentials: false,
            upgrade: true,
            timestampParam: "t",
            rememberUpgrade: false,
            addTrailingSlash: true,
            rejectUnauthorized: true,
            perMessageDeflate: {
                threshold: 1024,
            },
            transportOptions: {},
            closeOnBeforeunload: false,
        }, opts);
        this.opts.path =
            this.opts.path.replace(/\/$/, "") +
                (this.opts.addTrailingSlash ? "/" : "");
        if (typeof this.opts.query === "string") {
            this.opts.query = decode(this.opts.query);
        }
        // set on handshake
        this.id = null;
        this.upgrades = null;
        this.pingInterval = null;
        this.pingTimeout = null;
        // set on heartbeat
        this.pingTimeoutTimer = null;
        if (typeof addEventListener === "function") {
            if (this.opts.closeOnBeforeunload) {
                // Firefox closes the connection when the "beforeunload" event is emitted but not Chrome. This event listener
                // ensures every browser behaves the same (no "disconnect" event at the Socket.IO level when the page is
                // closed/reloaded)
                this.beforeunloadEventListener = () => {
                    if (this.transport) {
                        // silently close the transport
                        this.transport.removeAllListeners();
                        this.transport.close();
                    }
                };
                addEventListener("beforeunload", this.beforeunloadEventListener, false);
            }
            if (this.hostname !== "localhost") {
                this.offlineEventListener = () => {
                    this.onClose("transport close", {
                        description: "network connection lost",
                    });
                };
                addEventListener("offline", this.offlineEventListener, false);
            }
        }
        this.open();
    }
    /**
     * Creates transport of the given type.
     *
     * @param {String} name - transport name
     * @return {Transport}
     * @private
     */
    createTransport(name) {
        const query = Object.assign({}, this.opts.query);
        // append engine.io protocol identifier
        query.EIO = protocol$1;
        // transport name
        query.transport = name;
        // session id if we already have one
        if (this.id)
            query.sid = this.id;
        const opts = Object.assign({}, this.opts, {
            query,
            socket: this,
            hostname: this.hostname,
            secure: this.secure,
            port: this.port,
        }, this.opts.transportOptions[name]);
        return new transports[name](opts);
    }
    /**
     * Initializes transport to use and starts probe.
     *
     * @private
     */
    open() {
        let transport;
        if (this.opts.rememberUpgrade &&
            Socket.priorWebsocketSuccess &&
            this.transports.indexOf("websocket") !== -1) {
            transport = "websocket";
        }
        else if (0 === this.transports.length) {
            // Emit error on next tick so it can be listened to
            this.setTimeoutFn(() => {
                this.emitReserved("error", "No transports available");
            }, 0);
            return;
        }
        else {
            transport = this.transports[0];
        }
        this.readyState = "opening";
        // Retry with the next transport if the transport is disabled (jsonp: false)
        try {
            transport = this.createTransport(transport);
        }
        catch (e) {
            this.transports.shift();
            this.open();
            return;
        }
        transport.open();
        this.setTransport(transport);
    }
    /**
     * Sets the current transport. Disables the existing one (if any).
     *
     * @private
     */
    setTransport(transport) {
        if (this.transport) {
            this.transport.removeAllListeners();
        }
        // set up transport
        this.transport = transport;
        // set up transport listeners
        transport
            .on("drain", this.onDrain.bind(this))
            .on("packet", this.onPacket.bind(this))
            .on("error", this.onError.bind(this))
            .on("close", (reason) => this.onClose("transport close", reason));
    }
    /**
     * Probes a transport.
     *
     * @param {String} name - transport name
     * @private
     */
    probe(name) {
        let transport = this.createTransport(name);
        let failed = false;
        Socket.priorWebsocketSuccess = false;
        const onTransportOpen = () => {
            if (failed)
                return;
            transport.send([{ type: "ping", data: "probe" }]);
            transport.once("packet", (msg) => {
                if (failed)
                    return;
                if ("pong" === msg.type && "probe" === msg.data) {
                    this.upgrading = true;
                    this.emitReserved("upgrading", transport);
                    if (!transport)
                        return;
                    Socket.priorWebsocketSuccess = "websocket" === transport.name;
                    this.transport.pause(() => {
                        if (failed)
                            return;
                        if ("closed" === this.readyState)
                            return;
                        cleanup();
                        this.setTransport(transport);
                        transport.send([{ type: "upgrade" }]);
                        this.emitReserved("upgrade", transport);
                        transport = null;
                        this.upgrading = false;
                        this.flush();
                    });
                }
                else {
                    const err = new Error("probe error");
                    // @ts-ignore
                    err.transport = transport.name;
                    this.emitReserved("upgradeError", err);
                }
            });
        };
        function freezeTransport() {
            if (failed)
                return;
            // Any callback called by transport should be ignored since now
            failed = true;
            cleanup();
            transport.close();
            transport = null;
        }
        // Handle any error that happens while probing
        const onerror = (err) => {
            const error = new Error("probe error: " + err);
            // @ts-ignore
            error.transport = transport.name;
            freezeTransport();
            this.emitReserved("upgradeError", error);
        };
        function onTransportClose() {
            onerror("transport closed");
        }
        // When the socket is closed while we're probing
        function onclose() {
            onerror("socket closed");
        }
        // When the socket is upgraded while we're probing
        function onupgrade(to) {
            if (transport && to.name !== transport.name) {
                freezeTransport();
            }
        }
        // Remove all listeners on the transport and on self
        const cleanup = () => {
            transport.removeListener("open", onTransportOpen);
            transport.removeListener("error", onerror);
            transport.removeListener("close", onTransportClose);
            this.off("close", onclose);
            this.off("upgrading", onupgrade);
        };
        transport.once("open", onTransportOpen);
        transport.once("error", onerror);
        transport.once("close", onTransportClose);
        this.once("close", onclose);
        this.once("upgrading", onupgrade);
        if (this.upgrades.indexOf("webtransport") !== -1 &&
            name !== "webtransport") {
            // favor WebTransport
            this.setTimeoutFn(() => {
                if (!failed) {
                    transport.open();
                }
            }, 200);
        }
        else {
            transport.open();
        }
    }
    /**
     * Called when connection is deemed open.
     *
     * @private
     */
    onOpen() {
        this.readyState = "open";
        Socket.priorWebsocketSuccess = "websocket" === this.transport.name;
        this.emitReserved("open");
        this.flush();
        // we check for `readyState` in case an `open`
        // listener already closed the socket
        if ("open" === this.readyState && this.opts.upgrade) {
            let i = 0;
            const l = this.upgrades.length;
            for (; i < l; i++) {
                this.probe(this.upgrades[i]);
            }
        }
    }
    /**
     * Handles a packet.
     *
     * @private
     */
    onPacket(packet) {
        if ("opening" === this.readyState ||
            "open" === this.readyState ||
            "closing" === this.readyState) {
            this.emitReserved("packet", packet);
            // Socket is live - any packet counts
            this.emitReserved("heartbeat");
            this.resetPingTimeout();
            switch (packet.type) {
                case "open":
                    this.onHandshake(JSON.parse(packet.data));
                    break;
                case "ping":
                    this.sendPacket("pong");
                    this.emitReserved("ping");
                    this.emitReserved("pong");
                    break;
                case "error":
                    const err = new Error("server error");
                    // @ts-ignore
                    err.code = packet.data;
                    this.onError(err);
                    break;
                case "message":
                    this.emitReserved("data", packet.data);
                    this.emitReserved("message", packet.data);
                    break;
            }
        }
    }
    /**
     * Called upon handshake completion.
     *
     * @param {Object} data - handshake obj
     * @private
     */
    onHandshake(data) {
        this.emitReserved("handshake", data);
        this.id = data.sid;
        this.transport.query.sid = data.sid;
        this.upgrades = this.filterUpgrades(data.upgrades);
        this.pingInterval = data.pingInterval;
        this.pingTimeout = data.pingTimeout;
        this.maxPayload = data.maxPayload;
        this.onOpen();
        // In case open handler closes socket
        if ("closed" === this.readyState)
            return;
        this.resetPingTimeout();
    }
    /**
     * Sets and resets ping timeout timer based on server pings.
     *
     * @private
     */
    resetPingTimeout() {
        this.clearTimeoutFn(this.pingTimeoutTimer);
        this.pingTimeoutTimer = this.setTimeoutFn(() => {
            this.onClose("ping timeout");
        }, this.pingInterval + this.pingTimeout);
        if (this.opts.autoUnref) {
            this.pingTimeoutTimer.unref();
        }
    }
    /**
     * Called on `drain` event
     *
     * @private
     */
    onDrain() {
        this.writeBuffer.splice(0, this.prevBufferLen);
        // setting prevBufferLen = 0 is very important
        // for example, when upgrading, upgrade packet is sent over,
        // and a nonzero prevBufferLen could cause problems on `drain`
        this.prevBufferLen = 0;
        if (0 === this.writeBuffer.length) {
            this.emitReserved("drain");
        }
        else {
            this.flush();
        }
    }
    /**
     * Flush write buffers.
     *
     * @private
     */
    flush() {
        if ("closed" !== this.readyState &&
            this.transport.writable &&
            !this.upgrading &&
            this.writeBuffer.length) {
            const packets = this.getWritablePackets();
            this.transport.send(packets);
            // keep track of current length of writeBuffer
            // splice writeBuffer and callbackBuffer on `drain`
            this.prevBufferLen = packets.length;
            this.emitReserved("flush");
        }
    }
    /**
     * Ensure the encoded size of the writeBuffer is below the maxPayload value sent by the server (only for HTTP
     * long-polling)
     *
     * @private
     */
    getWritablePackets() {
        const shouldCheckPayloadSize = this.maxPayload &&
            this.transport.name === "polling" &&
            this.writeBuffer.length > 1;
        if (!shouldCheckPayloadSize) {
            return this.writeBuffer;
        }
        let payloadSize = 1; // first packet type
        for (let i = 0; i < this.writeBuffer.length; i++) {
            const data = this.writeBuffer[i].data;
            if (data) {
                payloadSize += byteLength(data);
            }
            if (i > 0 && payloadSize > this.maxPayload) {
                return this.writeBuffer.slice(0, i);
            }
            payloadSize += 2; // separator + packet type
        }
        return this.writeBuffer;
    }
    /**
     * Sends a message.
     *
     * @param {String} msg - message.
     * @param {Object} options.
     * @param {Function} callback function.
     * @return {Socket} for chaining.
     */
    write(msg, options, fn) {
        this.sendPacket("message", msg, options, fn);
        return this;
    }
    send(msg, options, fn) {
        this.sendPacket("message", msg, options, fn);
        return this;
    }
    /**
     * Sends a packet.
     *
     * @param {String} type: packet type.
     * @param {String} data.
     * @param {Object} options.
     * @param {Function} fn - callback function.
     * @private
     */
    sendPacket(type, data, options, fn) {
        if ("function" === typeof data) {
            fn = data;
            data = undefined;
        }
        if ("function" === typeof options) {
            fn = options;
            options = null;
        }
        if ("closing" === this.readyState || "closed" === this.readyState) {
            return;
        }
        options = options || {};
        options.compress = false !== options.compress;
        const packet = {
            type: type,
            data: data,
            options: options,
        };
        this.emitReserved("packetCreate", packet);
        this.writeBuffer.push(packet);
        if (fn)
            this.once("flush", fn);
        this.flush();
    }
    /**
     * Closes the connection.
     */
    close() {
        const close = () => {
            this.onClose("forced close");
            this.transport.close();
        };
        const cleanupAndClose = () => {
            this.off("upgrade", cleanupAndClose);
            this.off("upgradeError", cleanupAndClose);
            close();
        };
        const waitForUpgrade = () => {
            // wait for upgrade to finish since we can't send packets while pausing a transport
            this.once("upgrade", cleanupAndClose);
            this.once("upgradeError", cleanupAndClose);
        };
        if ("opening" === this.readyState || "open" === this.readyState) {
            this.readyState = "closing";
            if (this.writeBuffer.length) {
                this.once("drain", () => {
                    if (this.upgrading) {
                        waitForUpgrade();
                    }
                    else {
                        close();
                    }
                });
            }
            else if (this.upgrading) {
                waitForUpgrade();
            }
            else {
                close();
            }
        }
        return this;
    }
    /**
     * Called upon transport error
     *
     * @private
     */
    onError(err) {
        Socket.priorWebsocketSuccess = false;
        this.emitReserved("error", err);
        this.onClose("transport error", err);
    }
    /**
     * Called upon transport close.
     *
     * @private
     */
    onClose(reason, description) {
        if ("opening" === this.readyState ||
            "open" === this.readyState ||
            "closing" === this.readyState) {
            // clear timers
            this.clearTimeoutFn(this.pingTimeoutTimer);
            // stop event from firing again for transport
            this.transport.removeAllListeners("close");
            // ensure transport won't stay open
            this.transport.close();
            // ignore further transport communication
            this.transport.removeAllListeners();
            if (typeof removeEventListener === "function") {
                removeEventListener("beforeunload", this.beforeunloadEventListener, false);
                removeEventListener("offline", this.offlineEventListener, false);
            }
            // set ready state
            this.readyState = "closed";
            // clear session id
            this.id = null;
            // emit close event
            this.emitReserved("close", reason, description);
            // clean buffers after, so users can still
            // grab the buffers on `close` event
            this.writeBuffer = [];
            this.prevBufferLen = 0;
        }
    }
    /**
     * Filters upgrades, returning only those matching client transports.
     *
     * @param {Array} upgrades - server upgrades
     * @private
     */
    filterUpgrades(upgrades) {
        const filteredUpgrades = [];
        let i = 0;
        const j = upgrades.length;
        for (; i < j; i++) {
            if (~this.transports.indexOf(upgrades[i]))
                filteredUpgrades.push(upgrades[i]);
        }
        return filteredUpgrades;
    }
};
Socket$1.protocol = protocol$1;

/**
 * URL parser.
 *
 * @param uri - url
 * @param path - the request path of the connection
 * @param loc - An object meant to mimic window.location.
 *        Defaults to window.location.
 * @public
 */
function url(uri, path = "", loc) {
    let obj = uri;
    // default to window.location
    loc = loc || (typeof location !== "undefined" && location);
    if (null == uri)
        uri = loc.protocol + "//" + loc.host;
    // relative path support
    if (typeof uri === "string") {
        if ("/" === uri.charAt(0)) {
            if ("/" === uri.charAt(1)) {
                uri = loc.protocol + uri;
            }
            else {
                uri = loc.host + uri;
            }
        }
        if (!/^(https?|wss?):\/\//.test(uri)) {
            if ("undefined" !== typeof loc) {
                uri = loc.protocol + "//" + uri;
            }
            else {
                uri = "https://" + uri;
            }
        }
        // parse
        obj = parse(uri);
    }
    // make sure we treat `localhost:80` and `localhost` equally
    if (!obj.port) {
        if (/^(http|ws)$/.test(obj.protocol)) {
            obj.port = "80";
        }
        else if (/^(http|ws)s$/.test(obj.protocol)) {
            obj.port = "443";
        }
    }
    obj.path = obj.path || "/";
    const ipv6 = obj.host.indexOf(":") !== -1;
    const host = ipv6 ? "[" + obj.host + "]" : obj.host;
    // define unique id
    obj.id = obj.protocol + "://" + host + ":" + obj.port + path;
    // define href
    obj.href =
        obj.protocol +
            "://" +
            host +
            (loc && loc.port === obj.port ? "" : ":" + obj.port);
    return obj;
}

const withNativeArrayBuffer = typeof ArrayBuffer === "function";
const isView = (obj) => {
    return typeof ArrayBuffer.isView === "function"
        ? ArrayBuffer.isView(obj)
        : obj.buffer instanceof ArrayBuffer;
};
const toString = Object.prototype.toString;
const withNativeBlob = typeof Blob === "function" ||
    (typeof Blob !== "undefined" &&
        toString.call(Blob) === "[object BlobConstructor]");
const withNativeFile = typeof File === "function" ||
    (typeof File !== "undefined" &&
        toString.call(File) === "[object FileConstructor]");
/**
 * Returns true if obj is a Buffer, an ArrayBuffer, a Blob or a File.
 *
 * @private
 */
function isBinary(obj) {
    return ((withNativeArrayBuffer && (obj instanceof ArrayBuffer || isView(obj))) ||
        (withNativeBlob && obj instanceof Blob) ||
        (withNativeFile && obj instanceof File));
}
function hasBinary(obj, toJSON) {
    if (!obj || typeof obj !== "object") {
        return false;
    }
    if (Array.isArray(obj)) {
        for (let i = 0, l = obj.length; i < l; i++) {
            if (hasBinary(obj[i])) {
                return true;
            }
        }
        return false;
    }
    if (isBinary(obj)) {
        return true;
    }
    if (obj.toJSON &&
        typeof obj.toJSON === "function" &&
        arguments.length === 1) {
        return hasBinary(obj.toJSON(), true);
    }
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
            return true;
        }
    }
    return false;
}

/**
 * Replaces every Buffer | ArrayBuffer | Blob | File in packet with a numbered placeholder.
 *
 * @param {Object} packet - socket.io event packet
 * @return {Object} with deconstructed packet and list of buffers
 * @public
 */
function deconstructPacket(packet) {
    const buffers = [];
    const packetData = packet.data;
    const pack = packet;
    pack.data = _deconstructPacket(packetData, buffers);
    pack.attachments = buffers.length; // number of binary 'attachments'
    return { packet: pack, buffers: buffers };
}
function _deconstructPacket(data, buffers) {
    if (!data)
        return data;
    if (isBinary(data)) {
        const placeholder = { _placeholder: true, num: buffers.length };
        buffers.push(data);
        return placeholder;
    }
    else if (Array.isArray(data)) {
        const newData = new Array(data.length);
        for (let i = 0; i < data.length; i++) {
            newData[i] = _deconstructPacket(data[i], buffers);
        }
        return newData;
    }
    else if (typeof data === "object" && !(data instanceof Date)) {
        const newData = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                newData[key] = _deconstructPacket(data[key], buffers);
            }
        }
        return newData;
    }
    return data;
}
/**
 * Reconstructs a binary packet from its placeholder packet and buffers
 *
 * @param {Object} packet - event packet with placeholders
 * @param {Array} buffers - binary buffers to put in placeholder positions
 * @return {Object} reconstructed packet
 * @public
 */
function reconstructPacket(packet, buffers) {
    packet.data = _reconstructPacket(packet.data, buffers);
    delete packet.attachments; // no longer useful
    return packet;
}
function _reconstructPacket(data, buffers) {
    if (!data)
        return data;
    if (data && data._placeholder === true) {
        const isIndexValid = typeof data.num === "number" &&
            data.num >= 0 &&
            data.num < buffers.length;
        if (isIndexValid) {
            return buffers[data.num]; // appropriate buffer (should be natural order anyway)
        }
        else {
            throw new Error("illegal attachments");
        }
    }
    else if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            data[i] = _reconstructPacket(data[i], buffers);
        }
    }
    else if (typeof data === "object") {
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                data[key] = _reconstructPacket(data[key], buffers);
            }
        }
    }
    return data;
}

/**
 * These strings must not be used as event names, as they have a special meaning.
 */
const RESERVED_EVENTS$1 = [
    "connect",
    "connect_error",
    "disconnect",
    "disconnecting",
    "newListener",
    "removeListener", // used by the Node.js EventEmitter
];
/**
 * Protocol version.
 *
 * @public
 */
const protocol = 5;
var PacketType;
(function (PacketType) {
    PacketType[PacketType["CONNECT"] = 0] = "CONNECT";
    PacketType[PacketType["DISCONNECT"] = 1] = "DISCONNECT";
    PacketType[PacketType["EVENT"] = 2] = "EVENT";
    PacketType[PacketType["ACK"] = 3] = "ACK";
    PacketType[PacketType["CONNECT_ERROR"] = 4] = "CONNECT_ERROR";
    PacketType[PacketType["BINARY_EVENT"] = 5] = "BINARY_EVENT";
    PacketType[PacketType["BINARY_ACK"] = 6] = "BINARY_ACK";
})(PacketType || (PacketType = {}));
/**
 * A socket.io Encoder instance
 */
class Encoder {
    /**
     * Encoder constructor
     *
     * @param {function} replacer - custom replacer to pass down to JSON.parse
     */
    constructor(replacer) {
        this.replacer = replacer;
    }
    /**
     * Encode a packet as a single string if non-binary, or as a
     * buffer sequence, depending on packet type.
     *
     * @param {Object} obj - packet object
     */
    encode(obj) {
        if (obj.type === PacketType.EVENT || obj.type === PacketType.ACK) {
            if (hasBinary(obj)) {
                return this.encodeAsBinary({
                    type: obj.type === PacketType.EVENT
                        ? PacketType.BINARY_EVENT
                        : PacketType.BINARY_ACK,
                    nsp: obj.nsp,
                    data: obj.data,
                    id: obj.id,
                });
            }
        }
        return [this.encodeAsString(obj)];
    }
    /**
     * Encode packet as string.
     */
    encodeAsString(obj) {
        // first is type
        let str = "" + obj.type;
        // attachments if we have them
        if (obj.type === PacketType.BINARY_EVENT ||
            obj.type === PacketType.BINARY_ACK) {
            str += obj.attachments + "-";
        }
        // if we have a namespace other than `/`
        // we append it followed by a comma `,`
        if (obj.nsp && "/" !== obj.nsp) {
            str += obj.nsp + ",";
        }
        // immediately followed by the id
        if (null != obj.id) {
            str += obj.id;
        }
        // json data
        if (null != obj.data) {
            str += JSON.stringify(obj.data, this.replacer);
        }
        return str;
    }
    /**
     * Encode packet as 'buffer sequence' by removing blobs, and
     * deconstructing packet into object with placeholders and
     * a list of buffers.
     */
    encodeAsBinary(obj) {
        const deconstruction = deconstructPacket(obj);
        const pack = this.encodeAsString(deconstruction.packet);
        const buffers = deconstruction.buffers;
        buffers.unshift(pack); // add packet info to beginning of data list
        return buffers; // write all the buffers
    }
}
// see https://stackoverflow.com/questions/8511281/check-if-a-value-is-an-object-in-javascript
function isObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
}
/**
 * A socket.io Decoder instance
 *
 * @return {Object} decoder
 */
class Decoder extends Emitter {
    /**
     * Decoder constructor
     *
     * @param {function} reviver - custom reviver to pass down to JSON.stringify
     */
    constructor(reviver) {
        super();
        this.reviver = reviver;
    }
    /**
     * Decodes an encoded packet string into packet JSON.
     *
     * @param {String} obj - encoded packet
     */
    add(obj) {
        let packet;
        if (typeof obj === "string") {
            if (this.reconstructor) {
                throw new Error("got plaintext data when reconstructing a packet");
            }
            packet = this.decodeString(obj);
            const isBinaryEvent = packet.type === PacketType.BINARY_EVENT;
            if (isBinaryEvent || packet.type === PacketType.BINARY_ACK) {
                packet.type = isBinaryEvent ? PacketType.EVENT : PacketType.ACK;
                // binary packet's json
                this.reconstructor = new BinaryReconstructor(packet);
                // no attachments, labeled binary but no binary data to follow
                if (packet.attachments === 0) {
                    super.emitReserved("decoded", packet);
                }
            }
            else {
                // non-binary full packet
                super.emitReserved("decoded", packet);
            }
        }
        else if (isBinary(obj) || obj.base64) {
            // raw binary data
            if (!this.reconstructor) {
                throw new Error("got binary data when not reconstructing a packet");
            }
            else {
                packet = this.reconstructor.takeBinaryData(obj);
                if (packet) {
                    // received final buffer
                    this.reconstructor = null;
                    super.emitReserved("decoded", packet);
                }
            }
        }
        else {
            throw new Error("Unknown type: " + obj);
        }
    }
    /**
     * Decode a packet String (JSON data)
     *
     * @param {String} str
     * @return {Object} packet
     */
    decodeString(str) {
        let i = 0;
        // look up type
        const p = {
            type: Number(str.charAt(0)),
        };
        if (PacketType[p.type] === undefined) {
            throw new Error("unknown packet type " + p.type);
        }
        // look up attachments if type binary
        if (p.type === PacketType.BINARY_EVENT ||
            p.type === PacketType.BINARY_ACK) {
            const start = i + 1;
            while (str.charAt(++i) !== "-" && i != str.length) { }
            const buf = str.substring(start, i);
            if (buf != Number(buf) || str.charAt(i) !== "-") {
                throw new Error("Illegal attachments");
            }
            p.attachments = Number(buf);
        }
        // look up namespace (if any)
        if ("/" === str.charAt(i + 1)) {
            const start = i + 1;
            while (++i) {
                const c = str.charAt(i);
                if ("," === c)
                    break;
                if (i === str.length)
                    break;
            }
            p.nsp = str.substring(start, i);
        }
        else {
            p.nsp = "/";
        }
        // look up id
        const next = str.charAt(i + 1);
        if ("" !== next && Number(next) == next) {
            const start = i + 1;
            while (++i) {
                const c = str.charAt(i);
                if (null == c || Number(c) != c) {
                    --i;
                    break;
                }
                if (i === str.length)
                    break;
            }
            p.id = Number(str.substring(start, i + 1));
        }
        // look up json data
        if (str.charAt(++i)) {
            const payload = this.tryParse(str.substr(i));
            if (Decoder.isPayloadValid(p.type, payload)) {
                p.data = payload;
            }
            else {
                throw new Error("invalid payload");
            }
        }
        return p;
    }
    tryParse(str) {
        try {
            return JSON.parse(str, this.reviver);
        }
        catch (e) {
            return false;
        }
    }
    static isPayloadValid(type, payload) {
        switch (type) {
            case PacketType.CONNECT:
                return isObject(payload);
            case PacketType.DISCONNECT:
                return payload === undefined;
            case PacketType.CONNECT_ERROR:
                return typeof payload === "string" || isObject(payload);
            case PacketType.EVENT:
            case PacketType.BINARY_EVENT:
                return (Array.isArray(payload) &&
                    (typeof payload[0] === "number" ||
                        (typeof payload[0] === "string" &&
                            RESERVED_EVENTS$1.indexOf(payload[0]) === -1)));
            case PacketType.ACK:
            case PacketType.BINARY_ACK:
                return Array.isArray(payload);
        }
    }
    /**
     * Deallocates a parser's resources
     */
    destroy() {
        if (this.reconstructor) {
            this.reconstructor.finishedReconstruction();
            this.reconstructor = null;
        }
    }
}
/**
 * A manager of a binary event's 'buffer sequence'. Should
 * be constructed whenever a packet of type BINARY_EVENT is
 * decoded.
 *
 * @param {Object} packet
 * @return {BinaryReconstructor} initialized reconstructor
 */
class BinaryReconstructor {
    constructor(packet) {
        this.packet = packet;
        this.buffers = [];
        this.reconPack = packet;
    }
    /**
     * Method to be called when binary data received from connection
     * after a BINARY_EVENT packet.
     *
     * @param {Buffer | ArrayBuffer} binData - the raw binary data received
     * @return {null | Object} returns null if more binary data is expected or
     *   a reconstructed packet object if all buffers have been received.
     */
    takeBinaryData(binData) {
        this.buffers.push(binData);
        if (this.buffers.length === this.reconPack.attachments) {
            // done with buffer list
            const packet = reconstructPacket(this.reconPack, this.buffers);
            this.finishedReconstruction();
            return packet;
        }
        return null;
    }
    /**
     * Cleans up binary packet reconstruction variables.
     */
    finishedReconstruction() {
        this.reconPack = null;
        this.buffers = [];
    }
}

var parser = /*#__PURE__*/Object.freeze({
  __proto__: null,
  Decoder: Decoder,
  Encoder: Encoder,
  get PacketType () { return PacketType; },
  protocol: protocol
});

function on(obj, ev, fn) {
    obj.on(ev, fn);
    return function subDestroy() {
        obj.off(ev, fn);
    };
}

/**
 * Internal events.
 * These events can't be emitted by the user.
 */
const RESERVED_EVENTS = Object.freeze({
    connect: 1,
    connect_error: 1,
    disconnect: 1,
    disconnecting: 1,
    // EventEmitter reserved events: https://nodejs.org/api/events.html#events_event_newlistener
    newListener: 1,
    removeListener: 1,
});
/**
 * A Socket is the fundamental class for interacting with the server.
 *
 * A Socket belongs to a certain Namespace (by default /) and uses an underlying {@link Manager} to communicate.
 *
 * @example
 * const socket = io();
 *
 * socket.on("connect", () => {
 *   console.log("connected");
 * });
 *
 * // send an event to the server
 * socket.emit("foo", "bar");
 *
 * socket.on("foobar", () => {
 *   // an event was received from the server
 * });
 *
 * // upon disconnection
 * socket.on("disconnect", (reason) => {
 *   console.log(`disconnected due to ${reason}`);
 * });
 */
class Socket extends Emitter {
    /**
     * `Socket` constructor.
     */
    constructor(io, nsp, opts) {
        super();
        /**
         * Whether the socket is currently connected to the server.
         *
         * @example
         * const socket = io();
         *
         * socket.on("connect", () => {
         *   console.log(socket.connected); // true
         * });
         *
         * socket.on("disconnect", () => {
         *   console.log(socket.connected); // false
         * });
         */
        this.connected = false;
        /**
         * Whether the connection state was recovered after a temporary disconnection. In that case, any missed packets will
         * be transmitted by the server.
         */
        this.recovered = false;
        /**
         * Buffer for packets received before the CONNECT packet
         */
        this.receiveBuffer = [];
        /**
         * Buffer for packets that will be sent once the socket is connected
         */
        this.sendBuffer = [];
        /**
         * The queue of packets to be sent with retry in case of failure.
         *
         * Packets are sent one by one, each waiting for the server acknowledgement, in order to guarantee the delivery order.
         * @private
         */
        this._queue = [];
        /**
         * A sequence to generate the ID of the {@link QueuedPacket}.
         * @private
         */
        this._queueSeq = 0;
        this.ids = 0;
        this.acks = {};
        this.flags = {};
        this.io = io;
        this.nsp = nsp;
        if (opts && opts.auth) {
            this.auth = opts.auth;
        }
        this._opts = Object.assign({}, opts);
        if (this.io._autoConnect)
            this.open();
    }
    /**
     * Whether the socket is currently disconnected
     *
     * @example
     * const socket = io();
     *
     * socket.on("connect", () => {
     *   console.log(socket.disconnected); // false
     * });
     *
     * socket.on("disconnect", () => {
     *   console.log(socket.disconnected); // true
     * });
     */
    get disconnected() {
        return !this.connected;
    }
    /**
     * Subscribe to open, close and packet events
     *
     * @private
     */
    subEvents() {
        if (this.subs)
            return;
        const io = this.io;
        this.subs = [
            on(io, "open", this.onopen.bind(this)),
            on(io, "packet", this.onpacket.bind(this)),
            on(io, "error", this.onerror.bind(this)),
            on(io, "close", this.onclose.bind(this)),
        ];
    }
    /**
     * Whether the Socket will try to reconnect when its Manager connects or reconnects.
     *
     * @example
     * const socket = io();
     *
     * console.log(socket.active); // true
     *
     * socket.on("disconnect", (reason) => {
     *   if (reason === "io server disconnect") {
     *     // the disconnection was initiated by the server, you need to manually reconnect
     *     console.log(socket.active); // false
     *   }
     *   // else the socket will automatically try to reconnect
     *   console.log(socket.active); // true
     * });
     */
    get active() {
        return !!this.subs;
    }
    /**
     * "Opens" the socket.
     *
     * @example
     * const socket = io({
     *   autoConnect: false
     * });
     *
     * socket.connect();
     */
    connect() {
        if (this.connected)
            return this;
        this.subEvents();
        if (!this.io["_reconnecting"])
            this.io.open(); // ensure open
        if ("open" === this.io._readyState)
            this.onopen();
        return this;
    }
    /**
     * Alias for {@link connect()}.
     */
    open() {
        return this.connect();
    }
    /**
     * Sends a `message` event.
     *
     * This method mimics the WebSocket.send() method.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
     *
     * @example
     * socket.send("hello");
     *
     * // this is equivalent to
     * socket.emit("message", "hello");
     *
     * @return self
     */
    send(...args) {
        args.unshift("message");
        this.emit.apply(this, args);
        return this;
    }
    /**
     * Override `emit`.
     * If the event is in `events`, it's emitted normally.
     *
     * @example
     * socket.emit("hello", "world");
     *
     * // all serializable datastructures are supported (no need to call JSON.stringify)
     * socket.emit("hello", 1, "2", { 3: ["4"], 5: Uint8Array.from([6]) });
     *
     * // with an acknowledgement from the server
     * socket.emit("hello", "world", (val) => {
     *   // ...
     * });
     *
     * @return self
     */
    emit(ev, ...args) {
        if (RESERVED_EVENTS.hasOwnProperty(ev)) {
            throw new Error('"' + ev.toString() + '" is a reserved event name');
        }
        args.unshift(ev);
        if (this._opts.retries && !this.flags.fromQueue && !this.flags.volatile) {
            this._addToQueue(args);
            return this;
        }
        const packet = {
            type: PacketType.EVENT,
            data: args,
        };
        packet.options = {};
        packet.options.compress = this.flags.compress !== false;
        // event ack callback
        if ("function" === typeof args[args.length - 1]) {
            const id = this.ids++;
            const ack = args.pop();
            this._registerAckCallback(id, ack);
            packet.id = id;
        }
        const isTransportWritable = this.io.engine &&
            this.io.engine.transport &&
            this.io.engine.transport.writable;
        const discardPacket = this.flags.volatile && (!isTransportWritable || !this.connected);
        if (discardPacket) ;
        else if (this.connected) {
            this.notifyOutgoingListeners(packet);
            this.packet(packet);
        }
        else {
            this.sendBuffer.push(packet);
        }
        this.flags = {};
        return this;
    }
    /**
     * @private
     */
    _registerAckCallback(id, ack) {
        var _a;
        const timeout = (_a = this.flags.timeout) !== null && _a !== void 0 ? _a : this._opts.ackTimeout;
        if (timeout === undefined) {
            this.acks[id] = ack;
            return;
        }
        // @ts-ignore
        const timer = this.io.setTimeoutFn(() => {
            delete this.acks[id];
            for (let i = 0; i < this.sendBuffer.length; i++) {
                if (this.sendBuffer[i].id === id) {
                    this.sendBuffer.splice(i, 1);
                }
            }
            ack.call(this, new Error("operation has timed out"));
        }, timeout);
        this.acks[id] = (...args) => {
            // @ts-ignore
            this.io.clearTimeoutFn(timer);
            ack.apply(this, [null, ...args]);
        };
    }
    /**
     * Emits an event and waits for an acknowledgement
     *
     * @example
     * // without timeout
     * const response = await socket.emitWithAck("hello", "world");
     *
     * // with a specific timeout
     * try {
     *   const response = await socket.timeout(1000).emitWithAck("hello", "world");
     * } catch (err) {
     *   // the server did not acknowledge the event in the given delay
     * }
     *
     * @return a Promise that will be fulfilled when the server acknowledges the event
     */
    emitWithAck(ev, ...args) {
        // the timeout flag is optional
        const withErr = this.flags.timeout !== undefined || this._opts.ackTimeout !== undefined;
        return new Promise((resolve, reject) => {
            args.push((arg1, arg2) => {
                if (withErr) {
                    return arg1 ? reject(arg1) : resolve(arg2);
                }
                else {
                    return resolve(arg1);
                }
            });
            this.emit(ev, ...args);
        });
    }
    /**
     * Add the packet to the queue.
     * @param args
     * @private
     */
    _addToQueue(args) {
        let ack;
        if (typeof args[args.length - 1] === "function") {
            ack = args.pop();
        }
        const packet = {
            id: this._queueSeq++,
            tryCount: 0,
            pending: false,
            args,
            flags: Object.assign({ fromQueue: true }, this.flags),
        };
        args.push((err, ...responseArgs) => {
            if (packet !== this._queue[0]) {
                // the packet has already been acknowledged
                return;
            }
            const hasError = err !== null;
            if (hasError) {
                if (packet.tryCount > this._opts.retries) {
                    this._queue.shift();
                    if (ack) {
                        ack(err);
                    }
                }
            }
            else {
                this._queue.shift();
                if (ack) {
                    ack(null, ...responseArgs);
                }
            }
            packet.pending = false;
            return this._drainQueue();
        });
        this._queue.push(packet);
        this._drainQueue();
    }
    /**
     * Send the first packet of the queue, and wait for an acknowledgement from the server.
     * @param force - whether to resend a packet that has not been acknowledged yet
     *
     * @private
     */
    _drainQueue(force = false) {
        if (!this.connected || this._queue.length === 0) {
            return;
        }
        const packet = this._queue[0];
        if (packet.pending && !force) {
            return;
        }
        packet.pending = true;
        packet.tryCount++;
        this.flags = packet.flags;
        this.emit.apply(this, packet.args);
    }
    /**
     * Sends a packet.
     *
     * @param packet
     * @private
     */
    packet(packet) {
        packet.nsp = this.nsp;
        this.io._packet(packet);
    }
    /**
     * Called upon engine `open`.
     *
     * @private
     */
    onopen() {
        if (typeof this.auth == "function") {
            this.auth((data) => {
                this._sendConnectPacket(data);
            });
        }
        else {
            this._sendConnectPacket(this.auth);
        }
    }
    /**
     * Sends a CONNECT packet to initiate the Socket.IO session.
     *
     * @param data
     * @private
     */
    _sendConnectPacket(data) {
        this.packet({
            type: PacketType.CONNECT,
            data: this._pid
                ? Object.assign({ pid: this._pid, offset: this._lastOffset }, data)
                : data,
        });
    }
    /**
     * Called upon engine or manager `error`.
     *
     * @param err
     * @private
     */
    onerror(err) {
        if (!this.connected) {
            this.emitReserved("connect_error", err);
        }
    }
    /**
     * Called upon engine `close`.
     *
     * @param reason
     * @param description
     * @private
     */
    onclose(reason, description) {
        this.connected = false;
        delete this.id;
        this.emitReserved("disconnect", reason, description);
    }
    /**
     * Called with socket packet.
     *
     * @param packet
     * @private
     */
    onpacket(packet) {
        const sameNamespace = packet.nsp === this.nsp;
        if (!sameNamespace)
            return;
        switch (packet.type) {
            case PacketType.CONNECT:
                if (packet.data && packet.data.sid) {
                    this.onconnect(packet.data.sid, packet.data.pid);
                }
                else {
                    this.emitReserved("connect_error", new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));
                }
                break;
            case PacketType.EVENT:
            case PacketType.BINARY_EVENT:
                this.onevent(packet);
                break;
            case PacketType.ACK:
            case PacketType.BINARY_ACK:
                this.onack(packet);
                break;
            case PacketType.DISCONNECT:
                this.ondisconnect();
                break;
            case PacketType.CONNECT_ERROR:
                this.destroy();
                const err = new Error(packet.data.message);
                // @ts-ignore
                err.data = packet.data.data;
                this.emitReserved("connect_error", err);
                break;
        }
    }
    /**
     * Called upon a server event.
     *
     * @param packet
     * @private
     */
    onevent(packet) {
        const args = packet.data || [];
        if (null != packet.id) {
            args.push(this.ack(packet.id));
        }
        if (this.connected) {
            this.emitEvent(args);
        }
        else {
            this.receiveBuffer.push(Object.freeze(args));
        }
    }
    emitEvent(args) {
        if (this._anyListeners && this._anyListeners.length) {
            const listeners = this._anyListeners.slice();
            for (const listener of listeners) {
                listener.apply(this, args);
            }
        }
        super.emit.apply(this, args);
        if (this._pid && args.length && typeof args[args.length - 1] === "string") {
            this._lastOffset = args[args.length - 1];
        }
    }
    /**
     * Produces an ack callback to emit with an event.
     *
     * @private
     */
    ack(id) {
        const self = this;
        let sent = false;
        return function (...args) {
            // prevent double callbacks
            if (sent)
                return;
            sent = true;
            self.packet({
                type: PacketType.ACK,
                id: id,
                data: args,
            });
        };
    }
    /**
     * Called upon a server acknowlegement.
     *
     * @param packet
     * @private
     */
    onack(packet) {
        const ack = this.acks[packet.id];
        if ("function" === typeof ack) {
            ack.apply(this, packet.data);
            delete this.acks[packet.id];
        }
    }
    /**
     * Called upon server connect.
     *
     * @private
     */
    onconnect(id, pid) {
        this.id = id;
        this.recovered = pid && this._pid === pid;
        this._pid = pid; // defined only if connection state recovery is enabled
        this.connected = true;
        this.emitBuffered();
        this.emitReserved("connect");
        this._drainQueue(true);
    }
    /**
     * Emit buffered events (received and emitted).
     *
     * @private
     */
    emitBuffered() {
        this.receiveBuffer.forEach((args) => this.emitEvent(args));
        this.receiveBuffer = [];
        this.sendBuffer.forEach((packet) => {
            this.notifyOutgoingListeners(packet);
            this.packet(packet);
        });
        this.sendBuffer = [];
    }
    /**
     * Called upon server disconnect.
     *
     * @private
     */
    ondisconnect() {
        this.destroy();
        this.onclose("io server disconnect");
    }
    /**
     * Called upon forced client/server side disconnections,
     * this method ensures the manager stops tracking us and
     * that reconnections don't get triggered for this.
     *
     * @private
     */
    destroy() {
        if (this.subs) {
            // clean subscriptions to avoid reconnections
            this.subs.forEach((subDestroy) => subDestroy());
            this.subs = undefined;
        }
        this.io["_destroy"](this);
    }
    /**
     * Disconnects the socket manually. In that case, the socket will not try to reconnect.
     *
     * If this is the last active Socket instance of the {@link Manager}, the low-level connection will be closed.
     *
     * @example
     * const socket = io();
     *
     * socket.on("disconnect", (reason) => {
     *   // console.log(reason); prints "io client disconnect"
     * });
     *
     * socket.disconnect();
     *
     * @return self
     */
    disconnect() {
        if (this.connected) {
            this.packet({ type: PacketType.DISCONNECT });
        }
        // remove socket from pool
        this.destroy();
        if (this.connected) {
            // fire events
            this.onclose("io client disconnect");
        }
        return this;
    }
    /**
     * Alias for {@link disconnect()}.
     *
     * @return self
     */
    close() {
        return this.disconnect();
    }
    /**
     * Sets the compress flag.
     *
     * @example
     * socket.compress(false).emit("hello");
     *
     * @param compress - if `true`, compresses the sending data
     * @return self
     */
    compress(compress) {
        this.flags.compress = compress;
        return this;
    }
    /**
     * Sets a modifier for a subsequent event emission that the event message will be dropped when this socket is not
     * ready to send messages.
     *
     * @example
     * socket.volatile.emit("hello"); // the server may or may not receive it
     *
     * @returns self
     */
    get volatile() {
        this.flags.volatile = true;
        return this;
    }
    /**
     * Sets a modifier for a subsequent event emission that the callback will be called with an error when the
     * given number of milliseconds have elapsed without an acknowledgement from the server:
     *
     * @example
     * socket.timeout(5000).emit("my-event", (err) => {
     *   if (err) {
     *     // the server did not acknowledge the event in the given delay
     *   }
     * });
     *
     * @returns self
     */
    timeout(timeout) {
        this.flags.timeout = timeout;
        return this;
    }
    /**
     * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
     * callback.
     *
     * @example
     * socket.onAny((event, ...args) => {
     *   console.log(`got ${event}`);
     * });
     *
     * @param listener
     */
    onAny(listener) {
        this._anyListeners = this._anyListeners || [];
        this._anyListeners.push(listener);
        return this;
    }
    /**
     * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
     * callback. The listener is added to the beginning of the listeners array.
     *
     * @example
     * socket.prependAny((event, ...args) => {
     *   console.log(`got event ${event}`);
     * });
     *
     * @param listener
     */
    prependAny(listener) {
        this._anyListeners = this._anyListeners || [];
        this._anyListeners.unshift(listener);
        return this;
    }
    /**
     * Removes the listener that will be fired when any event is emitted.
     *
     * @example
     * const catchAllListener = (event, ...args) => {
     *   console.log(`got event ${event}`);
     * }
     *
     * socket.onAny(catchAllListener);
     *
     * // remove a specific listener
     * socket.offAny(catchAllListener);
     *
     * // or remove all listeners
     * socket.offAny();
     *
     * @param listener
     */
    offAny(listener) {
        if (!this._anyListeners) {
            return this;
        }
        if (listener) {
            const listeners = this._anyListeners;
            for (let i = 0; i < listeners.length; i++) {
                if (listener === listeners[i]) {
                    listeners.splice(i, 1);
                    return this;
                }
            }
        }
        else {
            this._anyListeners = [];
        }
        return this;
    }
    /**
     * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
     * e.g. to remove listeners.
     */
    listenersAny() {
        return this._anyListeners || [];
    }
    /**
     * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
     * callback.
     *
     * Note: acknowledgements sent to the server are not included.
     *
     * @example
     * socket.onAnyOutgoing((event, ...args) => {
     *   console.log(`sent event ${event}`);
     * });
     *
     * @param listener
     */
    onAnyOutgoing(listener) {
        this._anyOutgoingListeners = this._anyOutgoingListeners || [];
        this._anyOutgoingListeners.push(listener);
        return this;
    }
    /**
     * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
     * callback. The listener is added to the beginning of the listeners array.
     *
     * Note: acknowledgements sent to the server are not included.
     *
     * @example
     * socket.prependAnyOutgoing((event, ...args) => {
     *   console.log(`sent event ${event}`);
     * });
     *
     * @param listener
     */
    prependAnyOutgoing(listener) {
        this._anyOutgoingListeners = this._anyOutgoingListeners || [];
        this._anyOutgoingListeners.unshift(listener);
        return this;
    }
    /**
     * Removes the listener that will be fired when any event is emitted.
     *
     * @example
     * const catchAllListener = (event, ...args) => {
     *   console.log(`sent event ${event}`);
     * }
     *
     * socket.onAnyOutgoing(catchAllListener);
     *
     * // remove a specific listener
     * socket.offAnyOutgoing(catchAllListener);
     *
     * // or remove all listeners
     * socket.offAnyOutgoing();
     *
     * @param [listener] - the catch-all listener (optional)
     */
    offAnyOutgoing(listener) {
        if (!this._anyOutgoingListeners) {
            return this;
        }
        if (listener) {
            const listeners = this._anyOutgoingListeners;
            for (let i = 0; i < listeners.length; i++) {
                if (listener === listeners[i]) {
                    listeners.splice(i, 1);
                    return this;
                }
            }
        }
        else {
            this._anyOutgoingListeners = [];
        }
        return this;
    }
    /**
     * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
     * e.g. to remove listeners.
     */
    listenersAnyOutgoing() {
        return this._anyOutgoingListeners || [];
    }
    /**
     * Notify the listeners for each packet sent
     *
     * @param packet
     *
     * @private
     */
    notifyOutgoingListeners(packet) {
        if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
            const listeners = this._anyOutgoingListeners.slice();
            for (const listener of listeners) {
                listener.apply(this, packet.data);
            }
        }
    }
}

/**
 * Initialize backoff timer with `opts`.
 *
 * - `min` initial timeout in milliseconds [100]
 * - `max` max timeout [10000]
 * - `jitter` [0]
 * - `factor` [2]
 *
 * @param {Object} opts
 * @api public
 */
function Backoff(opts) {
    opts = opts || {};
    this.ms = opts.min || 100;
    this.max = opts.max || 10000;
    this.factor = opts.factor || 2;
    this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
    this.attempts = 0;
}
/**
 * Return the backoff duration.
 *
 * @return {Number}
 * @api public
 */
Backoff.prototype.duration = function () {
    var ms = this.ms * Math.pow(this.factor, this.attempts++);
    if (this.jitter) {
        var rand = Math.random();
        var deviation = Math.floor(rand * this.jitter * ms);
        ms = (Math.floor(rand * 10) & 1) == 0 ? ms - deviation : ms + deviation;
    }
    return Math.min(ms, this.max) | 0;
};
/**
 * Reset the number of attempts.
 *
 * @api public
 */
Backoff.prototype.reset = function () {
    this.attempts = 0;
};
/**
 * Set the minimum duration
 *
 * @api public
 */
Backoff.prototype.setMin = function (min) {
    this.ms = min;
};
/**
 * Set the maximum duration
 *
 * @api public
 */
Backoff.prototype.setMax = function (max) {
    this.max = max;
};
/**
 * Set the jitter
 *
 * @api public
 */
Backoff.prototype.setJitter = function (jitter) {
    this.jitter = jitter;
};

class Manager extends Emitter {
    constructor(uri, opts) {
        var _a;
        super();
        this.nsps = {};
        this.subs = [];
        if (uri && "object" === typeof uri) {
            opts = uri;
            uri = undefined;
        }
        opts = opts || {};
        opts.path = opts.path || "/socket.io";
        this.opts = opts;
        installTimerFunctions(this, opts);
        this.reconnection(opts.reconnection !== false);
        this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
        this.reconnectionDelay(opts.reconnectionDelay || 1000);
        this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
        this.randomizationFactor((_a = opts.randomizationFactor) !== null && _a !== void 0 ? _a : 0.5);
        this.backoff = new Backoff({
            min: this.reconnectionDelay(),
            max: this.reconnectionDelayMax(),
            jitter: this.randomizationFactor(),
        });
        this.timeout(null == opts.timeout ? 20000 : opts.timeout);
        this._readyState = "closed";
        this.uri = uri;
        const _parser = opts.parser || parser;
        this.encoder = new _parser.Encoder();
        this.decoder = new _parser.Decoder();
        this._autoConnect = opts.autoConnect !== false;
        if (this._autoConnect)
            this.open();
    }
    reconnection(v) {
        if (!arguments.length)
            return this._reconnection;
        this._reconnection = !!v;
        return this;
    }
    reconnectionAttempts(v) {
        if (v === undefined)
            return this._reconnectionAttempts;
        this._reconnectionAttempts = v;
        return this;
    }
    reconnectionDelay(v) {
        var _a;
        if (v === undefined)
            return this._reconnectionDelay;
        this._reconnectionDelay = v;
        (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMin(v);
        return this;
    }
    randomizationFactor(v) {
        var _a;
        if (v === undefined)
            return this._randomizationFactor;
        this._randomizationFactor = v;
        (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setJitter(v);
        return this;
    }
    reconnectionDelayMax(v) {
        var _a;
        if (v === undefined)
            return this._reconnectionDelayMax;
        this._reconnectionDelayMax = v;
        (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMax(v);
        return this;
    }
    timeout(v) {
        if (!arguments.length)
            return this._timeout;
        this._timeout = v;
        return this;
    }
    /**
     * Starts trying to reconnect if reconnection is enabled and we have not
     * started reconnecting yet
     *
     * @private
     */
    maybeReconnectOnOpen() {
        // Only try to reconnect if it's the first time we're connecting
        if (!this._reconnecting &&
            this._reconnection &&
            this.backoff.attempts === 0) {
            // keeps reconnection from firing twice for the same reconnection loop
            this.reconnect();
        }
    }
    /**
     * Sets the current transport `socket`.
     *
     * @param {Function} fn - optional, callback
     * @return self
     * @public
     */
    open(fn) {
        if (~this._readyState.indexOf("open"))
            return this;
        this.engine = new Socket$1(this.uri, this.opts);
        const socket = this.engine;
        const self = this;
        this._readyState = "opening";
        this.skipReconnect = false;
        // emit `open`
        const openSubDestroy = on(socket, "open", function () {
            self.onopen();
            fn && fn();
        });
        const onError = (err) => {
            this.cleanup();
            this._readyState = "closed";
            this.emitReserved("error", err);
            if (fn) {
                fn(err);
            }
            else {
                // Only do this if there is no fn to handle the error
                this.maybeReconnectOnOpen();
            }
        };
        // emit `error`
        const errorSub = on(socket, "error", onError);
        if (false !== this._timeout) {
            const timeout = this._timeout;
            // set timer
            const timer = this.setTimeoutFn(() => {
                openSubDestroy();
                onError(new Error("timeout"));
                socket.close();
            }, timeout);
            if (this.opts.autoUnref) {
                timer.unref();
            }
            this.subs.push(() => {
                this.clearTimeoutFn(timer);
            });
        }
        this.subs.push(openSubDestroy);
        this.subs.push(errorSub);
        return this;
    }
    /**
     * Alias for open()
     *
     * @return self
     * @public
     */
    connect(fn) {
        return this.open(fn);
    }
    /**
     * Called upon transport open.
     *
     * @private
     */
    onopen() {
        // clear old subs
        this.cleanup();
        // mark as open
        this._readyState = "open";
        this.emitReserved("open");
        // add new subs
        const socket = this.engine;
        this.subs.push(on(socket, "ping", this.onping.bind(this)), on(socket, "data", this.ondata.bind(this)), on(socket, "error", this.onerror.bind(this)), on(socket, "close", this.onclose.bind(this)), on(this.decoder, "decoded", this.ondecoded.bind(this)));
    }
    /**
     * Called upon a ping.
     *
     * @private
     */
    onping() {
        this.emitReserved("ping");
    }
    /**
     * Called with data.
     *
     * @private
     */
    ondata(data) {
        try {
            this.decoder.add(data);
        }
        catch (e) {
            this.onclose("parse error", e);
        }
    }
    /**
     * Called when parser fully decodes a packet.
     *
     * @private
     */
    ondecoded(packet) {
        // the nextTick call prevents an exception in a user-provided event listener from triggering a disconnection due to a "parse error"
        nextTick(() => {
            this.emitReserved("packet", packet);
        }, this.setTimeoutFn);
    }
    /**
     * Called upon socket error.
     *
     * @private
     */
    onerror(err) {
        this.emitReserved("error", err);
    }
    /**
     * Creates a new socket for the given `nsp`.
     *
     * @return {Socket}
     * @public
     */
    socket(nsp, opts) {
        let socket = this.nsps[nsp];
        if (!socket) {
            socket = new Socket(this, nsp, opts);
            this.nsps[nsp] = socket;
        }
        else if (this._autoConnect && !socket.active) {
            socket.connect();
        }
        return socket;
    }
    /**
     * Called upon a socket close.
     *
     * @param socket
     * @private
     */
    _destroy(socket) {
        const nsps = Object.keys(this.nsps);
        for (const nsp of nsps) {
            const socket = this.nsps[nsp];
            if (socket.active) {
                return;
            }
        }
        this._close();
    }
    /**
     * Writes a packet.
     *
     * @param packet
     * @private
     */
    _packet(packet) {
        const encodedPackets = this.encoder.encode(packet);
        for (let i = 0; i < encodedPackets.length; i++) {
            this.engine.write(encodedPackets[i], packet.options);
        }
    }
    /**
     * Clean up transport subscriptions and packet buffer.
     *
     * @private
     */
    cleanup() {
        this.subs.forEach((subDestroy) => subDestroy());
        this.subs.length = 0;
        this.decoder.destroy();
    }
    /**
     * Close the current socket.
     *
     * @private
     */
    _close() {
        this.skipReconnect = true;
        this._reconnecting = false;
        this.onclose("forced close");
        if (this.engine)
            this.engine.close();
    }
    /**
     * Alias for close()
     *
     * @private
     */
    disconnect() {
        return this._close();
    }
    /**
     * Called upon engine close.
     *
     * @private
     */
    onclose(reason, description) {
        this.cleanup();
        this.backoff.reset();
        this._readyState = "closed";
        this.emitReserved("close", reason, description);
        if (this._reconnection && !this.skipReconnect) {
            this.reconnect();
        }
    }
    /**
     * Attempt a reconnection.
     *
     * @private
     */
    reconnect() {
        if (this._reconnecting || this.skipReconnect)
            return this;
        const self = this;
        if (this.backoff.attempts >= this._reconnectionAttempts) {
            this.backoff.reset();
            this.emitReserved("reconnect_failed");
            this._reconnecting = false;
        }
        else {
            const delay = this.backoff.duration();
            this._reconnecting = true;
            const timer = this.setTimeoutFn(() => {
                if (self.skipReconnect)
                    return;
                this.emitReserved("reconnect_attempt", self.backoff.attempts);
                // check again for the case socket closed in above events
                if (self.skipReconnect)
                    return;
                self.open((err) => {
                    if (err) {
                        self._reconnecting = false;
                        self.reconnect();
                        this.emitReserved("reconnect_error", err);
                    }
                    else {
                        self.onreconnect();
                    }
                });
            }, delay);
            if (this.opts.autoUnref) {
                timer.unref();
            }
            this.subs.push(() => {
                this.clearTimeoutFn(timer);
            });
        }
    }
    /**
     * Called upon successful reconnect.
     *
     * @private
     */
    onreconnect() {
        const attempt = this.backoff.attempts;
        this._reconnecting = false;
        this.backoff.reset();
        this.emitReserved("reconnect", attempt);
    }
}

/**
 * Managers cache.
 */
const cache = {};
function lookup(uri, opts) {
    if (typeof uri === "object") {
        opts = uri;
        uri = undefined;
    }
    opts = opts || {};
    const parsed = url(uri, opts.path || "/socket.io");
    const source = parsed.source;
    const id = parsed.id;
    const path = parsed.path;
    const sameNamespace = cache[id] && path in cache[id]["nsps"];
    const newConnection = opts.forceNew ||
        opts["force new connection"] ||
        false === opts.multiplex ||
        sameNamespace;
    let io;
    if (newConnection) {
        io = new Manager(source, opts);
    }
    else {
        if (!cache[id]) {
            cache[id] = new Manager(source, opts);
        }
        io = cache[id];
    }
    if (parsed.query && !opts.query) {
        opts.query = parsed.queryKey;
    }
    return io.socket(parsed.path, opts);
}
// so that "lookup" can be used both as a function (e.g. `io(...)`) and as a
// namespace (e.g. `io.connect(...)`), for backward compatibility
Object.assign(lookup, {
    Manager,
    Socket,
    io: lookup,
    connect: lookup,
});

const _tmpl$$4 = /*#__PURE__*/template(`<style>`),
  _tmpl$2$4 = /*#__PURE__*/template(`<div class="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true"><style></style><div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity animate-fade-in"></div><div class="fixed inset-0 z-10 overflow-y-auto"><div class="flex min-h-full items-center justify-center p-4 text-center sm:p-0"><div class="relative transform overflow-hidden rounded-lg text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">`),
  _tmpl$3$3 = /*#__PURE__*/template(`<div><pre>`);
function syntaxHighlight(json) {
  if (typeof json != 'string') {
    json = JSON.stringify(json, undefined, 2);
  }
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // eslint-disable-next-line
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'key';
      } else {
        cls = 'string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'boolean';
    } else if (/null/.test(match)) {
      cls = 'null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}
const Popup = props => {
  let preEl;
  const [popupProps] = splitProps(props, ['onOpen', 'onClose', 'isOpen', 'value']);
  onMount(() => {
    if (preEl) {
      preEl.innerHTML = syntaxHighlight(JSON.stringify(props?.value, undefined, 2));
    }
  });
  const [isBotOpened, setIsBotOpened] = createSignal(
  // eslint-disable-next-line solid/reactivity
  popupProps.isOpen ?? false);
  createEffect(() => {
    if (isNotDefined(props.isOpen) || props.isOpen === isBotOpened()) return;
    toggleBot();
  });
  const stopPropagation = event => {
    event.stopPropagation();
  };
  const openBot = () => {
    setIsBotOpened(true);
    popupProps.onOpen?.();
    document.body.style.overflow = 'hidden';
  };
  const closeBot = () => {
    setIsBotOpened(false);
    popupProps.onClose?.();
    document.body.style.overflow = 'auto';
  };
  const toggleBot = () => {
    isBotOpened() ? closeBot() : openBot();
  };
  return createComponent(Show, {
    get when() {
      return isBotOpened();
    },
    get children() {
      return [(() => {
        const _el$ = _tmpl$$4();
        insert(_el$, css_248z);
        return _el$;
      })(), (() => {
        const _el$2 = _tmpl$2$4(),
          _el$3 = _el$2.firstChild,
          _el$4 = _el$3.nextSibling,
          _el$5 = _el$4.nextSibling,
          _el$6 = _el$5.firstChild,
          _el$7 = _el$6.firstChild;
        _el$2.style.setProperty("z-index", "1100");
        _el$2.addEventListener("click", closeBot);
        insert(_el$3, css_248z);
        _el$7.style.setProperty("background-color", "transparent");
        _el$7.style.setProperty("margin-left", "20px");
        _el$7.style.setProperty("margin-right", "20px");
        _el$7.addEventListener("click", stopPropagation);
        _el$7.addEventListener("pointerdown", stopPropagation);
        insert(_el$7, (() => {
          const _c$ = createMemo(() => !!props.value);
          return () => _c$() && (() => {
            const _el$8 = _tmpl$3$3(),
              _el$9 = _el$8.firstChild;
            _el$8.style.setProperty("background", "white");
            _el$8.style.setProperty("margin", "auto");
            _el$8.style.setProperty("padding", "7px");
            const _ref$ = preEl;
            typeof _ref$ === "function" ? use(_ref$, _el$9) : preEl = _el$9;
            return _el$8;
          })();
        })());
        return _el$2;
      })()];
    }
  });
};

const _tmpl$$3 = /*#__PURE__*/template(`<button class="justify-between question-button-mobile">`),
  _tmpl$2$3 = /*#__PURE__*/template(`<button class="justify-between question-button-desktop">`),
  _tmpl$3$2 = /*#__PURE__*/template(`<div class="flex" data-testid="input">`);
const QuestionButton = props => {
  // compute the left offset
  const isMobile = isMobileCheck();
  "calc(20px + " + props.leftOffset + ")";
  return (() => {
    const _el$ = _tmpl$3$2();
    insert(_el$, createComponent(Show, {
      when: isMobile,
      get children() {
        const _el$2 = _tmpl$$3();
        _el$2.$$click = () => {
          props.onQuestionClick(props.question);
        };
        insert(_el$2, () => props.question);
        createRenderEffect(() => props.mobileQuestionFontSize != null ? _el$2.style.setProperty("font-size", props.mobileQuestionFontSize) : _el$2.style.removeProperty("font-size"));
        return _el$2;
      }
    }), null);
    insert(_el$, createComponent(Show, {
      when: !isMobile,
      get children() {
        const _el$3 = _tmpl$2$3();
        _el$3.$$click = () => {
          props.onQuestionClick(props.question);
        };
        insert(_el$3, () => props.question);
        createRenderEffect(() => props.desktopQuestionFontSize != null ? _el$3.style.setProperty("font-size", props.desktopQuestionFontSize) : _el$3.style.removeProperty("font-size"));
        return _el$3;
      }
    }), null);
    return _el$;
  })();
};
delegateEvents(["click"]);

const _tmpl$$2 = /*#__PURE__*/template(`<button class="close-tab-btn">&times;`),
  _tmpl$2$2 = /*#__PURE__*/template(`<div class="question-container flex gap-3 outer-questions">`),
  _tmpl$3$1 = /*#__PURE__*/template(`<div><div class="flex w-full h-full justify-center"><div class="overflow-y-scroll min-w-full w-full min-h-full px-3 pt-10 relative scrollable-container chatbot-chat-view scroll-smooth">`),
  _tmpl$4 = /*#__PURE__*/template(`<div>`),
  _tmpl$5 = /*#__PURE__*/template(`<div class="w-full h-32">`);
const defaultWelcomeMessage = "Hi there! How can I help?";
const Bot = props => {
  let chatContainer;
  let bottomSpacer;
  let botContainer;
  const [userInput, setUserInput] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [sourcePopupOpen, setSourcePopupOpen] = createSignal(false);
  const [sourcePopupSrc, setSourcePopupSrc] = createSignal({});
  const [questionClicked, setQuestionClicked] = createSignal(false);
  const [messages, setMessages] = createSignal([{
    message: props.welcomeMessage ?? defaultWelcomeMessage,
    type: "apiMessage"
  }], {
    equals: false
  });
  const [socketIOClientId, setSocketIOClientId] = createSignal("");
  const [isChatFlowAvailableToStream, setIsChatFlowAvailableToStream] = createSignal(false);
  const convo_message = {
    messages: [{
      text: props.welcomeMessage ? props.welcomeMessage : "",
      type: "bot",
      timestamp: new Date().toISOString()
    }],
    load_id: props.loadID,
    realtor_id: props.userID
  };
  sendLogConvoQuery(convo_message);
  onMount(() => {
    if (!bottomSpacer) return;
    setTimeout(() => {
      chatContainer?.scrollTo(0, chatContainer.scrollHeight);
    }, 50);
  });
  const scrollToBottom = () => {
    setTimeout(() => {
      chatContainer?.scrollTo(0, chatContainer.scrollHeight);
    }, 50);
  };
  const updateLastMessage = text => {
    setMessages(data => {
      const updated = data.map((item, i) => {
        if (i === data.length - 1 && item.type === "apiMessage" && item.streamable) {
          return {
            ...item,
            message: item.message + text
          };
        }
        return item;
      });
      return [...updated];
    });
  };
  const updateFullMessage = (text, id) => {
    setMessages(data => {
      const updated = data.map((item, i) => {
        if (item.type === "apiMessage" && item.id === id) {
          return {
            ...item,
            message: text,
            streamable: false
          };
        }
        return item;
      });
      return [...updated];
    });
  };
  const updateLastMessageSourceDocuments = sourceDocuments => {
    setMessages(data => {
      const updated = data.map((item, i) => {
        if (i === data.length - 1) {
          return {
            ...item,
            sourceDocuments: sourceDocuments
          };
        }
        return item;
      });
      return [...updated];
    });
  };
  // Handle errors
  const handleError = (message = "Oops! There seems to be an error. Please try again.") => {
    setMessages(prevMessages => [...prevMessages, {
      message,
      type: "apiMessage"
    }]);
    setLoading(false);
    setUserInput("");
    scrollToBottom();
  };
  // Handle form submission
  const handleSubmit = async value => {
    setQuestionClicked(true);
    setUserInput(value);
    if (value.trim() === "") {
      return;
    }
    let message_send_time = new Date().toISOString();
    setLoading(true);
    scrollToBottom();
    // Send user question and history to API
    props.welcomeMessage ?? defaultWelcomeMessage;
    const messageList = messages().filter(msg => !msg?.streamable);
    const message_id = String(Math.random());
    setMessages(prevMessages => [...prevMessages, {
      message: value,
      type: "userMessage"
    }, {
      message: "",
      type: "apiMessage",
      streamable: true,
      id: message_id
    }]);
    const body = {
      question: value,
      load_id: props.loadID,
      history: messageList
    };
    if (props.chatflowConfig) body.overrideConfig = props.chatflowConfig;
    if (isChatFlowAvailableToStream()) body.socketIOClientId = socketIOClientId();
    let bot_resp_time = new Date().toISOString();
    body.page_url = window.location.href;
    // console.log(body);
    const result = await sendMessageQuery({
      chatflowid: props.chatflowid,
      apiHost: props.apiHost,
      body
    });
    var text = "";
    if (typeof result.data === "object" && "text" in result.data) {
      text = result.data.text;
    } else {
      text = result.data;
    }
    const convo_message = {
      messages: [{
        text: value,
        type: "user",
        timestamp: message_send_time
      }, {
        text: text,
        type: "bot",
        timestamp: bot_resp_time
      }],
      load_id: props.loadID,
      realtor_id: props.userID
    };
    sendLogConvoQuery(convo_message);
    if (result.data) {
      const data = handleVectaraMetadata(result.data);
      if (typeof data === "object" && data.text && data.sourceDocuments) {
        if (!isChatFlowAvailableToStream()) {
          setMessages(prevMessages => [...prevMessages, {
            message: data.text,
            sourceDocuments: data.sourceDocuments,
            type: "apiMessage"
          }]);
        }
      } else {
        updateFullMessage(text, message_id);
        //if (!isChatFlowAvailableToStream()) setMessages((prevMessages) => [...prevMessages, { message: data, type: 'apiMessage' }])
      }

      setLoading(false);
      setUserInput("");
      scrollToBottom();
    }
    if (result.error) {
      const error = result.error;
      console.error(error);
      const err = error;
      const errorData = typeof err === "string" ? err : err.response.data || `${err.response.status}: ${err.response.statusText}`;
      handleError(errorData);
      return;
    }
  };
  // Auto scroll chat to bottom
  createEffect(() => {
    if (messages()) scrollToBottom();
  });
  createEffect(() => {
    if (props.fontSize && botContainer) botContainer.style.fontSize = `${props.fontSize}px`;
  });
  // eslint-disable-next-line solid/reactivity
  createEffect(async () => {
    const {
      data
    } = await isStreamAvailableQuery({
      chatflowid: props.chatflowid,
      apiHost: props.apiHost
    });
    if (data) {
      setIsChatFlowAvailableToStream(data?.isStreaming ?? false);
    }
    const socket = lookup(props.apiHost);
    socket.on("connect", () => {
      // console.log("connect", socket.id);
      setSocketIOClientId(socket.id);
    });
    socket.on("start", () => {
      // setMessages((prevMessages) => [...prevMessages, { message: '', type: 'apiMessage' }])
    });
    socket.on("sourceDocuments", updateLastMessageSourceDocuments);
    socket.on("token", updateLastMessage);
    // eslint-disable-next-line solid/reactivity
    return () => {
      setUserInput("");
      setLoading(false);
      setMessages([{
        message: props.welcomeMessage ?? defaultWelcomeMessage,
        type: "apiMessage"
      }]);
      if (socket) {
        socket.disconnect();
        setSocketIOClientId("");
      }
    };
  });
  const isValidURL = url => {
    try {
      return new URL(url);
    } catch (err) {
      return undefined;
    }
  };
  const handleVectaraMetadata = message => {
    if (message.sourceDocuments && message.sourceDocuments[0].metadata.length) {
      message.sourceDocuments = message.sourceDocuments.map(docs => {
        const newMetadata = docs.metadata.reduce((newMetadata, metadata) => {
          newMetadata[metadata.name] = metadata.value;
          return newMetadata;
        }, {});
        return {
          pageContent: docs.pageContent,
          metadata: newMetadata
        };
      });
    }
    return message;
  };
  const removeDuplicateURL = message => {
    const visitedURLs = [];
    const newSourceDocuments = [];
    message = handleVectaraMetadata(message);
    message.sourceDocuments.forEach(source => {
      if (isValidURL(source.metadata.source) && !visitedURLs.includes(source.metadata.source)) {
        visitedURLs.push(source.metadata.source);
        newSourceDocuments.push(source);
      } else if (!isValidURL(source.metadata.source)) {
        newSourceDocuments.push(source);
      }
    });
    return newSourceDocuments;
  };
  const clickPrompt = message => {
    // console.log("clicked the button")
    // console.log(message)
    handleSubmit(message);
    setQuestionClicked(true);
  };
  return [(() => {
    const _el$ = _tmpl$3$1(),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild;
    const _ref$ = botContainer;
    typeof _ref$ === "function" ? use(_ref$, _el$) : botContainer = _el$;
    const _ref$2 = chatContainer;
    typeof _ref$2 === "function" ? use(_ref$2, _el$3) : chatContainer = _el$3;
    insert(_el$3, createComponent(For, {
      get each() {
        return [...messages()];
      },
      children: (message, index) => [createMemo((() => {
        const _c$2 = createMemo(() => message.type === "userMessage");
        return () => _c$2() && createComponent(GuestBubble, {
          get message() {
            return message.message;
          },
          get backgroundColor() {
            return props.userMessage?.backgroundColor;
          },
          get textColor() {
            return props.userMessage?.textColor;
          },
          get showAvatar() {
            return props.userMessage?.showAvatar;
          },
          get avatarSrc() {
            return props.userMessage?.avatarSrc;
          }
        });
      })()), createMemo((() => {
        const _c$3 = createMemo(() => message.type === "apiMessage");
        return () => _c$3() && createComponent(BotBubble, {
          get message() {
            return message.message;
          },
          get backgroundColor() {
            return props.botMessage?.backgroundColor;
          },
          get textColor() {
            return props.botMessage?.textColor;
          },
          get showAvatar() {
            return props.botMessage?.showAvatar;
          },
          get avatarSrc() {
            return props.botMessage?.avatarSrc;
          },
          get loading() {
            return createMemo(() => !!(message.message === "" && loading()))() && index() === messages().length - 1;
          }
        });
      })()), createMemo((() => {
        const _c$4 = createMemo(() => !!(message.sourceDocuments && message.sourceDocuments.length));
        return () => _c$4() && (() => {
          const _el$6 = _tmpl$4();
          _el$6.style.setProperty("display", "flex");
          _el$6.style.setProperty("flex-direction", "row");
          _el$6.style.setProperty("width", "100%");
          insert(_el$6, createComponent(For, {
            get each() {
              return [...removeDuplicateURL(message)];
            },
            children: src => {
              const URL = isValidURL(src.metadata.source);
              return createComponent(SourceBubble, {
                get pageContent() {
                  return URL ? URL.pathname : src.pageContent;
                },
                get metadata() {
                  return src.metadata;
                },
                onSourceClick: () => {
                  if (URL) {
                    window.open(src.metadata.source, "_blank");
                  } else {
                    setSourcePopupSrc(src);
                    setSourcePopupOpen(true);
                  }
                }
              });
            }
          }));
          return _el$6;
        })();
      })())]
    }));
    insert(_el$2, createComponent(Show, {
      get when() {
        return !props?.fullScreen;
      },
      get children() {
        const _el$4 = _tmpl$$2();
        addEventListener$1(_el$4, "click", props.closeBoxFunction, true);
        return _el$4;
      }
    }), null);
    insert(_el$2, createComponent(Show, {
      get when() {
        return createMemo(() => !!props.includeQuestions)() && !questionClicked();
      },
      get children() {
        const _el$5 = _tmpl$2$2();
        _el$5.style.setProperty("position", "absolute");
        _el$5.style.setProperty("left", "20px");
        _el$5.style.setProperty("width", "calc(100% - 40px)");
        _el$5.style.setProperty("bottom", "100px");
        _el$5.style.setProperty("margin", "auto");
        _el$5.style.setProperty("z-index", "1000");
        insert(_el$5, () => props.questions?.map((item, index) => createComponent(QuestionButton, {
          question: item,
          onQuestionClick: clickPrompt,
          leftOffset: "0%",
          get mobileQuestionFontSize() {
            return props.mobileQuestionFontSize;
          },
          get desktopQuestionFontSize() {
            return props.desktopQuestionFontSize;
          }
        })));
        return _el$5;
      }
    }), null);
    insert(_el$2, createComponent(TextInput, {
      get backgroundColor() {
        return props.textInput?.backgroundColor;
      },
      get textColor() {
        return props.textInput?.textColor;
      },
      get placeholder() {
        return props.textInput?.placeholder;
      },
      get sendButtonColor() {
        return props.textInput?.sendButtonColor;
      },
      get fontSize() {
        return props.fontSize;
      },
      get defaultValue() {
        return userInput();
      },
      onSubmit: handleSubmit
    }), null);
    insert(_el$, createComponent(Badge, {
      get badgeBackgroundColor() {
        return props.badgeBackgroundColor;
      },
      get poweredByTextColor() {
        return props.poweredByTextColor;
      },
      botContainer: botContainer,
      get badgeText() {
        return props.badgeText;
      }
    }), null);
    insert(_el$, createComponent(BottomSpacer, {
      ref(r$) {
        const _ref$3 = bottomSpacer;
        typeof _ref$3 === "function" ? _ref$3(r$) : bottomSpacer = r$;
      }
    }), null);
    createRenderEffect(_p$ => {
      const _v$ = "relative flex w-full h-full text-base overflow-hidden bg-cover bg-center flex-col items-center chatbot-container " + props.class,
        _v$2 = props.includeQuestions && !questionClicked() ? "170px" : "110px";
      _v$ !== _p$._v$ && className(_el$, _p$._v$ = _v$);
      _v$2 !== _p$._v$2 && ((_p$._v$2 = _v$2) != null ? _el$3.style.setProperty("padding-bottom", _v$2) : _el$3.style.removeProperty("padding-bottom"));
      return _p$;
    }, {
      _v$: undefined,
      _v$2: undefined
    });
    return _el$;
  })(), createMemo((() => {
    const _c$ = createMemo(() => !!sourcePopupOpen());
    return () => _c$() && createComponent(Popup, {
      get isOpen() {
        return sourcePopupOpen();
      },
      get value() {
        return sourcePopupSrc();
      },
      onClose: () => setSourcePopupOpen(false)
    });
  })())];
};
const BottomSpacer = props => {
  return (() => {
    const _el$7 = _tmpl$5();
    const _ref$4 = props.ref;
    typeof _ref$4 === "function" ? use(_ref$4, _el$7) : props.ref = _el$7;
    return _el$7;
  })();
};
delegateEvents(["click"]);

const _tmpl$$1 = /*#__PURE__*/template(`<style>`),
  _tmpl$2$1 = /*#__PURE__*/template(`<link rel="icon" href="data:,">`),
  _tmpl$3 = /*#__PURE__*/template(`<div part="bot">`);
const Bubble = props => {
  const [bubbleProps] = splitProps(props, ["theme", "popoutMessageConfig"]);
  const [popoutConfigProps] = splitProps(props, ["popoutMessageConfig"]);
  //check cookie for how many times the site as been loaded
  // const numLoadedCookie: string =  getCookie("numLoadedChat");
  // let numLoaded: number  = parseInt(numLoadedCookie);
  // numLoaded = numLoaded ? numLoaded : 0;
  //const isMobile =  window?.innerWidth ? (window?.innerWidth < 1000): false;
  const isMobile = isMobileCheck();
  const height_calc = isMobile ? "calc(min(350px, max(100% - 100px,275px)))" : "calc(min(500px, max(100% - 100px,300px)))";
  let defaultOpen = isMobile ? props.defaultOpenMobile : props.defaultOpenDesktop;
  // grab cookie to check if bot has been closed before
  const cookie_name = `realty-ai-bot-closed-${props.userID}`;
  const count_cookie_name = `realty-ai-bot-open-count-${props.userID}`;
  const bot_closed_before = getCookie(cookie_name);
  if (bot_closed_before === "true" && props.stayClosedFlag) {
    defaultOpen = false;
  }
  //isOpen = false
  const [isBotOpened, setIsBotOpened] = createSignal(defaultOpen);
  const [isBotStarted, setIsBotStarted] = createSignal(defaultOpen);
  const [isVisible, setIsVisible] = createSignal(true);
  const [visibleCount, setVisibleCount] = createSignal(0);
  const [hasClosed, setHasClosed] = createSignal(false);
  const [isChatFlowAvailableToStream, setIsChatFlowAvailableToStream] = createSignal(false);
  var openCount = Number(getCookie(count_cookie_name));
  if (!openCount) {
    openCount = 0;
  }
  const openBot = () => {
    if (!isBotStarted()) setIsBotStarted(true);
    openCount += 1;
    setCookie(count_cookie_name, openCount.toString(), 1 / 48);
    setIsBotOpened(true);
  };
  const timedOpenBot = () => {
    if (props.stayClosedFlag && bot_closed_before === "true") {
      // console.log("No Popup - previously closed");
      return;
    }
    const maxPopups = props.maxPopups ? props.maxPopups : 0;
    if (maxPopups <= openCount && maxPopups > 0) {
      // console.log("Max Popups", maxPopups);
      // console.log("No Popup - exceeded max popups");
      return;
    }
    // console.log(props.delayOpenFlag);
    if (props.delayOpenFlag && !isBotOpened() && !hasClosed()) {
      openBot();
    }
  };
  if (props.delayOpenFlag) {
    setTimeout(timedOpenBot, props.delayOpenSeconds * 1000); //convert to mills
  }

  const closeBot = () => {
    setIsBotOpened(false);
    setHasClosed(true);
    setCookie(cookie_name, "true", 1);
  };
  const toggleBot = () => {
    isBotOpened() ? closeBot() : openBot();
    setVisibleCount(0);
  };
  // check if visibility is changing and update count
  const updateVisible = () => {
    setIsVisible(document.visibilityState === "visible");
    if (isVisible() === (document.visibilityState === "visible")) {
      setVisibleCount(x => Math.min(x + 1, 3));
    }
  };
  // event listener for changes in visibility
  document.addEventListener("visibilitychange", updateVisible);
  // if count is creater than two ie switched tabs twice then close bot window
  createEffect(() => {
    if (visibleCount() > 2) {
      // console.log("closed window because of toggling tab");
      closeBot();
    }
  });
  onMount(() => {
    const checkStreamAvailability = async () => {
      const {
        data
      } = await isStreamAvailableQuery({
        chatflowid: props.chatflowid,
        apiHost: props.apiHost
      });
      if (data) {
        setIsChatFlowAvailableToStream(data?.isStreaming ?? false);
      }
    };
    checkStreamAvailability();
  });
  return createComponent(Show, {
    get when() {
      return isChatFlowAvailableToStream();
    },
    get children() {
      return [(() => {
        const _el$ = _tmpl$$1();
        insert(_el$, css_248z);
        return _el$;
      })(), _tmpl$2$1(), createComponent(BubbleButton, mergeProps(() => bubbleProps.theme?.button, {
        get userID() {
          return props.userID;
        },
        toggleBot: toggleBot,
        get isBotOpened() {
          return isBotOpened();
        },
        get popoutMessageConfig() {
          return popoutConfigProps.popoutMessageConfig;
        },
        get popoutMessageTheme() {
          return {
            message: bubbleProps.theme?.popoutMessage?.message ?? "Need help? Let's chat!",
            backgroundColor: bubbleProps.theme?.popoutMessage?.backgroundColor ?? Config.theme.popoutMessage.defaultBackgroundColor
          };
        },
        get showAvatar() {
          return bubbleProps.theme?.button?.showAvatar ?? true;
        },
        get avatarSrc() {
          return bubbleProps.theme?.chatWindow?.botMessage?.avatarSrc;
        }
      })), (() => {
        const _el$3 = _tmpl$3();
        _el$3.style.setProperty("transition", "transform 200ms cubic-bezier(0, 1.2, 1, 1), opacity 150ms ease-out");
        _el$3.style.setProperty("transform-origin", "bottom right");
        _el$3.style.setProperty("box-shadow", "rgb(0 0 0 / 16%) 0px 5px 40px");
        _el$3.style.setProperty("z-index", "42424242");
        insert(_el$3, createComponent(Show, {
          get when() {
            return isBotStarted();
          },
          get children() {
            return createComponent(Bot, {
              get badgeBackgroundColor() {
                return bubbleProps.theme?.chatWindow?.backgroundColor;
              },
              get welcomeMessage() {
                return bubbleProps.theme?.chatWindow?.welcomeMessage;
              },
              get poweredByTextColor() {
                return bubbleProps.theme?.chatWindow?.poweredByTextColor;
              },
              get textInput() {
                return bubbleProps.theme?.chatWindow?.textInput;
              },
              get botMessage() {
                return bubbleProps.theme?.chatWindow?.botMessage;
              },
              get userMessage() {
                return bubbleProps.theme?.chatWindow?.userMessage;
              },
              get fontSize() {
                return bubbleProps.theme?.chatWindow?.fontSize;
              },
              get chatflowid() {
                return props.chatflowid;
              },
              get chatflowConfig() {
                return props.chatflowConfig;
              },
              get apiHost() {
                return props.apiHost;
              },
              closeBoxFunction: closeBot,
              get includeQuestions() {
                return props.includeQuestions;
              },
              fullScreen: false,
              get userID() {
                return props.userID;
              },
              get loadID() {
                return props.loadID;
              },
              get questions() {
                return props.questions;
              },
              get mobileQuestionFontSize() {
                return props.mobileQuestionFontSize;
              },
              get desktopQuestionFontSize() {
                return props.desktopQuestionFontSize;
              },
              get badgeText() {
                return props.badgeText;
              }
            });
          }
        }));
        createRenderEffect(_p$ => {
          const _v$ = bubbleProps.theme?.chatWindow?.height ? `${bubbleProps.theme?.chatWindow?.height.toString()}px` : height_calc,
            _v$2 = isBotOpened() ? "scale3d(1, 1, 1)" : "scale3d(0, 0, 1)",
            _v$3 = bubbleProps.theme?.chatWindow?.backgroundColor || "#ffffff",
            _v$4 = `fixed sm:right-5 rounded-lg w-full sm:w-[400px] max-h-[704px] overflow-hidden` + (isBotOpened() ? " opacity-1" : " opacity-0 pointer-events-none") + (props.theme?.button?.size === "large" ? " bottom-28" : " bottom-24");
          _v$ !== _p$._v$ && ((_p$._v$ = _v$) != null ? _el$3.style.setProperty("height", _v$) : _el$3.style.removeProperty("height"));
          _v$2 !== _p$._v$2 && ((_p$._v$2 = _v$2) != null ? _el$3.style.setProperty("transform", _v$2) : _el$3.style.removeProperty("transform"));
          _v$3 !== _p$._v$3 && ((_p$._v$3 = _v$3) != null ? _el$3.style.setProperty("background-color", _v$3) : _el$3.style.removeProperty("background-color"));
          _v$4 !== _p$._v$4 && className(_el$3, _p$._v$4 = _v$4);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined,
          _v$3: undefined,
          _v$4: undefined
        });
        return _el$3;
      })()];
    }
  });
};

const _tmpl$ = /*#__PURE__*/template(`<style>`),
  _tmpl$2 = /*#__PURE__*/template(`<div>`);
const Full = (props, {
  element
}) => {
  const [isBotDisplayed, setIsBotDisplayed] = createSignal(false);
  const launchBot = () => {
    setIsBotDisplayed(true);
  };
  const botLauncherObserver = new IntersectionObserver(intersections => {
    if (intersections.some(intersection => intersection.isIntersecting)) launchBot();
  });
  onMount(() => {
    botLauncherObserver.observe(element);
  });
  onCleanup(() => {
    botLauncherObserver.disconnect();
  });
  return [(() => {
    const _el$ = _tmpl$();
    insert(_el$, css_248z);
    return _el$;
  })(), createComponent(Show, {
    get when() {
      return isBotDisplayed();
    },
    get children() {
      const _el$2 = _tmpl$2();
      _el$2.style.setProperty("margin", "0px");
      insert(_el$2, createComponent(Bot, {
        get badgeBackgroundColor() {
          return props.theme?.chatWindow?.backgroundColor;
        },
        get welcomeMessage() {
          return props.theme?.chatWindow?.welcomeMessage;
        },
        get poweredByTextColor() {
          return props.theme?.chatWindow?.poweredByTextColor;
        },
        get textInput() {
          return props.theme?.chatWindow?.textInput;
        },
        get botMessage() {
          return props.theme?.chatWindow?.botMessage;
        },
        get userMessage() {
          return props.theme?.chatWindow?.userMessage;
        },
        get fontSize() {
          return props.theme?.chatWindow?.fontSize;
        },
        get chatflowid() {
          return props.chatflowid;
        },
        get chatflowConfig() {
          return props.chatflowConfig;
        },
        get apiHost() {
          return props.apiHost;
        },
        fullScreen: true,
        get userID() {
          return props.userID;
        },
        get loadID() {
          return props.loadID;
        },
        get questions() {
          return props.questions;
        },
        get includeQuestions() {
          return props.includeQuestions;
        },
        get mobileQuestionFontSize() {
          return props.mobileQuestionFontSize;
        },
        get desktopQuestionFontSize() {
          return props.desktopQuestionFontSize;
        },
        get badgeText() {
          return props.badgeText;
        }
      }));
      createRenderEffect(_p$ => {
        const _v$ = props.theme?.chatWindow?.backgroundColor || '#ffffff',
          _v$2 = props.theme?.chatWindow?.height ? `${props.theme?.chatWindow?.height.toString()}px` : '100%',
          _v$3 = props.theme?.chatWindow?.width ? `${props.theme?.chatWindow?.width.toString()}px` : '100%';
        _v$ !== _p$._v$ && ((_p$._v$ = _v$) != null ? _el$2.style.setProperty("background-color", _v$) : _el$2.style.removeProperty("background-color"));
        _v$2 !== _p$._v$2 && ((_p$._v$2 = _v$2) != null ? _el$2.style.setProperty("height", _v$2) : _el$2.style.removeProperty("height"));
        _v$3 !== _p$._v$3 && ((_p$._v$3 = _v$3) != null ? _el$2.style.setProperty("width", _v$3) : _el$2.style.removeProperty("width"));
        return _p$;
      }, {
        _v$: undefined,
        _v$2: undefined,
        _v$3: undefined
      });
      return _el$2;
    }
  })];
};

const registerWebComponents = () => {
  if (typeof window === "undefined") return;
  // @ts-expect-error element incorect type
  customElement("realty-ai-fullchatbot", defaultBotProps, Full);
  customElement("realty-ai-chatbot", defaultBotProps, Bubble);
};

/* eslint-disable solid/reactivity */
const fetchAndParseBasicConfig = props => {
  return sendRequest({
    method: "GET",
    url: `${Config.server.userConfigApiUrl}?username=${props.userID}`
  }).then(response => {
    if (!response.data) {
      throw new Error("No response data");
    }
    if (response.data.errorType || !response.data.body) {
      console.error("Fetching config failed", response.data);
      throw new Error(response.data.errorMessage || "No response body");
    }
    const config_data = JSON.parse(response.data.body);
    // prettier-ignore
    // console.log("%c[REALTY-AI-BOT]", "color: #3B81F6; font-weight: bold;", "Config Fetched", config_data);
    props.theme = config_data?.theme;
    props.chatflowid = config_data?.chatflowid;
    props.apiHost = config_data?.apiHost;
    props.includeQuestions = config_data?.includeQuestions;
    props.defaultOpenDesktop = config_data?.defaultOpenDesktop;
    props.defaultOpenMobile = config_data?.defaultOpenMobile;
    props.delayOpenSeconds = config_data?.delayOpenSeconds;
    props.delayOpenFlag = config_data?.delayOpenFlag;
    props.loadID = config_data?.load_id ? config_data?.load_id : "";
    props.stayClosedFlag = config_data?.stayClosedFlag;
    props.questions = config_data?.questions;
    props.badgeText = config_data?.badgeText;
    props.popoutMessageConfig = config_data?.popoutMessage;
    return {
      props,
      config_data
    };
  });
};
// prettier-ignore
// console.log("%c[REALTY-AI-BOT]", "color: #3B81F6; font-weight: bold;", version);
const initFull = props => {
  fetchAndParseBasicConfig(props).then(({
    props
  }) => {
    const fullElement = props.id ? document.getElementById(props.id) : document.querySelector("realty-ai-fullchatbot-parent");
    if (!fullElement) throw new Error("<realty-ai-fullchatbot> element not found.");
    const element = document.createElement("realty-ai-fullchatbot");
    Object.assign(element, props);
    fullElement.appendChild(element);
  }).catch(error => {
    console.error(error);
  });
};
const init = async props => {
  fetchAndParseBasicConfig(props).then(({
    props,
    config_data
  }) => {
    props.maxPopups = config_data?.maxPopups ? config_data?.maxPopups : 0;
    props.mobileQuestionFontSize = config_data?.mobileQuestionFontSize ? config_data?.mobileQuestionFontSize : "10px";
    props.desktopQuestionFontSize = config_data?.desktopQuestionFontSize ? config_data?.desktopQuestionFontSize : "20px";
    const no_display = config_data?.no_display;
    const isMobile = isMobileCheck();
    const noMobile = config_data?.noMobile;
    if (no_display) {
      return;
    }
    // prettier-ignore
    // console.log("%c[REALTY-AI-BOT]", "color: #3B81F6; font-weight: bold;", isMobile ? noMobile ? "Disabled on mobile" : "Platform is mobile" : "Platform is desktop");
    if (isMobile && noMobile) {
      return;
    }
    // props.isOpen = props.isOpen || default_open
    const element = document.createElement("realty-ai-chatbot");
    Object.assign(element, props);
    document.body.appendChild(element);
  }).catch(error => {
    console.error(error);
  });
  // TODO: need to add error checking and handling
};

const parseChatbot = () => ({
  initFull,
  init
});
const injectChatbotInWindow = bot => {
  if (typeof window === "undefined") return;
  window.Chatbot = {
    ...bot
  };
};

registerWebComponents();
const chatbot = parseChatbot();
injectChatbotInWindow(chatbot);
// const script_id = document.getElementById("realty_ai")?.getAttribute("data-realityaiid");
const script_id = document.getElementById("realty_ai")?.dataset.realityaiid;
// prettier-ignore
// console.log("%c[REALTY-AI-BOT]", "color: #3B81F6; font-weight: bold;", script_id);
chatbot.init({
  userID: script_id ? script_id : "",
  chatflowid: "",
  includeQuestions: false
});

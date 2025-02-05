// biome-ignore lint: FIXME: no idea what to do here, since unknown won't work either
type MagicSet = Set<Magic<any, any>> | null;
// biome-ignore lint: FIXME: no idea what to do here, since unknown won't work either
let currentMagic: Magic<any, any> | null = null;

const DoesNotNeedUpdate = 0;
const MightNeedUpdate = 1;
const NeedsUpdate = 2;
type CacheState = typeof DoesNotNeedUpdate | typeof MightNeedUpdate | typeof NeedsUpdate;

/** Reactive magic function. Kind of like a combination of a signal, a computed, and an effect. */
export class Magic<State, Message> {
  #runner: (state?: State, message?: Message, instance?: Magic<State, Message>) => State;
  #equals: (a: unknown, b: unknown) => boolean;

  #value?: State = undefined;
  #cacheState: CacheState = NeedsUpdate;

  #parents: MagicSet = null;
  #visitedParents: MagicSet = null;
  #children: MagicSet = null;

  constructor(
    runner: (state?: State, message?: Message, instance?: Magic<State, Message>) => State,
    options = defaultOptions,
  ) {
    if (import.meta.env.DEV) {
      if (runner?.constructor.name === "AsyncFunction") {
        throw new Error(
          "Magic cannot support async functions. If they `await` anything, the whole Magic system will fail.",
        );
      }
    }
    this.#runner = runner;

    const { equals } = options === defaultOptions ? options : { ...defaultOptions, ...options };
    this.#equals = equals;
  }

  /** Gets the return value of this Magic. If its ancestors have updated, it will re-run. Otherwise the most recent return value is used. If called inside another Magic, whenever this Magic's return value changes that Magic will re-run on its next `.get()`. */
  get(): State {
    // If this is called inside another magic function…
    if (currentMagic) {
      // if it's called inside itself, just return the cached value I guess?
      if (currentMagic === this) return this.#value as State;

      // add that as a child to this
      if (!this.#children) this.#children = new Set();
      this.#children.add(currentMagic);

      // and this as a parent to that
      if (!currentMagic.#parents) currentMagic.#parents = new Set();
      currentMagic.#parents.add(this);

      // and also mark this as a visited parent, for cleaning up stale relationships later
      if (!currentMagic.#visitedParents) currentMagic.#visitedParents = new Set();
      currentMagic.#visitedParents.add(this);
    }

    return this.#updateIfNeeded();
  }

  #updateIfNeeded() {
    if (this.#cacheState === MightNeedUpdate && this.#parents) {
      // One of the ancestors has updated, so let's find it and run it first, along with anything in between
      for (const parent of this.#parents) {
        parent.#updateIfNeeded();

        // If cacheState has changed due to parent updates, stop and continue below
        if (this.#cacheState !== MightNeedUpdate) break;
      }
    }

    if (this.#cacheState === NeedsUpdate) return this.update();

    return this.#value as State;
  }

  /** Re-run this Magic and pass it a message as an argument. If its return value changes, its children will re-run on their next `.get()`. */
  update(message?: Message): State {
    if (currentMagic === this) throw new Error("Can't update a Magic inside itself");

    const previousMagic = currentMagic;
    currentMagic = this;

    let newState = this.#value;

    try {
      newState = this.#runner(this.#value, message, this);
    } catch (error) {
      (globalThis?.reportError || console.error)(error);
    }

    // Delete outdated parent/child relationships
    if (this.#parents) {
      for (const parent of this.#parents) {
        if (!this.#visitedParents?.has(parent)) {
          this.#parents.delete(parent);
          parent.#children?.delete(this);
        }
      }
    }
    this.#visitedParents?.clear();

    // If new state differs from the previous, mark all children as needing update
    // and their descendants as maybe needing update
    if (this.#children && !this.#equals(newState, this.#value)) {
      for (const child of this.#children) {
        child.#markAsNeedingUpdate(NeedsUpdate);
      }
    }

    // Finish up
    this.#value = newState;
    this.#cacheState = DoesNotNeedUpdate;
    currentMagic = previousMagic;

    return this.#value as State;
  }

  #markAsNeedingUpdate(newCacheState: CacheState) {
    // Skip if already needing an update
    if (this.#cacheState < newCacheState) {
      this.#cacheState = newCacheState;

      // Mark children as maybe needing an update
      if (this.#children) {
        for (const child of this.#children) {
          child.#markAsNeedingUpdate(MightNeedUpdate);
        }
      }
    }
  }

  /** Disconnect from other Magics and become uncallable. Best do this when the Magic is no longer needed. Otherwise parent-child relationships may keep it from being garbage-collected. */
  destroy() {
    if (this.#parents) {
      for (const parent of this.#parents) {
        parent.#children?.delete(this);
      }
    }

    this.#parents?.clear();
    this.#visitedParents?.clear();
    this.#children?.clear();

    this.#value = undefined;
    this.#runner = destroyed;
    this.#equals = defaultOptions.equals;
  }
}

export const defaultOptions = {
  /** Used to compare the new and previous return value after a Magic runs. If it returns false, the Magic's children will re-run in response. */
  equals: (a: unknown, b: unknown) => a === b,
};

const destroyed = () => {
  throw new Error("This has been .destroy()'d and is no longer callable");
};

export class MagicState<State> extends Magic<State, State> {
  constructor(initialState: State, options = defaultOptions) {
    super((state: State = initialState, message?: State) => {
      return message === undefined ? state : message;
    }, options);
  }
}

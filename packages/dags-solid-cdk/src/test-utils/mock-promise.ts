
function _isPromiseLike<T>(arg: T | PromiseLike<T>): arg is PromiseLike<T> {
    if (arg != null && (typeof arg === 'object' || typeof arg === 'function') && typeof (arg as any).then === 'function' ) {
        return true;
    } else {
        return false
    }
}


export function _installMockPromise(queue: (fn: () => void) => void): () => void {
    class _MockPromise<T> implements Promise<T> {
        #thenHandlers: ((value: T) => void)[] = [];
        #catchHandlers: ((reason: any) => void)[] = [];

        constructor(executor: (resolve: (value: T) => void, reject: (reason?: any) => void) => void) {
            executor(
                (value) => {
                    queue(() => {
                        this.#thenHandlers.forEach(h => h(value));
                });
                },
                (reason) => {
                    queue(() => {
                        this.#catchHandlers.forEach(h => h(reason));
                    });
                }
            );
        }

        then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
            onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
        ): Promise<TResult1 | TResult2> {

            return new _MockPromise((resolve, reject) => {
                if (onfulfilled) this.#thenHandlers.push((v) => {
                    const result = onfulfilled(v);
                    if(_isPromiseLike(result)) {
                        result.then((value) => resolve(value), typeof onrejected === 'function' ? null : (r) => reject(r));
                    } else {
                        resolve(result);
                    }
                    });

                if (onrejected) this.#catchHandlers.push((e) => {
                const result = onrejected(e);
                    if (_isPromiseLike(result)) {
                        result.then(null, (r) => reject(r));
                    } else {
                        reject(result);
                    }
                });
            });
        }

        catch<TResult = never>(
            onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
        ): Promise<T | TResult> {
            return this.then(null, onrejected);
        }

        finally(onfinally?: (() => void) | null): Promise<T> {
            return this.then(
                (v) => {
                    onfinally?.();
                    return v;
                },
                (e) => {
                    onfinally?.();
                    throw e;
                }
            );
        }

        [Symbol.toStringTag] = "Promise";
    }

    const ogPromise = globalThis.Promise;
    globalThis.Promise = _MockPromise as any;

    return () => {
        globalThis.Promise = ogPromise;
    }
}
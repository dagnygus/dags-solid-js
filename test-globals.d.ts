import 'vitest';

declare module 'vitest' {
    interface Assertion<T extends ArrayLike<any>> {
        toBeEach: (expected: ArrayLike<any>) => void;
    }

    interface AsymmetricMatchersContaining {
        toBeEach: (expected: ArrayLike<any>) => void;
    }
}
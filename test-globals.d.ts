import 'vitest';

declare module 'vitest' {
    interface Assertion {
        toBeEach: (expected: ArrayLike<any>) => void;
    }

    interface AsymmetricMatchersContaining {
        toBeEach: (expected: ArrayLike<any>) => void;
    }
}
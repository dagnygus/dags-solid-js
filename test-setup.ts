if (!('toBeEach' in expect && typeof expect.toBeEach === 'function')) {
    expect.extend({
        toBeEach: (received: ArrayLike<any>, expected: ArrayLike<any>) => {
            if (!('length' in received && typeof received.length === 'number')) {
                throw new Error('expect().toBeEach(): A `received` argument is not ArrayLike')
            }
            if (!('length' in expected && typeof expected.length === 'number')) {
                throw new Error('expect().toBeEach(): A `expected` argument is not ArrayLike')
            }

            if (received.length !== expected.length) {
                return {
                    pass: false,
                    message: () => `Expected length ${received.length} to be ${expected.length}.`
                }
            }

            for (let i = 0; i < received.length; i++) {
                if (!Object.is(received[i], expected[i])) {
                    return {
                        pass: false,
                        message: () =>
                            `Expected element at index ${i} to be the same reference.`,
                        actual: received[i],
                        expected: expected[i],
                    };
                }
            }

            return {
                pass: true,
                message: () => 'Expected the collections not to contain the same elements.',
            };
        }
    })
}
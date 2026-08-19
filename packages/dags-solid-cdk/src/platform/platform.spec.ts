//@vitest-environment jsdom

describe('Platform.', () => {

    beforeEach(() => {
        vitest.unstubAllGlobals().resetAllMocks().resetModules();
    });

    describe('IsBrowser', () => {

        it('Should be true in browser environment.', async () => {
            vitest.stubGlobal('__IS_SERVER__', false);
            const { isBrowser } = await import('./platform');
            expect(isBrowser).toBe(true);
        });

        it('Should be false in server environment.', async () => {
            vitest.stubGlobal('__IS_SERVER__', true);
            const { isBrowser } = await import('./platform');
            expect(isBrowser).toBe(false);
        });

    });
});
//@vitest-environment jsdom

describe('Platform. Passive listeners.', () => {
    beforeEach(() => {
        vitest.unstubAllGlobals().resetModules().resetAllMocks();
    });

    describe('supportsPassiveEventListeners()', () => {

        it('Should return false in server environments', async () => {
            vitest.stubGlobal('__IS_SERVER__', true);
            const { supportsPassiveEventListeners } = await import('./passive-listeners')
            expect(supportsPassiveEventListeners()).toBe(false);
        });

        it('Should return boolean in browser environment.', async () => {
            vitest.stubGlobal('__IS_SERVER__', false);
            const { supportsPassiveEventListeners } = await import('./passive-listeners')
            expect(typeof supportsPassiveEventListeners()).toBe('boolean');
        });
        
    });
});
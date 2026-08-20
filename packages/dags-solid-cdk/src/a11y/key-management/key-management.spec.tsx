import { Accessor, Component, createEffect, createRoot, createSignal, getOwner,runWithOwner, Setter } from "solid-js";
import { _defaultGetAccName, _KeyManagerImpl, _UNWRAP_SKIP_PREDICATE, currentHandledKey, deferAddItem, DOMElementKeyManagerItem, FocusableDOMElementKeyManagerItem, focusableKeyManagerItem, horizontalLtrOrientationKeyboardHandler, horizontalRtlOrientationKeyboardHandler, isInKeyManagerHandlerContext, KeyManager, KeyManagerBuilder, keyManagerBuilder, keyManagerItem, KeyManagerItem, ProvideAccessabilityNameAccessor, verticalOrientationKeyboardHandler } from "./key-management";
import { render } from "solid-js/web";
import { isFocused, monitorFocusOrigin } from "../focus-management/focus-management";

vitest.mock(import('./key-management'), (importOgModule) => {
    (globalThis as any).__IS_SERVER__ = false;
    return importOgModule()
})

afterAll(() => {
    vitest.doUnmock('./key-manager');
    delete (globalThis as any).__IS_SERVER__;
})

class TestItem implements KeyManagerItem {

    private _disabled: Accessor<boolean>;
    private _setDisabled: Setter<boolean>;
    private _attached = false;

    id: string = '';

    constructor(
        public sortIndex: number,
        public label: string = '',
        private _onActive: (() => void) | null = null,
        private _onInactive: (() => void) | null = null,
        private _onAttached: ((manager: KeyManager) => void) | null = null,
        private _onDetached: (() => void) | null = null

    ) {
        const [disabled, setDisabled] = createSignal(false);
        this._disabled = disabled;
        this._setDisabled = setDisabled;
    }


    get disabled(): boolean { return this._disabled(); }
    set disabled(value: boolean) { this._setDisabled(value); }

    get attached(): boolean { return this._attached; }

    compare(target: KeyManagerItem): number {
        if (!(target instanceof TestItem)) {
            throw new Error('Not supported item to compare!');
        };
        return this.sortIndex - target.sortIndex;
    }

    onActive(): void {
        this._onActive?.();
    }

    onInactive(): void {
        this._onInactive?.();
    }

    onAttached(manager: KeyManager): void {
        this._onAttached?.(manager);
        this._attached = true;
    }

    onDetached(): void {
        this._onDetached?.();
        this._attached = false;
    }

}

describe('Key manager', () => {

    const disposeBag: (() => void)[] = [];
    let owner: any = null;

    function createManager(buildFn?: (config: Omit<KeyManagerBuilder, 'build'>) => void,): _KeyManagerImpl {
        return createRoot((d) => {
            disposeBag.push(d);
            owner = getOwner();
            const builder = keyManagerBuilder();
            buildFn?.(builder);
            return builder.build() as _KeyManagerImpl;
        });
        
    }

    function subscribeEffect(fn: () => void): void {
        disposeBag.push(createRoot((dispose) => {
            createEffect(fn);
            return dispose;
        }))
    }

    function dispose(): void {
        owner = null;
        while (disposeBag.length) {
            disposeBag.shift()!();
        }
    }

    afterEach(() => {
        dispose();
        vitest.unstubAllGlobals();
        Array.from(document.body.childNodes).forEach((n) => n.remove());
        if (
            vitest.isMockFunction(window.setTimeout) ||
            vitest.isMockFunction(window.clearTimeout)
        ) {
            throw new Error('Mock function has not been restored!')
        }
    })

    describe('keyManagerBuilder()', () => {
        
        test('KeyManagerBuilder.withAccessibilityNameAccessor() Should throw error if argument is not a function.', () => {
            const builder = keyManagerBuilder();
            const errorMessage = 'KeyManagerBuilder.withAccessibilityNameAccessor(): Invalid argument! It must be a function.'
            //Will throw
            expect(() => builder.withAccessibilityNameAccessor(0 as any)).toThrow(errorMessage);
            expect(() => builder.withAccessibilityNameAccessor(1 as any)).toThrow(errorMessage);
            expect(() => builder.withAccessibilityNameAccessor(true as any)).toThrow(errorMessage);
            expect(() => builder.withAccessibilityNameAccessor(false as any)).toThrow(errorMessage);
            expect(() => builder.withAccessibilityNameAccessor('' as any)).toThrow(errorMessage);
            expect(() => builder.withAccessibilityNameAccessor('A' as any)).toThrow(errorMessage);
            expect(() => builder.withAccessibilityNameAccessor(undefined as any)).toThrow(errorMessage);
            expect(() => builder.withAccessibilityNameAccessor(null as any)).toThrow(errorMessage);
            expect(() => builder.withAccessibilityNameAccessor({} as any)).toThrow(errorMessage);
            expect(() => builder.withAccessibilityNameAccessor([] as any)).toThrow(errorMessage);

            //Will not throw
            expect(() => builder.withAccessibilityNameAccessor(() => '')).not.toThrow();
        });

        test('KeyManagerBuilder.withAllowedModifierKeys() Should throw error if argument is not an object with a proper shape.', () => {
            const builder = keyManagerBuilder();
            const errorMessage =
                'KeyManagerBuilder.withAllowedModifierKeys(): Invalid argument! ' +
                'It must be an object of type { altKey?: boolean, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean }';

            //Will throw
            expect(() => builder.withAllowedModifierKeys(0 as any)).toThrow(errorMessage);
            expect(() => builder.withAllowedModifierKeys(1 as any)).toThrow(errorMessage);
            expect(() => builder.withAllowedModifierKeys(true as any)).toThrow(errorMessage);
            expect(() => builder.withAllowedModifierKeys(false as any)).toThrow(errorMessage);
            expect(() => builder.withAllowedModifierKeys('' as any)).toThrow(errorMessage);
            expect(() => builder.withAllowedModifierKeys('A' as any)).toThrow(errorMessage);
            expect(() => builder.withAllowedModifierKeys(undefined as any)).toThrow(errorMessage);
            expect(() => builder.withAllowedModifierKeys(null as any)).toThrow(errorMessage);
            expect(() => builder.withAllowedModifierKeys((() => {}) as any)).toThrow(errorMessage);
            expect(() => builder.withAllowedModifierKeys([] as any)).toThrow(errorMessage);

            //Will not throw
            expect(() => builder.withAllowedModifierKeys({})).not.toThrow();
            expect(() => builder.withAllowedModifierKeys({ altKey: true })).not.toThrow();
            expect(() => builder.withAllowedModifierKeys({ altKey: false })).not.toThrow();
            expect(() => builder.withAllowedModifierKeys({ ctrlKey: true })).not.toThrow();
            expect(() => builder.withAllowedModifierKeys({ ctrlKey: false })).not.toThrow();
            expect(() => builder.withAllowedModifierKeys({ metaKey: false })).not.toThrow();
            expect(() => builder.withAllowedModifierKeys({ metaKey: true })).not.toThrow();
            expect(() => builder.withAllowedModifierKeys({ shiftKey: true })).not.toThrow();
            expect(() => builder.withAllowedModifierKeys({ shiftKey: false })).not.toThrow();

        });

        test('KeyManagerBuilder.withHomeEnd() Should throw error if provided arg is not of type optional boolean (true, false, null, undefined).', () => {
            const builder = keyManagerBuilder();
            const errorMessage = 'KeyManagerBuilder.withHomeAndEnd(): Invalid argument! It must be a boolean or nothing.';
            
            //Will throw
            expect(() => builder.withHomeAndEnd(0 as any)).toThrow(errorMessage);
            expect(() => builder.withHomeAndEnd(1 as any)).toThrow(errorMessage);
            expect(() => builder.withHomeAndEnd({} as any)).toThrow(errorMessage);
            expect(() => builder.withHomeAndEnd([] as any)).toThrow(errorMessage);
            expect(() => builder.withHomeAndEnd((() => {}) as any)).toThrow(errorMessage);

            
            //Will not throw
            expect(() => builder.withHomeAndEnd()).not.toThrow();
            expect(() => builder.withHomeAndEnd(true)).not.toThrow();
            expect(() => builder.withHomeAndEnd(false)).not.toThrow();
            expect(() => builder.withHomeAndEnd(null as any)).not.toThrow();
            expect(() => builder.withHomeAndEnd(undefined as any)).not.toThrow();
        });

        test('KeyManagerBuilder.withHorizontalOrientation() Should throw error if the first arg is not valid direction string.', () => {
            const builder = keyManagerBuilder();
            const errorMessage = 'KeyManagerBuilder.withHorizontalOrientation(): Invalid first argument! It must be \'ltr\' or \'rtl\'.'

            //Will throw
            expect(() => builder.withHorizontalOrientation('' as any)).toThrow(errorMessage);
            expect(() => builder.withHorizontalOrientation('A' as any)).toThrow(errorMessage);
            expect(() => builder.withHorizontalOrientation(0 as any)).toThrow(errorMessage);
            expect(() => builder.withHorizontalOrientation(1 as any)).toThrow(errorMessage);
            expect(() => builder.withHorizontalOrientation(true as any)).toThrow(errorMessage);
            expect(() => builder.withHorizontalOrientation(false as any)).toThrow(errorMessage);
            expect(() => builder.withHorizontalOrientation(undefined as any)).toThrow(errorMessage);
            expect(() => builder.withHorizontalOrientation(null as any)).toThrow(errorMessage);
            expect(() => builder.withHorizontalOrientation({} as any)).toThrow(errorMessage);
            expect(() => builder.withHorizontalOrientation([] as any)).toThrow(errorMessage);
            expect(() => builder.withHorizontalOrientation((() => {}) as any)).toThrow(errorMessage);
            //@ts-expect-error
            expect(() => builder.withHorizontalOrientation()).toThrow(
                'KeyManagerBuilder.withHorizontalOrientation(): Provide orientation direction!'
            );

            //Will not throw
            expect(() => builder.withHorizontalOrientation('ltr')).not.toThrow();
            expect(() => builder.withHorizontalOrientation('rtl')).not.toThrow();
        });

        test('KeyManagerBuilder.withHorizontalOrientation() Should throw error if the second arg is not optional number.', () => {
            const builder = keyManagerBuilder();
            const errorMessage = 'KeyManagerBuilder.withHorizontalOrientation(): Invalid second argument! It must be a number or nothing.'

            //Will throw
            expect(() => builder.withHorizontalOrientation('ltr', '' as any)).toThrow(errorMessage);
            expect(() => builder.withHorizontalOrientation('ltr', 'A' as any)).toThrow(errorMessage);
            expect(() => builder.withHorizontalOrientation('ltr', {} as any)).toThrow(errorMessage);
            expect(() => builder.withHorizontalOrientation('ltr', (() => {}) as any)).toThrow(errorMessage);
            expect(() => builder.withHorizontalOrientation('ltr', [] as any)).toThrow(errorMessage);

            //Will not throw
            expect(() => builder.withHorizontalOrientation('ltr', 0)).not.toThrow();
            expect(() => builder.withHorizontalOrientation('ltr', 1)).not.toThrow();
            expect(() => builder.withHorizontalOrientation('ltr', null as any)).not.toThrow();
            expect(() => builder.withHorizontalOrientation('ltr', undefined as any)).not.toThrow();
        });

        test('ListKeyManagerBuilder.withKeyboardHandler() Should throw error if provided first arg is not a function.', () => {
            const builder = keyManagerBuilder();
            const errorMessage = 'KeyManagerBuilder.withKeyboardHandler(). Invalid argument! It must be a function.'

            //will throw
            //@ts-expect-error
            expect(() => builder.withKeyboardHandler()).toThrow(
                'KeyManagerBuilder.withKeyboardHandler(). Invalid method usage! Expected at least one argument'
            );
            expect(() => builder.withKeyboardHandler(0 as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(1 as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler('' as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler('A' as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(true as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(false as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(undefined as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(null as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler({} as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler([] as any)).toThrow(errorMessage);

            //Will not throw
            expect(() => builder.withKeyboardHandler((() => {}) as any)).not.toThrow();
        });

        test('ListKeyManagerBuilder.withKeyboardHandler() Should not throw error if provided first arg is number and second is function', () => {
            const builder = keyManagerBuilder();
            let errorMessage = 'KeyManagerBuilder.withKeyboardHandler(). Invalid first argument! It must be a number.'

            //Will throw
            expect(() => builder.withKeyboardHandler('' as any, undefined as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler('A' as any, undefined as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(true as any, undefined as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(false as any, undefined as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(undefined as any, undefined as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(null as any, undefined as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler({} as any, undefined as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler([] as any, undefined as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(0 as any, undefined as any)).not.toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(1 as any, undefined as any)).not.toThrow(errorMessage);

            errorMessage = 'KeyManagerBuilder.withKeyboardHandler(). Invalid second argument! It must be a function.'

            expect(() => builder.withKeyboardHandler(0, 0 as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(0, 1 as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(0, '' as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(0, 'A' as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(0, true as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(0, false as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(0, undefined as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(0, null as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(0, {} as any)).toThrow(errorMessage);
            expect(() => builder.withKeyboardHandler(0, [] as any)).toThrow(errorMessage);

            //Will not throw
            expect(() => builder.withKeyboardHandler(0, (() => {}) as any)).not.toThrow();
            expect(() => builder.withKeyboardHandler(1, (() => {}) as any)).not.toThrow();
        });

        test('KeyManagerBuilder.withPageUpDown() Should throw error if first arg is not optional boolean.', () => {
            const builder = keyManagerBuilder();
            const errorMessage = 'KeyManagerBuilder.withPageUpDown(): Invalid first argument! It must be a boolean or nothing.'

            expect(() => builder.withPageUpDown('' as any)).toThrow(errorMessage);
            expect(() => builder.withPageUpDown('A' as any)).toThrow(errorMessage);
            expect(() => builder.withPageUpDown(0 as any)).toThrow(errorMessage);
            expect(() => builder.withPageUpDown(1 as any)).toThrow(errorMessage);
            expect(() => builder.withPageUpDown({} as any)).toThrow(errorMessage);
            expect(() => builder.withPageUpDown([] as any)).toThrow(errorMessage);

            expect(() => builder.withPageUpDown()).not.toThrow();
            expect(() => builder.withPageUpDown(true)).not.toThrow();
            expect(() => builder.withPageUpDown(false)).not.toThrow();
            expect(() => builder.withPageUpDown(undefined)).not.toThrow();
            expect(() => builder.withPageUpDown(null as any)).not.toThrow();
        });

        test('KeyManagerBuilder.withPageUpDown() Should throw error if second arg is not optional number.', () => {
            const builder = keyManagerBuilder();
            const errorMessage = 'KeyManagerBuilder.withPageUpDown(): Invalid second argument! It must be a boolean or nothing.'

            expect(() => builder.withPageUpDown(true, '' as any)).toThrow(errorMessage);
            expect(() => builder.withPageUpDown(true, 'A' as any)).toThrow(errorMessage);
            expect(() => builder.withPageUpDown(true, true as any)).toThrow(errorMessage);
            expect(() => builder.withPageUpDown(true, false as any)).toThrow(errorMessage);
            expect(() => builder.withPageUpDown(true, {} as any)).toThrow(errorMessage);
            expect(() => builder.withPageUpDown(true, [] as any)).toThrow(errorMessage);

            expect(() => builder.withPageUpDown(true, 0));
            expect(() => builder.withPageUpDown(true, 1));
            expect(() => builder.withPageUpDown(true, undefined));
            expect(() => builder.withPageUpDown(true, null!));
        });

        test('KeyManagerBuilder.withSkipPredicate() Should throw error if provided arg is not a function.', () => {
            const builder = keyManagerBuilder();
            const errorMessage = 'KeyManagerBuilder.withSkipPredicate(): Invalid argument! It must be a function.';

            //Will Throw
            expect(() => builder.withSkipPredicate(0 as any)).toThrow(errorMessage);
            expect(() => builder.withSkipPredicate(1 as any)).toThrow(errorMessage);
            expect(() => builder.withSkipPredicate('' as any)).toThrow(errorMessage);
            expect(() => builder.withSkipPredicate('A' as any)).toThrow(errorMessage);
            expect(() => builder.withSkipPredicate(true as any)).toThrow(errorMessage);
            expect(() => builder.withSkipPredicate(false as any)).toThrow(errorMessage);
            expect(() => builder.withSkipPredicate(undefined as any)).toThrow(errorMessage);
            expect(() => builder.withSkipPredicate(null as any)).toThrow(errorMessage);
            expect(() => builder.withSkipPredicate({} as any)).toThrow(errorMessage);
            expect(() => builder.withSkipPredicate([] as any)).toThrow(errorMessage);

            //Wil not throw
            expect(() => builder.withSkipPredicate((() => {}) as any)).not.toThrow();
        });

        test('KeyManagerBuilder.withTypeAhead() Should should throw error if optional argument is not of shape typeahead config.', () => {
            const builder = keyManagerBuilder();

            const errorMessage = 
                'KeyManagerBuilder.withTypeAhead(): Invalid argument! It must be an object of type ' +
                '{\n' +
                '   debounceInterval: number,\n' +
                '   reducer: (buffer: string, key: string) => string,\n' + 
                '   caseSensitive: boolean,\n' +
                '   eachWordAsPrefix: boolean\n' +
                '}';

            //Will throw
            expect(() => builder.withTypeAhead(0 as any)).toThrow(errorMessage);
            expect(() => builder.withTypeAhead(1 as any)).toThrow(errorMessage);
            expect(() => builder.withTypeAhead('' as any)).toThrow(errorMessage);
            expect(() => builder.withTypeAhead('A' as any)).toThrow(errorMessage);
            expect(() => builder.withTypeAhead(true as any)).toThrow(errorMessage);
            expect(() => builder.withTypeAhead(false as any)).toThrow(errorMessage);
            expect(() => builder.withTypeAhead([] as any)).toThrow(errorMessage);
            expect(() => builder.withTypeAhead((() => {}) as any)).toThrow(errorMessage);

            //Will not throw
            expect(() => builder.withTypeAhead()).not.toThrow(errorMessage);
            expect(() => builder.withTypeAhead(undefined)).not.toThrow(errorMessage);
            expect(() => builder.withTypeAhead(null as any)).not.toThrow(errorMessage);
            expect(() => builder.withTypeAhead({})).not.toThrow(errorMessage);
            expect(() => builder.withTypeAhead({ caseSensitive: true })).not.toThrow(errorMessage);
            expect(() => builder.withTypeAhead({ caseSensitive: false })).not.toThrow(errorMessage);
            expect(() => builder.withTypeAhead({ debounceInterval: 0 })).not.toThrow(errorMessage);
            expect(() => builder.withTypeAhead({ debounceInterval: 1 })).not.toThrow(errorMessage);
            expect(() => builder.withTypeAhead({ eachWordAsPrefix: true })).not.toThrow(errorMessage);
            expect(() => builder.withTypeAhead({ eachWordAsPrefix: false })).not.toThrow(errorMessage);
            expect(() => builder.withTypeAhead({ reducer: (() => {}) as any })).not.toThrow(errorMessage);
        });

        test('KeyManagerBuilder.withVerticalOrientation() Should throw error if provided arg is not optional number.', () => {
            const builder = keyManagerBuilder();
            const errorMessage = 'KeyManagerBuilder.withVerticalOrientation(): Invalid argument! It must be a number or nothing.';

            //Will throw
            expect(() => builder.withVerticalOrientation('' as any)).toThrow(errorMessage);
            expect(() => builder.withVerticalOrientation('A' as any)).toThrow(errorMessage);
            expect(() => builder.withVerticalOrientation(true as any)).toThrow(errorMessage);
            expect(() => builder.withVerticalOrientation(false as any)).toThrow(errorMessage);
            expect(() => builder.withVerticalOrientation({} as any)).toThrow(errorMessage);
            expect(() => builder.withVerticalOrientation([] as any)).toThrow(errorMessage);
            expect(() => builder.withVerticalOrientation((() => {}) as any)).toThrow(errorMessage);

            //Will not throw
            expect(() => builder.withVerticalOrientation()).not.toThrow(errorMessage);
            expect(() => builder.withVerticalOrientation(0)).not.toThrow(errorMessage);
            expect(() => builder.withVerticalOrientation(1)).not.toThrow(errorMessage);
            expect(() => builder.withVerticalOrientation(null as any)).not.toThrow(errorMessage);
            expect(() => builder.withVerticalOrientation(undefined as any)).not.toThrow(errorMessage);
        });

        test('KeyManagerBuilder.withWrap() Should  throw error if provided arg is not optional boolean', () => {
            const builder = keyManagerBuilder();
            const errorMessage = 'KeyManagerBuilder.withWrap(): Invalid argument! It must be a boolean or nothing.';

            //Will throw
            expect(() => builder.withWrap(0 as any)).toThrow(errorMessage);
            expect(() => builder.withWrap(1 as any)).toThrow(errorMessage);
            expect(() => builder.withWrap('' as any)).toThrow(errorMessage);
            expect(() => builder.withWrap('A' as any)).toThrow(errorMessage);
            expect(() => builder.withWrap({} as any)).toThrow(errorMessage);
            expect(() => builder.withWrap([] as any)).toThrow(errorMessage);
            expect(() => builder.withWrap((() => {}) as any)).toThrow(errorMessage);

            //Will not throw
            expect(() => builder.withWrap()).not.toThrow();
            expect(() => builder.withWrap(true)).not.toThrow();
            expect(() => builder.withWrap(false)).not.toThrow();
            expect(() => builder.withWrap(undefined)).not.toThrow();
            expect(() => builder.withWrap(null as any)).not.toThrow();
        });

        test('KeyManagerBuilder.build() Should returns an instance of _KeyManagerImpl class.', () => {
            const builder = keyManagerBuilder();
            let dispose: any = null;
            createRoot((d) => {
                dispose = d;
                expect(builder.build() instanceof _KeyManagerImpl).toBe(true);
            });
            dispose();
        });

        it('Should any builder method throws error if the builder has already builded an instance.', () => {
            function getErrorMessage(method: Function): string {
                return 'ListKeyManager.' + method.name + '(): This builder has already been used. ' +
                'Create a new builder instance by calling keyManagerBuilder().'
            }
            const builder = keyManagerBuilder();
            let dispose: any = null;
            createRoot((d) => {
                dispose = d;
                builder.build();
            });

            expect(() => builder.withAccessibilityNameAccessor(() => '')).toThrow(getErrorMessage(builder.withAccessibilityNameAccessor));
            expect(() => builder.withAllowedModifierKeys({})).toThrow(getErrorMessage(builder.withAllowedModifierKeys));
            expect(() => builder.withHomeAndEnd()).toThrow(getErrorMessage(builder.withHomeAndEnd));
            expect(() => builder.withHorizontalOrientation('ltr')).toThrow(getErrorMessage(builder.withHorizontalOrientation));
            expect(() => builder.withKeyboardHandler(() => true)).toThrow(getErrorMessage(builder.withKeyboardHandler));
            expect(() => builder.withPageUpDown()).toThrow(getErrorMessage(builder.withPageUpDown));
            expect(() => builder.withSkipPredicate(() => true)).toThrow(getErrorMessage(builder.withSkipPredicate));
            expect(() => builder.withTypeAhead()).toThrow(getErrorMessage(builder.withTypeAhead));
            expect(() => builder.withVerticalOrientation()).toThrow(getErrorMessage(builder.withVerticalOrientation));
            expect(() => builder.withWrap()).toThrow(getErrorMessage(builder.withWrap));
            expect(() => builder.build()).toThrow(getErrorMessage(builder.build));

            dispose();
        });

    });

    describe('_KeyManagerImpl', () => {

        it('Should have a default configuration.', () => {
            const manager = createManager();

            expect(manager._allowedModifierKeys.length).toBe(0);
            expect(manager._getAccName).toBe(_defaultGetAccName);
            expect(manager._homeAndEndEnabled).toBe(false);
            expect(manager.jumpStep).toBe(0);
            expect(manager._keyboardHandler).toBe(verticalOrientationKeyboardHandler);
            expect(manager.pageUpAndDownDelta).toBe(0);
            expect(manager._shouldWrap).toBe(false);
            expect((manager._skipPredicate as any)[_UNWRAP_SKIP_PREDICATE].toString()).toBeOneOf(['item => item.disabled', '(item) => item.disabled']);
        });

        test('_KeyManagerImpl._allowedModifierKeys should be overridden.', () => {
            const eventWithCtrlKey = new KeyboardEvent('A', { ctrlKey: true });
            const eventWithShiftKey = new KeyboardEvent('A', { shiftKey: true });
            const eventWithMetaKey = new KeyboardEvent('A', { metaKey: true });
            const eventWithAltKey = new KeyboardEvent('A', { altKey: true });
            let manager = createManager();

            expect(manager._allowedModifierKeys.length).toBe(0);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: false }));
            expect(manager._allowedModifierKeys.length).toBe(0);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: true }));
            expect(manager._allowedModifierKeys.length).toBe(1);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ shiftKey: false }));
            expect(manager._allowedModifierKeys.length).toBe(0);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ shiftKey: true }));
            expect(manager._allowedModifierKeys.length).toBe(1);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ metaKey: false }));
            expect(manager._allowedModifierKeys.length).toBe(0);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ metaKey: true }));
            expect(manager._allowedModifierKeys.length).toBe(1);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ altKey: false }));
            expect(manager._allowedModifierKeys.length).toBe(0);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ altKey: true }));
            expect(manager._allowedModifierKeys.length).toBe(1);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(true);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: true, shiftKey: true }));
            expect(manager._allowedModifierKeys.length).toBe(2);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: true, shiftKey: false }));
            expect(manager._allowedModifierKeys.length).toBe(1);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: false, shiftKey: true }));
            expect(manager._allowedModifierKeys.length).toBe(1);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: true, shiftKey: true, metaKey: true }));
            expect(manager._allowedModifierKeys.length).toBe(3);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: false, shiftKey: true, metaKey: true }));
            expect(manager._allowedModifierKeys.length).toBe(2);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: true, shiftKey: false, metaKey: true }));
            expect(manager._allowedModifierKeys.length).toBe(2);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: true, shiftKey: true, metaKey: false }));
            expect(manager._allowedModifierKeys.length).toBe(2);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: true, shiftKey: true, metaKey: true, altKey: true }));
            expect(manager._allowedModifierKeys.length).toBe(4);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(true);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: true, shiftKey: false, metaKey: false, altKey: false }));
            expect(manager._allowedModifierKeys.length).toBe(1);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: false, shiftKey: true, metaKey: false, altKey: false }));
            expect(manager._allowedModifierKeys.length).toBe(1);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: false, shiftKey: false, metaKey: true, altKey: false }));
            expect(manager._allowedModifierKeys.length).toBe(1);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(true);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: false, shiftKey: false, metaKey: false, altKey: true }));
            expect(manager._allowedModifierKeys.length).toBe(1);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(true);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: false, shiftKey: false, metaKey: false, altKey: true }));
            expect(manager._allowedModifierKeys.length).toBe(1);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(true);

            manager = createManager((config) => {
                config.withAllowedModifierKeys({ ctrlKey: true, shiftKey: true, metaKey: true, altKey: true });
                config.withAllowedModifierKeys({});
            });
            expect(manager._allowedModifierKeys.length).toBe(0);
            expect(manager._isAllowedModifier(eventWithCtrlKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithShiftKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithMetaKey)).toBe(false);
            expect(manager._isAllowedModifier(eventWithAltKey)).toBe(false);
        });

        test('_KeyManagerImpl._getAccName should be overridden.', () => {
            const getA = () => 'A';
            const getB = () => 'B';
            
            let manager = createManager((config) => config.withAccessibilityNameAccessor(getA))
            expect(manager._getAccName).toBe(getA);
            expect(manager._getAccName!({} as any)).toBe('A');

            manager = createManager((config) => config.withAccessibilityNameAccessor(getB))
            expect(manager._getAccName).toBe(getB);
            expect(manager._getAccName!({} as any)).toBe('B');

            manager = createManager((config) => {
                config
                    .withAccessibilityNameAccessor(getB)
                    .withAccessibilityNameAccessor(getA);
            });
            expect(manager._getAccName).toBe(getA);
            expect(manager._getAccName!({} as any)).toBe('A');
        });

        test('_KeyManagerImpl._homeAndEndEnabled should be overridden.', () => {
            let manager = createManager((config) => config.withHomeAndEnd())
            expect(manager._homeAndEndEnabled).toBe(true);

            manager = createManager((config) => config.withHomeAndEnd(false))

            manager = createManager((config) => config.withHomeAndEnd(true))
            expect(manager._homeAndEndEnabled).toBe(true);

            manager = createManager((config) => config.withHomeAndEnd(true).withHomeAndEnd(false))
            expect(manager._homeAndEndEnabled).toBe(false);
        });

        test('_KeyManagerImpl._keyboardHandler should be overridden.', () => {
            const customKeyboardHandler = () => true;

            let manager = createManager((config) => config.withHorizontalOrientation('ltr'));
            expect(manager._keyboardHandler).toBe(horizontalLtrOrientationKeyboardHandler);
            expect(manager.jumpStep).toBe(0);

            manager = createManager((config) => config.withHorizontalOrientation('rtl'));
            expect(manager._keyboardHandler).toBe(horizontalRtlOrientationKeyboardHandler);
            expect(manager.jumpStep).toBe(0);

            manager = createManager((config) => config.withKeyboardHandler(customKeyboardHandler));
            expect(manager._keyboardHandler).toBe(customKeyboardHandler);
            expect(manager.jumpStep).toBe(0);

            manager = createManager((config) => config.withKeyboardHandler(customKeyboardHandler).withVerticalOrientation())
            expect(manager._keyboardHandler).toBe(verticalOrientationKeyboardHandler);
            expect(manager.jumpStep).toBe(0);
        });

        test('_KeyManagerImpl.jumpStep should be overridden and truncated to integer.', () => {
            const customKeyboardHandler = () => true;
            let manager: _KeyManagerImpl;

            manager = createManager((config) => config.withHorizontalOrientation('ltr', 0.5));
            expect(manager.jumpStep).toBe(0);

            manager = createManager((config) => config.withHorizontalOrientation('ltr', -1.6));
            expect(manager.jumpStep).toBe(-1);

            manager = createManager((config) => config.withHorizontalOrientation('ltr', 2.999999));
            expect(manager.jumpStep).toBe(2);

            manager = createManager((config) => config.withHorizontalOrientation('rtl', 0.5));
            expect(manager.jumpStep).toBe(0);

            manager = createManager((config) => config.withHorizontalOrientation('rtl', -1.6));
            expect(manager.jumpStep).toBe(-1);

            manager = createManager((config) => config.withHorizontalOrientation('rtl', 2.999999));
            expect(manager.jumpStep).toBe(2);

            manager = createManager((config) => config.withKeyboardHandler(0.5, customKeyboardHandler));
            expect(manager.jumpStep).toBe(0);

            manager = createManager((config) => config.withKeyboardHandler(-1.5, customKeyboardHandler));
            expect(manager.jumpStep).toBe(-1);

            manager = createManager((config) => config.withKeyboardHandler(2.999999, customKeyboardHandler));
            expect(manager.jumpStep).toBe(2);

            manager = createManager((config) => {
                config
                    .withKeyboardHandler(customKeyboardHandler)
                    .withVerticalOrientation(0.5)
            });
            expect(manager.jumpStep).toBe(0);

            manager = createManager((config) => {
                config
                    .withKeyboardHandler(customKeyboardHandler)
                    .withVerticalOrientation(-1.6)
            });
            expect(manager.jumpStep).toBe(-1);

            manager = createManager((config) => {
                config
                    .withKeyboardHandler(customKeyboardHandler)
                    .withVerticalOrientation(2.9999999)
            });
            expect(manager.jumpStep).toBe(2);

            manager = createManager()
            expect(manager.jumpStep).toBe(0)
            manager.jumpStep = 0.5;
            expect(manager.jumpStep).toBe(0);
            manager.jumpStep = -1.5;
            expect(manager.jumpStep).toBe(-1);
            manager.jumpStep = 2.99999;
            expect(manager.jumpStep).toBe(2);
            manager.jumpStep = -1.6;
            expect(manager.jumpStep).toBe(-1);
        });

        it('Should throw error if value of not a number type is assigned to jumpStep property.', () => {
            const errorMessage = 'KeyManager.jumpStep: Failed to assign jumpStep. Expected a number.';
            const manager = createManager();

            expect(() => manager.jumpStep = '' as any).toThrow(errorMessage);
            expect(() => manager.jumpStep = 'A' as any).toThrow(errorMessage);
            expect(() => manager.jumpStep = true as any).toThrow(errorMessage);
            expect(() => manager.jumpStep = false as any).toThrow(errorMessage);
            expect(() => manager.jumpStep = undefined as any).toThrow(errorMessage);
            expect(() => manager.jumpStep = null as any).toThrow(errorMessage);
            expect(() => manager.jumpStep = {} as any).toThrow(errorMessage);
            expect(() => manager.jumpStep = [] as any).toThrow(errorMessage);
            expect(() => manager.jumpStep = (() => {}) as any).toThrow(errorMessage);
        });

        test('_KeyManagerImpl.pageUpAndDownDelta should be overridden and rounded down to integer not lesser then 1.', () => {
            let manager: _KeyManagerImpl;

            manager = createManager((config) => config.withPageUpDown());
            expect(manager.pageUpAndDownDelta).toBe(10);

            manager = createManager((config) => config.withPageUpDown(true));
            expect(manager.pageUpAndDownDelta).toBe(10);

            manager = createManager((config) => config.withPageUpDown(false));
            expect(manager.pageUpAndDownDelta).toBe(0);

            manager = createManager((config) => config.withPageUpDown(true, 1.9999999));
            expect(manager.pageUpAndDownDelta).toBe(1);
            manager.pageUpAndDownDelta = 2.99999;
            expect(manager.pageUpAndDownDelta).toBe(2);
            manager.pageUpAndDownDelta = 3.99999;
            expect(manager.pageUpAndDownDelta).toBe(3);
        });

        test('_KeyManagerImpl.pageUpAndDownDelta should be coerced to 0 if pageUpDown is disabled.', () => {
            let manager = createManager();
            manager.pageUpAndDownDelta = 1;
            expect(manager.pageUpAndDownDelta).toBe(0);
            manager.pageUpAndDownDelta = 2;
            expect(manager.pageUpAndDownDelta).toBe(0);
            manager.pageUpAndDownDelta = 3;
            expect(manager.pageUpAndDownDelta).toBe(0);

            manager = createManager((config) => config.withPageUpDown(false, 5));
            expect(manager.pageUpAndDownDelta).toBe(0);
            manager.pageUpAndDownDelta = 1;
            expect(manager.pageUpAndDownDelta).toBe(0);
            manager.pageUpAndDownDelta = 2;
            expect(manager.pageUpAndDownDelta).toBe(0);
            manager.pageUpAndDownDelta = 3;
            expect(manager.pageUpAndDownDelta).toBe(0);
        });

        it('Should throw error if value of not a number type is assigned to pageUpAndDown property.', () => {
            const errorMessage = 'KeyManager.pageUpAndDownDelta: Failed to assign jumpStep. Expected a number.';

            let manager = createManager();
            expect(() => manager.pageUpAndDownDelta = '' as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = 'A' as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = true as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = false as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = undefined as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = null as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = {} as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = [] as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = (() => {}) as any).toThrow(errorMessage);

            manager = createManager((config) => config.withPageUpDown());
            expect(() => manager.pageUpAndDownDelta = '' as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = 'A' as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = true as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = false as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = undefined as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = null as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = {} as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = [] as any).toThrow(errorMessage);
            expect(() => manager.pageUpAndDownDelta = (() => {}) as any).toThrow(errorMessage);
        });

        test('_KeyManagerImpl._shouldWrap should be overridden.', () => {
            let manager = createManager((config) => config.withWrap());
            expect(manager._shouldWrap).toBe(true);

            manager = createManager((config) => config.withWrap(false));
            expect(manager._shouldWrap).toBe(false);

            manager = createManager((config) => config.withWrap(true));
            expect(manager._shouldWrap).toBe(true);

            manager = createManager((config) => config.withWrap(false).withWrap());
            expect(manager._shouldWrap).toBe(true);
        });

        test('_KeyMangerImpl._skipPredicate should be overridden.', () => {
            const customSkipPredicate = () => true;
            const manager = createManager((config) => config.withSkipPredicate(customSkipPredicate));

            expect((manager._skipPredicate as any)[_UNWRAP_SKIP_PREDICATE]).toBe(customSkipPredicate);
        });

        test('_KeyManagerImpl._skipPredicate should throw error if return type is not boolean.', () => {
            const item = new TestItem(0);
            const errorMessage = 'KeyManagerBuilder.withSkipPredicate(): Invalid predicate return value! The predicate must return a boolean.';
            let manager: _KeyManagerImpl;

            manager = createManager((config) => config.withSkipPredicate(() => 0 as any));
            expect(() => manager._skipPredicate(item)).toThrow(errorMessage);

            manager = createManager((config) => config.withSkipPredicate(() => 1 as any));
            expect(() => manager._skipPredicate(item)).toThrow(errorMessage);

            manager = createManager((config) => config.withSkipPredicate(() => '' as any));
            expect(() => manager._skipPredicate(item)).toThrow(errorMessage);

            manager = createManager((config) => config.withSkipPredicate(() => 'A' as any));
            expect(() => manager._skipPredicate(item)).toThrow(errorMessage);

            manager = createManager((config) => config.withSkipPredicate(() => undefined as any));
            expect(() => manager._skipPredicate(item)).toThrow(errorMessage);

            manager = createManager((config) => config.withSkipPredicate(() => null as any));
            expect(() => manager._skipPredicate(item)).toThrow(errorMessage);

            manager = createManager((config) => config.withSkipPredicate(() => ({}) as any));
            expect(() => manager._skipPredicate(item)).toThrow(errorMessage);

            manager = createManager((config) => config.withSkipPredicate(() => [] as any));
            expect(() => manager._skipPredicate(item)).toThrow(errorMessage);

            manager = createManager((config) => config.withSkipPredicate(() => false));
            expect(() => manager._skipPredicate(item)).not.toThrow();

            manager = createManager((config) => config.withSkipPredicate(() => true));
            item.disabled = true;
            expect(() => manager._skipPredicate(item)).not.toThrow();
        });

        test('_KeyManagerImpl._containerEl  should not be null if manager is bound.', () => {
            let manager = createManager()
            expect(manager._containerEl).toBeNull();
            const container1 = document.createElement('div');
            manager.bind(container1);
            expect(manager._containerEl).toBe(container1)

            manager = createManager()
            expect(manager._containerEl).toBeNull();
            const container2 = document.createElement('div');
            manager.bind(container2);
            expect(manager._containerEl).toBe(container2)
        });

        it('Should throw an error when trying to bind to an already bound element.', () => {
            const errorMessage = 'KeyManager.bind(): Provided element is already bound to some key manager!'
            const container = document.createElement('div');

            let manager1 = createManager();
            let manager2 = createManager();
            manager1.bind(container);
            expect(() => manager2.bind(container)).toThrow(errorMessage);
            dispose();

            manager1 = createManager();
            manager2 = createManager();
            manager1.bind(container);
            expect(() => manager2.bind(container)).toThrow(errorMessage);
        });

        test('_KeyManagerImpl.bind() should throw error if manager is already bound to element.', () => {
            const errorMessage = 'KeyManager.bind(): Manager is already bound!';
            const manager = createManager();

            manager.bind(document.createElement('div'));
            expect(() => manager.bind(document.createElement('div'))).toThrow(errorMessage);
        });

        test('_KeyManagerImpl.bind() should throw error in server environment.', () => {
            const manager = createManager();
            const errorMessage = 'KeyManager.bind(): This method cannot be used in a server environment!'
            using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockImplementation(() => true);
            expect(() => manager.bind(document.createElement('div'))).toThrow(errorMessage);
        });

        test('_KeyManagerImpl.Provide() should throw error in server environment.', () => {
            const manager = createManager();
            const errorMessage = '<KeyManager.Provider>: This method cannot be used in a server environment!'
            using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockImplementation(() => true);
            expect(() => manager.Provider({ children: undefined })).toThrow(errorMessage);
        });

        test('_KeyManagerImpl.addItem()  should throw error if manager is not bound.', () => {
            const errorMessage = 'KeyManager.addItem(): This method can not be used if manager is not bound to container element.';
            const manager = createManager();
            expect(() => manager.addItem(new TestItem(0))).toThrow(errorMessage);
        });

        test('_KeyMangerImpl.addItem() should throw error if item already belongs to some manager.', () => {
            const errorMessage = 'KeyManager.addItem(): The item already belongs to some key manager!'
            const manager1 = createManager();
            const manager2 = createManager();
            const [dispose1, dispose2] = disposeBag;

            manager1.bind(document.createElement('div'));
            manager2.bind(document.createElement('div'));

            const item = new TestItem(0);
            manager1.addItem(item);
            expect(() => manager2.addItem(item)).toThrow(errorMessage);
            
            manager1.removeItem(item);
            expect(() => manager2.addItem(item)).not.toThrow();
            expect(() => manager1.addItem(item)).toThrow(errorMessage);

            dispose2();
            expect(() => manager1.addItem(item)).not.toThrow();
            dispose1();
        })

        it('Should added items be immediately sorted.', () => {
            let manager = createManager();

            let item: TestItem
            manager.bind(document.createElement('div'));

            let items = [0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 14].map((index) => new TestItem(index));
            for (const item of items) {
                manager.addItem(item);
            }
            items = manager._items as TestItem[];

            expect(items.length).toBe(11);
            for (let i = 1; i < items.length; i++) {
                expect(items[i - 1].sortIndex).toBeLessThan(items[i].sortIndex);
            }

            item = new TestItem(4)
            manager.addItem(item);
            expect(items.length).toBe(12);
            expect(items[4]).toBe(item);
            items = manager._items as TestItem[];
            for (let i = 1; i < items.length; i++) {
                expect(items[i - 1].sortIndex).toBeLessThan(items[i].sortIndex);
            }
            
            item = new TestItem(9)
            manager.addItem(item);
            expect(items[9]).toBe(item);
            expect(items.length).toBe(13);
            items = manager._items as TestItem[];
            for (let i = 1; i < items.length; i++) {
                expect(items[i - 1].sortIndex).toBeLessThan(items[i].sortIndex);
            }

            item = new TestItem(13)
            manager.addItem(item);
            expect(items[12]).toBe(item);
            expect(items.length).toBe(14);
            items = manager._items as TestItem[];
            for (let i = 1; i < items.length; i++) {
                expect(items[i - 1].sortIndex).toBeLessThan(items[i].sortIndex);
            }

            item = new TestItem(12)
            manager.addItem(item);
            expect(items[12]).toBe(item);
            expect(items.length).toBe(15);
            items = manager._items as TestItem[];
            for (let i = 1; i < items.length; i++) {
                expect(items[i - 1].sortIndex).toBeLessThan(items[i].sortIndex);
            }

            item = new TestItem(17)
            manager.addItem(item);
            expect(items[15]).toBe(item);
            expect(items.length).toBe(16);
            items = manager._items as TestItem[];
            for (let i = 1; i < items.length; i++) {
                expect(items[i - 1].sortIndex).toBeLessThan(items[i].sortIndex);
            }

            item = new TestItem(15)
            manager.addItem(item);
            expect(items[15]).toBe(item);
            expect(items.length).toBe(17);
            items = manager._items as TestItem[];
            for (let i = 1; i < items.length; i++) {
                expect(items[i - 1].sortIndex).toBeLessThan(items[i].sortIndex);
            }

            item = new TestItem(16)
            manager.addItem(item);
            expect(items[16]).toBe(item);
            expect(items.length).toBe(18);
            items = manager._items as TestItem[];
            for (let i = 1; i < items.length; i++) {
                expect(items[i - 1].sortIndex).toBeLessThan(items[i].sortIndex);
            }

            item = new TestItem(5)
            manager.addItem(item);
            expect(items[6]).toBe(item);
            expect(items.length).toBe(19);
            items = manager._items as TestItem[];
            for (let i = 1; i < items.length; i++) {
                expect(items[i - 1].sortIndex).toBeLessThanOrEqual(items[i].sortIndex);
            }

            manager = createManager();
            manager.bind(document.createElement('div'));

            items = [0, 1, 1, 1, 2, 2, 4, 6, 8, 9, 9, 10].map((index) => new TestItem(index));
            for (const item of items) {
                manager.addItem(item);
            }
            items = manager._items as TestItem[];

            item = new TestItem(2);
            manager.addItem(item);
            expect(items[6]).toBe(item);

            item = new TestItem(1);
            manager.addItem(item);
            expect(items[4]).toBe(item);

            item = new TestItem(7);
            manager.addItem(item);
            expect(items[10]).toBe(item);

            item = new TestItem(5);
            manager.addItem(item);
            expect(items[9]).toBe(item);

            item = new TestItem(9);
            manager.addItem(item);
            expect(items[15]).toBe(item);
        });

        it('Should remove item without any problem.', () => {
            const manager = createManager();

            manager.bind(document.createElement('div'));
            const items = [0, 1, 2, 3, 4, 5, 6].map((index) => new TestItem(index));

            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager._items).toEqual(items);
            manager.removeItem(items[2]);
            expect(manager._items.includes(items[2])).toBe(false);
            //Removing again does nothing
            manager.removeItem(items[2]);
            expect(manager._items.includes(items[2])).toBe(false);
        });

        test('_KeyManagerItem.addItem() should invoke the item\'s onAttached() method after it has been successfully added.', () => {
            const manager = createManager();
            const items = Array.from({ length: 7 }, (_, i) => new TestItem(i));

            manager.bind(document.createElement('div'));
            items.forEach((item) => {
                const spy = vitest.spyOn(item, 'onAttached');
                disposeBag.push(() => spy.mockRestore());
            });

            for (const item of items) {
                expect(item.attached).toBe(false);
                expect(item.onAttached).toHaveBeenCalledTimes(0);
            }

            [1, 0, 5, 6, 3, 4, 2].forEach((index) => {
                manager.addItem(items[index]);
            });

            for (const item of items) {
                expect(item.attached).toBe(true);
                expect(item.onAttached).toHaveBeenCalledTimes(1);
            }
        });

        test('_KeyManagerItem.addItem() should not invoke the item\'s onAttached() method if it is already attached to a key manager.', () => {
            const manager = createManager();
            const items = Array.from({ length: 7 }, (_, i) => new TestItem(i));

            manager.bind(document.createElement('div'));
            items.forEach((item) => {
                const spy = vitest.spyOn(item, 'onAttached');
                disposeBag.push(() => spy.mockRestore());
            });

            [1, 0, 5, 6, 3, 4, 2].forEach((index) => {
                manager.addItem(items[index]);
            });

            for (const item of items) {
                expect(item.attached).toBe(true);
                expect(item.onAttached).toHaveBeenCalledTimes(1);
            }

            [1, 0, 5, 6, 3, 4, 2].forEach((index) => {
                manager.addItem(items[index]);
            });

            for (const item of items) {
                expect(item.attached).toBe(true);
                expect(item.onAttached).toHaveBeenCalledTimes(1);
            }
        });

        test('_KeyManagerImpl.removeItem() should invoke the items\'s onDetached() method after it has been successfully removed.', () => {
            const item = new TestItem(0);
            const manager = createManager();
            using spy = vitest.spyOn(item, 'onDetached');

            manager.bind(document.createElement('div'));
            manager.addItem(item);

            expect(item.attached).toBe(true);
            expect(spy).toHaveBeenCalledTimes(0);
            manager.removeItem(item);
            expect(item.attached).toBe(false);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        test('_KeyManagerImpl.removeItem() should not invoke the items\'s onDetached() method if it is already detached from a key manager.', () => {
            const item = new TestItem(0);
            const manager = createManager();
            using spy = vitest.spyOn(item, 'onDetached');

            manager.bind(document.createElement('div'));
            manager.addItem(item);
            manager.removeItem(item);

            expect(item.attached).toBe(false);
            expect(spy).toHaveBeenCalledTimes(1);
            manager.removeItem(item);
            expect(item.attached).toBe(false);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        test('_KeyManagerImpl.removeItem() should work correctly with a set of equal items.', () => {
            const manager = createManager();
            const items = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2].map((value) => new TestItem(value));
            let removal: TestItem;

            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager._items).toEqual(items);

            removal = items.splice(1, 1)[0];
            manager.removeItem(removal);
            expect(manager._items).toEqual(items);

            removal = items.splice(items.length - 2, 1)[0];
            manager.removeItem(removal);
            expect(manager._items).toEqual(items);

            removal = items.splice(1, 1)[0];
            manager.removeItem(removal);
            expect(manager._items).toEqual(items);

            removal = items.splice(items.length - 2, 1)[0]
            manager.removeItem(removal);
            expect(manager._items).toEqual(items);

            removal = items.splice(1, 1)[0];
            manager.removeItem(removal);
            expect(manager._items).toEqual(items);

            removal = items.splice(items.length - 2, 1)[0];
            manager.removeItem(removal);
            expect(manager._items).toEqual(items);
        });

        test('_KeyManagerImpl.itemsCount should reflect he length of the items list.', () => {
            const manager = createManager();
            const items = Array.from({ length: 8 }, (_, i) => new TestItem(i));

            manager.bind(document.createElement('div'));

            manager.addItem(items[2]);
            expect(manager.itemsCount).toBe(manager._items.length);
            manager.addItem(items[1]);
            expect(manager.itemsCount).toBe(manager._items.length);
            manager.addItem(items[0]);
            expect(manager.itemsCount).toBe(manager._items.length);
            manager.addItem(items[6]);
            expect(manager.itemsCount).toBe(manager._items.length);
            manager.addItem(items[7]);
            expect(manager.itemsCount).toBe(manager._items.length);
            manager.addItem(items[4]);
            expect(manager.itemsCount).toBe(manager._items.length);
            manager.addItem(items[5]);
            expect(manager.itemsCount).toBe(manager._items.length);
            manager.addItem(items[3]);
            expect(manager.itemsCount).toBe(manager._items.length);

            expect(manager.itemsCount).toBe(8);

            manager.removeItem(items[4]);
            expect(manager.itemsCount).toBe(manager._items.length);
            manager.removeItem(items[0]);
            expect(manager.itemsCount).toBe(manager._items.length);
            manager.removeItem(items[7]);
            expect(manager.itemsCount).toBe(manager._items.length);

            expect(manager.itemsCount).toBe(5);
        })

        test('_KeyManagerImpl.activeItem should be reactive.', () => {
            const log: string[] = [];
            let manager = createManager();
            manager.bind(document.createElement('div'));

            [ 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J' ].forEach((char, index) => {
                manager.addItem(new TestItem(index, char));
            });

            subscribeEffect(() => {
                if (manager.activeItem) {
                    log.push(manager.activeItem.label)
                }
            })

            manager.setActive(0);
            manager.setActive(1);
            manager.setActive(2);
            manager.setActive(5);
            manager.setActive(7);
            manager.setActive(9);

            expect(log).toEqual([ 'A', 'B', 'C', 'F', 'H', 'J' ]);
        });

        test('_KeyManagerImpl.activeItemIndex should be reactive.', () => {
            const log: number[] = [];
            const manager = createManager();

            manager.bind(document.createElement('div'));

            Array.from({ length: 10 }, (_, i) => manager.addItem(new TestItem(i)));

            subscribeEffect(() => {
                if (manager.activeItemIndex > -1) {
                    log.push(manager.activeItemIndex);
                }
            });

            manager.setActive(0);
            manager.setActive(1);
            manager.setActive(2);
            manager.setActive(5);
            manager.setActive(7);
            manager.setActive(9);

            expect(log).toEqual([ 0, 1, 2, 5, 7, 9 ]);
        });

        test('_KeyManagerImpl.itemsCount should be reactive.', () => {
            const log: number[] = [];
            const manager = createManager();

            manager.bind(document.createElement('div'));
            
            runWithOwner(owner, () => {
                createEffect(() => {
                    log.push(manager.itemsCount);
                });
            })

            manager.addItem(new TestItem(0))
            manager.addItem(new TestItem(1))
            manager.addItem(new TestItem(2))
            manager.addItem(new TestItem(3))
            manager.addItem(new TestItem(5));

            expect(log).toEqual([ 0, 1, 2, 3, 4, 5 ]);
        });

        it('Should update activeItem, activeItemIndex and run onActive and onInactive in the same batch.', () => {
            const log: string[] = [];
            const manager = createManager();
            
            manager.bind(document.createElement('div'));

            const [onActive, setOnActive] = createSignal<string | undefined>(undefined)
            const [onInactive, setOnInactive] = createSignal<string | undefined>(undefined)

            manager.addItem(new TestItem(0, '', null, () => setOnInactive('A')));
            manager.addItem(new TestItem(1, 'B', () => setOnActive('C')));

            manager._setActiveItemByIndex(0);

            subscribeEffect(() => {
                const inactive = onInactive();
                    const index = manager.activeItemIndex;
                    const label = manager.activeItem!.label;
                    const active = onActive();
                    if (inactive) { log.push(inactive); }
                    if (index) { log.push(String(index)); }
                    if (label) { log.push(label); }
                    if (active) { log.push(active); }
            })

            expect(log).toEqual([]);
            manager._setActiveItemByIndex(1)
            expect(log).toEqual([ 'A', '1', 'B', 'C' ]);
        });

        test('_KeyManagerImpl.onTabOut() should throw error if argument is not a function.', () => {
            const errorMessage = 'KeyManager.onTabOut(): Provided argument is not a function!';
            let manager = createManager()
            manager.bind(document.createElement('div'));

            //Will throw
            expect(() => manager.onTabOut(0 as any)).toThrow(errorMessage);
            expect(() => manager.onTabOut(1 as any)).toThrow(errorMessage);
            expect(() => manager.onTabOut(true as any)).toThrow(errorMessage);
            expect(() => manager.onTabOut(false as any)).toThrow(errorMessage);
            expect(() => manager.onTabOut('' as any)).toThrow(errorMessage);
            expect(() => manager.onTabOut('A' as any)).toThrow(errorMessage);
            expect(() => manager.onTabOut(undefined as any)).toThrow(errorMessage);
            expect(() => manager.onTabOut(null as any)).toThrow(errorMessage);
            expect(() => manager.onTabOut({} as any)).toThrow(errorMessage);
            expect(() => manager.onTabOut([] as any)).toThrow(errorMessage);

            //Will not throw
            expect(() => manager.onTabOut(() => {})).not.toThrow();
        })

        it('Should invoke onTabOut listeners if container emits tab keyboard event.', () => {
            const log: string[] = [];
            const manager = createManager();
            const div = document.createElement('div');
            
            document.body.appendChild(div);
            manager.bind(div);

            manager.onTabOut(() => log.push('A'));
            manager.onTabOut(() => log.push('B'));
            manager.onTabOut(() => log.push('C'));
            
            div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

            expect(log).toEqual([ 'A', 'B', 'C' ]);
        })

        it('Should not invoke removed onTabOut listener if container emits tab keyboard event.', () => {
            const log: string[] = [];
            const div = document.createElement('div');
            const manager = createManager();

            document.body.appendChild(div);
            manager.bind(div);

            manager.onTabOut(() => log.push('A'));
            const unregister = manager.onTabOut(() => log.push('B'));
            manager.onTabOut(() => log.push('C'));
            
            unregister();

            div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

            expect(log).toEqual([ 'A', 'C' ]);
        });

        it('Should not invoke tabOut listeners if the default event action is prevented.', () => {
            const log: number[] = [];
            const div = document.createElement('div');
            const manager = createManager();
            let prevent = false;
            let i = 0;

            document.body.appendChild(div);
            manager.bind(div)
            manager.onTabOut(() => log.push(i));
            div.addEventListener('keydown', (e) => prevent && e.preventDefault());

            div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
            i++;
            prevent = true;
            div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
            i++
            prevent = false;
            div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
            i++
            prevent = true;
            div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
            i++
            prevent = false;
            div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
            i++
            prevent = true;
            div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
            i++
            prevent = false;
            div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));

            expect(log).toEqual([ 0, 2, 4, 6 ]);
        });

        test('tabOut listener should  receive manager instance and event object.', () => {
            const log: any[] = [];
            const div = document.createElement('div');
            const manager = createManager();
            const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
            
            document.body.appendChild(div);
            manager.bind(div);


            manager.onTabOut((m, e) => {
                log.push(m, e);
            });

            expect(log).toEqual([])
            div.dispatchEvent(event);
            expect(log).toEqual([ manager, event ]);
        });

        test('_KeyManagerImpl.onActiveItemDisabled() should throw error if argument is not a function.', () => {
            const errorMessage = 'KeyManager.onActiveItemDisabled(): Provided argument is not a function!'
            const manager = createManager()
            manager.bind(document.createElement('div'));

            //Will throw
            expect(() => manager.onActiveItemDisabled(0 as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemDisabled(1 as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemDisabled(true as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemDisabled(false as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemDisabled('' as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemDisabled('A' as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemDisabled(undefined as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemDisabled(null as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemDisabled({} as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemDisabled([] as any)).toThrow(errorMessage);
            
            //Will not throw
            expect(() => manager.onActiveItemDisabled(() => {})).not.toThrow();
        });

        it('Should set activeItem to null, activeItemIndex to -1 and invoke onActiveItemDisabled listeners when the active item becomes disabled.', () => {
            const log: string[] = [];
            const manager = createManager();
            const item = new TestItem(0);
            
            manager.bind(document.createElement('div'));
            manager.addItem(item);
            manager.setActive(item);

            manager.onActiveItemDisabled(() => log.push('A'));
            manager.onActiveItemDisabled(() => log.push('B'));
            manager.onActiveItemDisabled(() => log.push('C'));

            expect(manager.activeItemIndex).toBe(0);
            expect(manager.activeItem).toBe(item);
            expect(log).toEqual([]);
            item.disabled = true;
            expect(manager.activeItemIndex).toBe(-1);
            expect(manager.activeItem).toBe(null);
            expect(log).toEqual([ 'A', 'B', 'C' ]);
        });

        it('Should not invoke removed onActiveItemDisabled listener when the active item becomes disabled.', () => {
            const log: string[] = [];
            const item = new TestItem(0);
            const manager = createManager()
            
            manager.bind(document.createElement('div'));
            manager.addItem(item);
            manager.setActive(item);

            manager.onActiveItemDisabled(() => log.push('A'));
            const unregister = manager.onActiveItemDisabled(() => log.push('B'));
            manager.onActiveItemDisabled(() => log.push('C'));

            unregister();
            item.disabled = true;
            expect(log).toEqual([ 'A', 'C' ]);
        });

        it('Should update activeItem, activeItemIndex and invoke onInactive() with onActiveItemDisabled listeners in the same batch.', () => {
            const log: any[] = [];
            const manager = createManager();
            const item = new TestItem(0, '', null, () => setOnInactive('A'));
            const [onInactive, setOnInactive] = createSignal<string>();
            const [onDisabled, setOnDisabled] = createSignal<string>();
            
            manager.bind(document.createElement('div'));
            manager.addItem(item);
            manager.setActive(item);
            manager.onActiveItemDisabled(() => setOnDisabled('B'));

            let init = false;
            subscribeEffect(() => {
                const inactive = onInactive();
                const index = manager.activeItemIndex;
                const item = manager.activeItem;
                const disabled = onDisabled();
                if (init) {
                    log.push(inactive, index, item, disabled);
                } else {
                    init = true;
                }
            })

            expect(log).toEqual([]);
            item.disabled = true;
            expect(log).toEqual([ 'A', -1, null, 'B' ]);
        });

        test('onActiveItemDisabled listener should receive manager instance, a disabled item and index of that item.', () => {
            const log: any[] = [];
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));

            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }
            manager.setActive(4);
            manager.onActiveItemDisabled((m, it, idx) => {
                log.push(m, it, idx);
            });

            const currentActive = manager.activeItem as TestItem
            expect(log).toEqual([]);
            currentActive.disabled = true;
            expect(log).toEqual([ manager, currentActive, 4 ]);
        });

        test('_KeyManagerImpl.onActiveItemRemoved() should throw error if provided argument is not a function.', () => {
            const errorMessage = 'KeyManager.onActiveItemRemoved(): Provided argument is not a function!';
            const manager = createManager();

            //Will throw
            expect(() => manager.onActiveItemRemoved(0 as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemRemoved(1 as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemRemoved(true as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemRemoved(false as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemRemoved('' as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemRemoved('A' as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemRemoved(undefined as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemRemoved(null as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemRemoved({} as any)).toThrow(errorMessage);
            expect(() => manager.onActiveItemRemoved([] as any)).toThrow(errorMessage);
            
            //Will not throw
            expect(() => manager.onActiveItemRemoved(() => {})).not.toThrow();
        })

        it('Should set activeItem to null, activeItemIndex to -1, and invoke onActiveItemRemoved listeners when the active item is removed.', () => {
            const log: string[] = [];
            const manager = createManager()
            const item = new TestItem(0);
            
            manager.bind(document.createElement('div'));
            manager.addItem(item);
            manager.setActive(item);

            manager.onActiveItemRemoved(() => log.push('A'));
            manager.onActiveItemRemoved(() => log.push('B'));
            manager.onActiveItemRemoved(() => log.push('C'));

            expect(manager.activeItemIndex).toBe(0);
            expect(manager.activeItem).toBe(item);
            expect(log).toEqual([]);
            manager.removeItem(item);
            expect(manager.activeItemIndex).toBe(-1);
            expect(manager.activeItem).toBe(null);
            expect(log).toEqual([ 'A', 'B', 'C' ]);
        })

        it('Should not invoke removed onActiveItemRemoved listener when the active item is removed.', () => {
            const log: string[] = [];
            const manager = createManager()
            const item = new TestItem(0);
            
            manager.bind(document.createElement('div'));
            manager.addItem(item);
            manager.setActive(item);

            manager.onActiveItemRemoved(() => log.push('A'));
            const unregister = manager.onActiveItemRemoved(() => log.push('B'));
            manager.onActiveItemRemoved(() => log.push('C'));

            unregister();
            manager.removeItem(item);
            expect(log).toEqual([ 'A', 'C' ]);
        });
        
        test('Should update activeItem, activeItemIndex, decrement itemsCount, invoke onInactive() with items onDetached() and with onActiveItemRemoved listeners in the same batch.', () => {
            const log: any[] = [];
            const manager = createManager();
            const item = new TestItem(0, '', null, () => setOnInactive('A'), null, () => setOnDetached('B'));
            const [onInactive, setOnInactive] = createSignal<string>();
            const [onDetached, setOnDetached] = createSignal<string>();
            const [onRemoved, setOnRemoved] = createSignal<string>();
            
            manager.bind(document.createElement('div'));
            manager.addItem(item);
            manager.setActive(item);
            manager.onActiveItemRemoved(() => setOnRemoved('C'));

            let init = false;
            subscribeEffect(() => {
                const inactive = onInactive();
                const detached = onDetached();
                const index = manager.activeItemIndex;
                const item = manager.activeItem;
                const disabled = onRemoved();
                const count = manager.itemsCount;
                if (init) {
                    log.push(inactive, detached, count, index, item, disabled);
                } else {
                    init = true;
                }
            })

            expect(log).toEqual([]);
            manager.removeItem(item);
            expect(log).toEqual([ 'A', 'B', 0, -1, null, 'C' ]);
        });

        test('_KeyManagerImpl._setActiveItemByIndex() should run onInactive and onActive in that order.', () => {
            const log: string[] = [];
            const manager = createManager();
            manager.bind(document.createElement('div'));

            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i, '', () => log.push(`${i}_active`), () => log.push(`${i}_inactive`)));

            for (const item of items) {
                manager.addItem(item);
            }

            manager._setActiveItemByIndex(0);
            manager._setActiveItemByIndex(1);
            manager._setActiveItemByIndex(2);
            manager._setActiveItemByIndex(5);
            manager._setActiveItemByIndex(7);
            manager._setActiveItemByIndex(9);
            manager._setActiveItemByIndex(4);
            manager._setActiveItemByIndex(3);
            manager._setActiveItemByIndex(5);
            manager._setActiveItemByIndex(2);

            expect(log).toEqual([
                '0_active',
                '0_inactive',
                '1_active',
                '1_inactive',
                '2_active',
                '2_inactive',
                '5_active',
                '5_inactive',
                '7_active',
                '7_inactive',
                '9_active',
                '9_inactive',
                '4_active',
                '4_inactive',
                '3_active',
                '3_inactive',
                '5_active',
                '5_inactive',
                '2_active',
            ]);
        });

        test('_KeyManagerImpl.setActive() should set item active by index and return true if index is in the range and item on that index is available.', () => {
            const manager = createManager();

            manager.bind(document.createElement('div'));

            const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => new TestItem(index));

            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            expect(manager.setActive(0)).toBe(true);
            expect(manager.activeItem).toBe(items[0]);
            expect(manager.activeItemIndex).toBe(0);

            expect(manager.setActive(1)).toBe(true);
            expect(manager.activeItem).toBe(items[1]);
            expect(manager.activeItemIndex).toBe(1);

            expect(manager.setActive(2)).toBe(true);
            expect(manager.activeItem).toBe(items[2]);
            expect(manager.activeItemIndex).toBe(2);

            expect(manager.setActive(5)).toBe(true);
            expect(manager.activeItem).toBe(items[5]);
            expect(manager.activeItemIndex).toBe(5);

            expect(manager.setActive(7)).toBe(true);
            expect(manager.activeItem).toBe(items[7]);
            expect(manager.activeItemIndex).toBe(7);

            expect(manager.setActive(9)).toBe(true);
            expect(manager.activeItem).toBe(items[9]);
            expect(manager.activeItemIndex).toBe(9);
        });

        test('_KeyManagerImpl.setActive() should not set and return false if index is out of the range.', () => {
            const manager = createManager();

            manager.bind(document.createElement('div'));

            const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => new TestItem(index));

            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            expect(manager.setActive(-1)).toBe(false);
            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            expect(manager.setActive(10)).toBe(false);
            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            manager.setActive(5);

            expect(manager.setActive(-1)).toBe(false);
            expect(manager.activeItem).toBe(items[5]);
            expect(manager.activeItemIndex).toBe(5);

            expect(manager.setActive(10)).toBe(false);
            expect(manager.activeItem).toBe(items[5]);
            expect(manager.activeItemIndex).toBe(5);
        });

        test('_KeyManagerImpl.setActive() should do nothing and return false if provided index is pointing to unavailable item.', () => {
            const manager = createManager();

            manager.bind(document.createElement('div'));

            const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => new TestItem(index));
            items[4].disabled = true;

            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.setActive(4)).toBe(false);
            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);
            manager.setActive(0);
            expect(manager.activeItem).toBe(items[0]);
            expect(manager.activeItemIndex).toBe(0);
            expect(manager.setActive(4)).toBe(false);
            expect(manager.activeItem).toBe(items[0]);
            expect(manager.activeItemIndex).toBe(0);
        });

        test('_KeyManagerImpl.setActive() should set item active by provided available item and return true.', () => {
            const manager = createManager();

            manager.bind(document.createElement('div'));

            const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => new TestItem(index));

            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            expect(manager.setActive((items[0]))).toBe(true);
            expect(manager.activeItem).toBe(items[0]);
            expect(manager.activeItemIndex).toBe(0);

            expect(manager.setActive(items[1])).toBe(true);
            expect(manager.activeItem).toBe(items[1]);
            expect(manager.activeItemIndex).toBe(1);

            expect(manager.setActive(items[2])).toBe(true);
            expect(manager.activeItem).toBe(items[2]);
            expect(manager.activeItemIndex).toBe(2);

            expect(manager.setActive(items[5])).toBe(true);
            expect(manager.activeItem).toBe(items[5]);
            expect(manager.activeItemIndex).toBe(5);

            expect(manager.setActive((items[7]))).toBe(true);
            expect(manager.activeItem).toBe(items[7]);
            expect(manager.activeItemIndex).toBe(7);

            expect(manager.setActive(items[9])).toBe(true);
            expect(manager.activeItem).toBe(items[9]);
            expect(manager.activeItemIndex).toBe(9);
        });

        test('_KeyManagerImpl.setActive() should set item active by provided available item and return true despise of duplicated sort indexes', () => {
            const manager = createManager();

            manager.bind(document.createElement('div'));

            const items = [0, 1, 1, 1, 1, 1, 1, 1, 1, 2].map((index) => new TestItem(index));

            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            expect(manager.setActive((items[0]))).toBe(true);
            expect(manager.activeItem).toBe(items[0]);
            expect(manager.activeItemIndex).toBe(0);

            expect(manager.setActive(items[1])).toBe(true);
            expect(manager.activeItem).toBe(items[1]);
            expect(manager.activeItemIndex).toBe(1);

            expect(manager.setActive(items[2])).toBe(true);
            expect(manager.activeItem).toBe(items[2]);
            expect(manager.activeItemIndex).toBe(2);

            expect(manager.setActive(items[5])).toBe(true);
            expect(manager.activeItem).toBe(items[5]);
            expect(manager.activeItemIndex).toBe(5);

            expect(manager.setActive((items[7]))).toBe(true);
            expect(manager.activeItem).toBe(items[7]);
            expect(manager.activeItemIndex).toBe(7);

            expect(manager.setActive(items[9])).toBe(true);
            expect(manager.activeItem).toBe(items[9]);
            expect(manager.activeItemIndex).toBe(9);
        });

        test('_KeyManagerImpl.setActive() should not set provided item active and return false if this item is not added to manager.', () => {
            const manager = createManager();

            manager.bind(document.createElement('div'));

            const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => new TestItem(index));

            for (const item of items) {
                manager.addItem(item);
            }

            const extraItem = new TestItem(10);

            expect(manager.setActive(extraItem)).toBe(false);
            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            manager.setActive(items[5]);

            expect(manager.setActive(extraItem)).toBe(false);
            expect(manager.activeItem).toBe(items[5]);
            expect(manager.activeItemIndex).toBe(5);
        });

        test('_KeyManagerImpl.setActive() should not set item active and return false if target item is unavailable.', () => {
            const manager = createManager();
            const items = [0, 1, 2].map((index) => new TestItem(index));

            manager.bind(document.createElement('div'));
            items[1].disabled = true;
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);
            
            expect(manager.setActive(1)).toBe(false);
            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            expect(manager.setActive(items[1])).toBe(false);
            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            manager.setActive(0);
            expect(manager.activeItem).toBe(items[0]);
            expect(manager.activeItemIndex).toBe(0);

            expect(manager.setActive(1)).toBe(false);
            expect(manager.activeItem).toBe(items[0]);
            expect(manager.activeItemIndex).toBe(0);

            expect(manager.setActive(items[1])).toBe(false);
            expect(manager.activeItem).toBe(items[0]);
            expect(manager.activeItemIndex).toBe(0);
        });

        test('_KeyManagerImpl.clearActive() should set activeItem to null and activeItemIndex to -1 and return true if there was an active item.', () => {
            const manager = createManager();
            const item = new TestItem(0);
            
            manager.bind(document.createElement('div'));
            manager.addItem(item);
            manager.setActive(0);

            expect(manager.activeItem).toBe(item);
            expect(manager.activeItemIndex).toBe(0);
            expect(manager.clearActive()).toBe(true);
            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);
        });

        test('_KeyManagerImpl.clearActive() should return false is there is not any active item.', () => {
            const manager = createManager()
            const item = new TestItem(0);
            
            manager.bind(document.createElement('div'));
            manager.addItem(item);

            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);
            expect(manager.clearActive()).toBe(false);
        });

        test('_KeyManagerImpl.clearActive() should update activeItem and activeItemIndex in the same bach.', () => {
            const log: any[] = [];
            const manager = createManager();
            const item = new TestItem(0);

            manager.bind(document.createElement('div'));
            manager.addItem(item);
            manager.setActive(0);

            runWithOwner(owner, () => {
                createEffect(() => {
                    const item = manager.activeItem;
                    const index = manager.activeItemIndex;
                    if (item) { return; }
                    log.push(item);
                    log.push(index);
                });
            });

            expect(log).toEqual([]);
            manager.clearActive();
            expect(log).toEqual([ null, -1]);
        });

        test('_KeyMangerImpl.setFistItemActive() should set the first item in the list and returns true.', () => {
            const manager = createManager();
            const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => new TestItem(index));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            expect(manager.setFirstItemActive()).toBe(true);

            expect(manager.activeItem).toBe(items[0]);
            expect(manager.activeItemIndex).toBe(0);

            manager.setActive(5);
            expect(manager.activeItem).toBe(items[5]);
            expect(manager.activeItemIndex).toBe(5);

            expect(manager.setFirstItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[0]);
            expect(manager.activeItemIndex).toBe(0);
        });

        test('_KeyMangerImpl.setFistItemActive() should set the first available item in the list and returns true.', () => {
            const manager = createManager();
            const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => new TestItem(index));

            manager.bind(document.createElement('div'));
            items[0].disabled = true;
            items[1].disabled = true;
            items[2].disabled = true;
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            expect(manager.setFirstItemActive()).toBe(true);

            expect(manager.activeItem).toBe(items[3]);
            expect(manager.activeItemIndex).toBe(3);

            manager.setActive(7);
            expect(manager.activeItem).toBe(items[7]);
            expect(manager.activeItemIndex).toBe(7);

            expect(manager.setFirstItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[3]);
            expect(manager.activeItemIndex).toBe(3);
        });

        test('_KeyMangerImpl.setFistItemActive() should returns false if items list is empty.', () => {
            const manager = createManager();
            manager.bind(document.createElement('div'));
            expect(manager.setFirstItemActive()).toBe(false);

        });

        test('_KeyMangerImpl.setFistItemActive() should returns false if all items are unavailable.', () => {
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i)).map((item) => (item.disabled = true) && item);

            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.setFirstItemActive()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('_KeyMangerImpl.setFirstItemActive() should do nothing and return false if manager is disposed.', () => {
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            dispose();
            expect(manager.setFirstItemActive()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('_KeyManagerImpl.setLastItemActive() should set the last item active and returns true.', () => {
            const manager = createManager();
            const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => new TestItem(index));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            expect(manager.setLastItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[9]);
            expect(manager.activeItemIndex).toBe(9);

            manager.setActive(5);
            expect(manager.activeItem).toBe(items[5]);
            expect(manager.activeItemIndex).toBe(5);

            expect(manager.setLastItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[9]);
            expect(manager.activeItemIndex).toBe(9);
        });

        test('_KeyManagerImpl.setLastItemActive() should set the last available item active and returns true.', () => {
            const manager = createManager();
            const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => new TestItem(index));
            
            manager.bind(document.createElement('div'));
            items[7].disabled = true;
            items[8].disabled = true;
            items[9].disabled = true;

            for (const item of items) {
                manager.addItem(item);
            }
            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            expect(manager.setLastItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[6]);
            expect(manager.activeItemIndex).toBe(6);

            manager.setActive(3);
            expect(manager.activeItem).toBe(items[3]);
            expect(manager.activeItemIndex).toBe(3);

            expect(manager.setLastItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[6]);
            expect(manager.activeItemIndex).toBe(6);
        });

        test('_KeyMangerImpl.setLastItemActive() should returns false if items list is empty.', () => {
            const manager = createManager();
            manager.bind(document.createElement('div'));
            expect(manager.setLastItemActive()).toBe(false);
            dispose();
        });

        test('_KeyMangerImpl.setLastItemActive() should returns false if all items are unavailable.', () => {
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i)).map((item) => (item.disabled = true) && item);

            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.setLastItemActive()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('_KeyMangerImpl.setLastItemActive() should do nothing and return false if manager is disposed.', () => {
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));

            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            dispose();
            expect(manager.setLastItemActive()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('_KeyManagerImpl.setNextItemActive() should set first item active and return true if there is no active item.', () => {
            const manager = createManager();
            const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => new TestItem(index));

            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            expect(manager.setNextItemActive()).toBe(true);

            expect(manager.activeItem).toBe(items[0]);
            expect(manager.activeItemIndex).toBe(0);
        });

        test('_KeyManagerImpl.setNextItemActive() should set first available item active and return true if there is no active item.', () => {
            const manager = createManager();
            const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => new TestItem(index));

            manager.bind(document.createElement('div'))
            items[0].disabled = true;
            items[1].disabled = true;
            items[2].disabled = true;
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            expect(manager.setNextItemActive()).toBe(true);

            expect(manager.activeItem).toBe(items[3]);
            expect(manager.activeItemIndex).toBe(3);
        });

        test('_KeyManagerImpl.setNextItemActive() should set the next available item from current active item and return true.', () => {
            const manager = createManager();;
            const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => new TestItem(index));

            
            manager.bind(document.createElement('div'));
            items[3].disabled = true;
            items[5].disabled = true;
            items[6].disabled = true;
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            expect(manager.setNextItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[0]);
            expect(manager.activeItemIndex).toBe(0);

            expect(manager.setNextItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[1]);
            expect(manager.activeItemIndex).toBe(1);

            expect(manager.setNextItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[2]);
            expect(manager.activeItemIndex).toBe(2);

            expect(manager.setNextItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[4]);
            expect(manager.activeItemIndex).toBe(4);

            expect(manager.setNextItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[7]);
            expect(manager.activeItemIndex).toBe(7);
        });

        test('_KeyManagerImpl.setNextItemActive() should wrap to the first item when reaching the end of the list and return true if wrap is enabled.', () => {
            const manager = createManager((config) => config.withWrap());
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(9);
            expect(manager.activeItem).toBe(items[9]);
            expect(manager.setNextItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[0]);
        });

        test('_KeyManagerImpl.setNextItemActive() should not wrap to the first item when reaching the end of the list and return false if wrap is disabled.', () => {
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(9);
            expect(manager.activeItem).toBe(items[9]);
            expect(manager.setNextItemActive()).toBe(false);
            expect(manager.activeItem).toBe(items[9]);
        });

        test('_KeyManagerImpl.setNextItemActive() should wrap to the first item when reaching the end of the available items list and return true if wrap is enabled.', () => {
            const manager = createManager((config) => config.withWrap());
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            items[9].disabled = true
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(8);
            expect(manager.activeItem).toBe(items[8]);
            expect(manager.setNextItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[0]);
        });

        test('_KeyManagerImpl.setNextItemActive() should not wrap to the first item when reaching the end of the available items list and return false if wrap is disabled.', () => {
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            items[9].disabled = true
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(8);
            expect(manager.activeItem).toBe(items[8]);
            expect(manager.setNextItemActive()).toBe(false);
            expect(manager.activeItem).toBe(items[8]);
        });

        test('_KeyManagerImpl.setNextItemActive() should wrap to the first available item when reaching the end of the list and return true if wrap is enabled.', () => {
            const manager = createManager((config) => config.withWrap());
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            items[0].disabled = true
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(9);
            expect(manager.activeItem).toBe(items[9]);
            expect(manager.setNextItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[1]);

            dispose();
        });

        test('_KeyManagerImpl.setNextItemActive() should wrap to the first available item when reaching the end of the available items list and return true if wrap is enabled.', () => {
            const manager = createManager((config) => config.withWrap());
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            items[0].disabled = true
            items[9].disabled = true
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(8);
            expect(manager.activeItem).toBe(items[8]);
            expect(manager.setNextItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[1]);
        });

        test('_KeyManagerImpl.setNextItemActive() should return false if there items list is empty.', () => {
            const manager = createManager();
            manager.bind(document.createElement('div'));
            expect(manager.setNextItemActive()).toBe(false);
        });

        test('_KeyManagerImpl.setNextItemActive() should return false if all items are unavailable.', () => {
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i)).map((item) => (item.disabled = true) && item);
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item)
            }

            expect(manager.setNextItemActive()).toBe(false);
        });

        test('KeyManagerImpl.setNextItemActive() should return false if all items are unavailable without current active.', () => {
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i)).map((item) => (item.disabled = true) && item);
            
            manager.bind(document.createElement('div'));
            items[4].disabled = false;
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(4);
            expect(manager.activeItem).toBe(items[4])
            expect(manager.setNextItemActive()).toBe(false);
            expect(manager.activeItem).toBe(items[4])
        });

        test('_KeyManagerImpl.setNextItemActive() should do nothing and return false if manager is disposed.', () => {
            const manager = createManager((config) => config.withWrap());
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            dispose();
            expect(manager.setNextItemActive()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('_KeyMangerImpl.setPreviousItemActive() should set the last item active and return true if there is no active item.', () => {
            const manager = createManager();
            const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => new TestItem(index));

            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            manager.setPreviousItemActive();
            expect(manager.activeItem).toBe(items[9]);
            expect(manager.activeItemIndex).toBe(9);
        });

        test('_KeyMangerImpl.setPreviousItemActive() should set the last available item active of there is no active item.', () => {
            const manager = createManager();
            const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => new TestItem(index));

            
            manager.bind(document.createElement('div'));
            items[7].disabled = true;
            items[8].disabled = true;
            items[9].disabled = true;
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            expect(manager.setPreviousItemActive()).toBe(true);

            expect(manager.activeItem).toBe(items[6]);
            expect(manager.activeItemIndex).toBe(6);
        });

        test('_KeyManagerImpl.setPreviousItemActive() should set previous available item from the current active item and return true.', () => {
            const manager = createManager();
            const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => new TestItem(index));

            manager.bind(document.createElement('div'));
            items[4].disabled = true;
            items[5].disabled = true;
            items[7].disabled = true;
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.activeItemIndex).toBe(-1);

            expect(manager.setPreviousItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[9]);
            expect(manager.activeItemIndex).toBe(9);

            expect(manager.setPreviousItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[8]);
            expect(manager.activeItemIndex).toBe(8);

            expect(manager.setPreviousItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[6]);
            expect(manager.activeItemIndex).toBe(6);

            expect(manager.setPreviousItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[3]);
            expect(manager.activeItemIndex).toBe(3);
        });

        test('_KeyManagerImpl.setPreviousItemActive() should wrap to the last item when reaching the beginning of the list and return true if wrap is enabled.', () => {
            const manager = createManager((config) => config.withWrap());
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(0);
            expect(manager.activeItem).toBe(items[0]);
            expect(manager.setPreviousItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[9]);
        });

        test('_KeyManagerImpl.setPreviousItemActive() should not wrap to the last item when reaching the beginning of the list and return false if wrap is disabled.', () => {
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(0);
            expect(manager.activeItem).toBe(items[0]);
            expect(manager.setPreviousItemActive()).toBe(false);
            expect(manager.activeItem).toBe(items[0]);
        });

        test('_KeyManagerImpl.setPreviousItemActive() should wrap to the last item when reaching the beginning of the available items list and return true if wrap is enabled.', () => {
            const manager = createManager((config) => config.withWrap());
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            items[0].disabled = true;
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(1);
            expect(manager.activeItem).toBe(items[1]);
            expect(manager.setPreviousItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[9]);
        });

        test('_KeyManagerImpl.setPreviousItemActive() should not wrap to the last item when reaching the beginning of the available items list and return false if wrap is disabled.', () => {
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            items[0].disabled = true;
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(1);
            expect(manager.activeItem).toBe(items[1]);
            expect(manager.setPreviousItemActive()).toBe(false);
            expect(manager.activeItem).toBe(items[1]);
        });

        test('_KeyManagerImpl.setPreviousItemActive() should wrap to the last available item when reaching the beginning of the list if wrap is enabled and return true.', () => {
            const manager = createManager((config) => config.withWrap());;
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            items[9].disabled = true;
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(0);
            expect(manager.activeItem).toBe(items[0]);
            expect(manager.setPreviousItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[8]);
        });

        test('_KeyManagerImpl.setPreviousItemActive() should wrap to the last available item when reaching the beginning of the available items list if wrap is enabled return true.', () => {
            const manager = createManager((config) => config.withWrap());
            manager.bind(document.createElement('div'));

            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            items[0].disabled = true;
            items[9].disabled = true;
            
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(1);
            expect(manager.activeItem).toBe(items[1]);
            expect(manager.setPreviousItemActive()).toBe(true);
            expect(manager.activeItem).toBe(items[8]);
        });

        test('_KeyManagerImpl.setPreviousItemActive() should return false if items list is empty.', () => {
            const manager = createManager();
            manager.bind(document.createElement('div'));
            expect(manager.setPreviousItemActive()).toBe(false);
        });

        test('_KeyManagerImpl.setPreviousItemActive() should return false if all items all unavailable.', () => {
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i)).map((item) => (item.disabled = true) && item);
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.setPreviousItemActive()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('KeyManagerImpl.setPreviousItemActive() should return false if all items are unavailable without current active.', () => {
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i)).map((item) => (item.disabled = true) && item);
            
            manager.bind(document.createElement('div'));
            items[4].disabled = false;
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(4);
            expect(manager.activeItem).toBe(items[4])
            expect(manager.setPreviousItemActive()).toBe(false);
            expect(manager.activeItem).toBe(items[4])
        });

        test('_KeyManagerImpl.setPreviousItemActive() should do nothing return false if manager is disposed.', () => {
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null)
            dispose();
            expect(manager.setPreviousItemActive()).toBe(false);
            expect(manager.activeItem).toBe(null)
        });

        test('_KeyManagerImpl.jumpForward() should set first item active item and returns true if there is no active item and jumpStep is positive.', () => {
            const manager1 = createManager();
            const manager2 = createManager();
            const manager3 = createManager();
            const items1 = Array.from({ length: 10 }, (_, i) => i).map((index) => new TestItem(index));
            const items2 = Array.from({ length: 10 }, (_, i) => i).map((index) => new TestItem(index));
            const items3 = Array.from({ length: 10 }, (_, i) => i).map((index) => new TestItem(index));

            manager1.bind(document.createElement('div'));
            manager2.bind(document.createElement('div'));
            manager3.bind(document.createElement('div'));
            for (const item of items1) {
                manager1.addItem(item);
            }
            for (const item of items2) {
                manager2.addItem(item);
            }
            for (const item of items3) {
                manager3.addItem(item);
            }
            manager1.jumpStep = 1;
            manager2.jumpStep = 2;
            manager3.jumpStep = 3;

            expect(manager1.activeItem).toBe(null);
            expect(manager2.activeItem).toBe(null);
            expect(manager3.activeItem).toBe(null);

            expect(manager1.jumpForward()).toBe(true);
            expect(manager2.jumpForward()).toBe(true);
            expect(manager3.jumpForward()).toBe(true);

            expect(manager1.activeItem).toBe(items1[0]);
            expect(manager2.activeItem).toBe(items2[0]);
            expect(manager3.activeItem).toBe(items3[0]);
        });

        test('_KeyManagerImpl.jumpForward() should set first available item active item and return true if there is no active item and jumpStep is positive.', () => {
            const manager1 = createManager()
            const manager2 = createManager()
            const items1 = Array.from({ length: 10 }, (_, i) => i).map((index) => new TestItem(index));
            const items2 = Array.from({ length: 10 }, (_, i) => i).map((index) => new TestItem(index));

            manager1.bind(document.createElement('div'));
            items1[0].disabled = true;
            items1[1].disabled = true;
            items1[2].disabled = true;
            for (const item of items1) {
                manager1.addItem(item);
            }
            manager1.jumpStep = 1;
            
            manager2.bind(document.createElement('div'));
            items2[0].disabled = true;
            items2[1].disabled = true;
            items2[2].disabled = true;
            for (const item of items2) {
                manager2.addItem(item);
            }
            manager2.jumpStep = 6;

            expect(manager1.activeItem).toBe(null);
            expect(manager2.activeItem).toBe(null);
            expect(manager1.jumpForward()).toBe(true);
            expect(manager2.jumpForward()).toBe(true);
            expect(manager1.activeItem).toBe(items1[3]);
            expect(manager2.activeItem).toBe(items2[3]);
        });

        test('_KeyManagerImpl.jumpForward() should set last item active item and return if there is no active item and jumpStep is negative.', () => {
            const manager1 = createManager();
            const manager2 = createManager();
            const manager3 = createManager();
            const items1 = Array.from({ length: 10 }, (_, i) => i).map((index) => new TestItem(index));
            const items2 = Array.from({ length: 10 }, (_, i) => i).map((index) => new TestItem(index));
            const items3 = Array.from({ length: 10 }, (_, i) => i).map((index) => new TestItem(index));

            manager1.bind(document.createElement('div'));
            manager2.bind(document.createElement('div'));
            manager3.bind(document.createElement('div'));
            for (const item of items1) {
                manager1.addItem(item);
            }
            for (const item of items2) {
                manager2.addItem(item);
            }
            for (const item of items3) {
                manager3.addItem(item);
            }
            manager1.jumpStep = -1;
            manager2.jumpStep = -2;
            manager3.jumpStep = -3;

            expect(manager1.activeItem).toBe(null);
            expect(manager2.activeItem).toBe(null);
            expect(manager3.activeItem).toBe(null);

            expect(manager1.jumpForward()).toBe(true);
            expect(manager2.jumpForward()).toBe(true);
            expect(manager3.jumpForward()).toBe(true);

            expect(manager1.activeItem).toBe(items1[9]);
            expect(manager2.activeItem).toBe(items2[9]);
            expect(manager3.activeItem).toBe(items3[9]);
        });

        test('_KeyManagerImpl.jumpForward() should set last available item active item and return true if there is no active item and jumpStep is negative.', () => {
            const manager1 = createManager();
            const manager2 = createManager();
            const items1 = Array.from({ length: 10 }, (_, i) => i).map((index) => new TestItem(index));
            const items2 = Array.from({ length: 10 }, (_, i) => i).map((index) => new TestItem(index));

            manager1.bind(document.createElement('div'))
            items1[7].disabled = true;
            items1[8].disabled = true;
            items1[9].disabled = true;
            for (const item of items1) {
                manager1.addItem(item);
            }
            manager1.jumpStep = -1;

            manager2.bind(document.createElement('div'))
            items2[7].disabled = true;
            items2[8].disabled = true;
            items2[9].disabled = true;
            for (const item of items2) {
                manager2.addItem(item);
            }
            manager2.jumpStep = -6;

            expect(manager1.activeItem).toBe(null);
            expect(manager2.activeItem).toBe(null);
            expect(manager1.jumpForward()).toBe(true);
            expect(manager2.jumpForward()).toBe(true);
            expect(manager1.activeItem).toBe(items1[6]);
            expect(manager2.activeItem).toBe(items2[6]);
        });

        test('_KeyManagerImpl.jumpForward() should jump to the next available item at the next multiple of the specified positive step and return true.', () => {
            const manager = createManager();
            const items = Array.from({ length: 25 }, (_, i) => new TestItem(i));
            
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            manager.jumpStep = 1;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[0]);
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[1]);
            items[2].disabled = true;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[3]);
            manager.jumpStep = 2;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[5]);
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[7]);
            items[9].disabled = true;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[11]);
            manager.jumpStep = 3;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[14]);
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[17]);
            items[20].disabled = true;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[23]);
        });

        test('_KeyManagerImpl.jumpForward() should jump to the previous available item at the next multiple of the specified negative step and return true.', () => {
            const manager = createManager();
            const items = Array.from({ length: 25 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            manager.jumpStep = -1;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[24 - 0]);
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[24 - 1]);
            items[24 - 2].disabled = true;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[24 - 3]);
            manager.jumpStep = -2;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[24 - 5]);
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[24 - 7]);
            items[24 - 9].disabled = true;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[24 - 11]);
            manager.jumpStep = -3;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[24 - 14]);
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[24 - 17]);
            items[24 - 20].disabled = true;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[24 - 23]);
        });

        test('_KeyManagerImpl.jumpForward() should wrap to the next available jump target and return true if wrap is enabled.', () => {
            /**
             * Grid layout used for the wrapping scenario.
             *
             * The last row is intentionally incomplete.
             * The first four columns are complete, while the remaining four columns are shorter.
             *
             * Disabled items:
             * - Column 2: first item.
             * - Column 3: last item.
             * - Column 4: first and last items.
             *
             * The same disabled pattern is applied to the incomplete columns.
             *
             * This layout is intended to verify that wrapping and jump navigation
             * correctly handle incomplete columns and disabled items.
             * 
             * O = available
             * X = disabled
             *
             * C1  C2  C3  C4  C5  C6  C7  C8
             *
             * O   X   O   X   O   X   O   X
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   X   X
             * O   O   X   X
             */

            const manager = createManager((config) => config.withWrap());
            const items = Array.from({ length: 8 * 8 - 4 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            items[1].disabled = true; // First item in C2
            items[58].disabled = true; // Last item in C3
            items[3].disabled = true; // First item in C4
            items[59].disabled = true; // Last item in C4
            items[5].disabled = true; // First item in C6
            items[54].disabled = true; // Last item in C7
            items[7].disabled = true; // First item in C8
            items[55].disabled = true; // Last item in C8

            for (const item of items) {
                manager.addItem(item);
            }

            manager.jumpStep = 8;

            manager.setActive(56);// Last item in C1;
            expect(manager.activeItem).toBe(items[56]);// Last item in C1;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[0]);// First item in C1;

            manager.setActive(57);// Last item in C2;
            expect(manager.activeItem).toBe(items[57]);// Last item in C2;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[9]);// Second item in C2;

            manager.setActive(50);// Before last item in C3;
            expect(manager.activeItem).toBe(items[50]);// Before last item in C3;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[2]);// First item C3;

            manager.setActive(51);// Before last item in C4;
            expect(manager.activeItem).toBe(items[51]);// Before last item in C4;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[11]);// Second item in C4;

            manager.setActive(52);// Last item in C5
            expect(manager.activeItem).toBe(items[52]);// Last item in C5
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[4]);// First item in C5

            manager.setActive(53);// Last item in C6
            expect(manager.activeItem).toBe(items[53]);// Last item in C6
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[13]);// Second item in C6

            manager.setActive(46);// Before last item in C7
            expect(manager.activeItem).toBe(items[46]);// Before last item in C7
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[6]);// First item in C7

            manager.setActive(47);// Before last item in C8
            expect(manager.activeItem).toBe(items[47]);// Before last item in C8
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[15]);// Second item in C8

            /** Reverted behavior */
            manager.jumpStep = -8

            manager.setActive(0);// First item in C1;
            expect(manager.activeItem).toBe(items[0]);// First item in C1;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[56]);// Last item in C1;

            manager.setActive(9);// Second item in C2;
            expect(manager.activeItem).toBe(items[9]);// Second item in C2;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[57]);// Last item in C2;

            manager.setActive(2);// First item in C3;
            expect(manager.activeItem).toBe(items[2]);// First item in C3;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[50]);// Before last item in C3;
            
            manager.setActive(11);// Second item in C4;
            expect(manager.activeItem).toBe(items[11]);// Second item in C4;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[51]);// Before last item in C4;

            manager.setActive(4);// First item in C5;
            expect(manager.activeItem).toBe(items[4]);// First item in C5;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[52]);// Last item in C5;

            manager.setActive(13);// Second item in C6;
            expect(manager.activeItem).toBe(items[13]);// Second item in C6;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[53]);// Last item in C6;

            manager.setActive(6);// First item in C7;
            expect(manager.activeItem).toBe(items[6]);// First item in C7;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[46]);// Before Last item in C7;

            manager.setActive(15);// Second item in C8;
            expect(manager.activeItem).toBe(items[15]);// Second item in C8;
            expect(manager.jumpForward()).toBe(true);
            expect(manager.activeItem).toBe(items[47]);// Before Last item in C8;
        });

        test('_KeyManagerImpl.jumpForward() should not wrap to the next available jump target and return false if wrap is disabled.', () => {
            /**
             * Grid layout used for the wrapping scenario.
             *
             * The last row is intentionally incomplete.
             * The first four columns are complete, while the remaining four columns are shorter.
             *
             * Disabled items:
             * - Column 2: first item.
             * - Column 3: last item.
             * - Column 4: first and last items.
             *
             * The same disabled pattern is applied to the incomplete columns.
             *
             * This layout is intended to verify that wrapping and jump navigation
             * correctly handle incomplete columns and disabled items.
             * 
             * O = available
             * X = disabled
             *
             * C1  C2  C3  C4  C5  C6  C7  C8
             *
             * O   X   O   X   O   X   O   X
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   X   X
             * O   O   X   X
             */

            const manager = createManager();
            const items = Array.from({ length: 8 * 8 - 4 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            items[1].disabled = true; // First item in C2
            items[58].disabled = true; // Last item in C3
            items[3].disabled = true; // First item in C4
            items[59].disabled = true; // Last item in C4
            items[5].disabled = true; // First item in C6
            items[54].disabled = true; // Last item in C7
            items[7].disabled = true; // First item in C8
            items[55].disabled = true; // Last item in C8

            for (const item of items) {
                manager.addItem(item);
            }

            manager.jumpStep = 8;

            manager.setActive(56);// Last item in C1;
            expect(manager.activeItem).toBe(items[56]);// Last item in C1;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[56]);// Last item in C1;

            manager.setActive(57);// Last item in C2;
            expect(manager.activeItem).toBe(items[57]);// Last item in C2;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[57]);// Last item in C2;

            manager.setActive(50);// Before last item in C3;
            expect(manager.activeItem).toBe(items[50]);// Before last item in C3;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[50]);//  Before last item in C3;

            manager.setActive(51);// Before last item in C4;
            expect(manager.activeItem).toBe(items[51]);// Before last item in C4;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[51]);// Before last item in C4;

            manager.setActive(52);// Last item in C5
            expect(manager.activeItem).toBe(items[52]);// Last item in C5
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[52]);// Last item in C5

            manager.setActive(53);// Last item in C6
            expect(manager.activeItem).toBe(items[53]);// Last item in C6
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[53]);// Last item in C6

            manager.setActive(46);// Before last item in C7
            expect(manager.activeItem).toBe(items[46]);// Before last item in C7
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[46]);// Before last item in C7

            manager.setActive(47);// Before last item in C8
            expect(manager.activeItem).toBe(items[47]);// Before last item in C8
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[47]);// Before last item in C8

            /** Reverted behavior */
            manager.jumpStep = -8

            manager.setActive(0);// First item in C1;
            expect(manager.activeItem).toBe(items[0]);// First item in C1;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[0]);// First item in C1;

            manager.setActive(9);// Second item in C2;
            expect(manager.activeItem).toBe(items[9]);// Second item in C2;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[9]);// Second item in C2;

            manager.setActive(2);// First item in C3;
            expect(manager.activeItem).toBe(items[2]);// First item in C3;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[2]);// First item in C3;
            
            manager.setActive(11);// Second item in C4;
            expect(manager.activeItem).toBe(items[11]);// Second item in C4;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[11]);// Second item in C4;

            manager.setActive(4);// First item in C5;
            expect(manager.activeItem).toBe(items[4]);// First item in C5;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[4]);// First item in C5;

            manager.setActive(13);// Second item in C6;
            expect(manager.activeItem).toBe(items[13]);// Second item in C6;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[13]);// Second item in C6;

            manager.setActive(6);// First item in C7;
            expect(manager.activeItem).toBe(items[6]);// First item in C7;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[6]);// First item in C7;

            manager.setActive(15);// Second item in C8;
            expect(manager.activeItem).toBe(items[15]);// Second item in C8;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[15]);// Second item in C8;
        })

        test('_KeyManagerImpl.jumpForward() should return false if items list is empty.', () => {
            const manager = createManager();

            manager.bind(document.createElement('div'));

            manager.jumpStep = 1;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = 5;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = -1;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = -5;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('_KeyManagerImpl.jumpForward() should return false if all items are unavailable.', () => {
            const manager = createManager();
            const items = Array.from({ length: 20 }, (_, i) => new TestItem(i)).map((item) => (item.disabled = true) && item);
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            manager.jumpStep = 1;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = 5;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = -1;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = -5;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('_KeyManagerImpl.jumpForward() should return false if all items are unavailable without current active one.', () => {
            const manager = createManager();
            const items = Array.from({ length: 20 }, (_, i) => new TestItem(i)).map((item) => (item.disabled = true) && item);
            
            manager.bind(document.createElement('div'));
            items[9].disabled = false;
            for (const item of items) {
                manager.addItem(item);
            }
            manager.setActive(9);

            expect(manager.activeItem).toBe(items[9])
            manager.jumpStep = 1;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[9])
            manager.jumpStep = 5;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[9])
            manager.jumpStep = -1;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[9])
            manager.jumpStep = -5;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(items[9])
        });

        test('_KeyManagerImpl.jumpForward() should return false if manager is disposed.', () => {
            const manager = createManager();
            const items = Array.from({ length: 20 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            dispose();
            manager.jumpStep = 1;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = 5;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = -1;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = -5;
            expect(manager.jumpForward()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('_KeyManagerImpl.jumpBackward() should set last item active and return true if there is no active item and jumpStep is positive.', () => {
            const manager1 = createManager();
            const manager2 = createManager();
            const manager3 = createManager();
            const items1 = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            const items2 = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            const items3 = Array.from({ length: 10 }, (_, i) => new TestItem(i));

            manager1.bind(document.createElement('div'));
            manager2.bind(document.createElement('div'));
            manager3.bind(document.createElement('div'));
            for (const item of items1) {
                manager1.addItem(item);
            }
            for (const item of items2) {
                manager2.addItem(item);
            }
            for (const item of items3) {
                manager3.addItem(item);
            }
            manager1.jumpStep = 1;
            manager2.jumpStep = 2;
            manager3.jumpStep = 3;

            expect(manager1.jumpBackward()).toBe(true);
            expect(manager2.jumpBackward()).toBe(true);
            expect(manager3.jumpBackward()).toBe(true);

            expect(manager1.activeItem).toBe(items1[9]);
            expect(manager2.activeItem).toBe(items2[9]);
            expect(manager3.activeItem).toBe(items3[9]);

            dispose();
        });

        test('_KeyManagerImpl.jumpBackward() should set last available item active and return true if there is no active item and jumpStep is positive.', () => {
            const manager1 = createManager();
            const manager2 = createManager();
            const items1 = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            const items2 = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager1.bind(document.createElement('div'));
            manager1.jumpStep = 1;
            items1[7].disabled = true;
            items1[8].disabled = true;
            items1[9].disabled = true;
            for (const item of items1) {
                manager1.addItem(item);
            };

            manager2.bind(document.createElement('div'));
            manager2.jumpStep = 6;
            items2[7].disabled = true;
            items2[8].disabled = true;
            items2[9].disabled = true;
            for (const item of items2) {
                manager2.addItem(item);
            };
            
            expect(manager1.activeItem).toBe(null);
            expect(manager2.activeItem).toBe(null);
            expect(manager1.jumpBackward()).toBe(true);
            expect(manager2.jumpBackward()).toBe(true);
            expect(manager1.activeItem).toBe(items1[6]);
            expect(manager2.activeItem).toBe(items2[6]);
        });

        test('_KeyManagerImpl.jumpBackward() should set first item active and return true if there is no active item and jumpStep is negative.', () => {
            const manager1 = createManager();
            const manager2 = createManager();
            const manager3 = createManager();
            const items1 = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            const items2 = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            const items3 = Array.from({ length: 10 }, (_, i) => new TestItem(i));

            manager1.bind(document.createElement('div'));
            manager2.bind(document.createElement('div'));
            manager3.bind(document.createElement('div'));
            for (const item of items1) {
                manager1.addItem(item);
            }
            for (const item of items2) {
                manager2.addItem(item);
            }
            for (const item of items3) {
                manager3.addItem(item);
            }
            manager1.jumpStep = -1;
            manager2.jumpStep = -2;
            manager3.jumpStep = -3;

            expect(manager1.jumpBackward()).toBe(true);
            expect(manager2.jumpBackward()).toBe(true);
            expect(manager3.jumpBackward()).toBe(true);

            expect(manager1.activeItem).toBe(items1[0]);
            expect(manager2.activeItem).toBe(items2[0]);
            expect(manager3.activeItem).toBe(items3[0]);
        });

        test('_KeyManagerImpl.jumpBackward() should set first available item active and return true if there is no active item and jumpStep is negative.', () => {
            const manager1 = createManager();
            const manager2 = createManager();
            const items1 = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            const items2 = Array.from({ length: 10 }, (_, i) => new TestItem(i));

            manager1.bind(document.createElement('div'));
            manager1.jumpStep = -1;
            items1[0].disabled = true;
            items1[1].disabled = true;
            items1[2].disabled = true;
            for (const item of items1) {
                manager1.addItem(item);
            };

            manager2.bind(document.createElement('div'));
            manager2.jumpStep = -6;
            items2[0].disabled = true;
            items2[1].disabled = true;
            items2[2].disabled = true;
            for (const item of items2) {
                manager2.addItem(item);
            };
            
            expect(manager1.activeItem).toBe(null);
            expect(manager2.activeItem).toBe(null);
            expect(manager1.jumpBackward()).toBe(true);
            expect(manager2.jumpBackward()).toBe(true);
            expect(manager1.activeItem).toBe(items1[3]);
            expect(manager2.activeItem).toBe(items2[3]);
        });

        test('_KeyManagerImpl.jumpBackward() should wrap to the previous available jump target and return true if wrap is enabled.', () => {
            /**
             * Grid layout used for the wrapping scenario.
             *
             * The last row is intentionally incomplete.
             * The first four columns are complete, while the remaining four columns are shorter.
             *
             * Disabled items:
             * - Column 2: first item.
             * - Column 3: last item.
             * - Column 4: first and last items.
             *
             * The same disabled pattern is applied to the incomplete columns.
             *
             * This layout is intended to verify that wrapping and jump navigation
             * correctly handle incomplete columns and disabled items.
             * 
             * O = available
             * X = disabled
             *
             * C1  C2  C3  C4  C5  C6  C7  C8
             *
             * O   X   O   X   O   X   O   X
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   X   X
             * O   O   X   X
             */

            const manager = createManager((config) => config.withWrap());
            const items = Array.from({ length: 8 * 8 - 4 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            items[1].disabled = true; // First item in C2
            items[58].disabled = true; // Last item in C3
            items[3].disabled = true; // First item in C4
            items[59].disabled = true; // Last item in C4
            items[5].disabled = true; // First item in C6
            items[54].disabled = true; // Last item in C7
            items[7].disabled = true; // First item in C8
            items[55].disabled = true; // Last item in C8
            for (const item of items) {
                manager.addItem(item);
            }
            manager.jumpStep = 8;

            manager.setActive(0);// First item in C1;
            expect(manager.activeItem).toBe(items[0]);// First item in C1;
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[56]);// Last item in C1;

            manager.setActive(9);// Second item in C2;
            expect(manager.activeItem).toBe(items[9]);// Second item in C2;
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[57]);// Last item in C2;

            manager.setActive(2);// First item in C3;
            expect(manager.activeItem).toBe(items[2]);// First item in C3;
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[50]);// Before last item in C3;
            
            manager.setActive(11);// Second item in C4;
            expect(manager.activeItem).toBe(items[11]);// Second item in C4;
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[51]);// Before last item in C4;

            manager.setActive(4);// First item in C5;
            expect(manager.activeItem).toBe(items[4]);// First item in C5;
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[52]);// Last item in C5;

            manager.setActive(13);// Second item in C6;
            expect(manager.activeItem).toBe(items[13]);// Second item in C6;
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[53]);// Last item in C6;

            manager.setActive(6);// First item in C7;
            expect(manager.activeItem).toBe(items[6]);// First item in C7;
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[46]);// Before Last item in C7;

            manager.setActive(15);// Second item in C8;
            expect(manager.activeItem).toBe(items[15]);// Second item in C8;
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[47]);// Before Last item in C8;

            /** Reverted behavior */
            manager.jumpStep = -8

            manager.setActive(56);// Last item in C1;
            expect(manager.activeItem).toBe(items[56]);// Last item in C1;
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[0]);// First item in C1;

            manager.setActive(57);// Last item in C2;
            expect(manager.activeItem).toBe(items[57]);// Last item in C2;
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[9]);// Second item in C2;

            manager.setActive(50);// Before last item in C3;
            expect(manager.activeItem).toBe(items[50]);// Before last item in C3;
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[2]);// First item C3;

            manager.setActive(51);// Before last item in C4;
            expect(manager.activeItem).toBe(items[51]);// Before last item in C4;
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[11]);// Second item in C4;

            manager.setActive(52);// Last item in C5
            expect(manager.activeItem).toBe(items[52]);// Last item in C5
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[4]);// First item in C5

            manager.setActive(53);// Last item in C6
            expect(manager.activeItem).toBe(items[53]);// Last item in C6
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[13]);// Second item in C6

            manager.setActive(46);// Before last item in C7
            expect(manager.activeItem).toBe(items[46]);// Before last item in C7
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[6]);// First item in C7

            manager.setActive(47);// Before last item in C8
            expect(manager.activeItem).toBe(items[47]);// Before last item in C8
            expect(manager.jumpBackward()).toBe(true);
            expect(manager.activeItem).toBe(items[15]);// Second item in C8

            dispose();
        });

        test('_KeyManagerImpl.jumpBackward() should not wrap to the previous available jump target and return false if wrap is disabled.', () => {
            /**
             * Grid layout used for the wrapping scenario.
             *
             * The last row is intentionally incomplete.
             * The first four columns are complete, while the remaining four columns are shorter.
             *
             * Disabled items:
             * - Column 2: first item.
             * - Column 3: last item.
             * - Column 4: first and last items.
             *
             * The same disabled pattern is applied to the incomplete columns.
             *
             * This layout is intended to verify that wrapping and jump navigation
             * correctly handle incomplete columns and disabled items.
             * 
             * O = available
             * X = disabled
             *
             * C1  C2  C3  C4  C5  C6  C7  C8
             *
             * O   X   O   X   O   X   O   X
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   O   O
             * O   O   O   O   O   O   X   X
             * O   O   X   X
             */

            const manager = createManager();
            const items = Array.from({ length: 8 * 8 - 4 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            items[1].disabled = true; // First item in C2
            items[58].disabled = true; // Last item in C3
            items[3].disabled = true; // First item in C4
            items[59].disabled = true; // Last item in C4
            items[5].disabled = true; // First item in C6
            items[54].disabled = true; // Last item in C7
            items[7].disabled = true; // First item in C8
            items[55].disabled = true; // Last item in C8

            for (const item of items) {
                manager.addItem(item);
            }

            manager.jumpStep = 8;

            manager.setActive(0);// First item in C1;
            expect(manager.activeItem).toBe(items[0]);// First item in C1;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[0]);// First item in C1;

            manager.setActive(9);// Second item in C2;
            expect(manager.activeItem).toBe(items[9]);// Second item in C2;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[9]);// Second item in C2;

            manager.setActive(2);// First item in C3;
            expect(manager.activeItem).toBe(items[2]);// First item in C3;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[2]);// First item in C3;
            
            manager.setActive(11);// Second item in C4;
            expect(manager.activeItem).toBe(items[11]);// Second item in C4;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[11]);// Second item in C4;

            manager.setActive(4);// First item in C5;
            expect(manager.activeItem).toBe(items[4]);// First item in C5;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[4]);// First item in C5;

            manager.setActive(13);// Second item in C6;
            expect(manager.activeItem).toBe(items[13]);// Second item in C6;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[13]);// Second item in C6;

            manager.setActive(6);// First item in C7;
            expect(manager.activeItem).toBe(items[6]);// First item in C7;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[6]);// First item in C7;

            manager.setActive(15);// Second item in C8;
            expect(manager.activeItem).toBe(items[15]);// Second item in C8;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[15]);// Second item in C8;

            /** Reverted behavior */
            manager.jumpStep = -8

            manager.setActive(56);// Last item in C1;
            expect(manager.activeItem).toBe(items[56]);// Last item in C1;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[56]);// Last item in C1;

            manager.setActive(57);// Last item in C2;
            expect(manager.activeItem).toBe(items[57]);// Last item in C2;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[57]);// Last item in C2;

            manager.setActive(50);// Before last item in C3;
            expect(manager.activeItem).toBe(items[50]);// Before last item in C3;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[50]);// Before last item in C3;

            manager.setActive(51);// Before last item in C4;
            expect(manager.activeItem).toBe(items[51]);// Before last item in C4;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[51]);// Before last item in C4;

            manager.setActive(52);// Last item in C5
            expect(manager.activeItem).toBe(items[52]);// Last item in C5
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[52]);// Last item in C5

            manager.setActive(53);// Last item in C6
            expect(manager.activeItem).toBe(items[53]);// Last item in C6
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[53]);// Last item in C6

            manager.setActive(46);// Before last item in C7
            expect(manager.activeItem).toBe(items[46]);// Before last item in C7
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[46]);// Before last item in C7

            manager.setActive(47);// Before last item in C8
            expect(manager.activeItem).toBe(items[47]);// Before last item in C8
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[47]);// Before last item in C8

            dispose();
        });

        test('_KeyManagerImpl.jumpBackward() should return false if items list is empty.', () => {
            const manager = createManager();

            manager.jumpStep = 1;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = 5;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = -1;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = -5;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('_KeyManagerImpl.jumpBackward() should return false if all items are unavailable.', () => {
            const manager = createManager();
            const items = Array.from({ length: 20 }, (_, i) => new TestItem(i)).map((item) => (item.disabled = true) && item);
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            manager.jumpStep = 1;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = 5;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = -1;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = -5;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('_KeyManagerImpl.jumpBackward() should return false if all items are unavailable without current active one.', () => {
            const manager = createManager();
            const items = Array.from({ length: 20 }, (_, i) => new TestItem(i)).map((item) => (item.disabled = true) && item);
            
            manager.bind(document.createElement('div'));
            items[9].disabled = false;
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(9)
            expect(manager.activeItem).toBe(items[9])
            manager.jumpStep = 1;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[9])
            manager.jumpStep = 5;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[9])
            manager.jumpStep = -1;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[9])
            manager.jumpStep = -5;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(items[9]);
        });

        test('_KeyManagerImpl.jumpBackward() should return false if manager is disposed.', () => {
            const manager = createManager();
            const items = Array.from({ length: 20 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            dispose();
            manager.jumpStep = 1;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = 5;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = -1;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(null);
            manager.jumpStep = -5;
            expect(manager.jumpBackward()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('_KeyMangerImpl.movePageDown() should not set any item and return false if pageUpDown is disabled.', () => {
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.movePageDown()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('_KeyManagerImpl.movePageDown() should jump to the first next available item at or after the current page delta and return true.', () => {
            const manager = createManager((config) => config.withPageUpDown());
            const items = Array.from({ length: 50 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.movePageDown()).toBe(true);
            expect(manager.activeItem).toBe(items[9]);
            expect(manager.movePageDown()).toBe(true);
            expect(manager.activeItem).toBe(items[19]);
            manager.pageUpAndDownDelta = 5;
            expect(manager.movePageDown()).toBe(true);
            expect(manager.activeItem).toBe(items[24]);
            items[29].disabled = true;
            expect(manager.movePageDown()).toBe(true);
            expect(manager.activeItem).toBe(items[30]);
            items[35].disabled = true;
            items[36].disabled = true;
            expect(manager.movePageDown()).toBe(true);
            expect(manager.activeItem).toBe(items[37]);
            items[42].disabled = true;
            items[43].disabled = true;
            items[44].disabled = true;
            expect(manager.movePageDown()).toBe(true);
            expect(manager.activeItem).toBe(items[45]);
        });

        test('_KeyManagerImpl.movePageDown() should jump to the last available item and return true if the page delta exceeds the list bounds.', () => {
            const manager = createManager((config) => config.withPageUpDown(true, 5));
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(6);
            expect(manager.activeItem).toBe(items[6]);
            expect(manager.movePageDown()).toBe(true);
            expect(manager.activeItem).toBe(items[9]);

            items[9].disabled = true;
            items[8].disabled = true;

            manager.setActive(4);
            expect(manager.activeItem).toBe(items[4]);
            expect(manager.movePageDown()).toBe(true);
            expect(manager.activeItem).toBe(items[7]);

            items[7].disabled = true;
            
            manager.setActive(3);
            expect(manager.activeItem).toBe(items[3]);
            expect(manager.movePageDown()).toBe(true);
            expect(manager.activeItem).toBe(items[6]);
        });

        test('_KeyManagerImpl.movePageDown() return false is items list is empty.', () => {
            const manager = createManager((config) => config.withPageUpDown());
            manager.bind(document.createElement('div'));
            expect(manager.movePageDown()).toBe(false);
        });

        test('_KeyManagerImpl.movePageDown() return false if all items are unavailable.', () => {
            const manager = createManager((config) => config.withPageUpDown(true, 5));
            const items = Array.from({ length: 20 }, (_, i) => new TestItem(i)).map((item) => (item.disabled = true) && item);
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.movePageDown()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('_KeyManagerImpl.movePageDown() return false if all items are unavailable without current active one.', () => {
            const manager = createManager((config) => config.withPageUpDown(true, 5));
            const items = Array.from({ length: 20 }, (_, i) => new TestItem(i)).map((item) => (item.disabled = true) && item);
            
            manager.bind(document.createElement('div'));
            items[9].disabled = false;
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(9);
            expect(manager.activeItem).toBe(items[9]);
            expect(manager.movePageDown()).toBe(false);
            expect(manager.activeItem).toBe(items[9]);

            dispose();
        });

        test('_KeyManagerImpl.movePageDown() should do nothing and return false if manager is disposed.', () => {
            const manager = createManager((config) => config.withPageUpDown(true, 5));
            const items = Array.from({ length: 20 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            dispose();
            expect(manager.activeItem).toBe(null);
            expect(manager.movePageDown()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('_KeyManagerImpl.movePageUp() should not set any item and returns false if pageUpDown is disabled.', () => {
            const manager = createManager();
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));

            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }
            manager.setActive(9);
            expect(manager.activeItem).toBe(items[9]);
            expect(manager.movePageUp()).toBe(false);
            expect(manager.activeItem).toBe(items[9]);
        });

        test('_KeyManagerImpl.movePageUp() should jump to the first previous available item at or before the current page delta and return true.', () => {
            const manager = createManager((config) => config.withPageUpDown());
            const items = Array.from({ length: 50 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(49)
            expect(manager.activeItem).toBe(items[49]);
            expect(manager.movePageUp()).toBe(true);
            expect(manager.activeItem).toBe(items[48 - 9]);
            expect(manager.movePageUp()).toBe(true);
            expect(manager.activeItem).toBe(items[48 - 19]);
            manager.pageUpAndDownDelta = 5;
            expect(manager.movePageUp()).toBe(true);
            expect(manager.activeItem).toBe(items[48 - 24]);
            items[48 - 29].disabled = true;
            expect(manager.movePageUp()).toBe(true);
            expect(manager.activeItem).toBe(items[48 - 30]);
            items[48 - 35].disabled = true;
            items[48 - 36].disabled = true;
            expect(manager.movePageUp()).toBe(true);
            expect(manager.activeItem).toBe(items[48 - 37]);
            items[48 - 42].disabled = true;
            items[48 - 43].disabled = true;
            items[48 - 44].disabled = true;
            expect(manager.movePageUp()).toBe(true);
            expect(manager.activeItem).toBe(items[48 - 45]);
        });

        test('_KeyManagerImpl.movePageUp() should jump to the first available item and return true if the page delta exceeds the list bounds.', () => {
            const manager = createManager((config) => config.withPageUpDown(true, 5));
            const items = Array.from({ length: 10 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(2);
            expect(manager.activeItem).toBe(items[2]);
            expect(manager.movePageUp()).toBe(true);
            expect(manager.activeItem).toBe(items[0]);
            
            items[0].disabled = true;
            items[1].disabled = true;

            manager.setActive(5)
            expect(manager.activeItem).toBe(items[5]);
            expect(manager.movePageUp()).toBe(true);
            expect(manager.activeItem).toBe(items[2]);

            items[2].disabled = true;
            
            manager.setActive(6);
            expect(manager.activeItem).toBe(items[6]);
            expect(manager.movePageUp()).toBe(true);
            expect(manager.activeItem).toBe(items[3]);
        });

        test('_KeyManagerImpl.movePageUp() return false is items list is empty.', () => {
            const manager = createManager((config) => config.withPageUpDown(true, 5));
            manager.bind(document.createElement('div'));
            expect(manager.movePageUp()).toBe(false);
        });

        test('_KeyManagerImpl.movePageUp() return false if all items are unavailable.', () => {
            const manager = createManager((config) => config.withPageUpDown(true, 5));
            const items = Array.from({ length: 20 }, (_, i) => new TestItem(i)).map((item) => (item.disabled = true) && item);
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            expect(manager.activeItem).toBe(null);
            expect(manager.movePageUp()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('_KeyManagerImpl.movePageUp() return false if all items are unavailable without current active one.', () => {
            const manager = createManager((config) => config.withPageUpDown(true, 5));
            const items = Array.from({ length: 20 }, (_, i) => new TestItem(i)).map((item) => (item.disabled = true) && item);
            
            manager.bind(document.createElement('div'));
            items[9].disabled = false;

            for (const item of items) {
                manager.addItem(item);
            }

            manager.setActive(9);
            expect(manager.activeItem).toBe(items[9]);
            expect(manager.movePageUp()).toBe(false);
            expect(manager.activeItem).toBe(items[9]);
        });

        test('_KeyManagerImpl.movePageUp() should do nothing and return false if manager is disposed.', () => {
            const manager = createManager((config) => config.withPageUpDown(true, 5));
            const items = Array.from({ length: 20 }, (_, i) => new TestItem(i));
            
            manager.bind(document.createElement('div'));
            for (const item of items) {
                manager.addItem(item);
            }

            dispose();
            expect(manager.activeItem).toBe(null);
            expect(manager.movePageUp()).toBe(false);
            expect(manager.activeItem).toBe(null);
        });

        test('Container\'s event handler should throw an error if the provided keyboard handler does not return a boolean.', () => {
            const log: string[] = []
            const errorMessage = 'KeyManagerBuilder.withKeyboardHandler(): Invalid keyboard handler! The return type must be a boolean.'
            const manager = createManager((config) => config.withKeyboardHandler(() => returnValue));
            const div = document.createElement('div');
            const errorHandler = (e: ErrorEvent) => {
                e.preventDefault()
                log.push(e.message);
            }
            let returnValue: any

            document.body.appendChild(div);
            manager.bind(div);
            window.addEventListener('error', errorHandler);

            returnValue = 0
            expect(log).toEqual([]);
            div.dispatchEvent(new KeyboardEvent('keydown', { key: '', bubbles: true }));
            expect(log).toEqual([ errorMessage ]);
            log.splice(0);
            
            returnValue = 1
            expect(log).toEqual([]);
            div.dispatchEvent(new KeyboardEvent('keydown', { key: '', bubbles: true }));
            expect(log).toEqual([ errorMessage ]);
            log.splice(0);

            returnValue = ''
            expect(log).toEqual([]);
            div.dispatchEvent(new KeyboardEvent('keydown', { key: '', bubbles: true }));
            expect(log).toEqual([ errorMessage ]);
            log.splice(0);

            returnValue = ''
            expect(log).toEqual([]);
            div.dispatchEvent(new KeyboardEvent('keydown', { key: '', bubbles: true }));
            expect(log).toEqual([ errorMessage ]);
            log.splice(0);

            returnValue = undefined
            expect(log).toEqual([]);
            div.dispatchEvent(new KeyboardEvent('keydown', { key: '', bubbles: true }));
            expect(log).toEqual([ errorMessage ]);
            log.splice(0);

            returnValue = Symbol();
            expect(log).toEqual([]);
            div.dispatchEvent(new KeyboardEvent('keydown', { key: '', bubbles: true }));
            expect(log).toEqual([ errorMessage ]);
            log.splice(0);

            returnValue = null
            expect(log).toEqual([]);
            div.dispatchEvent(new KeyboardEvent('keydown', { key: '', bubbles: true }));
            expect(log).toEqual([ errorMessage ]);
            log.splice(0);

            returnValue = {}
            expect(log).toEqual([]);
            div.dispatchEvent(new KeyboardEvent('keydown', { key: '', bubbles: true }));
            expect(log).toEqual([ errorMessage ]);
            log.splice(0);

            returnValue = []
            expect(log).toEqual([]);
            div.dispatchEvent(new KeyboardEvent('keydown', { key: '', bubbles: true }));
            expect(log).toEqual([ errorMessage ]);
            log.splice(0);

            returnValue = () => {};
            expect(log).toEqual([]);
            div.dispatchEvent(new KeyboardEvent('keydown', { key: '', bubbles: true }));
            expect(log).toEqual([ errorMessage ]);
            log.splice(0);

            returnValue = true;
            expect(log).toEqual([]);
            div.dispatchEvent(new KeyboardEvent('keydown', { key: '', bubbles: true }));
            expect(log).toEqual([]);
            log.splice(0);

            returnValue = false;
            expect(log).toEqual([]);
            div.dispatchEvent(new KeyboardEvent('keydown', { key: '', bubbles: true }));
            expect(log).toEqual([]);
            log.splice(0);
        
            window.removeEventListener('error', errorHandler);

        });

        test('Container\'s event handler should throw an error if the provided keyboard handler calls event.preventDefault().', () => {
            const log: string[] = []
            const errorMessage = 
                'KeyManagerBuilder.withKeyboardHandler(): '+
                'Keyboard handler must not call event.preventDefault(). ' +
                'Return true instead to indicate that the event has been handled.';
            const manager = createManager((config) => config.withKeyboardHandler((_, e) => { prevent && e.preventDefault(); return true; }))
            const div = document.createElement('div');
            const errorHandler = (e: ErrorEvent) => {
                e.preventDefault()
                log.push(e.message);
            }
            let prevent = true;

            document.body.appendChild(div);
            manager.bind(div);
            window.addEventListener('error', errorHandler);

            expect(log).toEqual([]);
            div.dispatchEvent(new KeyboardEvent('keydown', { key: '', bubbles: true, cancelable: true }));
            expect(log).toEqual([ errorMessage ]);
            log.splice(0);

            prevent = false;

            expect(log).toEqual([]);
            div.dispatchEvent(new KeyboardEvent('keydown', { key: '', bubbles: true, cancelable: true }));
            expect(log).toEqual([]);


            window.removeEventListener('error', errorHandler);
        });

        test('The keyboardHandler should receive manager instance and event object.', () => {
            const log: any[] = [];
            const div = document.createElement('div');
            const event = new KeyboardEvent('keydown', { key: '', bubbles: true });
            const manager = createManager((config) => config.withKeyboardHandler((m, e) => {
                log.push(m, e);
                return false
            }))

            document.body.appendChild(div);
            manager.bind(div);


            expect(log).toEqual([]);
            div.dispatchEvent(event);
            expect(log).toEqual([ manager, event ]);
        });

        test('The keyboardHandler should not be invoked if event.defaultPrevented is true', () => {
            const log: string[] = [];
            const container = document.createElement('div');
            const child = document.createElement('div');
            const fireEventsWithKeys = (keys: string) => {
                for (const key of keys) {
                    child.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
                }
            }
            const manager = createManager((config) => config.withKeyboardHandler((_, e) => {
                log.push(e.key);
                return true;
            }))
    
            document.body.appendChild(container);
            container.appendChild(child);
            manager.bind(container);
            child.addEventListener('keydown', (e) => { 
                if ([ 'B', 'D', 'F', 'H' ].includes(e.key)) {
                    e.preventDefault();
                } 
            });

            fireEventsWithKeys('ABCDEFGHI')
            expect(log).toEqual([ 'A', 'C', 'E', 'G', 'I' ]);

        });

        test('The keyboardHandler should not be invoked for a forbidden key modifier.', () => {
            const log: string[] = [];
            const container = document.createElement('div');
            const fireEventWithKey = (
                key: string, 
                modifier?: { ctrlKey?: boolean, altKey?: boolean, metaKey?: boolean, shiftKey?: boolean }
            ) => {
                container.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...(modifier || {}) }));
            }
            const manager = createManager((config) => config.withKeyboardHandler((_, e) => {
                log.push(e.key);
                return true;
            }))
            document.body.appendChild(container);
            manager.bind(container);

            fireEventWithKey('A');
            fireEventWithKey('B', { ctrlKey: true });
            fireEventWithKey('C');
            fireEventWithKey('D', { shiftKey: true });
            fireEventWithKey('E');
            fireEventWithKey('F', { metaKey: true });
            fireEventWithKey('G');
            fireEventWithKey('H', { altKey: true });
            fireEventWithKey('I');

            expect(log).toEqual([ 'A', 'C', 'E', 'G', 'I'  ]);

        });

        test('The keyboardHandler should be invoked for key modifier if that key has been enabled in builder configuration.', () => {
            const log: string[] = [];
            const container = document.createElement('div');
            const fireEventWithKey = (
                key: string, 
                modifier?: { ctrlKey?: boolean, altKey?: boolean, metaKey?: boolean, shiftKey?: boolean }
            ) => {
                container.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...(modifier || {}) }));
            };
            const fireKeyboardEvents = () => {
                fireEventWithKey('A', { ctrlKey: true });
                fireEventWithKey('B', { altKey: true });
                fireEventWithKey('C', { metaKey: true });
                fireEventWithKey('D', { shiftKey: true });
            };
            let manager: _KeyManagerImpl;

            document.body.appendChild(container);

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: true }).withKeyboardHandler((_, e) => {
                log.push(e.key);
                return true;
            }));
            manager.bind(container);

            fireKeyboardEvents();
            expect(log).toEqual([ 'A' ]);
            log.splice(0);
            dispose();

            manager = createManager((config) => config.withAllowedModifierKeys({ altKey: true }).withKeyboardHandler((_, e) => {
                log.push(e.key);
                return true;
            }));
            manager.bind(container);

            fireKeyboardEvents();
            expect(log).toEqual([ 'B' ]);
            log.splice(0);
            dispose();

            manager = createManager((config) => config.withAllowedModifierKeys({ metaKey: true }).withKeyboardHandler((_, e) => {
                log.push(e.key);
                return true;
            }));
            manager.bind(container);

            fireKeyboardEvents();
            expect(log).toEqual([ 'C' ]);
            log.splice(0);
            dispose();

            manager = createManager((config) => config.withAllowedModifierKeys({ shiftKey: true }).withKeyboardHandler((_, e) => {
                log.push(e.key);
                return true;
            }));
            manager.bind(container);

            fireKeyboardEvents();
            expect(log).toEqual([ 'D' ]);
            log.splice(0);
            dispose();

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: true, altKey: true }).withKeyboardHandler((_, e) => {
                log.push(e.key);
                return true;
            }));
            manager.bind(container);

            fireKeyboardEvents();
            expect(log).toEqual([ 'A', 'B' ]);
            log.splice(0);
            dispose();

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: true, altKey: true, metaKey: true }).withKeyboardHandler((_, e) => {
                log.push(e.key);
                return true;
            }));
            manager.bind(container);

            fireKeyboardEvents();
            expect(log).toEqual([ 'A', 'B', 'C' ]);
            log.splice(0);
            dispose();

            manager = createManager((config) => config.withAllowedModifierKeys({ ctrlKey: true, altKey: true, metaKey: true, shiftKey: true }).withKeyboardHandler((_, e) => {
                log.push(e.key);
                return true;
            }));
            manager.bind(container);

            fireKeyboardEvents();
            expect(log).toEqual([ 'A', 'B', 'C', 'D' ]);
            log.splice(0);
            dispose();
        });

    });

    describe('Typeahead', () => {
        
        let container: HTMLElement = null!;

        function fireEventWithKey(key: string): void {
            container!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        }

        function fireEventsWithWord(word: string): void {
            for (const key of word) {
                fireEventWithKey(key)
            }
        }

        function createBoundManager(setupFn?: (config: Omit<KeyManagerBuilder, 'build'>) => void): _KeyManagerImpl {
            const manager = createManager(setupFn);
            manager.bind(container!);
            return manager;
        }

        beforeEach(() => {
            container = document.createElement('div');
            document.body.appendChild(container);
            vitest.useFakeTimers();
        });

        afterEach(() => {
            dispose();
            if (vitest.getTimerCount()) {
                throw new Error('There are still pending timers');
            }
            vitest.useRealTimers();
            container = null!;
        });

        const oneWordLabels = [
            'Apple', 'Apricot', 'Avocado', 'Banana', 'Blackberry', 'Blueberry', 'Cherry', 'Coconut', 'Date', 'Fig',
            'Grape', 'Kiwi', 'Lemon', 'Lime', 'Mango', 'Melon', 'Orange', 'Papaya', 'Peach', 'Pear', 'Pineapple',
            'Plum', 'Raspberry', 'Strawberry', 'Watermelon'
        ];

        const twoWordsLabels = [
            'Red Apple', 'Green Apple', 'Golden Apple', 'Sweet Cherry', 'Black Cherry', 'Fresh Mango', 'Yellow Banana',
            'Purple Grape', 'Pink Peach', 'Juicy Orange', 'Wild Berry', 'Blue Berry', 'Fresh Lemon', 'Green Lime', 'Red Plum'
        ];

        const threeWordsLabels = [
            'Fresh Red Apple', 'Sweet Green Apple', 'Large Yellow Banana', 'Fresh Black Cherry', 'Juicy Pink Peach', 'Fresh Purple Grape',
            'Sweet Orange Juice', 'Wild Forest Berry', 'Fresh Coconut Water', 'Ripe Golden Mango'
        ];

        const sharedPrefixedWords_App = [
            'App', 'Apple', 'Application', 'Apply'
        ];

        const sharedPrefixedWords_Car = [
            'Car', 'Card', 'Care', 'Cargo', 'Cart'
        ];

        const sharedPrefixedWords_Cat = [
            'Cat', 'Catch', 'Category', 'Caterpillar'
        ];

        it('Should throw an error if the reducer does not return a string.', () => {
            const log: string[] = [];
            const errorMessage = 'ListKeyManager.withTypeAhead(): Invalid reducer return type! Expected a string.';
            const errorHandler = (e: ErrorEvent) => {
                e.preventDefault();
                log.push(e.message);
            };
            const assertErrorMessage = () => {
                expect(log).toEqual([ errorMessage ]);
                log.splice(0);
            };
            const assertNoErrorMessage = () => {
                expect(log).toEqual([]);
            };
            const assertNoTimers = () => {
                expect(vitest.getTimerCount()).toBe(0);
            };
            const assertOneTimer = () => {
                expect(vitest.getTimerCount()).toBe(1);
            };
            const manager = createBoundManager((config) => config.withTypeAhead({
                reducer: () => returnValue
            }))

            let returnValue: any;
            

            manager.addItem(new TestItem(0, 'Foo'));
            window.addEventListener('error', errorHandler);

            expect(manager._typeahead).toBeTypeOf('object');

            returnValue = 0;
            fireEventWithKey('A');
            assertErrorMessage();
            assertNoTimers();

            returnValue = 1;
            fireEventWithKey('A');
            assertErrorMessage();
            assertNoTimers();

            returnValue = true;
            fireEventWithKey('A');
            assertErrorMessage();
            assertNoTimers();

            returnValue = false;
            fireEventWithKey('A');
            assertErrorMessage();
            assertNoTimers();

            returnValue = null;
            fireEventWithKey('A');
            assertErrorMessage();
            assertNoTimers();

            returnValue = undefined;
            fireEventWithKey('A');
            assertErrorMessage();
            assertNoTimers();

            returnValue = {};
            fireEventWithKey('A');
            assertErrorMessage();
            assertNoTimers();

            returnValue = [];
            fireEventWithKey('A');
            assertErrorMessage();
            assertNoTimers();

            returnValue = () => {};
            fireEventWithKey('A');
            assertErrorMessage();
            assertNoTimers();

            returnValue = '';
            fireEventWithKey('A');
            assertNoErrorMessage();
            assertNoTimers();

            returnValue = 'A';
            fireEventWithKey('A');
            assertNoErrorMessage();
            assertOneTimer();

            window.removeEventListener('error', errorHandler);
        });

        it('Should debounce if reducer returns new buffer.', () => {
            const log: string[] = [];
            const manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => {
                    log.push(buffer);
                    return buffer + key
                }
            }));
            using timeoutSpy = vitest.spyOn(window, 'setTimeout');
            using clearTimeoutSpy = vitest.spyOn(window, 'clearTimeout');

            manager.addItem(new TestItem(0, 'Foo'));

            fireEventWithKey('A');
            expect(timeoutSpy).toHaveBeenCalledTimes(1);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(log).toEqual([ '' ]);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('A');

            fireEventWithKey('B');
            expect(timeoutSpy).toHaveBeenCalledTimes(2);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
            expect(log).toEqual([ '', 'A' ]);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('AB');

            fireEventWithKey('C');
            expect(timeoutSpy).toHaveBeenCalledTimes(3);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
            expect(log).toEqual([ '', 'A', 'AB' ]);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('ABC');

            fireEventWithKey('D');
            expect(timeoutSpy).toHaveBeenCalledTimes(4);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(3);
            expect(log).toEqual([ '', 'A', 'AB', 'ABC' ]);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('ABCD');

            fireEventWithKey('E');
            expect(timeoutSpy).toHaveBeenCalledTimes(5);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(4);
            expect(log).toEqual([ '', 'A', 'AB', 'ABC', 'ABCD' ]);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('ABCDE');

            fireEventWithKey('F');
            expect(timeoutSpy).toHaveBeenCalledTimes(6);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(5);
            expect(log).toEqual([ '', 'A', 'AB', 'ABC', 'ABCD', 'ABCDE' ]);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('ABCDEF');
        });

        it('Should not debounce if reducer returns unchanged state.', () => {
            const log: string[] = [];
            const manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => {
                    log.push(buffer);
                    return key > 'C' ? buffer : buffer + key
                }
            }));
            using timeoutSpy = vitest.spyOn(window, 'setTimeout');
            using clearTimeoutSpy = vitest.spyOn(window, 'clearTimeout');

            manager.addItem(new TestItem(0, 'Foo'));

            fireEventWithKey('A');
            expect(timeoutSpy).toHaveBeenCalledTimes(1);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(log).toEqual([ '' ]);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('A');

            fireEventWithKey('B');
            expect(timeoutSpy).toHaveBeenCalledTimes(2);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
            expect(log).toEqual([ '', 'A' ]);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('AB');

            fireEventWithKey('C');
            expect(timeoutSpy).toHaveBeenCalledTimes(3);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
            expect(log).toEqual([ '', 'A', 'AB' ]);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('ABC');

            fireEventWithKey('D');
            expect(timeoutSpy).toHaveBeenCalledTimes(3);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
            expect(log).toEqual([ '', 'A', 'AB', 'ABC' ]);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('ABC');

            fireEventWithKey('E');
            expect(timeoutSpy).toHaveBeenCalledTimes(3);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
            expect(log).toEqual([ '', 'A', 'AB', 'ABC', 'ABC' ]);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('ABC');

            fireEventWithKey('F');
            expect(timeoutSpy).toHaveBeenCalledTimes(3);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
            expect(log).toEqual([ '', 'A', 'AB', 'ABC', 'ABC', 'ABC' ]);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('ABC');
        });

        it('Should not schedule and typing should be false if reducer returns an empty string.', () => {
            const log: string[] = [];
            const manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (_, key) => {
                    log.push(key)
                    return '';
                }
            }))
            using timeoutSpy = vitest.spyOn(window, 'setTimeout');
            using clearTimeoutSpy = vitest.spyOn(window, 'clearTimeout');

            manager.addItem(new TestItem(0, 'Foo'));

            fireEventWithKey('A');
            expect(timeoutSpy).toHaveBeenCalledTimes(0);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(log).toEqual([ 'A' ]);
            expect(manager.typing).toBe(false);

            fireEventWithKey('B');
            expect(timeoutSpy).toHaveBeenCalledTimes(0);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(log).toEqual([ 'A', 'B' ]);
            expect(manager.typing).toBe(false);

            fireEventWithKey('C');
            expect(timeoutSpy).toHaveBeenCalledTimes(0);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(log).toEqual([ 'A', 'B', 'C' ]);
            expect(manager.typing).toBe(false);
        });

        it('Should clear buffer, typing set to false and cancel timer if reducer returns an empty string for not empty buffer.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => key > 'A' ? '' : buffer + key
            }));
            using timeoutSpy = vitest.spyOn(window, 'setTimeout');
            using clearTimeoutSpy = vitest.spyOn(window, 'clearTimeout');

            manager.addItem(new TestItem(0, 'Foo'));

            fireEventWithKey('A');
            expect(timeoutSpy).toHaveBeenCalledTimes(1);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('A');

            fireEventWithKey('B');
            expect(timeoutSpy).toHaveBeenCalledTimes(1);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
            expect(manager.typing).toBe(false);
            expect(manager.typeAheadBuffer).toBe('');
        });

        it('Should not trigger typeahead if the key manager item list is empty.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => buffer + key
            }));
            using timeoutSpy = vitest.spyOn(window, 'setTimeout');
            using clearTimeoutSpy = vitest.spyOn(window, 'clearTimeout');

            fireEventWithKey('A');
            expect(timeoutSpy).toHaveBeenCalledTimes(0);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(manager.typing).toBe(false);
            expect(manager.typeAheadBuffer).toBe('');

            fireEventWithKey('B');
            expect(timeoutSpy).toHaveBeenCalledTimes(0);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(manager.typing).toBe(false);
            expect(manager.typeAheadBuffer).toBe('');

            fireEventWithKey('C');
            expect(timeoutSpy).toHaveBeenCalledTimes(0);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(manager.typing).toBe(false);
            expect(manager.typeAheadBuffer).toBe('');
        });

        it('Should reset typeahead when last key manager item is removed.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => buffer + key
            }));
            const item = new TestItem(0, '');
            using timeoutSpy = vitest.spyOn(window, 'setTimeout');
            using clearTimeoutSpy = vitest.spyOn(window, 'clearTimeout');
            
            manager.addItem(item);

            fireEventWithKey('A');
            expect(timeoutSpy).toHaveBeenCalledTimes(1);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('A');

            fireEventWithKey('B');
            expect(timeoutSpy).toHaveBeenCalledTimes(2);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('AB');

            fireEventWithKey('C');
            expect(timeoutSpy).toHaveBeenCalledTimes(3);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('ABC');

            manager.removeItem(item);
            expect(timeoutSpy).toHaveBeenCalledTimes(3);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(3);
            expect(manager.typing).toBe(false);
            expect(manager.typeAheadBuffer).toBe('');
        });

        test('_KeyManagerImpl.cancelTypeahead() should reset typeahead.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => buffer + key
            }));
            using timeoutSpy = vitest.spyOn(window, 'setTimeout');
            using clearTimeoutSpy = vitest.spyOn(window, 'clearTimeout');
            
            manager.addItem(new TestItem(0, 'Foo'));

            fireEventWithKey('A');
            expect(timeoutSpy).toHaveBeenCalledTimes(1);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('A');

            manager.cancelTypeahead();

            expect(timeoutSpy).toHaveBeenCalledTimes(1);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
            expect(manager.typing).toBe(false);
            expect(manager.typeAheadBuffer).toBe('');
        });

        it('Should not reset typeahead when an item is removed and the key manager is not empty.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead());
            const item1 = new TestItem(0, 'Foo');
            const item2 = new TestItem(1, 'Baz');
            using timeoutSpy = vitest.spyOn(window, 'setTimeout');
            using clearTimeoutSpy = vitest.spyOn(window, 'clearTimeout');

            manager.addItem(item1);
            manager.addItem(item2);

            fireEventWithKey('A');
            expect(timeoutSpy).toHaveBeenCalledTimes(1);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('A');
            manager.removeItem(item1);
            expect(timeoutSpy).toHaveBeenCalledTimes(1);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('A');
            manager.removeItem(item2);
            expect(timeoutSpy).toHaveBeenCalledTimes(1);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
            expect(manager.typing).toBe(false);
            expect(manager.typeAheadBuffer).toBe('');
        });

        it('Should update itemsCount to zero, typeAheadBuffer to empty string and typing to false in the same batch when the last item has been removed from manager.', () => {
            const log: any[] = [];
            const manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => buffer + key
            }));
            const item = new TestItem(0, 'Foo');

            manager.addItem(item);

            fireEventWithKey('A');

            runWithOwner(owner, () => {
                createEffect(() => {
                    const count = manager.itemsCount;
                    const buffer = manager.typeAheadBuffer;
                    const typing = manager.typing;
                    if (typing) { return; }
                    log.push(count, buffer, typing);
                });
            });

            expect(log).toEqual([]);
            manager.removeItem(item);
            expect(log).toEqual([ 0, '', false ]);
        });

        it('Should reset typeahead and invoke onActiveItemRemoved listeners in the same batch when the last item has been removed form key manager and that item was active.', () => {
            const log: any[] = [];
            const [onRemove, setOnRemove] = createSignal<string>();
            const item = new TestItem(0, 'Foo');
            const manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => buffer + key
            }));

            manager.addItem(item);
            manager.setActive(0);
            manager.onActiveItemRemoved(() => setOnRemove('ON_REMOVE'));

            fireEventWithKey('A');

            subscribeEffect(() => {
                const count = manager.itemsCount;
                const buffer = manager.typeAheadBuffer;
                const typing = manager.typing;
                const remove = onRemove();
                if (typing) { return; }
                log.push(count, buffer, typing, remove);
            })

            expect(log).toEqual([]);
            manager.removeItem(item);
            expect(log).toEqual([ 0, '', false, 'ON_REMOVE' ]);
        });

        it('Should reset typeahead when the owning context is disposed.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => buffer + key
            }));

            using timeoutSpy = vitest.spyOn(window, 'setTimeout');
            using clearTimeoutSpy = vitest.spyOn(window, 'clearTimeout');

            manager.addItem(new TestItem(0, 'Foo'));

            fireEventWithKey('A');
            expect(timeoutSpy).toHaveBeenCalledTimes(1);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(manager.typeAheadBuffer).toBe('A');
            expect(manager.typing).toBe(true);

            dispose();
            expect(timeoutSpy).toHaveBeenCalledTimes(1);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
            expect(manager.typeAheadBuffer).toBe('');
            expect(manager.typing).toBe(false);
        });

        it('Should schedule with provided interval.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => buffer + key,
                debounceInterval: 20
            }));
            manager.addItem(new TestItem(0, 'Foo'));

            expect(manager._typeahead!.interval).toBe(20)

            using timeoutSpy = vitest.spyOn(window, 'setTimeout');
            using clearTimeoutSpy = vitest.spyOn(window, 'clearTimeout');

            fireEventWithKey('A');
            expect(timeoutSpy).toHaveBeenCalledTimes(1);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('A');

            vitest.advanceTimersByTime(10);
            expect(manager.typing).toBe(true);
            expect(manager.typeAheadBuffer).toBe('A');

            vitest.advanceTimersByTime(10);
            expect(timeoutSpy).toHaveBeenCalledTimes(1);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(manager.typing).toBe(false);
            expect(manager.typeAheadBuffer).toBe('');
        });

        test('The default typeahead interval should be 200.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead());
            expect(manager._typeahead!.interval).toBe(200);
        });

        test('Default reducer should accept range from A to z and from 0 to 9.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead());
            manager.addItem(new TestItem(0, 'Foo'));

            for (let i = 32; i < 127; i++) {
                fireEventWithKey(String.fromCharCode(i));
            }

            expect(manager.typeAheadBuffer.length).toBe(68);

            for(const key of manager.typeAheadBuffer) {
                expect((key >= 'A' && key <= 'z') || (key >= '0' && key <= '9')).toBe(true);
            }
        });

        it('Should set the active item whose label is prefixed by the aggregated buffer.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead());

            let i = 0;
            for (const label of oneWordLabels) {
                manager.addItem(new TestItem(i++, label));
            }

            fireEventsWithWord('Coc');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Coconut');

            fireEventsWithWord('Avo');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Avocado');

            fireEventsWithWord('Pin');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Pineapple');

            fireEventsWithWord('Wate');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Watermelon');

            fireEventsWithWord('Ras');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Raspberry');
        });

        it('Should be case insensitive be default.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead());

            let i = 0;
            for (const label of oneWordLabels) {
                manager.addItem(new TestItem(i++, label));
            }

            fireEventsWithWord('cOConUt');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Coconut');

            fireEventsWithWord('AvOcADO');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Avocado');

            fireEventsWithWord('PINEAPPLE');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Pineapple');

            fireEventsWithWord('WaTeRmeLon');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Watermelon');

            fireEventsWithWord('rASPBERRY');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Raspberry');
        });

        it('Should be case sensitive if enabled in the configuration.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead({ caseSensitive: true }));

            let i = 0;
            for (const label of oneWordLabels) {
                manager.addItem(new TestItem(i++, label));
            }

            fireEventsWithWord('cOConUt');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('AvOcADO');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('PINEAPPLE');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('WaTeRmeLon');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('rASPBERRY');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);
        });

        it('Should set the active item to the first match.', () => {
            const labels: string[] = [
                ...sharedPrefixedWords_App.slice().reverse(),
                ...sharedPrefixedWords_Car.slice().reverse(),
                ...sharedPrefixedWords_Cat.slice().reverse(),
            ];
            const manager = createBoundManager((config) => config.withTypeAhead());

            let i = 0;
            for (const label of labels) {
                manager.addItem(new TestItem(i++, label));
            }

            fireEventsWithWord('App');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Apply')

            fireEventsWithWord('Appli');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Application');

            fireEventsWithWord('Apple');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Apple');

            fireEventsWithWord('Car');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Cart');

            fireEventsWithWord('Carg');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Cargo');

            fireEventsWithWord('Cat');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Caterpillar');

            fireEventsWithWord('Categ');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Category');

            fireEventsWithWord('Catc');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Catch');
        });

        it('Should match only the beginning of the label when eachWordAsPrefix is disabled.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => buffer + key 
            }));

            let i = 0
            for (const label of twoWordsLabels) {
                manager.addItem(new TestItem(i++, label));
            }

            expect(manager._typeahead!.eachWordAsPrefix).toBe(false);

            fireEventsWithWord('Swe Cher');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('Yel Ba');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('Fr Le');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('Gol Ap');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('Re Ap');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);
        });

        it('Should match each word as an independent prefix when eachWordAsPrefix is enabled.', () => {
            let manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => buffer + key,
                eachWordAsPrefix: true
            }));

            let i = 0
            for (const label of twoWordsLabels) {
                manager.addItem(new TestItem(i++, label));
            }

            expect(manager._typeahead!.eachWordAsPrefix).toBe(true);

            fireEventsWithWord('Swe Cher');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Sweet Cherry');

            fireEventsWithWord('   Yel      Ba');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Yellow Banana');

            fireEventsWithWord('Fre Le    ');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Fresh Lemon');

            fireEventsWithWord('Gol    Ap    ');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Golden Apple');

            fireEventsWithWord('   Re Ap');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Red Apple');
    
            dispose();

            manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => buffer + key,
                eachWordAsPrefix: true
            }));

            for (const label of threeWordsLabels) {
                manager.addItem(new TestItem(i++, label));
            }

            fireEventsWithWord('   Jui   Pea');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Juicy Pink Peach');

            fireEventsWithWord('Lar       Ban    ');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Large Yellow Banana');

            fireEventsWithWord('Swe     Gree  ');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Sweet Green Apple');


            fireEventsWithWord(' Fre    Coc    Wa  ');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Fresh Coconut Water');
        });

        it('Should not match labels whose word order differs from the search buffer.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => buffer + key,
                eachWordAsPrefix: true
            }));

            let i = 0
            for (const label of twoWordsLabels) {
                manager.addItem(new TestItem(i++, label));
            }

            fireEventsWithWord('Cher Swe');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('Ba Yel');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('Le Fre');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('Ap Gol');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('Ap Re');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);
        });

        it('Should match each word prefix in a case-insensitive manner when eachWordAsPrefix is enabled.', () => {
            let manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => buffer + key,
                eachWordAsPrefix: true
            }));

            let i = 0
            for (const label of twoWordsLabels) {
                manager.addItem(new TestItem(i++, label));
            }

            fireEventsWithWord('sWE chER');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Sweet Cherry');

            fireEventsWithWord('   yEL      bA');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Yellow Banana');

            fireEventsWithWord('fRE lE    ');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Fresh Lemon');

            fireEventsWithWord('gOL    aP    ');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Golden Apple');

            fireEventsWithWord('   rE aP');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Red Apple');
    
            dispose();

            manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => buffer + key,
                eachWordAsPrefix: true
            }));

            for (const label of threeWordsLabels) {
                manager.addItem(new TestItem(i++, label));
            }

            fireEventsWithWord('   jUI   pEA');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Juicy Pink Peach');

            fireEventsWithWord('lAR       bAN    ');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Large Yellow Banana');

            fireEventsWithWord('sWE     gREE  ');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Sweet Green Apple');


            fireEventsWithWord(' fRE    cOC    wA  ');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem!.label).toBe('Fresh Coconut Water');
        });

        it('Should match each word prefix in a case-sensitive manner when eachWordAsPrefix is enabled.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead({
                reducer: (buffer, key) => buffer + key,
                eachWordAsPrefix: true,
                caseSensitive: true
            }));

            let i = 0
            for (const label of twoWordsLabels) {
                manager.addItem(new TestItem(i++, label));
            }

            fireEventsWithWord('sWE chER');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('yEL bA');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('fRE lE');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('gOL aP');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            fireEventsWithWord('rE aP');
            vitest.advanceTimersToNextTimer();
            expect(manager.activeItem).toBe(null);

            dispose();
        });

        it('Should not trigger typeahead if the event\'s default action has been prevented.', () => {
            const manager = createBoundManager((config) => config.withTypeAhead());

            container.addEventListener('keydown', (e) => {
                if ([ 'A', 'C', 'E', 'G' ].includes(e.key)) {
                    e.preventDefault();
                }
            });
            manager.addItem(new TestItem(0, 'Foo'));

            fireEventsWithWord('ABCDEFGH');
            expect(manager.typeAheadBuffer).toBe('BDFH');
        });

        it('Should reset typeahead if the keyboardHandler will return true.', () => {
            const manager = createBoundManager((config) => {
                config
                    .withTypeAhead()
                    .withKeyboardHandler((_, e) => e.key > 'C');
            });
            using timeoutSpy = vitest.spyOn(window, 'setTimeout');
            using clearTimeoutSpy = vitest.spyOn(window, 'clearTimeout');

            manager.addItem(new TestItem(0, 'Foo'));

            fireEventsWithWord('ABC');
            expect(timeoutSpy).toHaveBeenCalledTimes(3);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
            expect(manager.typeAheadBuffer).toBe('ABC');
            expect(manager.typing).toBe(true);

            fireEventWithKey('D');
            expect(timeoutSpy).toHaveBeenCalledTimes(3);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(3);
            expect(manager.typeAheadBuffer).toBe('');
            expect(manager.typing).toBe(false);
        });

        it('Should not trigger typeahead if the keyboardHandler returns.', () => {
            const manager = createBoundManager((config) => {
                config
                    .withTypeAhead()
                    .withKeyboardHandler(() => true);
            });
            using timeoutSpy = vitest.spyOn(window, 'setTimeout');
            using clearTimeoutSpy = vitest.spyOn(window, 'clearTimeout');

            fireEventsWithWord('ABC');
            expect(timeoutSpy).toHaveBeenCalledTimes(0);
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
            expect(manager.typeAheadBuffer).toBe('');
            expect(manager.typing).toBe(false);
        });

    });

    describe('verticalOrientationKeyboardHandler()', () => {
        let container: HTMLElement = null!;

        function fireEventWithKey(key: string): void {
            container!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        }

        function createBoundManager(setupFn?: (config: Omit<KeyManagerBuilder, 'build'>) => void): _KeyManagerImpl {
            const manager = createManager(setupFn);
            manager.bind(container!);
            return manager;
        }

        beforeEach(() => {
            container = document.createElement('div');
            document.body.appendChild(container);
        });

        it('Should invoke _KeyMangerImpl.setNextItemActive() when arrow down is pressed.', () => {
            const manager = createBoundManager();
            using spy = vitest.spyOn(manager, 'setNextItemActive');

            expect(manager._keyboardHandler).toBe(verticalOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('ArrowDown');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.setPreviousItemActive() when arrow up is pressed.', () => {
            const manager = createBoundManager();
            using spy = vitest.spyOn(manager, 'setPreviousItemActive');

            expect(manager._keyboardHandler).toBe(verticalOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('ArrowUp');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.jumpForward() when arrow right is pressed.', () => {
            const manager = createBoundManager();
            using spy = vitest.spyOn(manager, 'jumpForward');

            expect(manager._keyboardHandler).toBe(verticalOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('ArrowRight');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.jumpBackward() when arrow left is pressed.', () => {
            const manager = createBoundManager();
            using spy = vitest.spyOn(manager, 'jumpBackward');

            expect(manager._keyboardHandler).toBe(verticalOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('ArrowLeft');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.movePageDown() when page down button is pressed.', () => {
            const manager = createBoundManager();
            using spy = vitest.spyOn(manager, 'movePageDown');

            expect(manager._keyboardHandler).toBe(verticalOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('PageDown');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.movePageUp() when page down button is pressed.', () => {
            const manager = createBoundManager();
            using spy = vitest.spyOn(manager, 'movePageUp');

            expect(manager._keyboardHandler).toBe(verticalOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('PageUp');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.setFirstItemActive() when home button is pressed.', () => {
            const manager = createBoundManager();
            using spy = vitest.spyOn(manager, 'setFirstItemActive');

            expect(manager._keyboardHandler).toBe(verticalOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('Home');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.setFirstItemActive() when end button is pressed.', () => {
            const manager = createBoundManager();
            using spy = vitest.spyOn(manager, 'setLastItemActive');

            expect(manager._keyboardHandler).toBe(verticalOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('End');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyManagerImpl.cancelTypeahead() when Escape button is pressed and typing is true.', () => {
            const manager = createBoundManager();
            using typingSpy = vitest.spyOn(manager, 'typing', 'get').mockReturnValue(true);
            using cancelSpy = vitest.spyOn(manager, 'cancelTypeahead')

            expect(manager._keyboardHandler).toBe(verticalOrientationKeyboardHandler);
            expect(cancelSpy).toHaveBeenCalledTimes(0);
            fireEventWithKey('Escape');
            expect(cancelSpy).toHaveBeenCalledTimes(1);
        });

        it('Should not invoke _KeyManagerImpl.cancelTypeahead() when Escape button is pressed and typing is false.', () => {
            const manager = createBoundManager();
            using typingSpy = vitest.spyOn(manager, 'typing', 'get').mockReturnValue(false);
            using cancelSpy = vitest.spyOn(manager, 'cancelTypeahead')

            expect(manager._keyboardHandler).toBe(verticalOrientationKeyboardHandler);
            expect(cancelSpy).toHaveBeenCalledTimes(0);
            fireEventWithKey('Escape');
            expect(cancelSpy).toHaveBeenCalledTimes(0);
        });
    });

    describe('horizontalLtrOrientationKeyboardHandler()', () => {
        let container: HTMLElement = null!;

        function fireEventWithKey(key: string): void {
            container!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        }

        function createBoundManager(setupFn?: (config: Omit<KeyManagerBuilder, 'build'>) => void): _KeyManagerImpl {
            const manager = createManager(setupFn);
            manager.bind(container!);
            return manager;
        }

        beforeEach(() => {
            container = document.createElement('div');
            document.body.appendChild(container);
        });

        it('Should invoke _KeyMangerImpl.setNextItemActive() when arrow right is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('ltr'));
            using spy = vitest.spyOn(manager, 'setNextItemActive');

            expect(manager._keyboardHandler).toBe(horizontalLtrOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('ArrowRight');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.setPreviousItemActive() when arrow left is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('ltr'));
            using spy = vitest.spyOn(manager, 'setPreviousItemActive');

            expect(manager._keyboardHandler).toBe(horizontalLtrOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('ArrowLeft');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.jumpForward() when arrow down is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('ltr'));
            using spy = vitest.spyOn(manager, 'jumpForward');

            expect(manager._keyboardHandler).toBe(horizontalLtrOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('ArrowDown');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.jumpBackward() when arrow up is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('ltr'));
            using spy = vitest.spyOn(manager, 'jumpBackward');

            expect(manager._keyboardHandler).toBe(horizontalLtrOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('ArrowUp');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.movePageDown() when page down button is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('ltr'));
            using spy = vitest.spyOn(manager, 'movePageDown');

            expect(manager._keyboardHandler).toBe(horizontalLtrOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('PageDown');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.movePageUp() when page down button is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('ltr'));
            using spy = vitest.spyOn(manager, 'movePageUp');

            expect(manager._keyboardHandler).toBe(horizontalLtrOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('PageUp');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.setFirstItemActive() when home button is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('ltr'));
            using spy = vitest.spyOn(manager, 'setFirstItemActive');

            expect(manager._keyboardHandler).toBe(horizontalLtrOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('Home');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.setFirstItemActive() when end button is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('ltr'));
            using spy = vitest.spyOn(manager, 'setLastItemActive');

            expect(manager._keyboardHandler).toBe(horizontalLtrOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('End');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyManagerImpl.cancelTypeahead() when Escape button is pressed and typing is true.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('ltr'));
            using typingSpy = vitest.spyOn(manager, 'typing', 'get').mockReturnValue(true);
            using cancelSpy = vitest.spyOn(manager, 'cancelTypeahead')

            expect(manager._keyboardHandler).toBe(horizontalLtrOrientationKeyboardHandler);
            expect(cancelSpy).toHaveBeenCalledTimes(0);
            fireEventWithKey('Escape');
            expect(cancelSpy).toHaveBeenCalledTimes(1);
        });

        it('Should not invoke _KeyManagerImpl.cancelTypeahead() when Escape button is pressed and typing is false.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('ltr'));
            using typingSpy = vitest.spyOn(manager, 'typing', 'get').mockReturnValue(false);
            using cancelSpy = vitest.spyOn(manager, 'cancelTypeahead')

            expect(manager._keyboardHandler).toBe(horizontalLtrOrientationKeyboardHandler);
            expect(cancelSpy).toHaveBeenCalledTimes(0);
            fireEventWithKey('Escape');
            expect(cancelSpy).toHaveBeenCalledTimes(0);
        });
    });

    describe('horizontalRtlOrientationKeyboardHandler()', () => {
        let container: HTMLElement = null!;

        function fireEventWithKey(key: string): void {
            container!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        }

        function createBoundManager(setupFn?: (config: Omit<KeyManagerBuilder, 'build'>) => void): _KeyManagerImpl {
            const manager = createManager(setupFn);
            manager.bind(container!);
            return manager;
        }

        beforeEach(() => {
            container = document.createElement('div');
            document.body.appendChild(container);
        });

        it('Should invoke _KeyMangerImpl.setNextItemActive() when arrow left is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('rtl'));
            using spy = vitest.spyOn(manager, 'setNextItemActive');

            expect(manager._keyboardHandler).toBe(horizontalRtlOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('ArrowLeft');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.setPreviousItemActive() when arrow right is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('rtl'));
            using spy = vitest.spyOn(manager, 'setPreviousItemActive');

            expect(manager._keyboardHandler).toBe(horizontalRtlOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('ArrowRight');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.jumpForward() when arrow down is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('rtl'));
            using spy = vitest.spyOn(manager, 'jumpForward');

            expect(manager._keyboardHandler).toBe(horizontalRtlOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('ArrowDown');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.jumpBackward() when arrow up is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('rtl'));
            using spy = vitest.spyOn(manager, 'jumpBackward');

            expect(manager._keyboardHandler).toBe(horizontalRtlOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('ArrowUp');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.movePageDown() when page down button is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('rtl'));
            using spy = vitest.spyOn(manager, 'movePageDown');

            expect(manager._keyboardHandler).toBe(horizontalRtlOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('PageDown');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.movePageUp() when page down button is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('rtl'));
            using spy = vitest.spyOn(manager, 'movePageUp');

            expect(manager._keyboardHandler).toBe(horizontalRtlOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('PageUp');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.setFirstItemActive() when home button is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('rtl'));
            using spy = vitest.spyOn(manager, 'setFirstItemActive');

            expect(manager._keyboardHandler).toBe(horizontalRtlOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('Home');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyMangerImpl.setFirstItemActive() when end button is pressed.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('rtl'));
            using spy = vitest.spyOn(manager, 'setLastItemActive');

            expect(manager._keyboardHandler).toBe(horizontalRtlOrientationKeyboardHandler);
            expect(spy).toHaveBeenCalledTimes(0);
            fireEventWithKey('End');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Should invoke _KeyManagerImpl.cancelTypeahead() when Escape button is pressed and typing is true.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('rtl'));
            using typingSpy = vitest.spyOn(manager, 'typing', 'get').mockReturnValue(true);
            using cancelSpy = vitest.spyOn(manager, 'cancelTypeahead')

            expect(manager._keyboardHandler).toBe(horizontalRtlOrientationKeyboardHandler);
            expect(cancelSpy).toHaveBeenCalledTimes(0);
            fireEventWithKey('Escape');
            expect(cancelSpy).toHaveBeenCalledTimes(1);
        });

        it('Should not invoke _KeyManagerImpl.cancelTypeahead() when Escape button is pressed and typing is false.', () => {
            const manager = createBoundManager((config) => config.withHorizontalOrientation('rtl'));
            using typingSpy = vitest.spyOn(manager, 'typing', 'get').mockReturnValue(false);
            using cancelSpy = vitest.spyOn(manager, 'cancelTypeahead')

            expect(manager._keyboardHandler).toBe(horizontalRtlOrientationKeyboardHandler);
            expect(cancelSpy).toHaveBeenCalledTimes(0);
            fireEventWithKey('Escape');
            expect(cancelSpy).toHaveBeenCalledTimes(0);
        });
    });

    describe('isInKeyManagerHandlerContext()', () => {

        it('Should return false if called outside a KeyManager keyboard handler.', () => {
            expect(isInKeyManagerHandlerContext()).toBe(false);
        });

        it('Should return true if called inside a KeyManager keyboard handler triggered by a keyboard event.', () => {
            const log: boolean[] = [];
            const manager = createManager((config) => config.withKeyboardHandler(() => {
                log.push(isInKeyManagerHandlerContext());
                return true;
            }));
            const containerEl = document.body.appendChild(document.createElement('div'));
            
            manager.bind(containerEl);

            log.push(isInKeyManagerHandlerContext());
            containerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true }));
            log.push(isInKeyManagerHandlerContext());
            expect(log).toEqual([ false, true, false ]);
        });

        it('Should return false outside the KeyManager keyboard handler even if the handler throws an error.', () => {
            const manager = createManager((config) => config.withKeyboardHandler((m, e) => {
                throw new Error();
            }));
            const containerEl = document.body.appendChild(document.createElement('div'));
            const errorHandler = (e: ErrorEvent) => e.preventDefault();

            manager.bind(containerEl);
            window.addEventListener('error', errorHandler);

            containerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true }));
            expect(isInKeyManagerHandlerContext()).toBe(false);
        })

    });

    describe('currentHandledKey()', () => {

        it('Should return the key currently being handled by the key manager\'s keyboard handler.', () => {
            const log: string[] = []
            const manager = createManager((config) => config.withKeyboardHandler((_, e) => {
                log.push(e.key);
                return false
            }));
            const containerEl = document.body.appendChild(document.createElement('div'))
            manager.bind(containerEl);

            expect(currentHandledKey()).toBeUndefined();
            
            containerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true }));
            containerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'B', bubbles: true }));
            containerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'C', bubbles: true }));

            expect(log).toEqual([ 'A', 'B', 'C' ]);
            expect(currentHandledKey()).toBe(undefined);
        });

        it('Should return undefined outside the KeyManager keyboard handler even if the handler throws an error.', () => {
            const manager = createManager((config) => config.withKeyboardHandler((m, e) => {
                throw new Error();
            }));
            const containerEl = document.body.appendChild(document.createElement('div'));
            const errorHandler = (e: ErrorEvent) => e.preventDefault();

            manager.bind(containerEl);
            window.addEventListener('error', errorHandler);

            containerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true }));
            expect(currentHandledKey()).toBeUndefined();
        });
        
    });

    describe('class DOMElementKeyManagerItem()', () => {

        it('Should throw an error if instantiated in a server environment.', () => {
            const errorMessage = 'DOMElementKeyManagerItem cannot be instantiated on the server.';
            using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockImplementation(() => true);

            expect(() => new DOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
        });

        it('Should throw an error if the provided argument is not an Element instance.', () => {
            const errorMessage = 'DOMElementKeyManagerItem.constructor(): The provided element is not a DOM element!';
            //Will throw
            expect(() => new DOMElementKeyManagerItem(0 as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem(1 as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem('' as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem('A' as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem(true as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem(false as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem(undefined as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem(null as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem({} as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem([] as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem((() => {}) as any)).toThrow(errorMessage);
            //Will not throw
            expect(() => new DOMElementKeyManagerItem(document.createElement('div'))).not.toThrow();
        });

        it('Should throw an error if the provided optional second argument is not a string.', () => {
            const errorMessage = 'DOMElementKeyManagerItem.constructor(): The second argument must be a string!';
            //Will throw
            expect(() => new DOMElementKeyManagerItem(document.createElement('div'), 0 as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem(document.createElement('div'), 1 as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem(document.createElement('div'), true as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem(document.createElement('div'), false as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem(document.createElement('div'), {} as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem(document.createElement('div'), [] as any)).toThrow(errorMessage);
            expect(() => new DOMElementKeyManagerItem(document.createElement('div'), (() => {}) as any)).toThrow(errorMessage);
            //Will not throw
            expect(() => new DOMElementKeyManagerItem(document.createElement('div'), undefined)).not.toThrow();
            expect(() => new DOMElementKeyManagerItem(document.createElement('div'), null as any)).not.toThrow();
            expect(() => new DOMElementKeyManagerItem(document.createElement('div'), '')).not.toThrow();
            expect(() => new DOMElementKeyManagerItem(document.createElement('div'), 'A')).not.toThrow();
        });

        it('Should throw an error if element is already bound to item.', () => {
            const errorMessage = 'DOMElementKeyManagerItem.constructor(): The provided element already has a key manager item!';
            const element = document.createElement('div');
            new DOMElementKeyManagerItem(element);
            expect(() => new DOMElementKeyManagerItem(element)).toThrow(errorMessage);
        });

        it('Should add the provided CSS class na to the list when onActive() is invoked.', () => {
            const element = document.createElement('div');
            const item = new DOMElementKeyManagerItem(element, 'active');

            expect(element.classList.contains('active')).toBe(false);
            item.onActive();
            expect(element.classList.contains('active')).toBe(true);
        });

        it('Should reactively reflect the buttons\' enabled state.', async () => {
            const log: boolean[] = [];
            const element = document.createElement('button');
            const item = new DOMElementKeyManagerItem(element);
            
            document.body.appendChild(element);
            subscribeEffect(() => log.push(item.disabled));

            element.disabled = true;
            await Promise.resolve();
            await Promise.resolve();
            element.disabled = false;
            await Promise.resolve();
            await Promise.resolve();
            element.disabled = true;
            await Promise.resolve();
            await Promise.resolve();

            expect(log).toEqual([ false, true, false, true ]);
        });

        it('Should reactively reflect the inputs\' enabled state.', async () => {
            const log: boolean[] = [];
            const element = document.createElement('input');
            const item = new DOMElementKeyManagerItem(element);
            
            document.body.appendChild(element);
            subscribeEffect(() => log.push(item.disabled));

            element.disabled = true;
            await Promise.resolve();
            await Promise.resolve();
            element.disabled = false;
            await Promise.resolve();
            await Promise.resolve();
            element.disabled = true;
            await Promise.resolve();
            await Promise.resolve();

            expect(log).toEqual([ false, true, false, true ]);
        });

        it('Should reactively reflect the value of the aria-disabled attribute.', async () => {
            const log: boolean[] = [];
            const element = document.createElement('div');
            const item = new DOMElementKeyManagerItem(element);
            
            document.body.appendChild(element);
            subscribeEffect(() => log.push(item.disabled));

            element.setAttribute('aria-disabled', 'true');
            await Promise.resolve();
            await Promise.resolve();
            element.removeAttribute('aria-disabled');
            await Promise.resolve();
            await Promise.resolve();
            element.setAttribute('aria-disabled', 'true');
            await Promise.resolve();
            await Promise.resolve();

            expect(log).toEqual([ false, true, false, true ]);
        });

        test('DOMElementKeyManagerItem.id should reflect the element id.', () => {
            const element = document.createElement('div');
            const item = new DOMElementKeyManagerItem(element);

            element.id = 'A';
            expect(item.id).toBe('A');
            element.id = 'B';
            expect(item.id).toBe('B');
        });

        test('DOMElementKeyManagerItem.element should be an element provided to constructor.', () => {
            const element = document.createElement('div');
            const item = new DOMElementKeyManagerItem(element);
            expect(item.element).toBe(element);
        });

        it('Should be sorted according to document flow.', () => {
            const indexes = [2, 1, 0, 6, 7, 4, 5, 3];
            let container = document.createElement('div');
            let manager = createManager();
            let elements = Array.from({ length: indexes.length }, (_, i) => document.createElement('div'));

            manager.bind(container);
            container.append(...elements);

            indexes.forEach((index) => {
                manager.addItem(new DOMElementKeyManagerItem(elements[index]))
            });

            expect(manager.itemsCount).toBe(8);
            for (let i = 0; i < elements.length; i++) {
                const item = manager._items[i] as DOMElementKeyManagerItem
                expect(item.element).toBe(elements[i]);
            }

            dispose();
            container = document.createElement('div');
            manager = createManager();
            elements = Array.from({ length: indexes.length }, (_, i) => document.createElement('div'));

            let parent: HTMLElement | null = null;
            for (const element of elements) {
                if (parent) { 
                    parent.appendChild(element)
                }
                parent = element
            }
            manager.bind(container);
            container.appendChild(elements[0]);

            indexes.forEach((index) => {
                manager.addItem(new DOMElementKeyManagerItem(elements[index]))
            });

            expect(manager.itemsCount).toBe(8);
            for (let i = 0; i < elements.length; i++) {
                const item = manager._items[i] as DOMElementKeyManagerItem
                expect(item.element).toBe(elements[i]);
            }

            dispose();
            container = document.createElement('div');
            manager = createManager();
            elements = Array.from({ length: indexes.length }, (_, i) => document.createElement('div'));

            elements[0].appendChild(elements[1]).appendChild(elements[2]);
            elements[3].appendChild(elements[4]).appendChild(elements[5]);
            elements[5].appendChild(elements[6]).appendChild(elements[7]);
            manager.bind(container);
            container.appendChild(elements[0]);
            container.appendChild(elements[3]);
            container.appendChild(elements[5]);


            indexes.forEach((index) => {
                manager.addItem(new DOMElementKeyManagerItem(elements[index]))
            });

            expect(manager.itemsCount).toBe(8);
            for (let i = 0; i < elements.length; i++) {
                const item = manager._items[i] as DOMElementKeyManagerItem
                expect(item.element).toBe(elements[i]);
            }
        });

        test('compare() method should return a value based on the relative positions of the elements in the DOM.', () => {
            const createDiv = () => document.createElement('div');
            const remove = () => { item1.element.remove(); item2.element.remove(); }
            const item1 = new DOMElementKeyManagerItem(createDiv());
            const item2 = new DOMElementKeyManagerItem(createDiv());

            createDiv().append(item1.element, item2.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            createDiv().append(item1.element, createDiv(), item2.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            createDiv().append(createDiv(), item1.element, createDiv(), item2.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            createDiv().append(createDiv(), item1.element, createDiv(), item2.element, createDiv());
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            item1.element.appendChild(item2.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            item1.element.appendChild(item2.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            item1.element.appendChild(createDiv()).appendChild(item2.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            createDiv().appendChild(item1.element).appendChild(createDiv()).appendChild(item2.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            let ancestor = createDiv();
            ancestor.append(createDiv(), item2.element);
            ancestor.firstChild!.appendChild(item1.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            ancestor = createDiv();
            ancestor.append(createDiv(), item2.element);
            ancestor.firstChild!.appendChild(createDiv()).appendChild(item1.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            ancestor = createDiv();
            ancestor.append(createDiv(), createDiv(), item2.element);
            ancestor.firstChild!.appendChild(createDiv()).appendChild(item1.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();
        });

        test('compare() should throw error if items do not belong to the same DOM tree.', () => {
            const errorMessage = 'DOMElementKeyManagerItem.compare(): Failed to compare items. Make sure both items belong to the same DOM tree.';
            const item1 = new DOMElementKeyManagerItem(document.createElement('div'));
            const item2 = new DOMElementKeyManagerItem(document.createElement('div'));
            
            expect(() => item1.compare(item2)).toThrow(errorMessage);
        });

        it('Should not contain an element reference after disposal.', () => {
            const item = new DOMElementKeyManagerItem(document.createElement('div'));

            item.dispose();

            //@ts-expect-error
            expect(item._element).toBe(null);
        });

        test('DOMElementKeyManagerItem.disposed should be true after disposal.', () => {
            const item = new DOMElementKeyManagerItem(document.createElement('div'));

            expect(item.disposed).toBe(false); 
            item.dispose();
            expect(item.disposed).toBe(true); 
        });

        it('Should throw an error if the disabled property is accessed after disposal.', () => {
            const errorMessage = 'DOMElementKeyManagerItem.disabled: Cannot access properties of a disposed instance!';
            const item = new DOMElementKeyManagerItem(document.createElement('div'));
            
            item.dispose();

            expect(() => item.disabled).toThrow(errorMessage);
        });

        it('Should throw an error if the id is accessed after disposal.', () => {
            const errorMessage = 'DOMElementKeyManagerItem.id: Cannot access properties of a disposed instance!';
            const item = new DOMElementKeyManagerItem(document.createElement('div'));
            
            item.dispose();

            expect(() => item.id).toThrow(errorMessage);
        });

        it('Should throw an error if the label id is accessed after disposal.', () => {
            const errorMessage = 'DOMElementKeyManagerItem.label: Cannot access properties of a disposed instance!';
            const item = new DOMElementKeyManagerItem(document.createElement('div'));
            
            item.dispose();

            expect(() => item.label).toThrow(errorMessage);
        });

        it('Should throw an error if the element id is accessed after disposal.', () => {
            const errorMessage = 'DOMElementKeyManagerItem.element: Cannot access properties of a disposed instance!';
            const item = new DOMElementKeyManagerItem(document.createElement('div'));
            
            item.dispose();

            expect(() => item.element).toThrow(errorMessage);
        });

        it('Should throw an error if dispose() is invoked while the item is attached to a key manager.', () => {
            const errorMessage = 'DOMElementKeyManagerItem.dispose(): attached item cannot be disposed!';
            const manager = createManager();
            const item1 = new DOMElementKeyManagerItem(document.createElement('div'));
            const item2 = new DOMElementKeyManagerItem(document.createElement('div'));
            const item3 = new DOMElementKeyManagerItem(document.createElement('div'));
            
            manager.bind(document.createElement('div'));
            manager.addItem(item1);

            expect(() => item1.dispose()).toThrow(errorMessage);
            expect(() => item1.dispose()).toThrow(errorMessage);

            item2.onAttached(manager);
            expect(() => item2.dispose()).toThrow(errorMessage);
            expect(() => item3.dispose()).not.toThrow();
        });

        it('Should throw error if the key manager tries to add a disposed item.', () => {
            const errorMessage = 'DOMElementKeyManagerItem.onAttached(): A disposed item cannot be added to a key manager!';
            const manager = createManager();
            const item1 = new DOMElementKeyManagerItem(document.createElement('div'));
            const item2 = new DOMElementKeyManagerItem(document.createElement('div'));
            const item3 = new DOMElementKeyManagerItem(document.createElement('div'));

            manager.bind(document.createElement('div'));
            item1.dispose();
            item2.dispose();
            
            expect(() => manager.addItem(item1)).toThrow(errorMessage);
            expect(() => item1.onAttached(manager)).toThrow(errorMessage);
            expect(() => item3.onAttached(manager)).not.toThrow();
            expect(manager.itemsCount).toBe(0);
        });

        it('Should throw an error if the argument provided to onAttached() is invalid.', () => {
            const errorMessage = 'DOMElementKeyManagerItem.onAttached(): Invalid argument! Expected a key manager with a removeItem() method!';
            const item = new DOMElementKeyManagerItem(document.createElement('div'));

            //Will throw
            expect(() => item.onAttached(0 as any)).toThrow(errorMessage);
            expect(() => item.onAttached(1 as any)).toThrow(errorMessage);
            expect(() => item.onAttached(true as any)).toThrow(errorMessage);
            expect(() => item.onAttached(false as any)).toThrow(errorMessage);
            expect(() => item.onAttached('' as any)).toThrow(errorMessage);
            expect(() => item.onAttached('A' as any)).toThrow(errorMessage);
            expect(() => item.onAttached(undefined as any)).toThrow(errorMessage);
            expect(() => item.onAttached(null as any)).toThrow(errorMessage);
            expect(() => item.onAttached({} as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: 0 } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: 1 } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: true } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: false } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: '' } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: 'A' } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: {} } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: [] } as any)).toThrow(errorMessage);

            //Will not throw
            expect(() => item.onAttached({ removeItem: () => {} } as any)).not.toThrow();
        })

        it('Should throw an error if accessability name accessor reached with useAccessabilityNameAccessor() has invalid return type.', () => {
            const log: string[] = [];
            const errorMessage = 'KeyManagerBuilder.withAccessabilityNameAccessor() or <ProvideAccessibilityNameAccessor>: The return type of provided function must be a string!'

            function Test() {
                let returnValue: any
                return <ProvideAccessabilityNameAccessor accessor={() => returnValue}>{() => {

                    // Will throw
                    returnValue = 0;
                    expect(() => new DOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
                    returnValue = 1;
                    expect(() => new DOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
                    returnValue = true;
                    expect(() => new DOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
                    returnValue = false;
                    expect(() => new DOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
                    returnValue = null;
                    expect(() => new DOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
                    returnValue = undefined;
                    expect(() => new DOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
                    returnValue = {};
                    expect(() => new DOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
                    returnValue = () => {};
                    expect(() => new DOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
                    returnValue = [];
                    expect(() => new DOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);

                    // Will not throw
                    returnValue = '';
                    expect(() => new DOMElementKeyManagerItem(document.createElement('div'))).not.toThrow();
                    returnValue = 'A';
                    expect(() => new DOMElementKeyManagerItem(document.createElement('div'))).not.toThrow();

                    log.push('A')
                }}</ProvideAccessabilityNameAccessor>
            }

            disposeBag.push(render(() => <Test/>, document.createElement('div')));

            expect(log).toEqual([ 'A' ]);
        });
    });

    describe('class FocusableDOMElementKeyManagerItem()', () => {

        it('Should throw an error if instantiated in a server environment.', () => {
            const errorMessage = 'FocusableDOMElementKeyManagerItem cannot be instantiated on the server.';
            using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockImplementation(() => true);

            expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
        });

        it('Should throw an error if the provided argument is not an Element instance.', () => {
            const errorMessage = 'FocusableDOMElementKeyManagerItem.constructor(): The provided element is not a DOM element!';
            //Will throw
            expect(() => new FocusableDOMElementKeyManagerItem(0 as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem(1 as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem('' as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem('A' as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem(true as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem(false as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem(undefined as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem(null as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem({} as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem([] as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem((() => {}) as any)).toThrow(errorMessage);
            //Will not throw
            expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'))).not.toThrow();
        });

        it('Should throw an error if the provided optional second argument is not a string.', () => {
            const errorMessage = 'FocusableDOMElementKeyManagerItem.constructor(): The second argument must be a string!';
            //Will throw
            expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'), 0 as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'), 1 as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'), true as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'), false as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'), {} as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'), [] as any)).toThrow(errorMessage);
            expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'), (() => {}) as any)).toThrow(errorMessage);
            //Will not throw
            expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'), undefined)).not.toThrow();
            expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'), null as any)).not.toThrow();
            expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'), '')).not.toThrow();
            expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'), 'A')).not.toThrow();
        });

        it('Should throw an error if element is not focusable.', () => {
            const errorMessage = 'FocusableDOMElementKeyManagerItem.constructor(): The provided element is not focusable! It does not implement the `focus()` method!';
            const element = document.createElement('div') as Element & { focus: any }

            //Will throw
            element.focus = undefined;
            expect(() => new FocusableDOMElementKeyManagerItem(element)).toThrow(errorMessage);
            element.focus = null;
            expect(() => new FocusableDOMElementKeyManagerItem(element)).toThrow(errorMessage);
            element.focus = 0;
            expect(() => new FocusableDOMElementKeyManagerItem(element)).toThrow(errorMessage);
            element.focus = 1;
            expect(() => new FocusableDOMElementKeyManagerItem(element)).toThrow(errorMessage);
            element.focus = '';
            expect(() => new FocusableDOMElementKeyManagerItem(element)).toThrow(errorMessage);
            element.focus = 'A';
            expect(() => new FocusableDOMElementKeyManagerItem(element)).toThrow(errorMessage);
            element.focus = true;
            expect(() => new FocusableDOMElementKeyManagerItem(element)).toThrow(errorMessage);
            element.focus = false;
            expect(() => new FocusableDOMElementKeyManagerItem(element)).toThrow(errorMessage);
            element.focus = {};
            expect(() => new FocusableDOMElementKeyManagerItem(element)).toThrow(errorMessage);
            element.focus = [];
            expect(() => new FocusableDOMElementKeyManagerItem(element)).toThrow(errorMessage);
            //Will not throw
            element.focus = () => {};
            expect(() => new FocusableDOMElementKeyManagerItem(element)).not.toThrow();
        });

        it('Should throw an error if element is already bound to item.', () => {
            const errorMessage = 'FocusableDOMElementKeyManagerItem.constructor(): The provided element already has a key manager item!';
            const element = document.createElement('div');
            new FocusableDOMElementKeyManagerItem(element);
            expect(() => new FocusableDOMElementKeyManagerItem(element)).toThrow(errorMessage);
        });

        it('Should throw an error when onActive() is invoke and the element is not focusable.', () => {
            const errorMessage = 'FocusableDOMElementKeyManagerItem.onActive(): Failed to focus the underlying element. Make sure the element is focusable and connected to the DOM.'
            const item = new FocusableDOMElementKeyManagerItem(document.createElement('div'));

            document.body.appendChild(item.element);

            expect(() => item.onActive()).toThrow(errorMessage);
        })

        it('Should add the provided CSS class na to the list when onActive() is invoked.', () => {
            const element = document.createElement('div');
            const item = new FocusableDOMElementKeyManagerItem(element, 'active');

            document.body.appendChild(element);
            element.tabIndex = 0;

            expect(element.classList.contains('active')).toBe(false);
            item.onActive();
            expect(element.classList.contains('active')).toBe(true);
        });

        it('Should invoke focus() method when onActive() is invoked.', () => {
            const element = document.createElement('div');
            const item = new FocusableDOMElementKeyManagerItem(element, 'active');
            using focusSpy = vitest.spyOn(element, 'focus');

            document.body.appendChild(element);
            element.tabIndex = 0;

            expect(focusSpy).toHaveBeenCalledTimes(0);
            item.onActive();
            expect(focusSpy).toHaveBeenCalledTimes(1);
        });

        it('Should throw an error if the element does not receive focus during onActive() invocation.', () => {
            const errorMessage = 'FocusableDOMElementKeyManagerItem.onActive(): Failed to focus the underlying element. Make sure the element is focusable and connected to the DOM.'
            const element = document.createElement('div');
            const item = new FocusableDOMElementKeyManagerItem(element, 'active');

            expect(() => item.onActive()).toThrow(errorMessage);
        })

        it('Should set the item as active when its element receives focus.', async () => {
            const element = document.createElement('div');
            const item = new FocusableDOMElementKeyManagerItem(element);
            const container = document.createElement('div');
            const manager = createManager();

            document.body.appendChild(container);
            container.appendChild(element);
            element.tabIndex = 0;
            manager.bind(container);
            manager.addItem(item);

            expect(manager.activeItem).toBe(null);
            element.focus();
            expect(manager.activeItem).toBe(item);
        });

        it('Should immediately set the item as active if its underlying element is focused.', () => {
            const element = document.createElement('div');
            const item = new FocusableDOMElementKeyManagerItem(element);
            const container = document.createElement('div');
            const manager = createManager();

            document.body.appendChild(container);
            container.appendChild(element);
            element.tabIndex = 0;
            element.focus();
            manager.bind(container);

            manager.addItem(item);
            expect(manager.activeItem).toBe(item);
        })

        it('Should reactively reflect the buttons\' enabled state.', async () => {
            const log: boolean[] = [];
            const element = document.createElement('button');
            const item = new FocusableDOMElementKeyManagerItem(element);
            
            document.body.appendChild(element);
            subscribeEffect(() => log.push(item.disabled));

            element.disabled = true;
            await Promise.resolve();
            await Promise.resolve();
            element.disabled = false;
            await Promise.resolve();
            await Promise.resolve();
            element.disabled = true;
            await Promise.resolve();
            await Promise.resolve();

            expect(log).toEqual([ false, true, false, true ]);
        });

        it('Should reactively reflect the inputs\' enabled state.', async () => {
            const log: boolean[] = [];
            const element = document.createElement('input');
            const item = new FocusableDOMElementKeyManagerItem(element);
            
            document.body.appendChild(element);
            subscribeEffect(() => log.push(item.disabled));

            element.disabled = true;
            await Promise.resolve();
            await Promise.resolve();
            element.disabled = false;
            await Promise.resolve();
            await Promise.resolve();
            element.disabled = true;
            await Promise.resolve();
            await Promise.resolve();

            expect(log).toEqual([ false, true, false, true ]);
        });

        it('Should reactively reflect the value of the aria-disabled attribute.', async () => {
            const log: boolean[] = [];
            const element = document.createElement('div');
            const item = new FocusableDOMElementKeyManagerItem(element);
            
            document.body.appendChild(element);
            subscribeEffect(() => log.push(item.disabled));

            element.setAttribute('aria-disabled', 'true');
            await Promise.resolve();
            await Promise.resolve();
            element.removeAttribute('aria-disabled');
            await Promise.resolve();
            await Promise.resolve();
            element.setAttribute('aria-disabled', 'true');
            await Promise.resolve();
            await Promise.resolve();

            expect(log).toEqual([ false, true, false, true ]);
        });

        test('FocusableDOMElementKeyManagerItem.id should reflect the element id.', () => {
            const element = document.createElement('div');
            const item = new FocusableDOMElementKeyManagerItem(element);

            element.id = 'A';
            expect(item.id).toBe('A');
            element.id = 'B';
            expect(item.id).toBe('B');
        });

        test('FocusableDOMElementKeyManagerItem.element should be an element provided to constructor.', () => {
            const element = document.createElement('div');
            const item = new FocusableDOMElementKeyManagerItem(element);
            expect(item.element).toBe(element);
        });

        it('Should be sorted according to document flow.', () => {
            const indexes = [2, 1, 0, 6, 7, 4, 5, 3];
            let container = document.createElement('div');
            let manager = createManager();
            let elements = Array.from({ length: indexes.length }, (_, i) => document.createElement('div'));

            manager.bind(container);
            container.append(...elements);

            indexes.forEach((index) => {
                manager.addItem(new FocusableDOMElementKeyManagerItem(elements[index]))
            });

            expect(manager.itemsCount).toBe(8);
            for (let i = 0; i < elements.length; i++) {
                const item = manager._items[i] as FocusableDOMElementKeyManagerItem
                expect(item.element).toBe(elements[i]);
            }

            dispose();
            container = document.createElement('div');
            manager = createManager();
            elements = Array.from({ length: indexes.length }, (_, i) => document.createElement('div'));

            let parent: HTMLElement | null = null;
            for (const element of elements) {
                if (parent) { 
                    parent.appendChild(element)
                }
                parent = element
            }
            manager.bind(container);
            container.appendChild(elements[0]);

            indexes.forEach((index) => {
                manager.addItem(new FocusableDOMElementKeyManagerItem(elements[index]))
            });

            expect(manager.itemsCount).toBe(8);
            for (let i = 0; i < elements.length; i++) {
                const item = manager._items[i] as FocusableDOMElementKeyManagerItem
                expect(item.element).toBe(elements[i]);
            }

            dispose();
            container = document.createElement('div');
            manager = createManager();
            elements = Array.from({ length: indexes.length }, (_, i) => document.createElement('div'));

            elements[0].appendChild(elements[1]).appendChild(elements[2]);
            elements[3].appendChild(elements[4]).appendChild(elements[5]);
            elements[5].appendChild(elements[6]).appendChild(elements[7]);
            manager.bind(container);
            container.appendChild(elements[0]);
            container.appendChild(elements[3]);
            container.appendChild(elements[5]);


            indexes.forEach((index) => {
                manager.addItem(new FocusableDOMElementKeyManagerItem(elements[index]))
            });

            expect(manager.itemsCount).toBe(8);
            for (let i = 0; i < elements.length; i++) {
                const item = manager._items[i] as FocusableDOMElementKeyManagerItem
                expect(item.element).toBe(elements[i]);
            }
        });

        test('compare() method should return a value based on the relative positions of the elements in the DOM.', () => {
            const createDiv = () => document.createElement('div');
            const remove = () => { item1.element.remove(); item2.element.remove(); }
            const item1 = new FocusableDOMElementKeyManagerItem(createDiv());
            const item2 = new FocusableDOMElementKeyManagerItem(createDiv());

            createDiv().append(item1.element, item2.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            createDiv().append(item1.element, createDiv(), item2.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            createDiv().append(createDiv(), item1.element, createDiv(), item2.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            createDiv().append(createDiv(), item1.element, createDiv(), item2.element, createDiv());
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            item1.element.appendChild(item2.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            item1.element.appendChild(item2.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            item1.element.appendChild(createDiv()).appendChild(item2.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            createDiv().appendChild(item1.element).appendChild(createDiv()).appendChild(item2.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            let ancestor = createDiv();
            ancestor.append(createDiv(), item2.element);
            ancestor.firstChild!.appendChild(item1.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            ancestor = createDiv();
            ancestor.append(createDiv(), item2.element);
            ancestor.firstChild!.appendChild(createDiv()).appendChild(item1.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();

            ancestor = createDiv();
            ancestor.append(createDiv(), createDiv(), item2.element);
            ancestor.firstChild!.appendChild(createDiv()).appendChild(item1.element);
            expect(item1.compare(item2)).toBe(-1);
            expect(item2.compare(item1)).toBe(1);
            remove();
        });

        test('compare() should throw error if items do not belong to the same DOM tree.', () => {
            const errorMessage = 'FocusableDOMElementKeyManagerItem.compare(): Failed to compare items. Make sure both items belong to the same DOM tree.';
            const item1 = new FocusableDOMElementKeyManagerItem(document.createElement('div'));
            const item2 = new FocusableDOMElementKeyManagerItem(document.createElement('div'));
            
            expect(() => item1.compare(item2)).toThrow(errorMessage);
        });

        it('Should not contain an element reference after disposal.', () => {
            const item = new FocusableDOMElementKeyManagerItem(document.createElement('div'));

            item.dispose();

            //@ts-expect-error
            expect(item._element).toBe(null);
        });

        test('DOMElementKeyManagerItem.disposed should be true after disposal.', () => {
            const item = new FocusableDOMElementKeyManagerItem(document.createElement('div'));

            expect(item.disposed).toBe(false); 
            item.dispose();
            expect(item.disposed).toBe(true); 
        });

        it('Should throw an error if the disabled property is accessed after disposal.', () => {
            const errorMessage = 'DOMElementKeyManagerItem.disabled: Cannot access properties of a disposed instance!';
            const item = new FocusableDOMElementKeyManagerItem(document.createElement('div'));
            
            item.dispose();

            expect(() => item.disabled).toThrow(errorMessage);
        });

        it('Should throw an error if the id is accessed after disposal.', () => {
            const errorMessage = 'FocusableDOMElementKeyManagerItem.id: Cannot access properties of a disposed instance!';
            const item = new FocusableDOMElementKeyManagerItem(document.createElement('div'));
            
            item.dispose();

            expect(() => item.id).toThrow(errorMessage);
        });

        it('Should throw an error if the label id is accessed after disposal.', () => {
            const errorMessage = 'FocusableDOMElementKeyManagerItem.label: Cannot access properties of a disposed instance!';
            const item = new FocusableDOMElementKeyManagerItem(document.createElement('div'));
            
            item.dispose();

            expect(() => item.label).toThrow(errorMessage);
        });

        it('Should throw an error if the element id is accessed after disposal.', () => {
            const errorMessage = 'FocusableDOMElementKeyManagerItem.element: Cannot access properties of a disposed instance!';
            const item = new FocusableDOMElementKeyManagerItem(document.createElement('div'));
            
            item.dispose();

            expect(() => item.element).toThrow(errorMessage);
        });

        it('Should throw an error if dispose() is invoked while the item is attached to a key manager.', () => {
            const errorMessage = 'FocusableDOMElementKeyManagerItem.dispose(): attached item cannot be disposed!';
            const manager = createManager();
            const item1 = new FocusableDOMElementKeyManagerItem(document.createElement('div'));
            const item2 = new FocusableDOMElementKeyManagerItem(document.createElement('div'));
            const item3 = new FocusableDOMElementKeyManagerItem(document.createElement('div'));
            
            manager.bind(document.createElement('div'));
            manager.addItem(item1);

            expect(() => item1.dispose()).toThrow(errorMessage);
            expect(() => item1.dispose()).toThrow(errorMessage);

            item2.onAttached(manager);
            expect(() => item2.dispose()).toThrow(errorMessage);
            expect(() => item3.dispose()).not.toThrow();
        });

        it('Should throw error if the key manager tries to add a disposed item.', () => {
            const errorMessage = 'FocusableDOMElementKeyManagerItem.onAttached(): A disposed item cannot be added to a key manager!';
            const manager = createManager();
            const item1 = new FocusableDOMElementKeyManagerItem(document.createElement('div'));
            const item2 = new FocusableDOMElementKeyManagerItem(document.createElement('div'));
            const item3 = new FocusableDOMElementKeyManagerItem(document.createElement('div'));

            manager.bind(document.createElement('div'));
            item1.dispose();
            item2.dispose();
            
            expect(() => manager.addItem(item1)).toThrow(errorMessage);
            expect(() => item1.onAttached(manager)).toThrow(errorMessage);
            expect(() => item3.onAttached(manager)).not.toThrow();
            expect(manager.itemsCount).toBe(0);
        });

        it('Should throw an error if the argument provided to onAttached() is invalid.', () => {
            const errorMessage = 'FocusableDOMElementKeyManagerItem.onAttached(): Invalid argument! Expected a key manager with a removeItem() method!';
            const item = new FocusableDOMElementKeyManagerItem(document.createElement('div'));

            //Will throw
            expect(() => item.onAttached(0 as any)).toThrow(errorMessage);
            expect(() => item.onAttached(1 as any)).toThrow(errorMessage);
            expect(() => item.onAttached(true as any)).toThrow(errorMessage);
            expect(() => item.onAttached(false as any)).toThrow(errorMessage);
            expect(() => item.onAttached('' as any)).toThrow(errorMessage);
            expect(() => item.onAttached('A' as any)).toThrow(errorMessage);
            expect(() => item.onAttached(undefined as any)).toThrow(errorMessage);
            expect(() => item.onAttached(null as any)).toThrow(errorMessage);
            expect(() => item.onAttached({} as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: 0 } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: 1 } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: true } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: false } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: undefined } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: null } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: '' } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: 'A' } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: {} } as any)).toThrow(errorMessage);
            expect(() => item.onAttached({ removeItem: [] } as any)).toThrow(errorMessage);

            //Will not throw
            expect(() => item.onAttached({ removeItem: () => {} } as any)).not.toThrow();
        })

        it('Should throw an error if accessability name accessor reached with useAccessabilityNameAccessor() has invalid return type.', () => {
            const log: string[] = [];
            const errorMessage = 'KeyManagerBuilder.withAccessabilityNameAccessor() or <ProvideAccessibilityNameAccessor>: The return type of provided function must be a string!'

            function Test() {
                let returnValue: any
                return <ProvideAccessabilityNameAccessor accessor={() => returnValue}>{() => {

                    // Will throw
                    returnValue = 0;
                    expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
                    returnValue = 1;
                    expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
                    returnValue = true;
                    expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
                    returnValue = false;
                    expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
                    returnValue = {};
                    expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
                    returnValue = () => {};
                    expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
                    returnValue = [];
                    expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);

                    // Will not throw
                    returnValue = '';
                    expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'))).not.toThrow();
                    returnValue = 'A';
                    expect(() => new FocusableDOMElementKeyManagerItem(document.createElement('div'))).not.toThrow();

                    log.push('A')
                }}</ProvideAccessabilityNameAccessor>
            }

            disposeBag.push(render(() => <Test/>, document.createElement('div')));
            expect(log).toEqual([ 'A' ]);
        });

        it('Should focus with the keyboard origin when called within a KeyManager keyboard handler triggered by a keyboard event.', () => {
            const containerEl = document.body.appendChild(document.createElement('div'));
            const itemEl = containerEl.appendChild(document.createElement('div'));
            itemEl.tabIndex = 0;
            const origin = monitorFocusOrigin(itemEl);
            const item = new FocusableDOMElementKeyManagerItem(itemEl);
            const manager = createManager((config) => config.withKeyboardHandler((m) => {
                return m.setActive(item);
            }));

            manager.bind(containerEl);
            manager.addItem(item);
            
            expect(isFocused(itemEl)).toBe(false);
            expect(origin()).toBeUndefined();
            expect(manager.activeItem).toBe(null);

            containerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true }));

            expect(isFocused(itemEl)).toBe(true);
            expect(origin()).toBe('keyboard');
            expect(manager.activeItem).toBe(item);

            manager.removeItem(item);
            itemEl.blur();

            expect(isFocused(itemEl)).toBe(false);
            expect(origin()).toBeUndefined();

            item.onActive();

            expect(isFocused(itemEl)).toBe(true);
            expect(origin()).toBe('program');
        });

    });

    describe('deferAddItem()', () => {

        const microtasks: (() => void)[] = [];

        function flushMicrotasks(): void {
            try {
                while (microtasks.length) {
                    microtasks.shift()!();
                }
            } finally {
                if (microtasks.length) {
                    flushMicrotasks();
                }
            } 
        }

        beforeEach(() => {
            vitest.stubGlobal('queueMicrotask', (cb: () => void) => microtasks.push(cb))
        })

        afterEach(() => {
            if (microtasks.length) {
                throw new Error('There is still pending microtask!');
            }
        });

        

        it('Should throw an error if the second argument is not a non-array object.', () => {
            const errorMessage = 'deferAddItem(): Invalid second argument! Expected a non-array object.'
            const manager = createManager();

            manager.bind(document.createElement('div'));

            //Will throw
            expect(() => deferAddItem(manager, 0 as any)).toThrow(errorMessage);
            expect(() => deferAddItem(manager, 1 as any)).toThrow(errorMessage);
            expect(() => deferAddItem(manager, true as any)).toThrow(errorMessage);
            expect(() => deferAddItem(manager, false as any)).toThrow(errorMessage);
            expect(() => deferAddItem(manager, '' as any)).toThrow(errorMessage);
            expect(() => deferAddItem(manager, 'A' as any)).toThrow(errorMessage);
            expect(() => deferAddItem(manager, undefined as any)).toThrow(errorMessage);
            expect(() => deferAddItem(manager, null as any)).toThrow(errorMessage);
            expect(() => deferAddItem(manager, [] as any)).toThrow(errorMessage);
            expect(() => deferAddItem(manager, (() => {}) as any)).toThrow(errorMessage);

            //Will not throw
            expect(() => deferAddItem(manager, {} as any)).not.toThrow();

            //Will throw
            expect(() => flushMicrotasks()).toThrow();
        });

        it('Should throw an error if the first argument is not the default KeyManager instance.', () => {
            const errorMessage = 'deferAddItem(): Invalid first argument. The first argument must be an instance of the default CDK KeyManager.';
            const item = new TestItem(0);

            //Will throw
            expect(() => deferAddItem(0 as any, item)).toThrow(errorMessage);
            expect(() => deferAddItem(1 as any, item)).toThrow(errorMessage);
            expect(() => deferAddItem(true as any, item)).toThrow(errorMessage);
            expect(() => deferAddItem(false as any, item)).toThrow(errorMessage);
            expect(() => deferAddItem('' as any, item)).toThrow(errorMessage);
            expect(() => deferAddItem('A' as any, item)).toThrow(errorMessage);
            expect(() => deferAddItem(undefined as any, item)).toThrow(errorMessage);
            expect(() => deferAddItem(null as any, item)).toThrow(errorMessage);
            expect(() => deferAddItem({} as any, item)).toThrow(errorMessage);
            expect(() => deferAddItem([] as any, item)).toThrow(errorMessage);
            expect(() => deferAddItem((() => {}) as any, item)).toThrow(errorMessage);

            //Will not throw
            const manager = createManager();
            expect(() => deferAddItem(manager, item)).not.toThrow();

            //Will throw
            expect(() => flushMicrotasks()).toThrow();
        });

        it('Should defer item registration.', () => {
            const item = new TestItem(0);
            const manager = createManager();

            manager.bind(document.createElement('div'));
            deferAddItem(manager, item);

            expect(manager.itemsCount).toBe(0);
            flushMicrotasks();
            expect(manager.itemsCount).toBe(1);
            expect(manager._items[0]).toBe(item);
        });

        it('Should not register an item with the manager if owning scope is disposed.', () => {
            const item = new TestItem(0);
            const manager = createManager();

            manager.bind(document.createElement('div'));
            runWithOwner(owner, () => deferAddItem(manager, item));

            expect(manager.itemsCount).toBe(0);
            dispose();
            flushMicrotasks();
            expect(manager.itemsCount).toBe(0);
        });

    });

    describe('keyManagerItem()', () => {

        it('Should throw an error in server environment.', () => {
            const errorMessage = 'keyManagerItem(): This function cannot be used in a server environment!';
            using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockImplementation(() => true);

            expect(() => keyManagerItem(document.createElement('div'))).toThrow(errorMessage);
        });

        it('Should throw an error if it is used outside key manager context.', () => {
            const errorMessage = 'keyManagerItem(): KeyManager context is required!';
            expect(() => keyManagerItem(document.createElement('div'))).toThrow(errorMessage);
            expect(() => keyManagerItem('css-class-name')(document.createElement('div'))).toThrow(errorMessage);
        });

        test('Items should be registered in key manager and be manage by it.', async () => {
            const manager = createManager();
            const TestComponent: Component = () => {
                return (
                    <div ref={manager.bind}>
                        <manager.Provider>
                            <div ref={keyManagerItem} class="item"></div>
                            <div ref={keyManagerItem} class="item"></div>
                            <div ref={keyManagerItem('foo')} class="item"></div>
                            <div ref={keyManagerItem('baz')} class="item"></div>
                            <div ref={keyManagerItem} class="item"></div>
                            <div ref={keyManagerItem} class="item"></div>
                        </manager.Provider>
                    </div>
                )
            };

            const root = document.createElement('div');
            document.body.appendChild(root);

            disposeBag.push(render(() => <TestComponent/>, root));
            await Promise.resolve();
            
            expect(manager._items.length).toBe(6);
            for (const item of manager._items) {
                expect(item).toBeInstanceOf(DOMElementKeyManagerItem);
                expect(item).not.toBeInstanceOf(FocusableDOMElementKeyManagerItem);
            }

            const elements = Array.from(document.querySelectorAll('.item'));

            expect(manager._items.map((it) => (it as any).element)).toEqual(elements);
            expect(manager.activeItem).toBe(null);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(false);

            manager.setNextItemActive();
            expect((manager.activeItem as any).element).toBe(elements[0]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(false);

            manager.setNextItemActive();
            expect((manager.activeItem as any).element).toBe(elements[1]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(false);

            manager.setNextItemActive();
            expect((manager.activeItem as any).element).toBe(elements[2]);
            expect(elements[2].classList.contains('foo')).toBe(true);
            expect(elements[3].classList.contains('baz')).toBe(false);

            manager.setNextItemActive();
            expect((manager.activeItem as any).element).toBe(elements[3]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(true);

            manager.setNextItemActive();
            expect((manager.activeItem as any).element).toBe(elements[4]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(false);

            const items = manager._items.slice();

            manager.setActive(items[0]);
            expect((manager.activeItem as any).element).toBe(elements[0]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(false);

            manager.setActive(items[1]);
            expect((manager.activeItem as any).element).toBe(elements[1]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(false);

            manager.setActive(items[2]);
            expect((manager.activeItem as any).element).toBe(elements[2]);
            expect(elements[2].classList.contains('foo')).toBe(true);
            expect(elements[3].classList.contains('baz')).toBe(false);

            manager.setActive(items[3]);
            expect((manager.activeItem as any).element).toBe(elements[3]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(true);

            manager.setActive(items[4]);
            expect((manager.activeItem as any).element).toBe(elements[4]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(false);
        });

    });

    describe('focusableKeyManagerItem()', () => {

        it('Should throw an error in server environment.', () => {
            const errorMessage = 'focusableKeyManagerItem(): This function cannot be used in a server environment!';
            using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockImplementation(() => true);

            expect(() => focusableKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
        });

        it('Should throw an error if it is used outside key manager context.', () => {
            const errorMessage = 'focusableKeyManagerItem(): KeyManager context is required!';
            expect(() => focusableKeyManagerItem(document.createElement('div'))).toThrow(errorMessage);
            expect(() => focusableKeyManagerItem('css-class-name')(document.createElement('div'))).toThrow(errorMessage);
        });

        test('Items should be registered in key manager and be manage by it.', async () => {
            const manager = createManager();
            const TestComponent: Component = () => {
                return (
                    <div ref={manager.bind}>
                        <manager.Provider>
                            <div tabIndex={0} ref={focusableKeyManagerItem} class="item"></div>
                            <div tabIndex={0} ref={focusableKeyManagerItem} class="item"></div>
                            <div tabIndex={0} ref={focusableKeyManagerItem('foo')} class="item"></div>
                            <div tabIndex={0} ref={focusableKeyManagerItem('baz')} class="item"></div>
                            <div tabIndex={0} ref={focusableKeyManagerItem} class="item"></div>
                            <div tabIndex={0} ref={focusableKeyManagerItem} class="item"></div>
                        </manager.Provider>
                    </div>
                )
            };

            const root = document.createElement('div');
            document.body.appendChild(root);

            disposeBag.push(render(() => <TestComponent/>, root));
            await Promise.resolve();
            
            expect(manager._items.length).toBe(6);
            for (const item of manager._items) {
                expect(item).toBeInstanceOf(FocusableDOMElementKeyManagerItem);
            }

            const elements = Array.from(document.querySelectorAll('.item'));

            expect(manager._items.map((it) => (it as any).element)).toEqual(elements);
            expect(manager.activeItem).toBe(null);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(false);

            manager.setNextItemActive();
            expect((manager.activeItem as any).element).toBe(elements[0]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(false);

            manager.setNextItemActive();
            expect((manager.activeItem as any).element).toBe(elements[1]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(false);

            manager.setNextItemActive();
            expect((manager.activeItem as any).element).toBe(elements[2]);
            expect(elements[2].classList.contains('foo')).toBe(true);
            expect(elements[3].classList.contains('baz')).toBe(false);

            manager.setNextItemActive();
            expect((manager.activeItem as any).element).toBe(elements[3]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(true);

            manager.setNextItemActive();
            expect((manager.activeItem as any).element).toBe(elements[4]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(false);

            const items = manager._items.slice();

            manager.setActive(items[0]);
            expect((manager.activeItem as any).element).toBe(elements[0]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(false);

            manager.setActive(items[1]);
            expect((manager.activeItem as any).element).toBe(elements[1]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(false);

            manager.setActive(items[2]);
            expect((manager.activeItem as any).element).toBe(elements[2]);
            expect(elements[2].classList.contains('foo')).toBe(true);
            expect(elements[3].classList.contains('baz')).toBe(false);

            manager.setActive(items[3]);
            expect((manager.activeItem as any).element).toBe(elements[3]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(true);

            manager.setActive(items[4]);
            expect((manager.activeItem as any).element).toBe(elements[4]);
            expect(elements[2].classList.contains('foo')).toBe(false);
            expect(elements[3].classList.contains('baz')).toBe(false);
        });

    });
});

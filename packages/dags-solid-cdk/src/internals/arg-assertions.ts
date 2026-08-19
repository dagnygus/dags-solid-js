/** @internal */
export function _assertIsFunction(target: any, errorMessage: string): true {
    if (typeof target === 'function') { return true; }
    throw new Error(errorMessage);
}

/** @internal */
export function _assertIsOptionalFunction(target: any, errorMessage: string): true {
    if (target == null || typeof target === 'function') { return true; }
    throw new Error(errorMessage);
}

/** @internal */
export function _assertIsObjectExcludingArray(target: any, errorMessage: string): true {
    if (target != null && typeof target === 'object' && !Array.isArray(target)) { return true; }
    throw new Error(errorMessage);
}

export function _assertIsOptionalObjectExcludingArray(target: any, errorMessage: string): true {
    if (target == null || (typeof target === 'object' && !Array.isArray(target))) { return true; }
    throw new Error(errorMessage);
}

/** @internal */
export function _assertIsBoolean(target: any, errorMessage: string): true {
    if (typeof target === 'boolean') { return true; }
    throw new Error(errorMessage);
}

/** @internal */
export function _assertIsOptionalBoolean(target: any, errorMessage: string): true {
    if (target == null || typeof target === 'boolean') { return true; }
    throw new Error(errorMessage);
}

/** @internal */
export function _assertIsAllowedModifierKeysConfig(target: any, errorMessage: string): true {
    if (target == null || typeof target !== 'object' || Array.isArray(target)) {
        throw new Error(errorMessage);
    }
    const modifiers: string[] = ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'];
    for (const modifier of modifiers) {
        if (modifier in target && typeof target[modifier] !== 'boolean') {
            throw new Error(errorMessage);
        }
    }
    return true;
}

/** @internal */
export function _assertIsOrientationDirection(target: any, errorMessage: string): true {
    if (target === 'ltr' || target === 'rtl') { return true; }
    throw new Error(errorMessage);
}

/** @internal */
export function _assertIsNumber(target: any, errorMessage: string): true {
    if (typeof target === 'number') { return true; }
    throw new Error(errorMessage);
}

/** @internal */
export function _assertIsOptionalNumber(target: any, errorMessage: string): true {
    if (target == null || typeof target === 'number') { return true; }
    throw new Error(errorMessage);
}

/** @internal */
export function _assertExpectedNumber(target: number, predicate: (target: number) => boolean, errorMessage: string): true {
    if (predicate(target)) { return true; }
    throw new Error(errorMessage)
}

/** @internal */
export function _assertIsOptionalTypeaheadConfig(target: any, errorMessage: string): true {
    if (target == null ) { return true; }
    if (typeof target !== 'object' || Array.isArray(target)) { throw new Error(errorMessage); }
    if ('debounceInterval' in target && target.debounceInterval != null && typeof target.debounceInterval !== 'number' ) {
        throw new Error(errorMessage);
    }
    if ('caseSensitive' in target && target.caseSensitive != null && typeof target.caseSensitive !== 'boolean') {
        throw new Error(errorMessage);
    }
    if ('reducer' in target && target.reducer != null && typeof target.reducer !== 'function') {
        throw new Error(errorMessage);
    }
    if ('eachWordAsPrefix' in target && target.eachWordAsPrefix != null && typeof target.eachWordAsPrefix !== 'boolean') {
        throw new Error(errorMessage);
    }
    return true;
}

/** @internal */
export function _assertIsString(target: any, errorMessage: string): true {
    if (typeof target === 'string') { return true; }
    throw new Error(errorMessage);
}

/** @internal */
export function _assertIsOptionalString(target: any, errorMessage: string): true {
    if (target == null || typeof target === 'string') { return true }
    throw new Error(errorMessage);
}
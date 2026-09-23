/** @internal */
declare const __IS_SERVER__: boolean;

/** @internal */
declare module '*.module.css' {
    const styles: Record<string, string>;
    export default styles;
}

/** @internal */
declare module '*.module.scss' {
    const styles: Record<string, string>;
    export default styles;
}
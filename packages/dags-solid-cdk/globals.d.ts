/** @internal */
declare const __IS_SERVER__: boolean;

declare module '*.module.css' {
    const styles: Record<string, string>;
    export default styles;
}

declare module '*.module.scss' {
    const styles: Record<string, string>;
    export default styles;
}
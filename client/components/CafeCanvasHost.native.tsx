/**
 * Native entrypoint for the café.
 *
 * Skia is linked into the iOS/Android binary, so there's no CanvasKit to wait
 * for — the canvas renders straight away. Metro picks this file over
 * CafeCanvasHost.tsx on native, which keeps the web-only WithSkiaWeb import
 * out of the native bundle entirely.
 */
export { default } from './CafeCanvas';

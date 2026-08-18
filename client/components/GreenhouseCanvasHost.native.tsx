/**
 * Native entrypoint for the greenhouse.
 *
 * Skia is linked into the binary here, so there is no WASM module to wait on
 * and the canvas can be re-exported directly. Metro picks this file over
 * GreenhouseCanvasHost.tsx on iOS and Android.
 */
export { default } from './GreenhouseCanvas';

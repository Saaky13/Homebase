import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * The web build's HTML shell.
 *
 * Everything here exists so the exported site can be added to an iPhone home
 * screen and behave like an app: `apple-mobile-web-app-capable` drops Safari's
 * chrome, `apple-touch-icon` gives the springboard a real icon instead of a
 * screenshot, and `viewport-fit=cover` lets the town map run under the notch
 * the way it does on device.
 *
 * This file is web-only — expo-router renders it at export time and never on
 * native, so nothing in it needs a native fallback.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        {/* Home-screen app, not a bookmarked page. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Homebase" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#FFF7F2" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* Keeps the body from scrolling behind the fixed app shell. */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: BODY_BACKGROUND }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

/**
 * The root background is painted here as well as in the layout: a home-screen
 * launch shows the body colour before React mounts, and an unpainted body
 * flashes white against the app's warm ground.
 */
const BODY_BACKGROUND = `
body { background-color: #FFF7F2; overscroll-behavior: none; }
`;

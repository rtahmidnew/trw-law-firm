import '../styles/globals.css'
import Head from 'next/head'
import { useEffect } from 'react'

export default function App({ Component, pageProps }) {
  // Register service worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => console.log('SW registered:', reg.scope))
          .catch((err) => console.log('SW registration failed:', err));
      });
    }
  }, []);

  return (
    <>
      <Head>
        <title>TRW Law Firm</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content="Tahmidur Remura Wahid Law Firm — Case Management Portal" />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme colour for browser chrome */}
        <meta name="theme-color" content="#1a2744" />
        <meta name="msapplication-TileColor" content="#1a2744" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />

        {/* iOS PWA meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TRW Portal" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512x512.png" />

        {/* Gilroy font preload */}
        <link
          rel="preload"
          href="https://tahmidurrahman.com/wp-content/uploads/et-fonts/Gilroy-Regular.ttf"
          as="font"
          type="font/truetype"
          crossOrigin="anonymous"
        />
      </Head>
      <Component {...pageProps} />
    </>
  )
}

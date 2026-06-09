import '../styles/globals.css'
import Head from 'next/head'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>TRW Law Firm</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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

import type { AppProps } from 'next/app';
import Layout from '@/components/Layout';
import 'leaflet/dist/leaflet.css';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}

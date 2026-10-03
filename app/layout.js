import './globals.css';
import SW from './sw-register';
export const metadata = {
  title: 'Watchlist', manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Watchlist' }, icons: { apple: '/icon-192.png' },
};
export const viewport = { themeColor: '#4338ca', viewportFit: 'cover' };
export default function RootLayout({ children }) {
  return <html lang="en"><body><SW />{children}</body></html>;
}

import './globals.css';

export const metadata = {
  title: 'Ares City OS — TV Dashboard & OneDrive Photo Stream',
  description: 'Tactical TV Dashboard photo slideshow engine powered by Microsoft OneDrive and Next.js',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Orbitron:wght@500;700;900&family=Inter:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="ares-theme">
        {children}
      </body>
    </html>
  );
}

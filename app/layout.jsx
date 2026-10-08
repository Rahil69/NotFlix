import "./globals.css";
import "../src/App.css";
import "./watch/watch.css";

export const metadata = {
  title: "FlixNotMV | Discover films and series",
  description: "Browse popular movies and series, find a title, and settle in.",
  applicationName: "FlixNotMV",
  icons: { icon: "/flixnotmv-icon.svg?v=2" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "FlixNotMV" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08090c",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}

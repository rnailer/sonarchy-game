import type React from "react"
import type { Metadata } from "next"
import { Poppins } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
})

export const metadata: Metadata = {
  title: "Sonarchy - Playlist Clash Party Bash",
  description: "Play music playlist battles with friends and party online",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sonarchy",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Sonarchy",
    title: "Sonarchy - Playlist Clash Party Bash",
    description: "Play music playlist battles with friends and party online",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sonarchy - Playlist Clash Party Bash",
    description: "Play music playlist battles with friends and party online",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover"
        />
        <meta name="theme-color" content="#000022" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Sonarchy" />
        <link rel="apple-touch-icon" href="/icon-192.jpg" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${poppins.variable} font-sans antialiased`}
        style={{ fontFamily: "Poppins, sans-serif", margin: 0, padding: 0 }}
      >
        {children}
        <Toaster />
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              console.log('[v0] Layout loaded');
              
              if ('serviceWorker' in window) {
                window.addEventListener('load', () => {
                  window.navigator.serviceWorker.register('/sw.js').then(
                    (registration) => {
                      console.log('[v0] ServiceWorker registered:', registration.scope);
                    },
                    (err) => {
                      console.log('[v0] ServiceWorker registration failed:', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}

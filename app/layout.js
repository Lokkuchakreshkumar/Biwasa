import './globals.css';

export const metadata = {
  title: 'BIWASA - Production level Manga Creator',
  description: 'Production level Manga Creator',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-[#050505] text-slate-300 min-h-screen flex flex-col selection:bg-cyan-500/30">
        <div className="noise-overlay"></div>
        {children}
      </body>
    </html>
  );
}

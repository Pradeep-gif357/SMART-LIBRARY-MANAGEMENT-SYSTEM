import './globals.css';
import Nav from '@/components/Nav.js';

export const metadata = {
  title: 'Smart Library',
  description: 'Smart Library Management and Book Recommendation System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}

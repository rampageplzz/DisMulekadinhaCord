import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'DisMulekadinhaCord',
  description:
    'Seu lugar para conversar com a mulekadinha. Servidores, canais de texto, voz e compartilhamento de tela.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

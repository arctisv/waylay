import { Instrument_Sans, JetBrains_Mono, Manrope } from 'next/font/google';

export const displayFont = Manrope({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

export const bodyFont = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
});

export const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
});

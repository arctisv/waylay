import { Instrument_Sans, Manrope } from 'next/font/google';

export const displayFont = Manrope({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--font-manrope',
  display: 'swap',
});

export const bodyFont = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
});

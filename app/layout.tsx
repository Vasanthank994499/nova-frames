import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'Nova Frames — Studio workspace',description:'From the first idea to the final post. Nova Frames production workspace.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }

import type { Metadata } from 'next';
import './globals.css';
import './studio.css';
export const metadata: Metadata={title:'Nova Frames — Studio workspace',description:'From the first idea to the final post. Nova Frames production workspace.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'Nova Frames',statusBarStyle:'default'},icons:{icon:'/favicon.svg',apple:'/icon-192.png'}};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en" data-astryx-theme="neutral" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:"try{document.documentElement.dataset.theme=localStorage.getItem('nova-frames-theme')==='dark'?'dark':'light'}catch{document.documentElement.dataset.theme='light'}"}}/></head><body>{children}</body></html>; }

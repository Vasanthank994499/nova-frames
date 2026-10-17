/* Notification-only worker: never caches private workspace data. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{}
 const target=new URL(typeof data.url==='string'?data.url:'/',self.location.origin);
 const url=target.origin===self.location.origin?target.href:self.location.origin;
 event.waitUntil(self.registration.showNotification(data.title||'Nova Frames update',{body:data.body||'Open your workspace for the latest update.',icon:'/icon-192.png',badge:'/badge-96.png',tag:data.tag||'nova-update',data:{url},renotify:true}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
 const target=new URL(event.notification.data?.url||'/',self.location.origin);if(target.origin!==self.location.origin)return;
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for(const client of windows){if(new URL(client.url).origin===target.origin){await client.navigate(target.href);await client.focus();return;}}
 await self.clients.openWindow(target.href);
})());});

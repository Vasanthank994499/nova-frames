export type DeviceSubscription={endpoint:string,keys:{p256dh:string,auth:string}};
export function validateSubscription(value:unknown):DeviceSubscription {
 const input=value as DeviceSubscription;let url:URL;try{url=new URL(input?.endpoint);}catch{throw Error('Invalid notification subscription.');}
 const host=url.hostname,allowed=host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com');
 if(url.protocol!=='https:'||url.username||url.password||url.port||!allowed||url.href.length>3000)throw Error('Unsupported notification provider.');
 const valid=(key:unknown,length:number)=>typeof key==='string'&&/^[A-Za-z0-9_-]+={0,2}$/.test(key)&&Buffer.from(key,'base64url').length===length;
 if(!valid(input.keys?.p256dh,65)||!valid(input.keys?.auth,16)||Buffer.from(input.keys.p256dh,'base64url')[0]!==4)throw Error('Invalid notification encryption keys.');
 return {endpoint:url.href,keys:{p256dh:input.keys.p256dh,auth:input.keys.auth}};
}

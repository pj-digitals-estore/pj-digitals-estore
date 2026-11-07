// Hosted auth is consumed and verified by Clerk; the router only restores the screen.
export function redirectSystemPath({path}:{path:string;initial:boolean}) {
 try {const u=new URL(path,'nearby-partner://app');if(u.pathname.includes('hosted-auth-callback')||u.hostname==='hosted-auth-callback'||u.hostname.endsWith('.hosted-callback'))return '/';}catch{}
 return path;
}

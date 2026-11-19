// Strict calendar checks. Date.parse('2026-02-30') silently rolls into March, so every YYYY-MM-DD / HH:MM is round-tripped instead.
export function isValidDay(v:unknown):v is string{
 const s=String(v??'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const [y,m,d]=s.split('-').map(Number);if(y<1900||y>2999)return false;
 const t=new Date(Date.UTC(y,m-1,d));return t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d;
}
export const isValidTime=(v:unknown):v is string=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v??''));

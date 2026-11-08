import { createClient } from 'npm:@supabase/supabase-js@2';
const token = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const encoder = new TextEncoder();
async function hmac(key: Uint8Array, text: string) {
  const k = await crypto.subtle.importKey('raw', key, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, encoder.encode(text)));
}
async function identity(raw: string) {
  const data = new URLSearchParams(raw);
  if (new Set(data.keys()).size !== [...data.keys()].length) throw Error('Invalid session');
  const hash = data.get('hash') || ''; data.delete('hash');
  const check = [...data.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret = await hmac(encoder.encode('WebAppData'), token);
  const expected = [...await hmac(secret,check)].map(v=>v.toString(16).padStart(2,'0')).join('');
  let mismatch = hash.length ^ expected.length;
  for(let i=0;i<expected.length;i++) mismatch |= expected.charCodeAt(i) ^ (hash.charCodeAt(i)||0);
  const age = Date.now()/1000 - Number(data.get('auth_date'));
  if(mismatch || !Number.isFinite(age) || age < -30 || age > 3600) throw Error('Session expired');
  const user = JSON.parse(data.get('user') || '{}');
  if(!Number.isSafeInteger(user.id) || user.id <= 0) throw Error('Invalid user');
  return user.id;
}
async function telegram(method: string, payload: object) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
  const result = await response.json();
  if(!result.ok) throw Error('Telegram rejected request. Check channel and permissions.');
  return result.result;
}
const cors = {'Access-Control-Allow-Origin':Deno.env.get('APP_ORIGIN') || 'https://igagor11.github.io','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async request=>{
  if(request.method==='OPTIONS') return new Response(null,{headers:cors});
  const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
  if(request.method!=='POST') return reply({error:'Method not allowed'},405);
  try {
    const raw = await request.text(); if(raw.length>32000) return reply({error:'Request too large'},413);
    const body = JSON.parse(raw);
    let owner: number;
    try {owner=await identity(body.initData);} catch {return reply({error:'Откройте приложение заново через Telegram.'},401);}
    const account=await db.from('accounts').upsert({telegram_id:owner}); if(account.error) throw Error('Database unavailable');
    if(body.action==='channels') {
      const {data,error}=await db.from('channels').select('id,title,kind,enabled,moderation,timezone,settings').eq('owner_id',owner);
      if(error) throw error; return reply(data);
    }
    if(body.action==='add_channel') {
      if(!['news','product','personal','character'].includes(body.kind)) return reply({error:'Invalid type'},400);
      const chat=await telegram('getChat',{chat_id:String(body.chat).trim()});
      if(chat.type!=='channel') return reply({error:'Укажите Telegram-канал'},400);
      const member=await telegram('getChatMember',{chat_id:chat.id,user_id:owner});
      if(!['creator','administrator'].includes(member.status)) return reply({error:'Нужны права администратора канала'},403);
      const bot=await telegram('getMe',{});
      const rights=await telegram('getChatMember',{chat_id:chat.id,user_id:bot.id});
      if(rights.status!=='administrator'||!rights.can_post_messages) return reply({error:'Разрешите боту публикацию сообщений'},400);
      try {new Intl.DateTimeFormat('ru',{timeZone:body.timezone});} catch {return reply({error:'Некорректный часовой пояс'},400);}
      const {error}=await db.from('channels').insert({owner_id:owner,telegram_chat_id:chat.id,title:chat.title,kind:body.kind,moderation:body.moderation!==false,timezone:body.timezone,settings:{sources:String(body.sources||'').slice(0,8000),priorities:String(body.priorities||'').slice(0,2000),description:String(body.description||'').slice(0,8000),tone:String(body.tone||'').slice(0,200)}});
      if(error?.code==='23505') return reply({error:'Этот канал уже подключён'},409);
      if(error) throw error; return reply({ok:true});
    }
    return reply({error:'Unknown action'},400);
  } catch {return reply({error:'Запрос не выполнен. Проверьте подключение и настройки сервера.'},500);}
});

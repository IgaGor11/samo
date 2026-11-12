const base='https://fpgdsosfwsrfxebvkgdz.supabase.co/rest/v1';
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const token=process.env.TELEGRAM_BOT_TOKEN;
if(!key||!token)throw Error('Missing scheduler secrets');
async function db(path,method='GET',body){const r=await fetch(base+'/'+path,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`Database HTTP ${r.status}`);return r.json();}
async function telegram(method,body){const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const result=await r.json();if(!result.ok)throw Error('Telegram request failed');return result.result;}
const posts=await db('posts?status=eq.scheduled&scheduled_at=lte.'+encodeURIComponent(new Date().toISOString())+'&order=scheduled_at.asc&limit=30');
for(const post of posts){
 const [channel]=await db(`channels?id=eq.${post.channel_id}&owner_id=eq.${post.owner_id}`);
 if(!channel)continue;
 try{const member=await telegram('getChatMember',{chat_id:channel.telegram_chat_id,user_id:post.owner_id});if(!['creator','administrator'].includes(member.status)){await db(`posts?id=eq.${post.id}&status=eq.scheduled`,'PATCH',{status:'failed'});continue;}}catch{continue;}
 const claimed=await db(`posts?id=eq.${post.id}&status=eq.scheduled`,'PATCH',{status:'publishing'});
 if(!claimed.length)continue;
 try{const sent=await telegram('sendMessage',{chat_id:channel.telegram_chat_id,text:post.content});await db(`posts?id=eq.${post.id}`,'PATCH',{status:'published',telegram_message_id:sent.message_id});}
 catch{await db(`posts?id=eq.${post.id}`,'PATCH',{status:'uncertain'});}
}
console.log(`Processed up to ${posts.length} due posts`);

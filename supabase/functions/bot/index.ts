const token=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
async function secret(){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('samo-webhook:'+token));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
Deno.serve(async request=>{
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 if(request.headers.get('X-Telegram-Bot-Api-Secret-Token')!==await secret())return new Response('Unauthorized',{status:401});
 try {
  const update=await request.json();const message=update.message;
  if(!message||message.chat?.type!=='private')return new Response('ok');
  const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:message.chat.id,text:'Добро пожаловать в S.A.M.O.\n\nОткройте приложение, подключите свой канал и настройте AI. Перед подключением назначьте бота администратором канала с правом публикации.',reply_markup:{inline_keyboard:[[{text:'Открыть S.A.M.O',web_app:{url:'https://igagor11.github.io/samo/'}}]]}}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)return new Response('Retry',{status:503});
  return new Response('ok');
 }catch{return new Response('Retry',{status:503});}
});

import {createHash} from 'node:crypto';
const token=process.env.TELEGRAM_BOT_TOKEN;
if(!token)throw Error('Missing TELEGRAM_BOT_TOKEN');
const url='https://igagor11.github.io/samo/';
async function call(method,payload){
 const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
 const data=await response.json();
 if(!data.ok)throw Error(`Telegram ${method} failed (${response.status})`);
}
await call('setChatMenuButton',{menu_button:{type:'web_app',text:'Открыть S.A.M.O',web_app:{url}}});
await call('setMyDescription',{description:'S.A.M.O — управление Telegram-каналами. Откройте приложение через кнопку меню, подключите канал и настройте контент.'});
console.log('Telegram Mini App menu configured');
await call('setWebhook',{url:'https://fpgdsosfwsrfxebvkgdz.supabase.co/functions/v1/bot',secret_token:createHash('sha256').update('samo-webhook:'+token).digest('hex'),allowed_updates:['message']});
await call('setMyCommands',{commands:[{command:'start',description:'Открыть S.A.M.O'},{command:'app',description:'Мои каналы'},{command:'help',description:'Как подключить канал'}]});
console.log('Telegram webhook and commands configured');

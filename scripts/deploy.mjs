import {readFile} from 'node:fs/promises';
const ref='fpgdsosfwsrfxebvkgdz';
const access=process.env.SUPABASE_ACCESS_TOKEN;
const bot=process.env.TELEGRAM_BOT_TOKEN;
if(!access||!bot) throw Error('Required GitHub Secrets: SUPABASE_ACCESS_TOKEN, TELEGRAM_BOT_TOKEN');
async function management(path,body){
 const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/${path}`,{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!response.ok)throw Error(`Supabase ${path}: HTTP ${response.status}`);
 const text=await response.text();
 return text ? JSON.parse(text) : null;
}
await management('secrets',[{name:'TELEGRAM_BOT_TOKEN',value:bot}]);
const query=await readFile('supabase/migrations/202611080001_initial.sql','utf8');
const existing=await management('database/query',{query:"select to_regclass('public.accounts') as existing"});
if(!existing[0]?.existing)await management('database/query',{query:`begin; ${query} commit;`});
console.log('Database and server secrets configured');

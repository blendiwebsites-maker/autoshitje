// AutoShitje Worker: public read-only API until secure account authentication is implemented.
const json = (data, status=200) => new Response(JSON.stringify(data), {status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const clean = (v,max=120) => String(v??'').slice(0,max);
export default {
 async fetch(request, env) {
  const url=new URL(request.url);
  if(url.pathname==='/api/health') return json({ok:true,project:'AutoShitje',database:!!env.DB,mode:'read-only'});
  if(url.pathname==='/api/cars' && request.method==='GET') {
   if(!env.DB) return json({error:'D1 binding DB is missing'},503);
   try {
    const limit=Math.min(Math.max(Number(url.searchParams.get('limit'))||24,1),48);
    const city=clean(url.searchParams.get('city'),70);
    const brand=clean(url.searchParams.get('brand'),70);
    let sql="SELECT id,slug,title,brand,model,year,price,mileage,fuel,transmission,city,description,phone,whatsapp,dealership_id,created_at FROM cars WHERE status='active'";
    const params=[];
    if(city){sql+=' AND city = ?';params.push(city)}
    if(brand){sql+=' AND brand = ?';params.push(brand)}
    sql+=' ORDER BY created_at DESC LIMIT ?';params.push(limit);
    const data=await env.DB.prepare(sql).bind(...params).all();
    return json({cars:data.results||[]});
   }catch(e){return json({error:'Database query failed; verify table schema',detail:'The existing cars table may not match the API'},500)}
  }
  if(url.pathname.startsWith('/api/') || url.pathname==='/api') return json({error:'Not available. Posting and accounts require secure backend implementation.'},404);
  if(request.method!=='GET'&&request.method!=='HEAD') return json({error:'Method not allowed'},405);
  return env.ASSETS.fetch(request);
 }
};

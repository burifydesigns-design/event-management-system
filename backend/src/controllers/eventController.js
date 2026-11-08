const { getSupabase } = require('../config/db');
const db = () => getSupabase();
const eventShape = (event) => event ? { ...event, date: event.event_date, time: event.event_time } : event;

exports.listEvents = async (req,res,next) => {
 try {
  const {search,category,city,date,price,page=1,limit=12}=req.query;
  let q=db().from('events').select('*, organizer:profiles!events_organizer_id_fkey(id,name,email)',{count:'exact'}).eq('status','published').is('deleted_at',null);
  if(search)q=q.or('title.ilike.%'+search+'%,description.ilike.%'+search+'%,city.ilike.%'+search+'%');
  if(category)q=q.eq('category',category);
  if(city)q=q.ilike('city','%'+city+'%');
  if(date==='upcoming')q=q.gte('event_date',new Date().toISOString());
  if(date==='past')q=q.lt('event_date',new Date().toISOString());
  if(price==='free')q=q.eq('price',0);
  if(price==='paid')q=q.gt('price',0);
  const p=Math.max(1,Number(page)),l=Math.min(100,Math.max(1,Number(limit)));
  const {data,error,count}=await q.order('event_date').range((p-1)*l,p*l-1);
  if(error)throw error;
  res.json({events:(data||[]).map(eventShape),page:p,limit:l,totalEvents:count||0,totalPages:Math.ceil((count||0)/l)});
 }catch(err){next(err);}
};
exports.getEvent=async(req,res,next)=>{
 try{
  const {data,error}=await db().from('events').select('*, organizer:profiles!events_organizer_id_fkey(id,name,email)').eq('id',req.params.id).eq('status','published').is('deleted_at',null).maybeSingle();
  if(error)throw error;if(!data)return res.status(404).json({message:'Event not found'});res.json(eventShape(data));
 }catch(err){next(err);}
};
exports.createEvent=async(req,res,next)=>{
 try{
  const b=req.body;
  const payload={title:b.title,description:b.description,category:b.category,event_date:b.event_date||b.date,event_time:b.event_time||b.time,location:b.location,city:b.city,capacity:Number(b.capacity),price:Number(b.price||0),image:b.image||'',organizer_id:req.user.userId,status:b.status||'draft'};
  const {data,error}=await db().from('events').insert(payload).select('*').single();
  if(error)throw error;res.status(201).json(eventShape(data));
 }catch(err){next(err);}
};
exports.updateEvent=async(req,res,next)=>{
 try{
  const {data:old,error:readError}=await db().from('events').select('organizer_id').eq('id',req.params.id).maybeSingle();
  if(readError)throw readError;if(!old)return res.status(404).json({message:'Event not found'});
  if(old.organizer_id!==req.user.userId&&req.user.role!=='admin')return res.status(403).json({message:'Not your event'});
  const b=req.body,p={};
  ['title','description','category','location','city','capacity','price','image','status'].forEach(k=>{if(b[k]!==undefined)p[k]=b[k];});
  if(b.time!==undefined)p.event_time=b.time;if(b.event_time!==undefined)p.event_time=b.event_time;
  if(b.date!==undefined)p.event_date=b.date;if(b.event_date!==undefined)p.event_date=b.event_date;
  const {data,error}=await db().from('events').update(p).eq('id',req.params.id).select('*').single();
  if(error)throw error;res.json(eventShape(data));
 }catch(err){next(err);}
};
exports.deleteEvent=async(req,res,next)=>{
 try{
  const {data:old,error:readError}=await db().from('events').select('organizer_id').eq('id',req.params.id).maybeSingle();
  if(readError)throw readError;if(!old)return res.status(404).json({message:'Event not found'});
  if(old.organizer_id!==req.user.userId&&req.user.role!=='admin')return res.status(403).json({message:'Not your event'});
  const {error}=await db().from('events').delete().eq('id',req.params.id);
  if(error)throw error;res.json({message:'Event deleted'});
 }catch(err){next(err);}
};
exports.publishEvent=async(req,res,next)=>{
 try{
  const {data:old,error:readError}=await db().from('events').select('organizer_id,status').eq('id',req.params.id).maybeSingle();
  if(readError)throw readError;if(!old)return res.status(404).json({message:'Event not found'});
  if(old.organizer_id!==req.user.userId&&req.user.role!=='admin')return res.status(403).json({message:'Not your event'});
  const {data,error}=await db().from('events').update({status:old.status==='published'?'draft':'published'}).eq('id',req.params.id).select('*').single();
  if(error)throw error;res.json(eventShape(data));
 }catch(err){next(err);}
};

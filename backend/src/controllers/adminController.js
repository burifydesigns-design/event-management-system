const { getSupabase } = require('../config/db');
const { generateAttendeesCSV } = require('../utils/csvExport');
const db=()=>getSupabase();

exports.getDashboard=async(req,res,next)=>{
 try{
  const [users,events,regs,upcoming,checked,capacity]=await Promise.all([
   db().from('profiles').select('id',{count:'exact',head:true}),
   db().from('events').select('id',{count:'exact',head:true}),
   db().from('registrations').select('id',{count:'exact',head:true}),
   db().from('events').select('id',{count:'exact',head:true}).eq('status','published').gte('event_date',new Date().toISOString()),
   db().from('registrations').select('id',{count:'exact',head:true}).eq('checked_in',true),
   db().from('events').select('capacity')
  ]);
  for(const r of [users,events,regs,upcoming,checked,capacity])if(r.error)throw r.error;
  res.json({totalUsers:users.count||0,totalEvents:events.count||0,totalRegistrations:regs.count||0,upcomingEvents:upcoming.count||0,availableSeats:(capacity.data||[]).reduce((n,e)=>n+Number(e.capacity||0),0),checkedInAttendees:checked.count||0});
 }catch(err){next(err);}
};
exports.getEventAttendees=async(req,res,next)=>{
 try{
  const {eventId}=req.params;
  const {data,error}=await db().from('registrations').select('*,user:profiles!registrations_user_id_fkey(id,name,email),event:events!registrations_event_id_fkey(id,title)').eq('event_id',eventId).order('registered_at',{ascending:false});
  if(error)throw error;res.json(data);
 }catch(err){next(err);}
};
exports.exportEventAttendees=async(req,res,next)=>{
 try{
  const {eventId}=req.params;
  const {data,error}=await db().from('registrations').select('*,user:profiles!registrations_user_id_fkey(name,email),event:events!registrations_event_id_fkey(title)').eq('event_id',eventId).order('registered_at',{ascending:false});
  if(error)throw error;
  const csv=generateAttendeesCSV(data.map(r=>({...r,ticketNumber:r.ticket_number,registeredAt:r.registered_at,checkedIn:r.checked_in,checkedInAt:r.checked_in_at,user:r.user,event:r.event})));
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition',`attachment; filename="attendees-${String(eventId).replace(/[^a-zA-Z0-9_-]/g,'_')}-${new Date().toISOString().slice(0,10)}.csv"`);
  res.setHeader('X-Content-Type-Options','nosniff');res.send(csv);
 }catch(err){next(err);}
};
exports.getAnalytics=async(req,res,next)=>{
 try{
  let q=db().from('registrations').select('event_id,status,checked_in,registered_at,event:events!registrations_event_id_fkey(id,title,capacity,organizer_id)');
  if(req.user.role==='organizer'){
   const {data:owned,error}=await db().from('events').select('id').eq('organizer_id',req.user.userId);
   if(error)throw error;
   const ids=(owned||[]).map(e=>e.id);
   if(!ids.length)return res.json({registrationsOverTime:[],registrationsPerEvent:[],checkInRate:0,totalCheckedIn:0,totalConfirmed:0,capacityUtilization:[]});
   q=q.in('event_id',ids);
  }
  if(req.query.startDate)q=q.gte('registered_at',new Date(req.query.startDate).toISOString());
  if(req.query.endDate)q=q.lte('registered_at',new Date(req.query.endDate+'T23:59:59.999Z').toISOString());
  const {data,error}=await q;
  if(error)throw error;
  const rows=data||[], confirmed=rows.filter(r=>r.status==='confirmed'), checked=confirmed.filter(r=>r.checked_in);
  const byDay={},byEvent={};
  for(const r of rows){const day=String(r.registered_at).slice(0,10);byDay[day]=(byDay[day]||0)+1;if(r.status==='confirmed'){const k=r.event_id;byEvent[k]??={eventId:k,eventName:r.event?.title||'Event',count:0};byEvent[k].count++;}}
  const evts=new Map();
  for(const r of rows){if(r.event)evts.set(r.event.id,r.event);}
  const counts={};for(const r of confirmed)counts[r.event_id]=(counts[r.event_id]||0)+1;
  const capacityUtilization=[...evts.values()].map(e=>({eventId:e.id,eventName:e.title,capacity:e.capacity,registered:counts[e.id]||0,utilization:e.capacity?((counts[e.id]||0)/e.capacity)*100:0})).sort((a,b)=>b.utilization-a.utilization);
  res.json({registrationsOverTime:Object.entries(byDay).sort(([a],[b])=>a.localeCompare(b)).map(([_id,count])=>({_id,count})),registrationsPerEvent:Object.values(byEvent).sort((a,b)=>b.count-a.count),checkInRate:confirmed.length?checked.length/confirmed.length*100:0,totalCheckedIn:checked.length,totalConfirmed:confirmed.length,capacityUtilization});
 }catch(err){next(err);}
};

const { getSupabase } = require('../config/db');
const { generateTicketNumber } = require('../services/qrService');
const db=()=>getSupabase();

exports.registerForEvent=async(req,res,next)=>{
 try{
  const {eventId}=req.body;
  const {data:event,error:e}=await db().from('events').select('*').eq('id',eventId).eq('status','published').maybeSingle();
  if(e)throw e;if(!event)return res.status(404).json({message:'Published event not found'});
  if(new Date(event.event_date)<new Date())return res.status(400).json({message:'Event is in the past'});
  const {count,error:ce}=await db().from('registrations').select('id',{count:'exact',head:true}).eq('event_id',eventId).eq('status','confirmed');
  if(ce)throw ce;if(count>=event.capacity)return res.status(409).json({message:'Event is full'});
  const {data,error}=await db().from('registrations').insert({user_id:req.user.userId,event_id:eventId,ticket_number:`EVT-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`}).select('*,event:events(*)').single();
  if(error){if(error.code==='23505')return res.status(409).json({message:'Already registered for this event'});throw error;}
  res.status(201).json({...data,event:{...data.event,id:data.event.id,date:data.event.event_date,time:data.event.event_time}});
 }catch(err){next(err);}
};
exports.getMyEvents=async(req,res,next)=>{
 try{
  const {data,error}=await db().from('registrations').select('*,event:events(*)').eq('user_id',req.user.userId).eq('status','confirmed').order('registered_at',{ascending:false});
  if(error)throw error;res.json(data.map(r=>({...r,event:r.event?{...r.event,date:r.event.event_date,time:r.event.event_time}:r.event})));
 }catch(err){next(err);}
};
exports.cancelRegistration=async(req,res,next)=>{
 try{
  const {data:r,error:e}=await db().from('registrations').select('*,event:events(event_date)').eq('id',req.params.id).maybeSingle();
  if(e)throw e;if(!r)return res.status(404).json({message:'Registration not found'});
  if(r.user_id!==req.user.userId&&!['admin','organizer'].includes(req.user.role))return res.status(403).json({message:'Not authorized'});
  if(r.event&&new Date(r.event.event_date)<new Date())return res.status(400).json({message:'Cannot cancel registration for past event'});
  const {error}=await db().from('registrations').update({status:'cancelled'}).eq('id',req.params.id);
  if(error)throw error;res.json({message:'Registration cancelled'});
 }catch(err){next(err);}
};

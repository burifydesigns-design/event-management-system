const { getSupabase } = require('../config/db');
const db = () => getSupabase();
const eventShape = (event) => event ? { ...event, date: event.event_date, time: event.event_time } : event;

exports.listEvents = async (req,res,next) => {
 try {
  const {search,category,city,date,price,page=1,limit=12}=req.query;
  let q=db().from('events').select('*, organizer:profiles!events_organizer_id_fkey(id,name)',{count:'exact'}).eq('status','published').is('deleted_at',null);
  if(search){
   const term=String(search).slice(0,100).replace(/[,%()]/g,' ').trim();
   if(term)q=q.or('title.ilike.%'+term+'%,description.ilike.%'+term+'%,city.ilike.%'+term+'%');
  }
  if(category)q=q.eq('category',category);
  if(city)q=q.ilike('city','%'+city+'%');
  if(date==='upcoming')q=q.gte('event_date',new Date().toISOString());
  if(date==='past')q=q.lt('event_date',new Date().toISOString());
  if(price==='free')q=q.eq('price',0);
  if(price==='paid')q=q.gt('price',0);
  const p=Math.max(1,Number(page)),l=Math.min(100,Math.max(1,Number(limit)));
  const {data,error,count}=await q.order('event_date').range((p-1)*l,p*l-1);
  if(error)throw error;
  res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.json({events:(data||[]).map(eventShape),page:p,limit:l,totalEvents:count||0,totalPages:Math.ceil((count||0)/l)});
 }catch(err){next(err);}
};
exports.getEvent=async(req,res,next)=>{
 try{
  const {data,error}=await db().from('events').select('*, organizer:profiles!events_organizer_id_fkey(id,name)').eq('id',req.params.id).eq('status','published').is('deleted_at',null).maybeSingle();
  if(error)throw error;if(!data)return res.status(404).json({message:'Event not found'});
  res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.json(eventShape(data));
 }catch(err){next(err);}
};

exports.createEvent = async (req, res, next) => {
  try {
    const b = req.body || {};
    const payload = {
      title: b.title, description: b.description, category: b.category,
      event_date: b.event_date || b.date, event_time: b.event_time || b.time,
      location: b.location, city: b.city, capacity: Number(b.capacity),
      price: Number(b.price || 0), image: b.image || '',
      organizer_id: req.user.userId, status: 'draft',
    };
    const { data, error } = await db().from('events').insert(payload).select('*').single();
    if (error) throw error;
    res.status(201).json(eventShape(data));
  } catch (err) { next(err); }
};

async function getOwnedEvent(eventId, user) {
  const { data, error } = await db().from('events')
    .select('id,organizer_id,status').eq('id', eventId).maybeSingle();
  if (error) throw error;
  if (!data) return { errorStatus: 404, message: 'Event not found' };
  if (user.role !== 'admin' && data.organizer_id !== user.userId) {
    return { errorStatus: 403, message: 'You cannot manage this event' };
  }
  return { event: data };
}

exports.updateEvent = async (req, res, next) => {
  try {
    const owned = await getOwnedEvent(req.params.id, req.user);
    if (owned.errorStatus) return res.status(owned.errorStatus).json({ message: owned.message });
    const b = req.body || {};
    const payload = {};
    // Publication state is changed only by the dedicated publish endpoint.
    ['title', 'description', 'category', 'location', 'city', 'capacity', 'price', 'image',
      'registration_opens_at', 'registration_closes_at', 'timezone', 'currency'].forEach((key) => {
      if (b[key] !== undefined) payload[key] = b[key];
    });
    if (b.time !== undefined) payload.event_time = b.time;
    if (b.event_time !== undefined) payload.event_time = b.event_time;
    if (b.date !== undefined) payload.event_date = b.date;
    if (b.event_date !== undefined) payload.event_date = b.event_date;
    if (!Object.keys(payload).length) return res.status(400).json({ message: 'No editable event fields supplied' });
    const { data, error } = await db().from('events').update(payload)
      .eq('id', req.params.id).select('*').single();
    if (error) throw error;
    res.json(eventShape(data));
  } catch (err) { next(err); }
};

exports.deleteEvent = async (req, res, next) => {
  try {
    const owned = await getOwnedEvent(req.params.id, req.user);
    if (owned.errorStatus) return res.status(owned.errorStatus).json({ message: owned.message });
    const { error } = await db().from('events')
      .update({ deleted_at: new Date().toISOString() }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Event archived' });
  } catch (err) { next(err); }
};

exports.publishEvent = async (req, res, next) => {
  try {
    const owned = await getOwnedEvent(req.params.id, req.user);
    if (owned.errorStatus) return res.status(owned.errorStatus).json({ message: owned.message });
    const nextStatus = owned.event.status === 'published' ? 'draft' : 'published';
    const update = { status: nextStatus };
    if (nextStatus === 'published') update.published_at = new Date().toISOString();
    const { data, error } = await db().from('events').update(update)
      .eq('id', req.params.id).select('*').single();
    if (error) throw error;
    res.json(eventShape(data));
  } catch (err) { next(err); }
};

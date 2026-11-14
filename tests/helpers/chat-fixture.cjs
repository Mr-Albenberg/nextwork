// Supabase transport fixture. Real SQL/RLS is separately exercised by messaging.test.sql.
const ids={alex:'00000000-0000-0000-0000-000000000001',taylor:'00000000-0000-0000-0000-000000000002',outsider:'00000000-0000-0000-0000-000000000003'};
class ChatFixture{
 constructor(){this.profiles=Object.entries(ids).map(([name,user_id])=>({user_id,name:name[0].toUpperCase()+name.slice(1),role:'Member',company:'',bio:'Public biography',skills:['React']}));this.conversations=[];this.messages=[];this.files=[];this.blobs=new Map();this.listeners=new Set();this.sequence=0;this.failUpload=false;this.failAfterCommit=false}
 uuid(){return '10000000-0000-0000-0000-'+String(++this.sequence).padStart(12,'0')}
 tick(){return new Date(Date.UTC(2026,10,14,12,0,++this.sequence)).toISOString()}
 conversation(id,actor){return this.conversations.find(c=>c.id===id&&c.members.includes(actor))}
 emit(){for(const callback of this.listeners)callback()}
 async rpc(actor,name,args){
  let data;const conv=this.conversation(args.conversation,actor);
  if(name==='chat_setup_version')data=1;
  else if(name==='chat_sync_profile')data=null;
  else if(name==='chat_search_people')data=this.profiles.filter(p=>p.user_id!==actor&&p.name.toLowerCase().includes((args.query||'').toLowerCase()));
  else if(name==='chat_start_conversation'){let row=this.conversations.find(c=>c.members.includes(actor)&&c.members.includes(args.recipient));if(!row){row={id:this.uuid(),members:[actor,args.recipient],states:Object.fromEntries([actor,args.recipient].map(id=>[id,{saved:false,archived:false,read:''}])),last:this.tick()};this.conversations.push(row)}data=row.id}
  else if(name==='chat_inbox')data=this.conversations.filter(c=>c.members.includes(actor)).map(c=>{const other=c.members.find(id=>id!==actor),state=c.states[actor],messages=this.messages.filter(m=>m.conversation_id===c.id);return {id:c.id,other_id:other,contact:this.profiles.find(p=>p.user_id===other),saved:state.saved,archived:state.archived,last_read_at:state.read,unread:messages.filter(m=>m.sender_id!==actor&&!m.deleted_at&&m.created_at>state.read).length,last_message:messages.length?{...messages.at(-1),filename:this.files.find(f=>f.message_id===messages.at(-1).id)?.name}:null,last_message_at:c.last}});
  else if(!conv&&name!=='chat_delete_message'&&name!=='chat_discard_attachment')return {error:{message:'Conversation unavailable',code:'42501'}};
  else if(name==='chat_set_state'){const state=conv.states[actor];if(args.save!==undefined)state.saved=args.save;if(args.archive!==undefined)state.archived=args.archive;if(args.mark_read)state.read=this.tick();data=null}
  else if(name==='chat_reserve_attachment'){data={id:this.uuid(),conversation_id:conv.id,uploaded_by:actor,name:args.filename,size_bytes:args.bytes,path:conv.id+'/'+actor+'/'+this.uuid()};this.files.push(data)}
  else if(name==='chat_send_message'){let message=this.messages.find(m=>m.id===args.client_id);if(!message){message={id:args.client_id,conversation_id:conv.id,sender_id:actor,body:args.text_body,listing:args.project,created_at:this.tick(),deleted_at:null};this.messages.push(message);for(const id of args.files){const file=this.files.find(f=>f.id===id);file.message_id=message.id}conv.last=message.created_at;for(const id of conv.members)conv.states[id].archived=false;conv.states[actor].read=message.created_at;this.emit()}data=message.id;if(this.failAfterCommit){this.failAfterCommit=false;return {error:{message:'Connection lost after commit'}}}}
  else if(name==='chat_delete_message'){const m=this.messages.find(m=>m.id===args.message&&m.sender_id===actor);if(!m)return {error:{message:'Denied',code:'42501'}};m.body='';m.listing=null;m.deleted_at=this.tick();this.emit();data=null}
  else if(name==='chat_discard_attachment'){this.files=this.files.filter(f=>f.id!==args.attachment||f.uploaded_by!==actor||f.message_id);data=null}
  else return {error:{message:'Unknown RPC '+name}};
  return {data,error:null};
 }
 rows(actor,conversation,before=null){if(!this.conversation(conversation,actor))return [];return this.messages.filter(m=>m.conversation_id===conversation&&(!before||m.created_at<before.created_at||m.created_at===before.created_at&&m.id<before.id)).slice(-50).reverse().map(m=>({...m,chat_attachments:this.files.filter(f=>f.message_id===m.id)}))}
 client(actor){const fixture=this;return {
  rpc:(name,args)=>fixture.rpc(actor,name,args),
  from(table){const filters={};let single=false;return {maybeSingle(){single=true;return this},select(){return this},eq(key,value){filters[key]=value;return this},order(){return this},limit(){return this},or(){return this},then(resolve){let rows=table==='chat_attachments'?fixture.files.filter(file=>(!filters.id||file.id===filters.id)&&(!filters.uploaded_by||file.uploaded_by===filters.uploaded_by)):fixture.rows(actor,filters.conversation_id);resolve({data:single?rows[0]||null:rows,error:null})}}},
  storage:{from(){return {async upload(path,file){if(fixture.failUpload)return {error:{message:'Upload failed'}};if(fixture.blobs.has(path))return {error:{message:'Duplicate',statusCode:'409'}};fixture.blobs.set(path,file);return {data:{path},error:null}},async download(path){return fixture.blobs.has(path)?{data:fixture.blobs.get(path),error:null}:{error:{message:'Unavailable'}}},async remove(paths){for(const path of paths)fixture.blobs.delete(path);return {data:paths,error:null}}}}},
  channel(){const callbacks=[];return {on(type,filter,callback){callbacks.push(callback);return this},subscribe(status){this.listener=()=>callbacks[0]?.();fixture.listeners.add(this.listener);status?.('SUBSCRIBED');return this}}},
  removeChannel(channel){fixture.listeners.delete(channel.listener);return Promise.resolve()}
 }}
}
module.exports={ChatFixture,ids};

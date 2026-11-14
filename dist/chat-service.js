/* Shared, authenticated messaging operations. No workspace JSON or sample recipients. */
(function(root){
class ChatService {
  constructor(client,userId,{isCurrent=()=>true,uuid=()=>crypto.randomUUID()}={}){this.client=client;this.userId=userId;this.isCurrent=isCurrent;this.uuid=uuid;this.channel=null}
  current(){if(!this.isCurrent())throw Object.assign(new Error('Account changed'),{code:'CHAT_ACCOUNT_CHANGED'})}
  checked(result){this.current();if(result.error)throw Object.assign(new Error(result.error.message||'Messaging request failed'),result.error);return result.data}
  async rpc(name,args={}){this.current();return this.checked(await this.client.rpc(name,args))}
  async initialize(){if(await this.rpc('chat_setup_version')!==1)throw Object.assign(new Error('Messaging is not available yet. Please try again later.'),{code:'CHAT_SETUP_MISSING'});await this.rpc('chat_sync_profile');return this.inbox()}
  inbox(){return this.rpc('chat_inbox')}
  search(query=''){return this.rpc('chat_search_people',{query})}
  start(recipient){return this.rpc('chat_start_conversation',{recipient})}
  state(conversation,changes){return this.rpc('chat_set_state',{conversation,...changes})}
  async messages(conversation,before=null){
    this.current();let query=this.client.from('chat_messages').select('id,conversation_id,sender_id,body,listing,created_at,deleted_at,chat_attachments(id,name,size_bytes,path)').eq('conversation_id',conversation).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50);
    if(before){if(!/^[\da-f-]{36}$/i.test(before.id)||!Number.isFinite(Date.parse(before.created_at)))throw Error('Invalid message cursor');query=query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`)}
    return this.checked(await query).reverse();
  }
  async send(conversation,{id,body='',listing=null,files=[]}){
    this.current();if(!body.trim()&&!listing&&!files.length)throw Error('Write a message or attach a file.');if(files.length>3)throw Error('Attach up to three files.');
    for(const file of files){
      if(!file.remote)file.remote=await this.rpc('chat_reserve_attachment',{conversation,filename:file.name,bytes:file.size});
      if(!file.uploaded){this.current();const result=await this.client.storage.from('message-attachments').upload(file.remote.path,new Blob([file.file],{type:'application/octet-stream'}),{contentType:'application/octet-stream',upsert:false});this.current();if(result.error&&!['409','Duplicate'].includes(String(result.error.statusCode||result.error.error)))throw Object.assign(new Error(result.error.message||'File upload failed'),result.error);file.uploaded=true}
    }
    return this.rpc('chat_send_message',{conversation,client_id:id,text_body:body,project:listing,files:files.map(f=>f.remote.id)});
  }
  async discard(file){if(!file.remote)return;this.current();const state=this.checked(await this.client.from('chat_attachments').select('message_id').eq('id',file.remote.id).maybeSingle());if(state?.message_id)return;this.checked(await this.client.storage.from('message-attachments').remove([file.remote.path]));await this.rpc('chat_discard_attachment',{attachment:file.remote.id})}
  async download(attachment){this.current();return this.checked(await this.client.storage.from('message-attachments').download(attachment.path))}
  async cleanupOwnUploads(){this.current();const result=await this.client.from('chat_attachments').select('path').eq('uploaded_by',this.userId);if(['42P01','PGRST205'].includes(result.error?.code))return;const paths=this.checked(result).map(file=>file.path).filter(Boolean);for(let index=0;index<paths.length;index+=100)this.checked(await this.client.storage.from('message-attachments').remove(paths.slice(index,index+100)))}
  async remove(message){this.current();const paths=(message.chat_attachments||[]).map(file=>file.path);if(paths.length)this.checked(await this.client.storage.from('message-attachments').remove(paths));await this.rpc('chat_delete_message',{message:message.id})}
  subscribe(onChange,onStatus=()=>{}){this.current();this.channel=this.client.channel('chat-'+this.userId+'-'+this.uuid()).on('postgres_changes',{event:'*',schema:'public',table:'chat_messages'},()=>{if(this.isCurrent())onChange()}).on('postgres_changes',{event:'*',schema:'public',table:'chat_conversations'},()=>{if(this.isCurrent())onChange()}).on('postgres_changes',{event:'*',schema:'public',table:'chat_memberships',filter:'user_id=eq.'+this.userId},()=>{if(this.isCurrent())onChange()}).subscribe(status=>{if(this.isCurrent())onStatus(status)});return this.channel}
  stop(){if(this.channel){Promise.resolve(this.client.removeChannel(this.channel)).catch(()=>{});this.channel=null}}
}
if(typeof module!=='undefined'&&module.exports)module.exports=ChatService;else root.ChatService=ChatService;
})(typeof window!=='undefined'?window:globalThis);

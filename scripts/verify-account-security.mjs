// Explicit, isolated live acceptance check. Creates and deletes one test identity;
// no real user password is read/reset and no email is sent.
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
if(!process.argv.includes('--live')) throw new Error('Use --live only against the reviewed SAMS deployment');
const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_ANON_KEY;
if(new URL(url).hostname!=='bymmvtbiohiqayyxppgr.supabase.co') throw new Error('Unexpected project');
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,opts);
const user=createClient(url,key,opts);
const anon=createClient(url,key,opts);
const identifier=`sams-security-check-${Date.now()}`;
const email=`${identifier}@example.invalid`;
const password=randomBytes(32).toString('base64url');
let id;
const checks=[];
function check(ok,label){if(!ok)throw new Error(`Acceptance failed: ${label}`);checks.push(label);}
try {
  const created=await admin.auth.admin.createUser({email,password,email_confirm:false});
  check(!created.error&&created.data.user,'temporary Auth identity creation');
  id=created.data.user.id;
  const inserted=await admin.from('app_users').insert({id,email,name:'Isolated security verification',role:'user',status:'Active'});
  check(!inserted.error,'atomic profile/settings initialization');
  const pending=await user.auth.signInWithPassword({email,password});
  check(pending.error?.code==='email_not_confirmed','unverified identities cannot sign in');
  const recovery=await admin.auth.admin.generateLink({type:'recovery',email});
  check(!recovery.error&&!!recovery.data.properties?.hashed_token,'native recovery link generated without sending email');
  const redeemed=await user.auth.verifyOtp({token_hash:recovery.data.properties.hashed_token,type:'recovery'});
  check(!redeemed.error&&redeemed.data.user?.id===id,'native owner-recovery flow confirms the pending identity');
  const signin=await user.auth.signInWithPassword({email,password});
  if(signin.error) console.log(JSON.stringify({authErrorCode:signin.error.code,authErrorStatus:signin.error.status}));
  check(!signin.error&&signin.data.user?.id===id,'native password sign-in');
  const profile=await user.from('app_users').select('id,email,role');
  check(!profile.error&&profile.data.length===1&&profile.data[0].id===id,'ordinary user sees only their own profile');
  const settings=await user.from('user_settings').select('user_id').eq('user_id',id);
  check(!settings.error&&settings.data.length===1,'own settings remain readable');
  const escalation=await user.from('app_users').update({role:'admin'}).eq('id',id);
  check(!!escalation.error,'direct role escalation denied');
  const perms=await user.from('user_permissions').insert({user_id:id,page:'users',can_view:true,can_edit:true});
  check(!!perms.error,'self-granted administrative permissions denied');
  const manage=await fetch(`${url}/functions/v1/account-security`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${signin.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'password',id,password})});
  check(manage.status===403,'non-admin backend account management denied');
  const anonymous=await anon.from('app_users').select('id').limit(1);
  check(!!anonymous.error,'anonymous account reads denied');
  const assets=await anon.from('assets').select('id').limit(1);
  check(!!assets.error,'anonymous organization data reads denied');
  const username=await fetch(`${url}/functions/v1/account-security`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({action:'login',identifier,password})});
  const usernameBody=await username.json();
  check(username.status===200&&!!usernameBody.session?.access_token,'username login through verified gateway');
  const ownUpdate=await user.from('app_users').update({name:'Verified profile edit'}).eq('id',id).select('name').single();
  check(!ownUpdate.error&&ownUpdate.data?.name==='Verified profile edit','safe own-profile edits work');
  const nextPassword=randomBytes(32).toString('base64url');
  const passwordUpdate=await user.auth.updateUser({password:nextPassword});
  check(!passwordUpdate.error,'native password change');
  const again=await anon.auth.signInWithPassword({email,password:nextPassword});
  check(!again.error&&again.data.user?.id===id,'sign-in with changed password');
  const metadata=await admin.from('app_users').select('password_changed_at').eq('id',id).single();
  check(!metadata.error&&!!metadata.data?.password_changed_at,'Auth password metadata synchronized');
  const inactive=await admin.from('app_users').update({status:'Inactive'}).eq('id',id);
  check(!inactive.error,'inactive-account setup');
  const inactiveRead=await user.from('app_users').select('id');
  check(!inactiveRead.error&&inactiveRead.data.length===0,'inactive session loses application access');
  console.log(JSON.stringify({passed:checks.length,checks}));
} finally {
  if(id){
    const cleanup=await admin.auth.admin.deleteUser(id);
    if(cleanup.error)throw new Error(`Temporary account cleanup required for ID ${id}`);
    const remaining=await admin.from('app_users').select('id').eq('id',id);
    if(remaining.error||remaining.data.length)throw new Error(`Temporary profile cleanup required for ID ${id}`);
    console.log('Temporary Auth identity, profile, and settings cleaned up');
  }
}

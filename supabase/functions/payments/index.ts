import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const ANON_KEY=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY")!;
const RAZORPAY_KEY_ID=Deno.env.get("RAZORPAY_KEY_ID")||"";
const RAZORPAY_KEY_SECRET=Deno.env.get("RAZORPAY_KEY_SECRET")||"";
const RAZORPAY_WEBHOOK_SECRET=Deno.env.get("RAZORPAY_WEBHOOK_SECRET")||"";
const PLANS={pro:{id:Deno.env.get("RAZORPAY_PRO_PLAN_ID")||"",name:"Pro",amount:39900},max:{id:Deno.env.get("RAZORPAY_MAX_PLAN_ID")||"",name:"Max",amount:99900}} as const;
const admin=createClient(SUPABASE_URL,SERVICE_KEY);
async function trackPayment(userId:string,eventName:string,meta:Record<string,unknown>={}){
  await admin.from('payment_analytics').insert({user_id:userId,event_name:eventName,provider:'razorpay',plan_key:meta.plan||null,amount_paise:meta.amountPaise||null,currency:'INR',external_id:meta.externalId||null,properties:meta});
  await admin.from('analytics_events').insert({user_id:userId,event_name:eventName,properties:meta});
}

async function user(req:Request){const a=req.headers.get("Authorization");if(!a)throw new Error("Missing session");const c=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:a}}});const {data,error}=await c.auth.getUser();if(error||!data.user)throw new Error("Invalid session");return data.user;}
async function hmac(secret:string,body:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(body));return [...new Uint8Array(sig)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function timingSafe(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  try{
    const raw=await req.text();
    const isWebhook=req.headers.get('x-razorpay-signature');
    if(isWebhook){
      if(!RAZORPAY_WEBHOOK_SECRET)throw new Error('Webhook secret is not configured');
      const expected=await hmac(RAZORPAY_WEBHOOK_SECRET,raw);
      if(!timingSafe(expected,isWebhook))return json({ok:false,error:'Invalid webhook signature'},401);
      const body=JSON.parse(raw);const eventId=req.headers.get('x-razorpay-event-id')|| (body?.payload?.subscription?.entity?.id?`${body.event}:${body.payload.subscription.entity.id}`:`${body.event}:${body.created_at||Date.now()}`);
      const {error}=await admin.from('payment_events').upsert({event_id:eventId,event_type:body.event,payload:body,received_at:new Date().toISOString()},{onConflict:'event_id'});if(error)throw error;
      const sub=body?.payload?.subscription?.entity;const userId=sub?.notes?.user_id||sub?.notes?.userId;if(userId){await trackPayment(userId,`payment.webhook.${String(body.event||'unknown').replace(/[^a-z0-9_.-]/gi,'_')}`,{plan:sub?.notes?.plan||null,externalId:sub?.id||null,status:sub?.status||null});await admin.from('billing_subscriptions').upsert({user_id:userId,provider:'razorpay',provider_subscription_id:sub.id,status:String(sub.status||'unknown'),plan_key:sub?.notes?.plan||null,current_period_end:sub?.end_at?new Date(sub.end_at*1000).toISOString():null,updated_at:new Date().toISOString()},{onConflict:'provider_subscription_id'});await admin.from('audit_logs').insert({user_id:userId,action:'payment.webhook',metadata:{event:body.event,subscription_id:sub.id}});}
      return json({ok:true});
    }
    const u=await user(req);const body=JSON.parse(raw||'{}');const action=String(body.action||'');
    if(action==='createSubscription'){
      if(!RAZORPAY_KEY_ID||!RAZORPAY_KEY_SECRET)throw new Error('Payment provider is not configured');
      const plan=String(body.plan||'');if(!(plan in PLANS))throw new Error('Unsupported plan');const p=PLANS[plan as keyof typeof PLANS];if(!p.id)throw new Error(`Missing Razorpay plan id for ${plan}`);
      const token=btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
      const r=await fetch('https://api.razorpay.com/v1/subscriptions',{method:'POST',headers:{Authorization:`Basic ${token}`,'Content-Type':'application/json'},body:JSON.stringify({plan_id:p.id,total_count:12,customer_notify:1,notes:{user_id:u.id,plan}})});
      const j=await r.json();if(!r.ok)throw new Error(j?.error?.description||'Razorpay subscription creation failed');
      await admin.from('billing_subscriptions').upsert({user_id:u.id,provider:'razorpay',provider_subscription_id:j.id,status:String(j.status||'created'),plan_key:plan,updated_at:new Date().toISOString()},{onConflict:'provider_subscription_id'});
      await trackPayment(u.id,'payment.checkout_started',{plan,amountPaise:p.amount,externalId:j.id});
      await admin.from('audit_logs').insert({user_id:u.id,action:'payment.subscription_created',metadata:{plan,subscription_id:j.id}});
      return json({ok:true,subscriptionId:j.id,checkoutUrl:j.short_url||null,keyId:RAZORPAY_KEY_ID});
    }
    if(action==='billingStatus'){const {data,error}=await admin.from('billing_subscriptions').select('provider,provider_subscription_id,status,plan_key,current_period_end').eq('user_id',u.id).order('updated_at',{ascending:false}).limit(5);if(error)throw error;return json({ok:true,subscriptions:data||[]});}
    throw new Error('Unknown payment action');
  }catch(e){return json({ok:false,error:e instanceof Error?e.message:String(e)},400);}
});

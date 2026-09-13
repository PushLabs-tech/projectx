(() => {
  'use strict';
  const C=window.BUILDER_CONFIG||{};
  const configured=Boolean(C.SUPABASE_URL&&!C.SUPABASE_URL.includes('YOUR_')&&C.SUPABASE_PUBLISHABLE_KEY&&!C.SUPABASE_PUBLISHABLE_KEY.includes('YOUR_'));
  const sb=configured&&window.supabase?window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_PUBLISHABLE_KEY):null;
  const notice=document.querySelector('#billingNotice');
  const show=(m)=>{notice.textContent=m;notice.classList.remove('hidden')};
  async function start(plan){
    window.BuilderSite?.track?.('billing_plan_selected',{plan});
    if(plan==='free'){location.href='/';return;}
    if(!sb){show('Payments are prepared but not live yet. Add Supabase + Razorpay server secrets when you have a merchant account.');return;}
    const {data:{session}}=await sb.auth.getSession();
    if(!session){location.href='/#signin';return;}
    try{
      const r=await fetch(`${C.SUPABASE_URL}/functions/v1/payments`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':C.SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({action:'createSubscription',plan})});
      const j=await r.json(); if(!r.ok||!j.ok) throw new Error(j.error||'Unable to start checkout');
      if(j.checkoutUrl){window.BuilderSite?.track?.('billing_checkout_redirected',{plan}); location.href=j.checkoutUrl;} else show('Payment provider is configured server-side but no checkout URL was returned. Check the payment setup checklist.');
    }catch(e){show(e.message||'Checkout failed');}
  }
  document.querySelectorAll('[data-plan]').forEach(b=>b.addEventListener('click',()=>start(b.dataset.plan)));
})();

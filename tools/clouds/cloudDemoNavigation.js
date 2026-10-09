export function selectedCloudDemo(url=window.location.href) {
 return new URL(url).searchParams.get('demo')==='planet'?'planet':'flat';
}
export function cloudDemoUrl(demo,url=window.location.href) {
 const target=new URL(url);target.searchParams.set('demo',demo==='planet'?'planet':'flat');return target.href;
}
export function mountCloudDemoNavigation(doc=document,url=window.location.href) {
 if(doc.getElementById('cloud-demo-navigation'))return;
 const nav=doc.createElement('nav');nav.id='cloud-demo-navigation';nav.setAttribute('aria-label','Cloud demos');
 nav.style.cssText='position:fixed;right:12px;bottom:12px;z-index:10000;display:flex;gap:5px;padding:5px;border:1px solid #536783;background:#08111ee8;border-radius:10px;font:13px system-ui,sans-serif;box-shadow:0 2px 12px #0006';
 const current=selectedCloudDemo(url);
 for(const [demo,label] of [['flat','Flat clouds'],['planet','Planet clouds']]){
  const link=doc.createElement('a');link.textContent=label;link.href=cloudDemoUrl(demo,url);
  link.style.cssText='padding:8px 12px;text-decoration:none;color:#e6efff;border-radius:6px;background:'+(demo===current?'#304d73':'#131f31');
  if(demo===current){link.setAttribute('aria-current','page');link.addEventListener('click',event=>event.preventDefault());}
  nav.appendChild(link);
 }
 doc.body.appendChild(nav);
}

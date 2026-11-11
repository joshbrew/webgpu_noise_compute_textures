import {installCloudLabTheme} from './cloudLabUi.js';

export function selectedCloudDemo(url=window.location.href) {
 const demo=new URL(url).searchParams.get('demo');
 return demo==='planet'||demo==='erosion'?demo:'flat';
}
export function cloudDemoUrl(demo,url=window.location.href) {
 const target=new URL(url);target.searchParams.set('demo',demo==='planet'||demo==='erosion'?demo:'flat');return target.href;
}
// A segmented set of real links (switching demos is a full navigation that
// releases the other scene's GPU resources). Styled by cloudLabUi.js; each
// demo moves it into its control rail head, otherwise it floats bottom-right.
export function mountCloudDemoNavigation(doc=document,url=window.location.href) {
 installCloudLabTheme(doc);
 if(doc.getElementById('cloud-demo-navigation'))return;
 const nav=doc.createElement('nav');nav.id='cloud-demo-navigation';nav.setAttribute('aria-label','Noise demos');
 nav.className='cl-switch cl-switch--floating';
 const current=selectedCloudDemo(url);
 for(const [demo,label] of [['flat','Flat clouds'],['planet','Planet clouds'],['erosion','Erosion terrain']]){
  const link=doc.createElement('a');link.textContent=label;link.href=cloudDemoUrl(demo,url);
  if(demo===current){link.setAttribute('aria-current','page');link.addEventListener('click',event=>event.preventDefault());}
  nav.appendChild(link);
 }
 doc.body.appendChild(nav);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedCloudDemo,cloudDemoUrl,mountCloudDemoNavigation} from '../cloudDemoNavigation.js';
test('cloud demo navigation defaults to flat and preserves unrelated URL settings',()=>{
 assert.equal(selectedCloudDemo('http://localhost/demo'),'flat');
 assert.equal(selectedCloudDemo('http://localhost/demo?demo=planet'),'planet');
 assert.equal(selectedCloudDemo('http://localhost/demo?demo=invalid'),'flat');
 assert.equal(cloudDemoUrl('planet','http://localhost/demo?seed=123#controls'),'http://localhost/demo?seed=123&demo=planet#controls');
});
test('demo switch uses accessible document links, highlights the active scene and mounts once',()=>{
 const nodes=[];const doc={getElementById:id=>nodes.find(n=>n.id===id),body:{appendChild:n=>nodes.push(n)},createElement:tag=>({tag,style:{},children:[],attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v},appendChild(n){this.children.push(n)},addEventListener(k,v){this.events[k]=v}})};
 mountCloudDemoNavigation(doc,'http://localhost/?demo=planet');mountCloudDemoNavigation(doc,'http://localhost/?demo=planet');
 assert.equal(nodes.length,1);assert.equal(nodes[0].attrs['aria-label'],'Cloud demos');
 assert.equal(nodes[0].children[1].attrs['aria-current'],'page');
 assert.ok(nodes[0].children.every(n=>n.tag==='a'));
 let prevented=false;nodes[0].children[1].events.click({preventDefault(){prevented=true}});assert.equal(prevented,true);
});

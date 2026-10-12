/* Original Find options, shared by bounded worker and tests. MIT. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipSearchCore=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 function search(lines,query,options={}){
  if(typeof query!=='string'||query.length>2048)throw Error('Search text exceeds 2048 characters.');
  if(!query)return [];
  if(!Array.isArray(lines)||lines.length>20000)throw Error('Search accepts at most 20000 lines.');
  const source=options.regex?query:query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp(source,options.matchCase?'gu':'giu'),result=[];
  let total=0;
  const word=char=>!!char&&/[\p{L}\p{N}_]/u.test(char);
  for(let row=0;row<lines.length;row++){
   const text=String(lines[row]);total+=text.length;if(total>8*1024*1024)throw Error('Search text exceeds 8 MiB.');
   pattern.lastIndex=0;let match;
   while((match=pattern.exec(text))){const start=match.index,end=start+match[0].length;
    if(!options.wholeWord||(!word([...text.slice(0,start)].at(-1))&&!word([...text.slice(end)][0])))result.push({row,start,end,text:match[0]});
    if(result.length>=10000)return result;
    if(!match[0].length){if(end>=text.length)break;pattern.lastIndex=end+(text.codePointAt(end)>0xffff?2:1);}
   }
  }
  return result;
 }
 return {search};
});

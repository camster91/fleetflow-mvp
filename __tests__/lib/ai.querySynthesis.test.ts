import { synthesizeFleetAnswer } from '@/lib/ai/querySynthesis'
const tool={claims:[{text:'Delivery d1 is late.',citationIds:['delivery:d1']}],sources:[{id:'delivery:d1',type:'delivery' as const,recordId:'d1',label:'Delivery d1',href:'/deliveries?record=d1'}]}
const meta={requestId:'r',provider:'test',model:'m',latencyMs:1,usage:{inputTokens:1,outputTokens:1,totalTokens:2}}
test('ships only deterministic claims in provider-selected citation order',()=>{const result=synthesizeFleetAnswer(tool,{content:{sections:[{heading:'x',summary:'invented',citationIds:['delivery:d1']}],claims:[{text:'invented',citationIds:['delivery:d1']}],actions:[]},meta:{...meta,status:'generated' as const}});expect(result.answer.claims).toEqual(tool.claims);expect(JSON.stringify(result)).not.toContain('invented')})
test.each([
 {content:{sections:[],claims:[],actions:[]},meta:{...meta,status:'generated'}},
 {content:{sections:[{heading:'x',summary:'x',citationIds:['delivery:foreign']}],claims:[],actions:[]},meta:{...meta,status:'generated'}},
 {content:{sections:[{heading:'x',summary:'x',citationIds:['delivery:d1']}],claims:[],actions:[]},meta:{...meta,status:'fallback'}},
])('fails malformed, foreign, empty, or reasonless synthesis %#',(generated)=>expect(()=>synthesizeFleetAnswer(tool,generated as never)).toThrow())

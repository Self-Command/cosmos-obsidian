export function taskPrompt(name){return '在宇宙知识库给我创建一个任务，标题“'+name+'”：明天10:30去驾校补交费用，预计1小时，最高优先级。办理原因是补齐报名材料；带身份证与收费通知到窗口核对金额并缴费，带回缴费凭证；完成标准是拿到收据并确认报名记录已更新。事情尚未执行，没有其他项目或领域归属。按当前模板写好行动说明。';}
export function travelPrompt(name){return '把完整材料写成一篇“'+name+'”，放在游记分类，标签旅行，无项目或领域：2026-10-10我和朋友阿岚乘公交去了合成故事中的山城，一天往返，无住宿。出发前想从忙碌的一周里放慢速度，期待看看雨后的老街。这趟旅行的一句话是：临时停留也能成为记忆。清晨8点到老桥，停留约半小时；9点沿河步行到市场，共约2公里；中午在桥边小店吃饭，下午2点公交回家。现场按两个片段写：清晨 · 老桥，雨刚停，桥面有水痕，桥洞里脚步声有回响；我和阿岚取消了赶路计划，在桥边等雨势减小；当时先担心安排被打乱，后来觉得停下观察正好适合这一天。午后 · 回程，街面已经晾干，店门口传来收拾餐具的声音；我们沿原路回车站，核对随身物品，没有再加行程；当时有些疲惫，也接受只留下两个场景。交通与住宿：公交往返24元，没有住宿；吃饭与花费：午饭两人共86元；装备与体力：带雨伞与水，回程步速下降但能继续走；下次会换的安排：少安排一站，给天气变化留出停留余地。最想留下的是清晨桥洞的脚步声；回家后我的看法从走完全部路线变成接受停留本身就是体验；下次愿意再去，路线更短、休息更多。没有拍照与附件，不需查询路线或图片，只创建这一篇游记。这是完整的虚构验收材料。';}
export function qualityIssues(kind,body){
  const issues=[];
  if(/待补充|待填写|TODO|TBD|时间 · 地点|章节 \/ 页码 · 主题/.test(body))issues.push('Empty template scaffold remains');
  if(kind==='task'){for(const fact of ['身份证','收费通知','缴费','凭证','收据','报名'])if(!body.includes(fact))issues.push('Missing supplied task fact: '+fact);if(/已(?:经)?(?:缴费|完成)|已经拿到收据/.test(body))issues.push('Task described as already performed');}
  else {
    for(const fact of ['阿岚','老桥','雨','脚步','24','86','2026-10-10'])if(!body.includes(fact))issues.push('Missing supplied travel fact: '+fact);
    // Chapters alone do not prove the supplied itinerary was retained. Accept
    // common Chinese/Arabic time expressions rather than requiring exact prose.
    const itineraryFacts=[
      ['08:00 bridge arrival',/(?:0?8|八)\s*(?:[:：]00|点|时)/],
      ['09:00 market walk',/(?:0?9|九)\s*(?:[:：]00|点|时)/],
      ['14:00 bus return',/(?:(?:14|十四)\s*(?:[:：]00|点|时)|(?:下午|午后)[^\n]{0,40}?(?:2|两|二)\s*(?:[:：]00|点|时))/],
      ['half-hour stop',/半(?:个)?小时|(?:30|三十)\s*分钟/],
      ['two-kilometre river walk',/(?:2|两|二)\s*(?:公里|千米)|2\s*km/i],
      ['market destination',/市场/],
      ['riverside meal',/桥边小店/],
      ['no overnight stay',/无住宿|没有住宿|不(?:需|用)?住宿/],
      ['umbrella and water',/雨伞[\s\S]*水|水[\s\S]*雨伞/],
      ['slower return walking pace',/步速[\s\S]{0,12}(?:下降|降低|放慢|变慢|慢)|(?:放慢|慢了)[\s\S]{0,8}脚步/]
    ];
    for(const [fact,pattern]of itineraryFacts)if(!pattern.test(body))issues.push('Missing supplied travel fact: '+fact);
    if(!/###\s+清晨\s*·\s*老桥/.test(body)||! /###\s+午后\s*·\s*回程/.test(body))issues.push('Both concrete scenes required');
    if((body.match(/\*\*眼前的景象\*\*/g)??[]).length!==2||(body.match(/\*\*当时发生的事\*\*/g)??[]).length!==2||(body.match(/\*\*那一刻的感受\*\*/g)??[]).length!==2)issues.push('Scene responsibilities were not repeated separately');
    if(body.includes('!['))issues.push('Invented image reference');
    if(body.length<650)issues.push('Complete supplied story was abbreviated below the rubric');
  }
  return issues;
}

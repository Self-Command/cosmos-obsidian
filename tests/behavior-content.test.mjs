import {it,expect} from 'vitest';
import {qualityIssues} from '../tools/behavior/cases.mjs';

const body=`# 雨后山城一日游记

## 旅程概览

2026-10-10，我和朋友阿岚乘公交到合成故事中的山城，一天往返，无住宿。这趟旅行的一句话是：临时停留也能成为记忆。

## 出发之前

忙碌的一周过去，我想把节奏放慢一些，也期待看看雨后的老街。出发前原本想走完全部路线，途中才发现临时停下来观察也适合这一天。

## 路线与节奏

清晨8点到老桥，停留约半小时；9点沿河步行到市场，约2公里；中午在桥边小店吃饭；下午2点乘公交回家。因雨取消赶路计划，在桥边等雨势减小；回程沿原路走到车站，没有再加行程。

## 旅途现场

### 清晨 · 老桥

**眼前的景象**

雨刚停，桥面留着水痕，桥洞里的脚步声有回响。最想留下的就是这些脚步声，而不是另一个需要赶到的景点。

**当时发生的事**

我和阿岚取消了赶路计划，在桥边等雨势减小。我们没有继续追赶原来的节奏，而是在桥边停留约半小时，再沿河走向市场。

**那一刻的感受**

起初担心安排被打乱，后来觉得停下来观察正好适合这一天。路线并没有全部走完，但桥边的停留留下了可以回看的记忆。

### 午后 · 回程

**眼前的景象**

街面已经晾干，店门口传来收拾餐具的声音。与清晨桥洞里的回声相比，午后的声音更接近日常生活。

**当时发生的事**

我们沿原路回车站，核对随身物品，没有再增加行程。这一天只留下两个场景，也已经可以按原来的路线返回。

**那一刻的感受**

有些疲惫，也接受这趟旅程只留下两个场景。回程步速下降，但还能继续走，没有必要再增加一站。

## 实用备忘

公交往返24元；当天往返，没有住宿。桥边小店午饭两人共86元。带了雨伞和水；回程步速下降，但还能继续走。下次少安排一站，给天气变化留出停留余地。

## 回到日常

最想留下的是清晨桥洞里的脚步声。回家后，我从想着走完全部路线，变成接受停留本身就是体验。愿意再去，路线更短、休息更多。
`;

it('accepts supplied itinerary facts in Chinese and colon time formats',()=>{
  expect(qualityIssues('travel',body)).toEqual([]);
  expect(qualityIssues('travel',body.replace('8点','08:00').replace('9点','09:00').replace('下午2点','14:00'))).toEqual([]);
});

it('rejects omitted itinerary details even when chapters and scene labels remain',()=>{
  expect(qualityIssues('travel',body.replace('9点','上午'))).toContain('Missing supplied travel fact: 09:00 market walk');
  expect(qualityIssues('travel',body.replace('约2公里','一段路'))).toContain('Missing supplied travel fact: two-kilometre river walk');
});

"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CalendarClock, Check, ChevronRight, CircleAlert, Eye, FileCheck2, MoreHorizontal, Play, RefreshCw, Rocket, Sparkles, TrendingUp, Tv, Users, WandSparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const metrics = [
  { label: "이번 주 게시", value: "12", change: "+3", icon: Rocket, color: "text-primary", path: "M1 26 C16 24 20 20 32 21 S49 11 63 13 S82 4 99 7" },
  { label: "총 조회수", value: "284.7K", change: "+38.2%", icon: Eye, color: "text-info", path: "M1 26 C14 20 18 24 31 17 S48 19 61 9 S82 15 99 2" },
  { label: "평균 시청 유지율", value: "78.4%", change: "+6.1%", icon: TrendingUp, color: "text-success", path: "M1 24 C15 25 20 19 31 21 S49 14 61 16 S82 8 99 6" },
  { label: "구독 전환", value: "1.82%", change: "+0.24%p", icon: Users, color: "text-warning", path: "M1 25 C18 16 24 23 37 15 S54 21 65 11 S86 10 99 4" },
];

const pipeline = [
  { title: "AI가 일자리를 바꾸는 3가지 신호", stage: "하이라이트 분석", progress: 68, color: "from-[#6d5dfc] to-[#30257c]", eta: "약 4분", status: "processing" },
  { title: "퇴근 후 10분, 생산성 루틴", stage: "검토 대기", progress: 100, color: "from-[#136f75] to-[#082f36]", eta: "품질 92점", status: "review" },
  { title: "2026년에 꼭 배워야 할 AI 도구", stage: "오늘 오후 7:30", progress: 100, color: "from-[#9b4b2b] to-[#452014]", eta: "예약됨", status: "scheduled" },
  { title: "성공하는 사람들의 메모 습관", stage: "게시됨", progress: 100, color: "from-[#2f654b] to-[#132d24]", eta: "18.4K 조회", status: "published" },
];

export function DashboardPage() {
  const [insightApplied, setInsightApplied] = useState(false);
  return <div className="space-y-6">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-success" /> 모든 자동화가 정상이에요 <span>·</span> 7월 13일 월요일</div><h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] md:text-[32px]">좋은 오후예요, 승준님</h1><p className="mt-2 text-sm text-muted-foreground">쇼츠는 자동으로, 성장은 더 똑똑하게. 오늘도 콘텐츠가 움직이고 있어요.</p></div>
      <Button asChild size="lg"><Link href="/create"><WandSparkles /> 새 쇼츠 만들기</Link></Button>
    </section>

    <section className="flex flex-col gap-3 rounded-2xl border border-warning/20 bg-warning/[.06] p-4 sm:flex-row sm:items-center">
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning"><CircleAlert className="size-4" /></div>
      <div className="flex-1"><p className="text-sm font-semibold">검토가 필요한 쇼츠가 2개 있어요</p><p className="mt-1 text-xs text-muted-foreground">품질 기준을 통과했지만 음원 권리와 합성 미디어 표시를 확인해야 합니다.</p></div>
      <Button variant="secondary" size="sm" asChild><Link href="/content">지금 검토하기 <ArrowRight /></Link></Button>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, change, icon: Icon, color, path }) => <Card key={label} className="overflow-hidden"><CardContent className="relative p-[18px]"><div className="mb-4 flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">{label}</span><Icon className={`size-4 ${color}`} /></div><div className="flex items-end justify-between gap-3"><div><p className="tabular text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-[11px] text-success"><span className="font-semibold">{change}</span> <span className="text-muted-foreground">지난주 대비</span></p></div><svg viewBox="0 0 100 32" className="h-9 w-24 overflow-visible" aria-hidden="true"><path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`metric-line ${color}`} /><path d={`${path} L99 32 L1 32 Z`} fill="currentColor" opacity=".06" className={color} /></svg></div></CardContent></Card>)}
    </section>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.7fr)]">
      <Card>
        <CardHeader><div><CardTitle>제작 파이프라인</CardTitle><CardDescription>원본 분석부터 게시까지 한눈에 확인하세요.</CardDescription></div><Button variant="ghost" size="sm" asChild><Link href="/content">전체 보기 <ChevronRight /></Link></Button></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pipeline.map((item, index) => <article key={item.title} className="group rounded-xl border border-border bg-background/45 p-2.5 transition hover:-translate-y-0.5 hover:border-primary/30">
            <div className={`relative aspect-[9/12] overflow-hidden rounded-[10px] bg-gradient-to-br ${item.color} noise-grid`}>
              <div className="absolute left-2 top-2"><Badge variant={item.status === "processing" ? "violet" : item.status === "review" ? "warning" : item.status === "scheduled" ? "info" : "success"}>{item.status === "processing" && <RefreshCw className="size-2.5 animate-spin" />}{item.stage}</Badge></div>
              <span className="absolute right-2 top-2 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[9px]">0:{index === 0 ? "38" : index === 1 ? "42" : "31"}</span>
              <div className="absolute inset-x-3 bottom-8 whitespace-pre-line rounded-md bg-white/[.08] px-2 py-1.5 text-center text-[11px] font-bold leading-4 text-white backdrop-blur-sm">{index % 2 === 0 ? "지금 놓치면\n늦습니다" : "단 10분이\n인생을 바꿉니다"}</div>
              {item.status !== "processing" && <button aria-label={`${item.title} 미리보기`} className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100"><span className="grid size-9 place-items-center rounded-full bg-white/90 text-black"><Play className="size-4 fill-current" /></span></button>}
            </div>
            <p className="mt-2.5 line-clamp-2 min-h-9 text-xs font-semibold leading-[18px]">{item.title}</p><div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>{item.eta}</span><MoreHorizontal className="size-3.5" /></div>{item.status === "processing" && <Progress value={item.progress} className="mt-2" />}
          </article>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>이번 주 일정</CardTitle><CardDescription>성과가 좋은 시간대를 우선 추천해요.</CardDescription></div><CalendarClock className="size-4 text-muted-foreground" /></CardHeader>
        <CardContent className="space-y-1">
          {[["오늘", "19:30", "AI 도구 3가지", "scheduled"], ["화", "12:10", "몰입을 만드는 법", "ready"], ["수", "19:40", "최적 시간 비어 있음", "suggested"], ["목", "18:50", "월급 관리 루틴", "scheduled"], ["금", "20:10", "콘텐츠 아이디어 공식", "review"]].map(([day, time, title, status]) => <div key={`${day}${time}`} className={`flex items-center gap-3 rounded-xl p-2.5 ${status === "suggested" ? "border border-dashed border-primary/35 bg-primary/[.05]" : "hover:bg-accent"}`}><div className="w-8 text-center"><p className="text-[10px] text-muted-foreground">{day}</p><p className="font-mono text-[11px] font-semibold">{time}</p></div><span className={`h-8 w-0.5 rounded-full ${status === "suggested" ? "bg-primary" : status === "review" ? "bg-warning" : "bg-info"}`} /><div className="min-w-0 flex-1"><p className={`truncate text-xs font-medium ${status === "suggested" ? "text-primary" : ""}`}>{title}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{status === "suggested" ? "평균 조회수 +21% 예상" : status === "review" ? "검토 후 예약" : "@Junlee Lab"}</p></div>{status === "suggested" && <button aria-label="추천 시간에 예약" className="grid size-7 place-items-center rounded-lg bg-primary text-white"><CalendarClock className="size-3" /></button>}</div>)}
          <Button variant="secondary" className="mt-3 w-full" asChild><Link href="/calendar">캘린더에서 보기</Link></Button>
        </CardContent>
      </Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.7fr)]">
      <Card>
        <CardHeader><div><CardTitle>성과 추이</CardTitle><CardDescription>지난 7일 동안 쇼츠 12개가 만든 성과입니다.</CardDescription></div><div className="flex rounded-lg border border-border bg-background p-0.5 text-[10px]"><button className="rounded-md bg-secondary px-2.5 py-1.5 font-semibold">조회수</button><button className="px-2.5 py-1.5 text-muted-foreground">유지율</button><button className="px-2.5 py-1.5 text-muted-foreground">전환</button></div></CardHeader>
        <CardContent className="pt-3"><div className="mb-3 flex items-end gap-3"><p className="tabular text-2xl font-bold">284,732</p><Badge variant="success"><TrendingUp className="size-2.5" />38.2%</Badge></div><div className="relative h-48 w-full"><div className="absolute inset-0 flex flex-col justify-between text-[9px] text-muted-foreground">{["80K", "60K", "40K", "20K", "0"].map((v) => <div key={v} className="flex items-center gap-2"><span className="w-7 text-right">{v}</span><span className="h-px flex-1 bg-border/70" /></div>)}</div><svg viewBox="0 0 700 180" className="absolute inset-0 h-full w-full pl-9" preserveAspectRatio="none" aria-label="조회수 상승 추이"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7c5cff" stopOpacity=".34" /><stop offset="1" stopColor="#7c5cff" stopOpacity="0" /></linearGradient></defs><path d="M0 150 C60 145 75 118 132 126 S221 83 283 92 S362 62 421 68 S510 24 566 43 S645 16 700 12 L700 180 L0 180Z" fill="url(#chartFill)" /><path d="M0 150 C60 145 75 118 132 126 S221 83 283 92 S362 62 421 68 S510 24 566 43 S645 16 700 12" fill="none" stroke="#8c74ff" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg></div><div className="ml-9 mt-2 grid grid-cols-7 text-center text-[9px] text-muted-foreground">{["7/7","7/8","7/9","7/10","7/11","7/12","오늘"].map((d) => <span key={d}>{d}</span>)}</div></CardContent>
      </Card>

      <Card className="overflow-hidden border-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(124,92,255,.12),transparent_42%),#11131a]">
        <CardHeader><div className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary"><Sparkles className="size-4" /></div><Badge variant="violet">신뢰도 높음</Badge></CardHeader>
        <CardContent><p className="text-[11px] font-semibold uppercase tracking-wider text-primary">AI가 이번 주 배운 점</p><h3 className="mt-3 text-lg font-bold leading-7">질문형 훅을 쓰면<br />3초 유지율이 <span className="text-success">12% 높아요.</span></h3><p className="mt-3 text-xs leading-5 text-muted-foreground">최근 쇼츠 28개를 비교했어요. 특히 28~36초 길이에서 효과가 가장 컸습니다.</p><div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-background/50 p-3 text-center"><div><p className="font-mono text-sm font-bold">28</p><p className="text-[9px] text-muted-foreground">표본</p></div><div><p className="font-mono text-sm font-bold text-success">+12%</p><p className="text-[9px] text-muted-foreground">예상 향상</p></div><div><p className="font-mono text-sm font-bold">94%</p><p className="text-[9px] text-muted-foreground">신뢰도</p></div></div><div className="mt-4 flex gap-2"><Button className="flex-1" size="sm" disabled={insightApplied} onClick={() => setInsightApplied(true)}>{insightApplied ? <><Check /> 실험에 추가됨</> : <><Zap /> 5개에 시험하기</>}</Button><Button variant="secondary" size="sm" asChild><Link href="/growth">근거</Link></Button></div><p className="mt-3 text-[10px] leading-4 text-muted-foreground">자동 적용하지 않습니다. 결과를 확인한 후 승격하거나 되돌릴 수 있어요.</p></CardContent>
      </Card>
    </section>

    <Card><CardHeader><div><CardTitle>최근 활동</CardTitle><CardDescription>자동화와 팀의 주요 변경 이력이 모두 기록됩니다.</CardDescription></div><Button variant="ghost" size="sm">감사 로그</Button></CardHeader><CardContent className="grid gap-2 pt-3 md:grid-cols-3">{[
      [FileCheck2, "쇼츠 3개 렌더 완료", "AI 인터뷰 하이라이트 · 12분 전", "text-success"], [Tv, "예약 게시 성공", "@Junlee Lab · 오늘 12:10", "text-[#ff3355]"], [Zap, "학습 규칙 v12 후보 생성", "질문형 훅 실험 · 1시간 전", "text-primary"],
    ].map(([Icon, title, desc, color]) => { const I = Icon as typeof FileCheck2; return <div key={String(title)} className="flex items-center gap-3 rounded-xl bg-background/45 p-3"><div className={`grid size-8 place-items-center rounded-lg bg-secondary ${color}`}><I className="size-3.5" /></div><div><p className="text-xs font-semibold">{String(title)}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{String(desc)}</p></div></div>; })}</CardContent></Card>
  </div>;
}

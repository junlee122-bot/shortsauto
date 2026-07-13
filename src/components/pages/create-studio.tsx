"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, FileUp, Film, Link2, LoaderCircle, Lock, MessageSquareText, Mic2, Play, ShieldCheck, Sparkles, Tv, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Mode = "repurpose" | "upload" | "idea";

const modes = [
  { id: "repurpose" as const, title: "긴 영상에서 추출", desc: "YouTube 링크에서 반응 좋은 순간 찾기", icon: Tv },
  { id: "upload" as const, title: "파일 편집", desc: "내 영상에 자막과 리프레임 적용", icon: FileUp },
  { id: "idea" as const, title: "아이디어로 생성", desc: "주제만 입력하면 대본부터 완성", icon: Sparkles },
];

export function CreateStudio() {
  const [mode, setMode] = useState<Mode>("repurpose");
  const [source, setSource] = useState("https://youtube.com/watch?v=your-video");
  const [topic, setTopic] = useState("AI 시대에도 대체되지 않는 사람들의 공통점");
  const [audience, setAudience] = useState("20~30대 직장인과 1인 창작자");
  const [duration, setDuration] = useState(35);
  const [clips, setClips] = useState(6);
  const [tone, setTone] = useState("energetic");
  const [subtitles, setSubtitles] = useState(true);
  const [broll, setBroll] = useState(true);
  const [silence, setSilence] = useState(true);
  const [autoMode, setAutoMode] = useState<"recommend" | "approval" | "auto">("approval");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  const estimate = useMemo(() => Math.max(18, Math.round(clips * duration * 0.2)), [clips, duration]);

  async function generate() {
    setLoading(true); setComplete(false); setError(""); setProgress(14);
    const timer = window.setInterval(() => setProgress((value) => Math.min(86, value + 9)), 420);
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic: mode === "idea" ? topic : `원본 영상에서 ${topic} 관점의 하이라이트 추출`, audience, durationSeconds: duration, tone, quality: "balanced", language: "ko", aspectRatio: "9:16" }) });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error?.message ?? "생성 요청을 시작하지 못했어요.");
      localStorage.setItem("shortsauto:last-generation", JSON.stringify({ ...payload, createdAt: new Date().toISOString(), source, clips }));
      setProgress(100); setComplete(true);
    } catch (e) { setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요."); }
    finally { window.clearInterval(timer); setLoading(false); }
  }

  return <div className="space-y-6">
    <div className="flex items-center gap-3"><Button variant="ghost" size="icon" asChild><Link href="/" aria-label="대시보드로 돌아가기"><ArrowLeft /></Link></Button><div><h1 className="text-2xl font-bold tracking-tight md:text-[28px]">새 쇼츠 만들기</h1><p className="mt-1 text-sm text-muted-foreground">원본 하나에서 아이디어, 편집, 예약까지 한 번에 끝내세요.</p></div></div>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Card><CardHeader><div><CardTitle>1. 시작 방법</CardTitle><CardDescription>원본을 재활용하거나 아이디어만으로 새 영상을 만들 수 있어요.</CardDescription></div><Badge variant="violet">STEP 1</Badge></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">{modes.map(({ id, title, desc, icon: Icon }) => <button key={id} onClick={() => setMode(id)} className={cn("rounded-xl border p-4 text-left transition hover:border-primary/50", mode === id ? "border-primary bg-primary/[.07] ring-1 ring-primary/20" : "border-border bg-background/40")}><div className={cn("mb-3 grid size-9 place-items-center rounded-xl", mode === id ? "bg-primary text-white" : "bg-secondary text-muted-foreground")}><Icon className="size-4" /></div><p className="text-sm font-semibold">{title}</p><p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{desc}</p></button>)}</CardContent></Card>

        <Card><CardHeader><div><CardTitle>2. 콘텐츠 방향</CardTitle><CardDescription>AI가 어떤 순간과 메시지에 집중할지 알려주세요.</CardDescription></div><Badge variant="neutral">필수</Badge></CardHeader><CardContent className="space-y-4">
          {mode !== "idea" ? <label className="block"><span className="mb-2 block text-xs font-semibold">{mode === "repurpose" ? "YouTube URL" : "영상 파일"}</span>{mode === "repurpose" ? <div className="relative"><Link2 className="absolute left-3 top-3 size-4 text-muted-foreground" /><input value={source} onChange={(e) => setSource(e.target.value)} className="h-10 w-full rounded-[10px] border border-input bg-background pl-10 pr-3 text-sm outline-none focus:border-primary" /><div className="mt-2 flex items-center gap-2 rounded-xl bg-secondary/50 p-3"><div className="grid size-10 place-items-center rounded-lg bg-[#ff0033]/15 text-[#ff3355]"><Tv className="size-4" /></div><div className="min-w-0"><p className="truncate text-xs font-semibold">링크를 분석해 영상 정보와 자막을 불러옵니다</p><p className="mt-0.5 text-[10px] text-muted-foreground">공개 또는 연결된 채널의 영상만 사용할 수 있어요.</p></div><Badge variant="success" className="ml-auto">준비</Badge></div></div> : <button className="flex h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/40 text-muted-foreground hover:border-primary/50 hover:text-foreground"><FileUp className="mb-2 size-5" /><span className="text-xs font-semibold">MP4, MOV 또는 WebM 업로드</span><span className="mt-1 text-[10px]">최대 4GB · 직접 업로드</span></button>}</label> : null}
          <div className="grid gap-4 md:grid-cols-2"><label><span className="mb-2 block text-xs font-semibold">어떤 내용을 만들까요?</span><textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} className="w-full resize-none rounded-[10px] border border-input bg-background p-3 text-sm leading-5 outline-none focus:border-primary" /></label><label><span className="mb-2 block text-xs font-semibold">핵심 시청자</span><textarea value={audience} onChange={(e) => setAudience(e.target.value)} rows={3} className="w-full resize-none rounded-[10px] border border-input bg-background p-3 text-sm leading-5 outline-none focus:border-primary" /></label></div>
          <div className="grid gap-4 sm:grid-cols-3"><label><span className="mb-2 block text-xs font-semibold">목표 길이</span><select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="h-10 w-full rounded-[10px] border border-input bg-background px-3 text-sm outline-none"><option value={20}>20초 · 빠른 훅</option><option value={35}>35초 · 균형</option><option value={50}>50초 · 깊은 설명</option><option value={60}>60초 · 최대</option></select></label><label><span className="mb-2 block text-xs font-semibold">생성 개수</span><select value={clips} onChange={(e) => setClips(Number(e.target.value))} className="h-10 w-full rounded-[10px] border border-input bg-background px-3 text-sm outline-none"><option value={3}>3개</option><option value={6}>6개</option><option value={10}>10개</option></select></label><label><span className="mb-2 block text-xs font-semibold">톤</span><select value={tone} onChange={(e) => setTone(e.target.value)} className="h-10 w-full rounded-[10px] border border-input bg-background px-3 text-sm outline-none"><option value="energetic">에너지 있게</option><option value="educational">쉽고 전문적으로</option><option value="storytelling">스토리텔링</option><option value="witty">재치 있게</option><option value="calm">차분하게</option></select></label></div>
        </CardContent></Card>

        <Card><CardHeader><div><CardTitle>3. 스타일과 자동화</CardTitle><CardDescription>브랜드는 일관되게, 공개 전 통제권은 명확하게 설정합니다.</CardDescription></div><Badge variant="success"><ShieldCheck className="size-2.5" /> 안전 기준 적용</Badge></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><ToggleRow icon={MessageSquareText} title="한국어 동적 자막" desc="조사·어미를 지키는 2줄 분절" checked={subtitles} onCheckedChange={setSubtitles} /><ToggleRow icon={Film} title="AI B-roll" desc="맥락에 맞는 권리 안전 자산" checked={broll} onCheckedChange={setBroll} /><ToggleRow icon={Mic2} title="무음·필러 제거" desc="호흡은 살리고 군더더기만 제거" checked={silence} onCheckedChange={setSilence} /></div><div><p className="mb-2 text-xs font-semibold">자동화 수준</p><div className="grid gap-2 sm:grid-cols-3">{[["recommend","추천만","모든 결과를 직접 검토"],["approval","승인 후 실행","품질 통과 후 한 번에 승인"],["auto","기준 충족 시 자동","승인한 규칙 안에서만 예약"]].map(([id,title,desc]) => <button key={id} onClick={() => setAutoMode(id as typeof autoMode)} className={cn("rounded-xl border p-3 text-left", autoMode === id ? "border-primary bg-primary/[.06]" : "border-border")}><span className="flex items-center gap-2 text-xs font-semibold">{autoMode === id && <Check className="size-3 text-primary" />}{title}</span><span className="mt-1 block text-[10px] text-muted-foreground">{desc}</span></button>)}</div></div></CardContent></Card>
      </div>

      <aside className="xl:sticky xl:top-[88px] xl:self-start">
        <Card className="overflow-hidden"><CardHeader><div><CardTitle>생성 요약</CardTitle><CardDescription>요청 전에 예상 결과를 확인하세요.</CardDescription></div><Badge variant="violet">DEMO READY</Badge></CardHeader><CardContent className="space-y-4">
          <div className="relative mx-auto aspect-[9/16] w-[180px] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_70%_20%,rgba(45,212,191,.35),transparent_30%),linear-gradient(145deg,#2f216e,#11131a_65%)] shadow-2xl safe-area"><div className="absolute left-3 top-3 rounded-full bg-black/35 px-2 py-1 text-[9px] backdrop-blur">9:16 · 1080p</div><div className="absolute inset-x-4 bottom-[28%] text-center text-lg font-black leading-6 tracking-tight text-white">대체되지 않는 사람은<br /><span className="rounded bg-[#ffe353] px-1 text-black">이것이 다릅니다</span></div><div className="absolute bottom-4 left-4 flex items-center gap-2 text-[9px]"><span className="grid size-5 place-items-center rounded-full bg-primary font-bold">J</span>@Junlee Lab</div><button aria-label="미리보기 재생" className="absolute inset-0 grid place-items-center"><span className="grid size-11 place-items-center rounded-full border border-white/15 bg-black/35 backdrop-blur"><Play className="size-4 fill-white" /></span></button></div>
          <div className="space-y-2 rounded-xl bg-background/55 p-3 text-xs"><SummaryRow label="예상 결과" value={`${clips}개 쇼츠`} /><SummaryRow label="목표 길이" value={`각 ${duration}초`} /><SummaryRow label="예상 처리" value="8~12분" /><SummaryRow label="예상 사용량" value={`약 ${estimate}분`} /><SummaryRow label="자동화" value={autoMode === "recommend" ? "추천만" : autoMode === "approval" ? "승인 후 실행" : "기준 충족 시 자동"} /></div>
          {loading && <div className="rounded-xl border border-primary/20 bg-primary/[.05] p-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold"><LoaderCircle className="size-3 animate-spin text-primary" /> 콘텐츠 구조와 훅을 설계하는 중…</div><Progress value={progress} /><p className="mt-2 text-[10px] text-muted-foreground">원본은 안전하게 보관되며 실패한 단계부터 재개할 수 있어요.</p></div>}
          {complete && <div className="rounded-xl border border-success/20 bg-success/[.06] p-3"><p className="flex items-center gap-2 text-xs font-semibold text-success"><Check className="size-3" /> 생성 파이프라인을 시작했어요</p><p className="mt-1.5 text-[10px] text-muted-foreground">데모 제공자가 구조화된 대본·장면·품질 검사를 만들었습니다.</p></div>}
          {error && <div className="rounded-xl border border-destructive/20 bg-destructive/[.06] p-3"><p className="flex items-center gap-2 text-xs font-semibold text-destructive"><CircleAlert className="size-3" /> 작업을 시작하지 못했어요</p><p className="mt-1.5 text-[10px] text-muted-foreground">{error}</p></div>}
          {!complete ? <Button size="lg" className="w-full" disabled={loading || !topic.trim()} onClick={generate}>{loading ? <><LoaderCircle className="animate-spin" /> 생성 준비 중</> : <><WandSparkles /> {clips}개 쇼츠 만들기</>}</Button> : <Button size="lg" className="w-full" asChild><Link href="/content">결과 검토하기 <ArrowRight /></Link></Button>}
          <p className="flex items-center justify-center gap-1.5 text-center text-[10px] text-muted-foreground"><Lock className="size-3" /> 게시 전 정책·저작권·합성 미디어 표시를 검사합니다.</p>
        </CardContent></Card>
      </aside>
    </div>
  </div>;
}

function ToggleRow({ icon: Icon, title, desc, checked, onCheckedChange }: { icon: typeof Film; title: string; desc: string; checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border bg-background/35 p-3"><div className="grid size-8 place-items-center rounded-lg bg-secondary text-muted-foreground"><Icon className="size-3.5" /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{title}</p><p className="mt-0.5 truncate text-[9px] text-muted-foreground">{desc}</p></div><Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} /></div>;
}
function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>; }

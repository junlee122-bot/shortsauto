"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell, CalendarDays, ChevronDown, CircleHelp, Command, CreditCard,
  FileVideo2, LayoutDashboard, Menu, Palette, Search, Settings,
  Sparkles, Tv, WandSparkles, Workflow, X, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const nav = [
  { href: "/", label: "개요", icon: LayoutDashboard },
  { href: "/create", label: "새 쇼츠 만들기", icon: WandSparkles, featured: true },
  { href: "/automations", label: "자동화", icon: Workflow },
  { href: "/content", label: "콘텐츠", icon: FileVideo2 },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/growth", label: "성장 분석", icon: Sparkles },
  { href: "/brand", label: "브랜드 키트", icon: Palette },
  { href: "/settings", label: "연동 및 설정", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matches = useMemo(() => nav.filter((item) => item.label.includes(query.trim())), [query]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main-content" className="sr-only z-[100] rounded bg-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">본문으로 건너뛰기</a>
      <Sidebar pathname={pathname} open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="min-h-screen lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="메뉴 열기" onClick={() => setMobileOpen(true)}><Menu /></Button>
            <button className="hidden h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold hover:bg-accent sm:flex">
              <span className="grid size-6 place-items-center rounded-md bg-primary/15 text-[11px] font-bold text-primary">JL</span>
              Junlee Studio <ChevronDown className="size-3 text-muted-foreground" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setSearchOpen(true)} className="hidden h-9 w-56 items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 text-left text-xs text-muted-foreground transition hover:border-primary/40 md:flex">
              <Search className="size-3.5" /> 무엇이든 찾아보세요 <kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </button>
            <div className="hidden items-center gap-2 rounded-lg border border-success/15 bg-success/5 px-2.5 py-1.5 text-xs text-success sm:flex"><Tv className="size-4" /> 채널 연결됨</div>
            <Button variant="ghost" size="icon" aria-label="알림"><Bell /><span className="absolute mt-[-18px] ml-[18px] size-1.5 rounded-full bg-destructive" /></Button>
            <button className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-primary to-[#2dd4bf] text-xs font-bold text-white">승준</button>
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-[1480px] px-4 pb-24 pt-6 md:px-7 md:pt-7 lg:pb-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 px-1 py-1.5 backdrop-blur-xl lg:hidden" aria-label="모바일 내비게이션">
        {nav.slice(0, 5).map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] text-muted-foreground", active && "bg-primary/10 text-primary", item.featured && "-mt-4")}>
            <span className={cn("grid size-7 place-items-center", item.featured && "size-11 rounded-full bg-primary text-white shadow-lg")}><Icon className="size-4" /></span>{item.featured ? "만들기" : item.label}
          </Link>;
        })}
      </nav>

      {searchOpen && <div className="fixed inset-0 z-50 bg-black/60 p-4 backdrop-blur-sm" onMouseDown={() => setSearchOpen(false)}>
        <div className="mx-auto mt-[12vh] max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 border-b border-border px-4"><Search className="size-4 text-muted-foreground" /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} className="h-14 flex-1 bg-transparent text-sm outline-none" placeholder="페이지, 프로젝트, 자동화 검색" /><Button variant="ghost" size="icon" onClick={() => setSearchOpen(false)}><X /></Button></div>
          <div className="p-2">
            <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">빠른 이동</p>
            {matches.map((item) => <button key={item.href} onClick={() => { router.push(item.href); setSearchOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-accent"><item.icon className="size-4 text-muted-foreground" />{item.label}<span className="ml-auto text-xs text-muted-foreground">이동</span></button>)}
          </div>
        </div>
      </div>}
    </div>
  );
}

function Sidebar({ pathname, open, onClose }: { pathname: string; open: boolean; onClose: () => void }) {
  return <>
    {open && <button className="fixed inset-0 z-40 bg-black/60 lg:hidden" aria-label="메뉴 닫기" onClick={onClose} />}
    <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-border bg-card px-3 py-4 transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
      <div className="mb-4 flex h-10 items-center gap-2.5 px-2">
        <div className="relative grid size-8 place-items-center rounded-xl bg-primary text-white"><Zap className="size-4 fill-current" /><span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-card bg-success" /></div>
        <div><p className="text-sm font-bold tracking-tight">ShortsAuto</p><p className="text-[10px] text-muted-foreground">AI Growth Studio</p></div>
        <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={onClose}><X /></Button>
      </div>
      <nav className="space-y-1" aria-label="주 내비게이션">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} onClick={onClose} className={cn("flex h-10 items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground", active && "bg-primary/10 text-primary", item.featured && !active && "mb-3 bg-primary text-white hover:bg-primary/90 hover:text-white")}><Icon className="size-4" />{item.label}{item.href === "/automations" && <Badge variant="success" className="ml-auto px-1.5">3</Badge>}</Link>;
        })}
      </nav>
      <div className="mt-auto space-y-2">
        <div className="rounded-xl border border-border bg-background/50 p-3">
          <div className="mb-2 flex items-center justify-between text-[11px]"><span className="font-semibold">7월 사용량</span><span className="font-mono text-muted-foreground">68 / 120분</span></div>
          <Progress value={57} /><p className="mt-2 text-[10px] leading-4 text-muted-foreground">이번 달 렌더 시간이 52분 남았어요.</p>
        </div>
        <div className="grid grid-cols-2 gap-1"><button className="flex items-center gap-2 rounded-lg p-2 text-[11px] text-muted-foreground hover:bg-accent"><CircleHelp className="size-3.5" /> 도움말</button><button className="flex items-center gap-2 rounded-lg p-2 text-[11px] text-muted-foreground hover:bg-accent"><CreditCard className="size-3.5" /> 요금제</button></div>
        <div className="flex items-center gap-2 border-t border-border px-2 pt-3"><div className="grid size-8 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">이</div><div className="min-w-0"><p className="truncate text-xs font-semibold">이승준</p><p className="truncate text-[10px] text-muted-foreground">Pro workspace</p></div><Command className="ml-auto size-3.5 text-muted-foreground" /></div>
      </div>
    </aside>
  </>;
}

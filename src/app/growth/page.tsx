import type { Metadata } from "next";
import { GrowthPage } from "@/components/pages/growth-page";
export const metadata: Metadata = { title: "성장 실험실" };
export default function Page() { return <GrowthPage />; }

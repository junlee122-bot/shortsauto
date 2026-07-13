import type { Metadata } from "next";
import { SettingsPage } from "@/components/pages/settings-page";
export const metadata: Metadata = { title: "연동 및 설정" };
export default function Page() { return <SettingsPage />; }

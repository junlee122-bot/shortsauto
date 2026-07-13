import type { Metadata } from "next";
import { AutomationsPage } from "@/components/pages/automations-page";
export const metadata: Metadata = { title: "자동화" };
export default function Page() { return <AutomationsPage />; }

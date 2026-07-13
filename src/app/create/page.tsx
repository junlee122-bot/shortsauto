import type { Metadata } from "next";
import { CreateStudio } from "@/components/pages/create-studio";

export const metadata: Metadata = { title: "새 쇼츠 만들기" };
export default function CreatePage() { return <CreateStudio />; }

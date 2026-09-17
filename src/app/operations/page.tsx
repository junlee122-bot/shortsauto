import type { Metadata } from "next";

import { OperationsPage } from "@/components/pages/operations-page";

export const metadata: Metadata = {
  title: "Operations",
};

export default function Page() {
  return <OperationsPage />;
}

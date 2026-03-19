import type { ReactNode } from "react";
import { DashboardViewTabs } from "@/components/dashboard-view-tabs";

export default function DashboardLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <div className="mx-auto w-full max-w-[1280px] px-5 pt-6 sm:px-6 lg:px-8">
        <DashboardViewTabs />
      </div>
      {children}
    </>
  );
}

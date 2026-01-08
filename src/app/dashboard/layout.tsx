import { ReferenceDataProvider } from "@/contexts/ReferenceDataContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ReferenceDataProvider>
      {children}
    </ReferenceDataProvider>
  );
}

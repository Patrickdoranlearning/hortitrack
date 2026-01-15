import { ReferenceDataProvider } from "@/contexts/ReferenceDataContext";

export default function MaterialsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ReferenceDataProvider>
      {children}
    </ReferenceDataProvider>
  );
}

import { ReferenceDataProvider } from "@/contexts/ReferenceDataContext";

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ReferenceDataProvider>
      {children}
    </ReferenceDataProvider>
  );
}

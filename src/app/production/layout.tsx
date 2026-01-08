import { ReferenceDataProvider } from "@/contexts/ReferenceDataContext";

export default function ProductionLayout({
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

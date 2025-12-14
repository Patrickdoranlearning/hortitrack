import { Metadata } from "next";
import { getUserAndOrg } from "@/server/auth/org";
import { PageFrame } from "@/ui/templates/PageFrame";
import { fetchProductionStatusOptions } from "@/server/production/saleable";
import { SaleabilityWizard } from "@/components/production/saleability";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Saleability Wizard | Production",
};

export default async function SaleabilityWizardPage() {
  const { orgId } = await getUserAndOrg();

  // Fetch status options
  const statusOptions = await fetchProductionStatusOptions(orgId);

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="production">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/production/saleable">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Saleability Wizard</h1>
            <p className="text-muted-foreground">
              Scan batches to update their saleable status and add photos
            </p>
          </div>
        </div>

        {/* Wizard Card */}
        <Card>
          <CardContent className="pt-6">
            <SaleabilityWizard statusOptions={statusOptions} />
          </CardContent>
        </Card>

        {/* Quick Tips */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Tips for Quick Updates
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Scan mode:</strong> Use the scanner to quickly find batches by their QR code or barcode.
            </p>
            <p>
              <strong>Search mode:</strong> Type a batch number or variety name to search.
            </p>
            <p>
              <strong>Photos:</strong> Add sales-ready photos directly from your camera or gallery.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageFrame>
  );
}

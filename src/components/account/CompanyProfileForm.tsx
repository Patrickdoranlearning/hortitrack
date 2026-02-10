"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateCompanyProfileAction } from "@/app/account/actions";
import { toast } from "@/lib/toast";
import { supabaseClient } from "@/lib/supabase/client";
import { Building2, Upload, X, Loader2, CreditCard, FileText, MapPin } from "lucide-react";
import Image from "next/image";

const COUNTRY_OPTIONS = [
  { code: "IE", name: "Ireland" },
  { code: "GB", name: "United Kingdom" },
  { code: "XI", name: "Northern Ireland" },
  { code: "NL", name: "Netherlands" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "US", name: "United States" },
] as const;

interface CompanyProfileFormProps {
  orgId: string;
  initialData: {
    name: string;
    countryCode: string;
    logoUrl: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    address: string | null;
    // Business details
    vatNumber: string | null;
    companyRegNumber: string | null;
    bankName: string | null;
    bankIban: string | null;
    bankBic: string | null;
    defaultPaymentTerms: number | null;
    invoicePrefix: string | null;
    invoiceFooterText: string | null;
    // Location for weather integration
    latitude: number | null;
    longitude: number | null;
  };
}

export function CompanyProfileForm({ orgId, initialData }: CompanyProfileFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialData.logoUrl);
  const [countryCode, setCountryCode] = useState(initialData.countryCode);
  const [latitude, setLatitude] = useState<string>(initialData.latitude?.toString() || "");
  const [longitude, setLongitude] = useState<string>(initialData.longitude?.toString() || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleLogoUpload(file: File) {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, etc.)");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Please upload an image smaller than 2MB");
      return;
    }

    setIsUploading(true);
    try {
      const supabase = supabaseClient();
      const fileExt = file.name.split(".").pop();
      const fileName = `${orgId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("company-logos")
        .getPublicUrl(fileName);

      setLogoUrl(publicUrl);
      toast.success("Your company logo has been uploaded. Don't forget to save your changes.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not upload logo");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleRemoveLogo() {
    setLogoUrl(null);
  }

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    
    // Add logo URL and country code to form data
    formData.set("logoUrl", logoUrl || "");
    formData.set("countryCode", countryCode);
    formData.set("orgId", orgId);
    
    // Add location coordinates
    formData.set("latitude", latitude);
    formData.set("longitude", longitude);

    const result = await updateCompanyProfileAction(formData);
    setIsLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Company profile updated successfully");
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* Basic Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Information
          </CardTitle>
          <CardDescription>
            Basic company details that appear on invoices and documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Upload Section */}
          <div className="space-y-3">
            <Label>Company Logo</Label>
            <div className="flex items-start gap-4">
              <div className="relative h-24 w-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden bg-muted/50">
                {logoUrl ? (
                  <>
                    <Image
                      src={logoUrl}
                      alt="Company logo"
                      fill
                      className="object-contain p-2"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground/50" />
                )}
              </div>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Logo
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG up to 2MB. Recommended: 200x200px
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }}
              />
            </div>
          </div>

          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Company Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={initialData.name}
              required
              disabled={isLoading}
              placeholder="Your company name"
            />
          </div>

          {/* Country */}
          <div className="space-y-2">
            <Label htmlFor="countryCode">Country</Label>
            <Select
              value={countryCode}
              onValueChange={setCountryCode}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_OPTIONS.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Business Address</Label>
            <Textarea
              id="address"
              name="address"
              defaultValue={initialData.address || ""}
              disabled={isLoading}
              placeholder="123 Main Street&#10;Dublin&#10;D01 AB12"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Full business address for invoices and correspondence
            </p>
          </div>

          {/* Contact Information */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={initialData.email || ""}
                disabled={isLoading}
                placeholder="sales@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={initialData.phone || ""}
                disabled={isLoading}
                placeholder="+353 1 234 5678"
              />
            </div>
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              name="website"
              type="url"
              defaultValue={initialData.website || ""}
              disabled={isLoading}
              placeholder="https://www.company.com"
            />
          </div>

          {/* Registration Numbers */}
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vatNumber">VAT Number</Label>
              <Input
                id="vatNumber"
                name="vatNumber"
                defaultValue={initialData.vatNumber || ""}
                disabled={isLoading}
                placeholder="IE1234567X"
              />
              <p className="text-xs text-muted-foreground">
                Your VAT registration number
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyRegNumber">Company Registration Number</Label>
              <Input
                id="companyRegNumber"
                name="companyRegNumber"
                defaultValue={initialData.companyRegNumber || ""}
                disabled={isLoading}
                placeholder="123456"
              />
              <p className="text-xs text-muted-foreground">
                Company registration/CRO number
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Banking & Payment Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Banking & Payment Details
          </CardTitle>
          <CardDescription>
            Bank details for receiving payments. These appear on your invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="bankName">Bank Name</Label>
            <Input
              id="bankName"
              name="bankName"
              defaultValue={initialData.bankName || ""}
              disabled={isLoading}
              placeholder="Allied Irish Banks"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bankIban">IBAN</Label>
              <Input
                id="bankIban"
                name="bankIban"
                defaultValue={initialData.bankIban || ""}
                disabled={isLoading}
                placeholder="IE12 AIBK 9312 3456 7890 12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankBic">BIC / SWIFT Code</Label>
              <Input
                id="bankBic"
                name="bankBic"
                defaultValue={initialData.bankBic || ""}
                disabled={isLoading}
                placeholder="AIBKIE2D"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultPaymentTerms">Default Payment Terms (days)</Label>
            <Input
              id="defaultPaymentTerms"
              name="defaultPaymentTerms"
              type="number"
              min="0"
              max="365"
              defaultValue={initialData.defaultPaymentTerms || 30}
              disabled={isLoading}
              placeholder="30"
            />
            <p className="text-xs text-muted-foreground">
              Number of days customers have to pay invoices
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Settings
          </CardTitle>
          <CardDescription>
            Customize how your invoices appear to customers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="invoicePrefix">Invoice Number Prefix</Label>
            <Input
              id="invoicePrefix"
              name="invoicePrefix"
              defaultValue={initialData.invoicePrefix || "INV"}
              disabled={isLoading}
              placeholder="INV"
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">
              Prefix for invoice numbers (e.g., INV-001, DN-001)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceFooterText">Invoice Footer Text</Label>
            <Textarea
              id="invoiceFooterText"
              name="invoiceFooterText"
              defaultValue={initialData.invoiceFooterText || ""}
              disabled={isLoading}
              placeholder="Thank you for your business!&#10;Registered in Ireland • Company No. 123456"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Custom text that appears at the bottom of invoices
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Weather & Location Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Settings
          </CardTitle>
          <CardDescription>
            Set your nursery location for weather-based AI care recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                name="latitude"
                type="number"
                step="0.0001"
                min="-90"
                max="90"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                disabled={isLoading}
                placeholder="53.3498"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                name="longitude"
                type="number"
                step="0.0001"
                min="-180"
                max="180"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                disabled={isLoading}
                placeholder="-6.2603"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Your nursery&apos;s GPS coordinates. Used by AI care recommendations to provide weather-specific advice.
            Find your coordinates on <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Google Maps</a> (right-click &rarr; &quot;What&apos;s here?&quot;).
            Defaults to Dublin, Ireland if not set.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading || isUploading} size="lg">
          {isLoading ? "Saving..." : "Save All Changes"}
        </Button>
      </div>
    </form>
  );
}

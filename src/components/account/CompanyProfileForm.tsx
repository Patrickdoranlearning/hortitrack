"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateCompanyProfileAction } from "@/app/account/actions";
import { useToast } from "@/hooks/use-toast";
import { supabaseClient } from "@/lib/supabase/client";
import { Building2, Upload, X, Loader2 } from "lucide-react";
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
  };
}

export function CompanyProfileForm({ orgId, initialData }: CompanyProfileFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialData.logoUrl);
  const [countryCode, setCountryCode] = useState(initialData.countryCode);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  async function handleLogoUpload(file: File) {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive",
      });
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
      toast({
        title: "Logo uploaded",
        description: "Your company logo has been uploaded. Don't forget to save your changes.",
      });
    } catch (error: unknown) {
      console.error("Logo upload failed:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload logo",
        variant: "destructive",
      });
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

    const result = await updateCompanyProfileAction(formData);
    setIsLoading(false);

    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Company profile updated successfully",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Profile</CardTitle>
        <CardDescription>
          Manage your company information. These details will be used on invoices and other documents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-6">
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
            <Label htmlFor="name">Company Name</Label>
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
                placeholder="company@example.com"
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
              placeholder="https://www.example.com"
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
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

          <Button type="submit" disabled={isLoading || isUploading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}


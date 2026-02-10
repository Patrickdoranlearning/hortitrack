"use client";

import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { updateStorePreferences } from "./store-data";
import type { StorePreferences } from "./types";
import { toast } from "@/lib/toast";

interface StorePreferencesFormProps {
  addressId: string;
  initialPreferences: StorePreferences;
  onSaved?: (preferences: StorePreferences) => void;
}

const DELIVERY_DAYS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "any", label: "Any Day" },
];

const TROLLEY_TYPES = [
  { value: "danish", label: "Danish Trolley" },
  { value: "cc", label: "CC Trolley" },
  { value: "pallet", label: "Pallet" },
  { value: "mixed", label: "Mixed" },
  { value: "none", label: "No Preference" },
];

export function StorePreferencesForm({
  addressId,
  initialPreferences,
  onSaved,
}: StorePreferencesFormProps) {
  const [preferences, setPreferences] = useState<StorePreferences>(initialPreferences);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();

    const result = await updateStorePreferences(supabase, addressId, preferences);

    if (result.success) {
      toast.success("Store preferences saved");
      onSaved?.(preferences);
    } else {
      toast.error("Failed to save preferences", {
        description: result.error,
      });
    }

    setSaving(false);
  };

  const handleChange = (key: keyof StorePreferences, value: string | number | undefined) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: value === "" ? undefined : value,
    }));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Store Preferences</CardTitle>
        <CardDescription>
          Delivery and order preferences for this location
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Preferred Delivery Day */}
          <div className="space-y-2">
            <Label htmlFor="deliveryDay">Preferred Delivery Day</Label>
            <Select
              value={preferences.preferredDeliveryDay || ""}
              onValueChange={(value) => handleChange("preferredDeliveryDay", value)}
            >
              <SelectTrigger id="deliveryDay">
                <SelectValue placeholder="Select day..." />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_DAYS.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preferred Trolley Type */}
          <div className="space-y-2">
            <Label htmlFor="trolleyType">Preferred Trolley Type</Label>
            <Select
              value={preferences.preferredTrolleyType || ""}
              onValueChange={(value) => handleChange("preferredTrolleyType", value)}
            >
              <SelectTrigger id="trolleyType">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {TROLLEY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Order Frequency Target */}
          <div className="space-y-2">
            <Label htmlFor="frequencyTarget">Target Order Frequency (days)</Label>
            <Input
              id="frequencyTarget"
              type="number"
              min={1}
              max={365}
              placeholder="e.g., 14"
              value={preferences.orderFrequencyTarget || ""}
              onChange={(e) =>
                handleChange(
                  "orderFrequencyTarget",
                  e.target.value ? parseInt(e.target.value, 10) : undefined
                )
              }
            />
          </div>
        </div>

        {/* Delivery Notes */}
        <div className="space-y-2">
          <Label htmlFor="deliveryNotes">Delivery Notes</Label>
          <Textarea
            id="deliveryNotes"
            placeholder="e.g., Side entrance, call on arrival..."
            rows={2}
            value={preferences.deliveryNotes || ""}
            onChange={(e) => handleChange("deliveryNotes", e.target.value)}
          />
        </div>

        {/* Special Instructions */}
        <div className="space-y-2">
          <Label htmlFor="specialInstructions">Special Instructions</Label>
          <Textarea
            id="specialInstructions"
            placeholder="Any other notes about this store..."
            rows={2}
            value={preferences.specialInstructions || ""}
            onChange={(e) => handleChange("specialInstructions", e.target.value)}
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Preferences
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  BadgeDollarSign,
  Loader2,
  Star,
  Users,
  Package,
} from "lucide-react";
import { PageFrame } from "@/ui/templates";
import { ModulePageHeader } from "@/ui/templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/http/fetchJson";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

type PriceList = {
  id: string;
  orgId: string;
  name: string;
  currency: string;
  isDefault: boolean;
  validFrom: string | null;
  validTo: string | null;
  createdAt: string;
  updatedAt: string;
  customerCount?: number;
  productCount?: number;
};

type PriceListsResponse = { ok: boolean; priceLists: PriceList[] };

// =============================================================================
// CONSTANTS
// =============================================================================

const CURRENCY_OPTIONS = [
  { value: "EUR", label: "Euro (€)" },
  { value: "GBP", label: "British Pound (£)" },
  { value: "USD", label: "US Dollar ($)" },
];

// =============================================================================
// FORM SCHEMA
// =============================================================================

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  currency: z.string().length(3, "Select a currency"),
  isDefault: z.boolean().default(false),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

// =============================================================================
// COMPONENT
// =============================================================================

export default function PriceListsPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingPriceList, setEditingPriceList] = React.useState<PriceList | null>(null);
  const [deletePriceList, setDeletePriceList] = React.useState<PriceList | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Fetch price lists
  const { data, mutate, isLoading } = useSWR<PriceListsResponse>(
    "/api/sales/price-lists",
    (url) => fetchJson(url)
  );

  const priceLists = data?.priceLists ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      currency: "EUR",
      isDefault: false,
      validFrom: null,
      validTo: null,
    },
  });

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (isDialogOpen) {
      if (editingPriceList) {
        form.reset({
          name: editingPriceList.name,
          currency: editingPriceList.currency,
          isDefault: editingPriceList.isDefault,
          validFrom: editingPriceList.validFrom ?? null,
          validTo: editingPriceList.validTo ?? null,
        });
      } else {
        form.reset({
          name: "",
          currency: "EUR",
          isDefault: priceLists.length === 0, // First price list is default
          validFrom: null,
          validTo: null,
        });
      }
    }
  }, [isDialogOpen, editingPriceList, form, priceLists.length]);

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      if (editingPriceList) {
        await fetchJson(`/api/sales/price-lists/${editingPriceList.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast({ title: "Price list updated" });
      } else {
        await fetchJson("/api/sales/price-lists", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast({ title: "Price list created" });
      }
      mutate();
      setIsDialogOpen(false);
      setEditingPriceList(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save price list",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePriceList) return;

    try {
      await fetchJson(`/api/sales/price-lists/${deletePriceList.id}`, {
        method: "DELETE",
      });
      toast({ title: "Price list deleted" });
      mutate();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete price list",
        variant: "destructive",
      });
    } finally {
      setDeletePriceList(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString();
  };

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case "EUR":
        return "€";
      case "GBP":
        return "£";
      case "USD":
        return "$";
      default:
        return currency;
    }
  };

  return (
    <PageFrame moduleKey="sales">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ModulePageHeader
            title="Price Lists"
            description="Configure pricing tiers and manage customer-specific pricing for products."
          />
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/settings">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Settings
              </Link>
            </Button>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Price List
            </Button>
          </div>
        </div>

        {/* Price Lists Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeDollarSign className="h-5 w-5" />
              Price Lists
            </CardTitle>
            <CardDescription>
              Create price lists to offer different pricing to different customer groups.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : priceLists.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <BadgeDollarSign className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <h3 className="mt-4 font-semibold">No price lists yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first price list to start managing product pricing.
                </p>
                <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Price List
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead className="hidden md:table-cell">Valid From</TableHead>
                      <TableHead className="hidden md:table-cell">Valid To</TableHead>
                      <TableHead className="text-center hidden lg:table-cell">Customers</TableHead>
                      <TableHead className="text-center hidden lg:table-cell">Products</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {priceLists.map((priceList) => (
                    <TableRow key={priceList.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{priceList.name}</span>
                          {priceList.isDefault && (
                            <Badge variant="secondary" className="gap-1">
                              <Star className="h-3 w-3" />
                              Default
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getCurrencySymbol(priceList.currency)} {priceList.currency}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {formatDate(priceList.validFrom)}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {formatDate(priceList.validTo)}
                      </TableCell>
                      <TableCell className="text-center hidden lg:table-cell">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{priceList.customerCount ?? 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center hidden lg:table-cell">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                          <Package className="h-4 w-4" />
                          <span>{priceList.productCount ?? 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingPriceList(priceList);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-8 w-8",
                              priceList.isDefault
                                ? "text-muted-foreground cursor-not-allowed"
                                : "text-destructive hover:text-destructive"
                            )}
                            disabled={priceList.isDefault}
                            onClick={() => setDeletePriceList(priceList)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How Price Lists Work</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Default Price List:</strong> Applied to all customers unless overridden.
              </p>
              <p>
                <strong>Customer Assignment:</strong> Assign specific customers to a price list for custom pricing.
              </p>
              <p>
                <strong>Validity Dates:</strong> Set start/end dates to control when pricing is active.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Coming Soon</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Bulk price import/export via CSV</p>
              <p>• Product-level pricing within each list</p>
              <p>• Quantity-based price breaks</p>
              <p>• Seasonal pricing rules</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingPriceList(null);
          }
          setIsDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPriceList ? "Edit Price List" : "Create Price List"}
            </DialogTitle>
            <DialogDescription>
              {editingPriceList
                ? "Update the price list details."
                : "Create a new price list for customer-specific pricing."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Wholesale, Retail, Trade" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="validFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid From</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="validTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid To</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Default Price List</FormLabel>
                      <FormDescription className="text-xs">
                        Used for customers without a specific assignment
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingPriceList ? (
                    "Save Changes"
                  ) : (
                    "Create Price List"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletePriceList}
        onOpenChange={(open) => !open && setDeletePriceList(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Price List</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletePriceList?.name}&quot;?
              {(deletePriceList?.customerCount ?? 0) > 0 && (
                <span className="block mt-2 text-destructive">
                  Warning: This price list has {deletePriceList?.customerCount} customer(s)
                  assigned to it.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageFrame>
  );
}


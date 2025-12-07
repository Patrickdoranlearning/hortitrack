"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, LayoutTemplate, Printer, History } from "lucide-react";
import Link from "next/link";
import { PageFrame } from "@/ui/templates/PageFrame";
import TemplateList from "./TemplateList";
import PrinterSettings from "./PrinterSettings";
import PrintHistory from "./PrintHistory";

export default function LabelManagementPage() {
  const [activeTab, setActiveTab] = useState("templates");

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="settings">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-3xl">Label Management</h1>
            <p className="text-muted-foreground">
              Design label templates, configure printers, and view print history.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Link>
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="printers" className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Printers</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-6">
            <TemplateList />
          </TabsContent>

          <TabsContent value="printers" className="mt-6">
            <PrinterSettings />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <PrintHistory />
          </TabsContent>
        </Tabs>
      </div>
    </PageFrame>
  );
}


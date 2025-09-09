
"use client"
import * as React from "react"
import { z } from "zod"
import { PageFrame } from "@/ui/templates/PageFrame"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function ProductionPlanningPage() {
  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="production">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Production Planning</h1>
        <Button><Plus className="mr-2 h-4 w-4" /> New Plan</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sales Forecast vs. Production</CardTitle>
          <CardDescription>This area will contain tools to align production schedules with sales forecasts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground bg-gray-50 rounded-lg">
            <p>Planning chart coming soon...</p>
          </div>
        </CardContent>
      </Card>
    </PageFrame>
  )
}

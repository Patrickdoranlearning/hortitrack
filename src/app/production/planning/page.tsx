
"use client"
import * as React from "react"
import { PageFrame } from "@/ui/templates/PageFrame"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NewDraftBatchDialog, DraftBatch } from "./new-draft-batch-dialog"

export default function ProductionPlanningPage() {
  const [batches, setBatches] = React.useState<DraftBatch[]>([])

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="production">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Production Planning</h1>
        <NewDraftBatchDialog onCreate={(b) => setBatches((prev) => [...prev, b])} />
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

      {batches.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Draft Batches</CardTitle>
            <CardDescription>Batches created but not yet committed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Sell Week</TableHead>
                  <TableHead>Ready Week</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id} className="font-medium">
                    <TableCell>{batch.sku}</TableCell>
                    <TableCell>Week {batch.sellWeek}</TableCell>
                    <TableCell>Week {batch.predictedReadyWeek}</TableCell>
                    <TableCell className="text-right">{batch.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageFrame>
  )
}

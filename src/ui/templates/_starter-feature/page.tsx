"use client"

import * as React from "react"
import { useState } from "react"
import { DataPage, DataToolbar, ConfirmDialog, DialogForm } from "@/ui/templates"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Edit, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { FeatureForm } from "./FeatureForm"
import { createFeatureAction, updateFeatureAction, deleteFeatureAction } from "./actions"
import type { FeatureFormValues } from "./schema"

/**
 * Starter Feature Page Template.
 * 
 * Copy and customize this folder to create a new data-managed feature.
 * It demonstrates:
 * 1. Using DataPage for the layout.
 * 2. Using DataToolbar for actions/filters.
 * 3. Standardized CRUD flow with forms and server actions.
 */

export default function StarterFeaturePage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [filterText, setFilterText] = useState("")
  const { toast } = useToast()

  // --- Handlers ---

  const handleAdd = () => {
    setEditingItem(null)
    setIsFormOpen(true)
  }

  const handleEdit = (item: any) => {
    setEditingItem(item)
    setIsFormOpen(true)
  }

  const handleSubmit = async (values: FeatureFormValues) => {
    const action = editingItem 
      ? updateFeatureAction(editingItem.id, values) 
      : createFeatureAction(values)
      
    const result = await action
    
    if (result.success) {
      toast({ 
        title: editingItem ? "Updated" : "Created", 
        description: "Operation successful" 
      })
      setIsFormOpen(false)
    } else {
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: result.error 
      })
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteFeatureAction(id)
    if (result.success) {
      toast({ title: "Deleted", description: "Item removed successfully" })
    } else {
      toast({ variant: "destructive", title: "Error", description: result.error })
    }
  }

  return (
    <DataPage
      title="Feature Title"
      description="Manage your feature data here."
      backHref="/settings"
      toolbar={
        <DataToolbar
          filters={
            <Input
              placeholder="Filter items..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="max-w-xs"
            />
          }
          extraActions={
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          }
        />
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>A list of all items in this feature.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Sample Row */}
              <TableRow>
                <TableCell>Example Item</TableCell>
                <TableCell>Active</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleEdit({ id: '1', name: 'Example' })}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <ConfirmDialog
                      title="Delete Item?"
                      description="This action cannot be undone."
                      onConfirm={() => handleDelete('1')}
                    >
                      <Button variant="destructive" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ConfirmDialog>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Standardized Form Dialog */}
      <DialogForm
        title={editingItem ? "Edit Item" : "Add Item"}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
      >
        <FeatureForm
          defaultValues={editingItem}
          onSubmit={handleSubmit}
          onCancel={() => setIsFormOpen(false)}
        />
      </DialogForm>
    </DataPage>
  )
}



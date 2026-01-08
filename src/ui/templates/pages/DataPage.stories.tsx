import type { Meta, StoryObj } from '@storybook/nextjs'
import { DataPage } from './DataPage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus } from 'lucide-react'

const meta: Meta<typeof DataPage> = {
  title: 'Templates/Pages/DataPage',
  component: DataPage,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof DataPage>

// Sample toolbar component for stories
function SampleToolbar() {
  return (
    <div className="rounded-lg border bg-card/80 p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm">Download Template</Button>
        <Button variant="outline" size="sm">Export Data</Button>
        <Button variant="outline" size="sm">Import CSV</Button>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add New</Button>
      </div>
    </div>
  )
}

// Sample table for stories
function SampleTable() {
  const data = [
    { id: 1, name: 'P9', type: 'Pot', quantity: 54 },
    { id: 2, name: '3L', type: 'Pot', quantity: 18 },
    { id: 3, name: '84 Cell', type: 'Tray', quantity: 84 },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Items</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quantity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.type}</TableCell>
                <TableCell>{item.quantity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export const Default: Story = {
  args: {
    title: 'Plant Sizes',
    description: 'Manage pot, tray, and bareroot sizes for your nursery.',
    toolbar: <SampleToolbar />,
    children: <SampleTable />,
  },
}

export const WithHeaderActions: Story = {
  args: {
    title: 'Products',
    description: 'Manage your product catalog.',
    toolbar: <SampleToolbar />,
    headerActions: <Button variant="default">Sync Products</Button>,
    children: <SampleTable />,
  },
}

export const MinimalNoToolbar: Story = {
  args: {
    title: 'Simple List',
    description: 'A minimal data page without a toolbar.',
    children: <SampleTable />,
  },
}

export const CustomBackLink: Story = {
  args: {
    title: 'Locations',
    description: 'Manage nursery locations and zones.',
    backHref: '/production',
    backLabel: 'Back to Production',
    toolbar: <SampleToolbar />,
    children: <SampleTable />,
  },
}

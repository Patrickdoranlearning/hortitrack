import type { Meta, StoryObj } from '@storybook/nextjs'
import { EmptyState } from './EmptyState'
import { Button } from '@/components/ui/button'
import { Package, ShoppingCart, Truck, Users, Search, FileText } from 'lucide-react'

const meta: Meta<typeof EmptyState> = {
  title: 'Templates/Sections/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof EmptyState>

export const Default: Story = {
  args: {
    title: 'No items yet',
    description: 'Get started by creating your first item.',
    action: <Button>Create Item</Button>,
  },
}

export const NoOrders: Story = {
  args: {
    icon: ShoppingCart,
    title: 'No orders found',
    description: 'When you receive orders, they will appear here.',
    action: <Button>Create Order</Button>,
  },
}

export const NoDeliveries: Story = {
  args: {
    icon: Truck,
    title: 'No deliveries scheduled',
    description: 'Deliveries for today will appear here once dispatch is complete.',
  },
}

export const NoCustomers: Story = {
  args: {
    icon: Users,
    title: 'No customers yet',
    description: 'Add your first customer to start creating orders.',
    action: <Button variant="outline">Add Customer</Button>,
  },
}

export const SearchNoResults: Story = {
  args: {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search or filter to find what you\'re looking for.',
    size: 'sm',
  },
}

export const NoDocuments: Story = {
  args: {
    icon: FileText,
    title: 'No documents',
    description: 'Upload documents to keep track of important files.',
    action: <Button>Upload Document</Button>,
    size: 'lg',
  },
}

export const SmallSize: Story = {
  args: {
    icon: Package,
    title: 'Empty',
    description: 'No items to display.',
    size: 'sm',
  },
}

export const LargeSize: Story = {
  args: {
    icon: Package,
    title: 'Welcome to Inventory',
    description: 'Your inventory is empty. Start by adding products to track stock levels and movements.',
    action: <Button size="lg">Add Products</Button>,
    size: 'lg',
  },
}

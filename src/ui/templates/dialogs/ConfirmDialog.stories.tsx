import type { Meta, StoryObj } from '@storybook/nextjs'
import { ConfirmDialog } from './ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Trash2, AlertTriangle, Check } from 'lucide-react'

const meta: Meta<typeof ConfirmDialog> = {
  title: 'Templates/Dialogs/ConfirmDialog',
  component: ConfirmDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof ConfirmDialog>

export const Default: Story = {
  args: {
    title: 'Confirm action',
    description: 'Are you sure you want to proceed with this action?',
    onConfirm: () => alert('Confirmed!'),
    children: <Button>Open Dialog</Button>,
  },
}

export const Destructive: Story = {
  args: {
    title: 'Delete item?',
    description: 'This action cannot be undone. This will permanently delete the item from our servers.',
    onConfirm: () => alert('Deleted!'),
    confirmLabel: 'Delete',
    variant: 'destructive',
    children: (
      <Button variant="destructive">
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>
    ),
  },
}

export const CustomLabels: Story = {
  args: {
    title: 'Discard changes?',
    description: 'You have unsaved changes. Are you sure you want to leave?',
    onConfirm: () => alert('Discarded!'),
    confirmLabel: 'Yes, discard',
    cancelLabel: 'Keep editing',
    children: <Button variant="outline">Close without saving</Button>,
  },
}

export const AsyncConfirm: Story = {
  args: {
    title: 'Submit form?',
    description: 'This will submit your changes to the server.',
    onConfirm: async () => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      alert('Submitted!')
    },
    confirmLabel: 'Submit',
    children: (
      <Button>
        <Check className="mr-2 h-4 w-4" />
        Submit
      </Button>
    ),
  },
}

export const Warning: Story = {
  args: {
    title: 'Archive batch?',
    description: 'This batch will be moved to the archive. You can restore it later from the archive section.',
    onConfirm: () => alert('Archived!'),
    confirmLabel: 'Archive',
    children: (
      <Button variant="outline">
        <AlertTriangle className="mr-2 h-4 w-4" />
        Archive
      </Button>
    ),
  },
}

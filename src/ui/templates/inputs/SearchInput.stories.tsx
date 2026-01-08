import type { Meta, StoryObj } from '@storybook/nextjs'
import { SearchInput } from './SearchInput'
import { useState } from 'react'

const meta: Meta<typeof SearchInput> = {
  title: 'Templates/Inputs/SearchInput',
  component: SearchInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SearchInput>

// Interactive wrapper for controlled component
function SearchInputWrapper(props: React.ComponentProps<typeof SearchInput>) {
  const [value, setValue] = useState(props.value || '')
  return <SearchInput {...props} value={value} onChange={setValue} />
}

export const Default: Story = {
  render: (args) => <SearchInputWrapper {...args} />,
  args: {
    placeholder: 'Search...',
    value: '',
  },
}

export const WithValue: Story = {
  render: (args) => <SearchInputWrapper {...args} />,
  args: {
    placeholder: 'Search products...',
    value: 'Lavender',
  },
}

export const WithScanner: Story = {
  render: (args) => <SearchInputWrapper {...args} />,
  args: {
    placeholder: 'Search or scan barcode...',
    value: '',
    showScanner: true,
    onScan: (code) => alert(`Scanned: ${code}`),
  },
}

export const CustomPlaceholder: Story = {
  render: (args) => <SearchInputWrapper {...args} />,
  args: {
    placeholder: 'Filter by name, variety, or batch code...',
    value: '',
  },
}

export const Disabled: Story = {
  render: (args) => <SearchInputWrapper {...args} />,
  args: {
    placeholder: 'Search...',
    value: '',
    disabled: true,
  },
}

export const NoClearButton: Story = {
  render: (args) => <SearchInputWrapper {...args} />,
  args: {
    placeholder: 'Search...',
    value: 'Some text',
    showClear: false,
  },
}

export const AutoFocus: Story = {
  render: (args) => <SearchInputWrapper {...args} />,
  args: {
    placeholder: 'Start typing...',
    value: '',
    autoFocus: true,
  },
}

export const FullExample: Story = {
  render: (args) => <SearchInputWrapper {...args} />,
  args: {
    placeholder: 'Search products, scan barcode, or enter batch code...',
    value: '',
    showScanner: true,
    showClear: true,
    autoFocus: false,
    onScan: (code) => console.log('Scanned:', code),
  },
}

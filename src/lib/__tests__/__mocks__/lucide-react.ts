/**
 * Mock for lucide-react icons
 * This prevents Jest from trying to transform ESM icons
 */

import React from 'react';

// Create a generic icon mock component
const createMockIcon = (name: string) => {
  const MockIcon = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
    (props, ref) => {
      return React.createElement('svg', {
        ...props,
        ref,
        'data-testid': `icon-${name.toLowerCase()}`,
        'data-lucide': name,
      });
    }
  );
  MockIcon.displayName = name;
  return MockIcon;
};

// Export commonly used icons as mocks
export const ScanLine = createMockIcon('ScanLine');
export const ClipboardList = createMockIcon('ClipboardList');
export const Syringe = createMockIcon('Syringe');
export const Check = createMockIcon('Check');
export const ChevronLeft = createMockIcon('ChevronLeft');
export const ChevronRight = createMockIcon('ChevronRight');
export const X = createMockIcon('X');
export const MapPin = createMockIcon('MapPin');
export const Package = createMockIcon('Package');
export const Plus = createMockIcon('Plus');
export const Trash2 = createMockIcon('Trash2');
export const Loader2 = createMockIcon('Loader2');
export const Calendar = createMockIcon('Calendar');
export const FlaskConical = createMockIcon('FlaskConical');
export const Leaf = createMockIcon('Leaf');
export const CheckCircle2 = createMockIcon('CheckCircle2');
export const Beaker = createMockIcon('Beaker');
export const Search = createMockIcon('Search');
export const Settings = createMockIcon('Settings');
export const Home = createMockIcon('Home');
export const AlertCircle = createMockIcon('AlertCircle');
export const AlertTriangle = createMockIcon('AlertTriangle');
export const Info = createMockIcon('Info');
export const MoreVertical = createMockIcon('MoreVertical');
export const MoreHorizontal = createMockIcon('MoreHorizontal');
export const Edit = createMockIcon('Edit');
export const Copy = createMockIcon('Copy');
export const Save = createMockIcon('Save');
export const Download = createMockIcon('Download');
export const Upload = createMockIcon('Upload');
export const Refresh = createMockIcon('Refresh');
export const RefreshCw = createMockIcon('RefreshCw');
export const ExternalLink = createMockIcon('ExternalLink');
export const ArrowLeft = createMockIcon('ArrowLeft');
export const ArrowRight = createMockIcon('ArrowRight');
export const ArrowUp = createMockIcon('ArrowUp');
export const ArrowDown = createMockIcon('ArrowDown');
export const Filter = createMockIcon('Filter');
export const Eye = createMockIcon('Eye');
export const EyeOff = createMockIcon('EyeOff');
export const Bell = createMockIcon('Bell');
export const User = createMockIcon('User');
export const Users = createMockIcon('Users');
export const LogOut = createMockIcon('LogOut');
export const Menu = createMockIcon('Menu');
export const PanelLeftClose = createMockIcon('PanelLeftClose');
export const PanelLeft = createMockIcon('PanelLeft');
export const Circle = createMockIcon('Circle');
export const Dot = createMockIcon('Dot');
export const ChevronDown = createMockIcon('ChevronDown');
export const ChevronUp = createMockIcon('ChevronUp');
export const ChevronsUpDown = createMockIcon('ChevronsUpDown');
export const Bug = createMockIcon('Bug');
export const Droplet = createMockIcon('Droplet');
export const Thermometer = createMockIcon('Thermometer');
export const Camera = createMockIcon('Camera');
export const Flag = createMockIcon('Flag');
export const CheckCircle = createMockIcon('CheckCircle');
export const XCircle = createMockIcon('XCircle');
export const Clock = createMockIcon('Clock');

// Default export for createLucideIcon
export const createLucideIcon = (name: string) => createMockIcon(name);

export default {
  createLucideIcon,
};





'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Minus,
  Trash2,
  Save,
  RotateCcw,
  Move,
  Grid,
  Truck,
  Package,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';

// Trolley dimensions in mm
const TROLLEY_WIDTH_MM = 565;
const TROLLEY_LENGTH_MM = 1350;

// Scale factor for visualization (mm to pixels)
const SCALE = 0.1; // 1mm = 0.1px

export interface TruckDimensions {
  lengthMm: number;  // Internal cargo length
  widthMm: number;   // Internal cargo width
  heightMm?: number; // Internal cargo height (optional)
}

export interface PlacedTrolley {
  id: string;
  x: number;  // Position in mm from left
  y: number;  // Position in mm from front
  rotation: 0 | 90;  // 0 = length along truck length, 90 = width along truck length
}

export interface TruckLayoutConfig {
  vehicleType: 'van' | 'truck' | 'trailer' | 'custom';
  name: string;
  dimensions: TruckDimensions;
  trolleys: PlacedTrolley[];
  maxTrolleys?: number;
}

// Preset vehicle dimensions (internal cargo area)
const PRESET_DIMENSIONS: Record<string, TruckDimensions> = {
  van_small: { lengthMm: 2400, widthMm: 1600, heightMm: 1400 },
  van_medium: { lengthMm: 3200, widthMm: 1700, heightMm: 1600 },
  van_large: { lengthMm: 4200, widthMm: 1800, heightMm: 1800 },
  truck_7_5t: { lengthMm: 6000, widthMm: 2200, heightMm: 2200 },
  truck_18t: { lengthMm: 8000, widthMm: 2400, heightMm: 2400 },
  trailer: { lengthMm: 13600, widthMm: 2450, heightMm: 2700 },
};

interface TruckLayoutWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLayout?: TruckLayoutConfig;
  onSave: (layout: TruckLayoutConfig) => void;
}

export default function TruckLayoutWizard({
  open,
  onOpenChange,
  initialLayout,
  onSave,
}: TruckLayoutWizardProps) {
  const [config, setConfig] = useState<TruckLayoutConfig>(
    initialLayout || {
      vehicleType: 'van',
      name: 'My Van',
      dimensions: PRESET_DIMENSIONS.van_medium,
      trolleys: [],
    }
  );
  
  const [draggedTrolley, setDraggedTrolley] = useState<string | null>(null);
  const [isAddingTrolley, setIsAddingTrolley] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset state when dialog opens with initial layout
  useEffect(() => {
    if (open && initialLayout) {
      setConfig(initialLayout);
    } else if (open && !initialLayout) {
      setConfig({
        vehicleType: 'van',
        name: 'My Van',
        dimensions: PRESET_DIMENSIONS.van_medium,
        trolleys: [],
      });
    }
  }, [open, initialLayout]);

  const handlePresetChange = (preset: string) => {
    const dims = PRESET_DIMENSIONS[preset];
    if (dims) {
      const type = preset.startsWith('van') ? 'van' : preset.startsWith('truck') ? 'truck' : 'trailer';
      setConfig(prev => ({
        ...prev,
        vehicleType: type as 'van' | 'truck' | 'trailer',
        dimensions: dims,
        trolleys: [], // Clear trolleys when changing truck size
      }));
    }
  };

  const handleDimensionChange = (field: keyof TruckDimensions, value: number) => {
    setConfig(prev => ({
      ...prev,
      vehicleType: 'custom',
      dimensions: { ...prev.dimensions, [field]: value },
    }));
  };

  // Calculate how many trolleys can fit
  const calculateMaxTrolleys = () => {
    const { lengthMm, widthMm } = config.dimensions;
    // Simple calculation - how many trolleys fit in a grid
    const trolleysAlongLength = Math.floor(lengthMm / TROLLEY_LENGTH_MM);
    const trolleysAlongWidth = Math.floor(widthMm / TROLLEY_WIDTH_MM);
    return trolleysAlongLength * trolleysAlongWidth;
  };

  // Add trolley to layout
  const addTrolley = useCallback((x: number, y: number, rotation: 0 | 90 = 0) => {
    const trolleyWidth = rotation === 0 ? TROLLEY_WIDTH_MM : TROLLEY_LENGTH_MM;
    const trolleyLength = rotation === 0 ? TROLLEY_LENGTH_MM : TROLLEY_WIDTH_MM;

    // Check bounds
    if (x < 0 || y < 0 || 
        x + trolleyWidth > config.dimensions.widthMm || 
        y + trolleyLength > config.dimensions.lengthMm) {
      return false;
    }

    // Check collision with existing trolleys
    const newTrolley: PlacedTrolley = {
      id: `trolley-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x,
      y,
      rotation,
    };

    const hasCollision = config.trolleys.some(existing => {
      const existingWidth = existing.rotation === 0 ? TROLLEY_WIDTH_MM : TROLLEY_LENGTH_MM;
      const existingLength = existing.rotation === 0 ? TROLLEY_LENGTH_MM : TROLLEY_WIDTH_MM;

      return !(
        x + trolleyWidth <= existing.x ||
        x >= existing.x + existingWidth ||
        y + trolleyLength <= existing.y ||
        y >= existing.y + existingLength
      );
    });

    if (hasCollision) {
      return false;
    }

    setConfig(prev => ({
      ...prev,
      trolleys: [...prev.trolleys, newTrolley],
    }));
    return true;
  }, [config]);

  // Remove trolley
  const removeTrolley = (id: string) => {
    setConfig(prev => ({
      ...prev,
      trolleys: prev.trolleys.filter(t => t.id !== id),
    }));
  };

  // Rotate trolley
  const rotateTrolley = (id: string) => {
    setConfig(prev => ({
      ...prev,
      trolleys: prev.trolleys.map(t => {
        if (t.id !== id) return t;
        const newRotation = t.rotation === 0 ? 90 : 0;
        // Check if rotated trolley would fit
        const newWidth = newRotation === 0 ? TROLLEY_WIDTH_MM : TROLLEY_LENGTH_MM;
        const newLength = newRotation === 0 ? TROLLEY_LENGTH_MM : TROLLEY_WIDTH_MM;
        if (t.x + newWidth > prev.dimensions.widthMm || t.y + newLength > prev.dimensions.lengthMm) {
          toast.error('Trolley would extend outside truck');
          return t;
        }
        return { ...t, rotation: newRotation as 0 | 90 };
      }),
    }));
  };

  // Auto-layout trolleys in a grid
  const autoLayout = () => {
    const { lengthMm, widthMm } = config.dimensions;
    const newTrolleys: PlacedTrolley[] = [];
    
    // Try laying trolleys with length along truck length
    const colsOption1 = Math.floor(widthMm / TROLLEY_WIDTH_MM);
    const rowsOption1 = Math.floor(lengthMm / TROLLEY_LENGTH_MM);
    const totalOption1 = colsOption1 * rowsOption1;

    // Try laying trolleys with width along truck length
    const colsOption2 = Math.floor(widthMm / TROLLEY_LENGTH_MM);
    const rowsOption2 = Math.floor(lengthMm / TROLLEY_WIDTH_MM);
    const totalOption2 = colsOption2 * rowsOption2;

    // Choose option that fits more trolleys
    const useRotated = totalOption2 > totalOption1;
    const cols = useRotated ? colsOption2 : colsOption1;
    const rows = useRotated ? rowsOption2 : rowsOption1;
    const rotation: 0 | 90 = useRotated ? 90 : 0;
    const trolleyW = useRotated ? TROLLEY_LENGTH_MM : TROLLEY_WIDTH_MM;
    const trolleyL = useRotated ? TROLLEY_WIDTH_MM : TROLLEY_LENGTH_MM;

    // Start from rear (y=0 is front/cab, so we start from high y values)
    for (let row = rows - 1; row >= 0; row--) {
      for (let col = 0; col < cols; col++) {
        newTrolleys.push({
          id: `trolley-${Date.now()}-${row}-${col}`,
          x: col * trolleyW,
          y: row * trolleyL,
          rotation,
        });
      }
    }

    setConfig(prev => ({
      ...prev,
      trolleys: newTrolleys,
    }));
  };

  // Clear all trolleys
  const clearLayout = () => {
    setConfig(prev => ({ ...prev, trolleys: [] }));
  };

  // Handle click on truck area to add trolley
  const handleTruckClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isAddingTrolley || !containerRef.current) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / (config.dimensions.widthMm * SCALE + 40);
    
    // Calculate click position in mm
    const clickX = (e.clientX - rect.left) / scale - 20;
    const clickY = (e.clientY - rect.top) / scale - 60;
    
    const xMm = clickX / SCALE;
    const yMm = clickY / SCALE;
    
    // Snap to grid (100mm intervals)
    const snappedX = Math.round(xMm / 100) * 100;
    const snappedY = Math.round(yMm / 100) * 100;
    
    if (addTrolley(snappedX, snappedY)) {
      toast.success('Trolley added');
    } else {
      toast.error('Cannot place trolley here');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (id: string) => {
    setDraggedTrolley(id);
  };

  const handleDragEnd = () => {
    setDraggedTrolley(null);
  };

  const handleSave = () => {
    if (!config.name.trim()) {
      toast.error('Please enter a layout name');
      return;
    }
    
    onSave({
      ...config,
      maxTrolleys: config.trolleys.length,
    });
    onOpenChange(false);
  };

  // Visualization dimensions
  const vizWidth = config.dimensions.widthMm * SCALE;
  const vizHeight = config.dimensions.lengthMm * SCALE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Truck Layout Wizard
          </DialogTitle>
          <DialogDescription>
            Configure your truck dimensions and drag trolleys to create your loading layout.
            Trolleys are {TROLLEY_WIDTH_MM}mm wide × {TROLLEY_LENGTH_MM}mm long (565mm × 1350mm).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Settings Panel */}
          <div className="space-y-4">
            {/* Layout Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Layout Name</Label>
              <Input
                id="name"
                value={config.name}
                onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Mercedes Sprinter"
              />
            </div>

            {/* Preset Selection */}
            <div className="grid gap-2">
              <Label>Vehicle Preset</Label>
              <Select onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a preset or customize below" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="van_small">Small Van (2.4m × 1.6m)</SelectItem>
                  <SelectItem value="van_medium">Medium Van (3.2m × 1.7m)</SelectItem>
                  <SelectItem value="van_large">Large Van (4.2m × 1.8m)</SelectItem>
                  <SelectItem value="truck_7_5t">7.5t Truck (6m × 2.2m)</SelectItem>
                  <SelectItem value="truck_18t">18t Truck (8m × 2.4m)</SelectItem>
                  <SelectItem value="trailer">Artic Trailer (13.6m × 2.45m)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Custom Dimensions */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Cargo Length (mm)</Label>
                <Input
                  type="number"
                  value={config.dimensions.lengthMm}
                  onChange={(e) => handleDimensionChange('lengthMm', parseInt(e.target.value) || 0)}
                  min={1000}
                  max={20000}
                  step={100}
                />
              </div>
              <div className="grid gap-2">
                <Label>Cargo Width (mm)</Label>
                <Input
                  type="number"
                  value={config.dimensions.widthMm}
                  onChange={(e) => handleDimensionChange('widthMm', parseInt(e.target.value) || 0)}
                  min={1000}
                  max={3000}
                  step={100}
                />
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={isAddingTrolley ? "default" : "outline"}
                size="sm"
                onClick={() => setIsAddingTrolley(!isAddingTrolley)}
              >
                <Plus className="h-4 w-4 mr-1" />
                {isAddingTrolley ? 'Click on truck...' : 'Add Trolley'}
              </Button>
              <Button variant="outline" size="sm" onClick={autoLayout}>
                <Grid className="h-4 w-4 mr-1" />
                Auto-Layout
              </Button>
              <Button variant="outline" size="sm" onClick={clearLayout}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>

            {/* Stats */}
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {config.trolleys.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Trolleys Placed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-muted-foreground">
                      {calculateMaxTrolleys()}
                    </div>
                    <div className="text-xs text-muted-foreground">Max Capacity (Grid)</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trolley List */}
            {config.trolleys.length > 0 && (
              <div className="space-y-2">
                <Label>Placed Trolleys</Label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {config.trolleys.map((trolley, idx) => (
                    <div
                      key={trolley.id}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm"
                    >
                      <span>
                        Trolley {idx + 1} ({trolley.rotation === 0 ? 'Vertical' : 'Horizontal'})
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => rotateTrolley(trolley.id)}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => removeTrolley(trolley.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Visualization Panel */}
          <div ref={containerRef} className="space-y-2">
            <Label>Truck Layout Preview</Label>
            <div className="border rounded-lg p-4 bg-slate-50 overflow-auto">
              <svg
                viewBox={`0 0 ${vizWidth + 40} ${vizHeight + 100}`}
                className={cn(
                  'w-full bg-white rounded shadow-sm',
                  isAddingTrolley && 'cursor-crosshair'
                )}
                style={{ minHeight: 300, maxHeight: 500 }}
                onClick={handleTruckClick}
              >
                {/* Cab */}
                <g transform={`translate(${vizWidth / 2 - 40}, 0)`}>
                  <rect
                    x={0}
                    y={0}
                    width={80}
                    height={50}
                    rx={4}
                    fill="#cbd5e1"
                    stroke="#94a3b8"
                    strokeWidth={2}
                  />
                  <rect
                    x={5}
                    y={5}
                    width={70}
                    height={20}
                    rx={2}
                    fill="#bae6fd"
                  />
                  <text x={40} y={42} textAnchor="middle" fontSize={10} fill="#64748b">
                    CAB
                  </text>
                </g>

                {/* Arrow indicating front */}
                <polygon
                  points={`${vizWidth / 2 + 20 - 8},45 ${vizWidth / 2 + 20},35 ${vizWidth / 2 + 20 + 8},45`}
                  fill="#64748b"
                />

                {/* Cargo area */}
                <rect
                  x={20}
                  y={60}
                  width={vizWidth}
                  height={vizHeight}
                  rx={4}
                  fill="#f1f5f9"
                  stroke="#94a3b8"
                  strokeWidth={2}
                />

                {/* Grid lines (every 500mm) */}
                {Array.from({ length: Math.floor(config.dimensions.widthMm / 500) + 1 }).map((_, i) => (
                  <line
                    key={`v-${i}`}
                    x1={20 + i * 500 * SCALE}
                    y1={60}
                    x2={20 + i * 500 * SCALE}
                    y2={60 + vizHeight}
                    stroke="#e2e8f0"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                ))}
                {Array.from({ length: Math.floor(config.dimensions.lengthMm / 500) + 1 }).map((_, i) => (
                  <line
                    key={`h-${i}`}
                    x1={20}
                    y1={60 + i * 500 * SCALE}
                    x2={20 + vizWidth}
                    y2={60 + i * 500 * SCALE}
                    stroke="#e2e8f0"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                ))}

                {/* Placed trolleys */}
                {config.trolleys.map((trolley, idx) => {
                  const w = trolley.rotation === 0 ? TROLLEY_WIDTH_MM : TROLLEY_LENGTH_MM;
                  const h = trolley.rotation === 0 ? TROLLEY_LENGTH_MM : TROLLEY_WIDTH_MM;
                  
                  return (
                    <g
                      key={trolley.id}
                      transform={`translate(${20 + trolley.x * SCALE}, ${60 + trolley.y * SCALE})`}
                      className="cursor-move"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isAddingTrolley) {
                          rotateTrolley(trolley.id);
                        }
                      }}
                    >
                      {/* Trolley body */}
                      <rect
                        x={2}
                        y={2}
                        width={w * SCALE - 4}
                        height={h * SCALE - 4}
                        rx={2}
                        fill="#22c55e"
                        stroke="#16a34a"
                        strokeWidth={2}
                        className="hover:fill-green-400 transition-colors"
                      />
                      {/* Trolley number */}
                      <text
                        x={w * SCALE / 2}
                        y={h * SCALE / 2 + 4}
                        textAnchor="middle"
                        fontSize={12}
                        fill="white"
                        fontWeight="bold"
                      >
                        {idx + 1}
                      </text>
                      {/* Rotation indicator */}
                      <text
                        x={w * SCALE / 2}
                        y={h * SCALE / 2 + 16}
                        textAnchor="middle"
                        fontSize={8}
                        fill="white"
                        opacity={0.8}
                      >
                        {trolley.rotation === 0 ? '↕' : '↔'}
                      </text>
                    </g>
                  );
                })}

                {/* Labels */}
                <text
                  x={vizWidth / 2 + 20}
                  y={vizHeight + 80}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#64748b"
                >
                  REAR DOORS ({config.dimensions.lengthMm}mm × {config.dimensions.widthMm}mm)
                </text>
              </svg>
            </div>
            <p className="text-xs text-muted-foreground">
              {isAddingTrolley 
                ? 'Click inside the truck to place a trolley. Click again to disable.'
                : 'Click a trolley to rotate it. Use buttons on the left to add more.'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


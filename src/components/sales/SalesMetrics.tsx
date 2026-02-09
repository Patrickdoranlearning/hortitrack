'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Target } from 'lucide-react';
import { formatCurrency } from '@/lib/format-currency';

export interface DashboardMetrics {
    currentWeekOrders: number;
    currentWeekRevenue: number;
    nextWeekOrders: number;
    nextWeekRevenue: number;
    targetAreas: { area: string; potential: string }[];
}

export default function SalesMetrics({ metrics }: { metrics: DashboardMetrics }) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Current Week Orders
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{metrics.currentWeekOrders}</div>
                    <p className="text-xs text-muted-foreground">
                        {formatCurrency(metrics.currentWeekRevenue)} revenue
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Next Week Orders
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{metrics.nextWeekOrders}</div>
                    <p className="text-xs text-muted-foreground">
                        {formatCurrency(metrics.nextWeekRevenue)} revenue
                    </p>
                </CardContent>
            </Card>
            <Card className="col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Target Areas
                    </CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {metrics.targetAreas.map((area, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                                <span className="font-medium">{area.area}</span>
                                <span className="text-muted-foreground">{area.potential} Potential</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

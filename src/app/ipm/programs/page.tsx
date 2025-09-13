
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { PageFrame } from '@/ui/templates/PageFrame';
import { Plus } from 'lucide-react';

export default function IpmProgramsPage() {

    return (
        <PageFrame companyName="Doran Nurseries" moduleKey="plantHealth">
            <div className="space-y-6">
                <ModulePageHeader 
                    title="IPM Programs"
                    description="Design and manage reusable Integrated Pest Management programs."
                    actionsSlot={
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            New IPM Program
                        </Button>
                    }
                />
                <Card>
                    <CardHeader>
                        <CardTitle>Program List</CardTitle>
                        <CardDescription>
                            Define standard routines for preventative spraying, biological controls, and treatments.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="text-center text-muted-foreground py-20">
                            <p>IPM Program management coming soon.</p>
                            <p className="text-xs">You will be able to create and edit programs here.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageFrame>
    );
}

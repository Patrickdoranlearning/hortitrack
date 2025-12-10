'use client';

import dynamic from 'next/dynamic';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Client-only loader for the gallery card to avoid rendering it on the server
const BatchGalleryCardLazy = dynamic(
  () => import('./BatchGalleryCard').then((mod) => mod.BatchGalleryCard),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    ),
  }
);

export default BatchGalleryCardLazy;

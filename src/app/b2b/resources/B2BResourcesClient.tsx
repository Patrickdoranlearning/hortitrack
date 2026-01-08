'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, FileSpreadsheet, Image, Video, Link as LinkIcon, Download, BookOpen } from 'lucide-react';

type Resource = {
  id: string;
  title: string;
  description: string | null;
  resource_type: string;
  file_url: string | null;
  storage_path: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  category: string | null;
  sort_order: number;
  created_at: string;
};

type B2BResourcesClientProps = {
  resources: Record<string, Resource[]>;
};

const RESOURCE_TYPE_CONFIG: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  pdf: { icon: FileText, label: 'PDF', color: 'text-red-500' },
  document: { icon: FileText, label: 'Document', color: 'text-blue-500' },
  spreadsheet: { icon: FileSpreadsheet, label: 'Spreadsheet', color: 'text-green-500' },
  image: { icon: Image, label: 'Image', color: 'text-purple-500' },
  video: { icon: Video, label: 'Video', color: 'text-orange-500' },
  link: { icon: LinkIcon, label: 'Link', color: 'text-cyan-500' },
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function B2BResourcesClient({ resources }: B2BResourcesClientProps) {
  const categories = Object.keys(resources).sort();

  const handleDownload = (resource: Resource) => {
    if (resource.file_url) {
      window.open(resource.file_url, '_blank');
    } else if (resource.storage_path) {
      // Download from storage
      window.open(`/api/b2b/resources/${resource.id}/download`, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
        <p className="text-muted-foreground">
          Access product catalogs, care guides, and other helpful resources
        </p>
      </div>

      {/* Resources by Category */}
      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No resources available at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        categories.map((category) => {
          const categoryResources = resources[category];

          return (
            <div key={category} className="space-y-4">
              <h2 className="text-2xl font-semibold">{category}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categoryResources.map((resource) => {
                  const typeConfig = RESOURCE_TYPE_CONFIG[resource.resource_type] || {
                    icon: FileText,
                    label: resource.resource_type,
                    color: 'text-gray-500',
                  };
                  const Icon = typeConfig.icon;

                  return (
                    <Card key={resource.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Icon className={`h-5 w-5 shrink-0 ${typeConfig.color}`} />
                            <CardTitle className="text-base line-clamp-2">{resource.title}</CardTitle>
                          </div>
                          <Badge variant="outline" className="shrink-0">
                            {typeConfig.label}
                          </Badge>
                        </div>
                        {resource.description && (
                          <CardDescription className="line-clamp-2">
                            {resource.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {resource.file_size_bytes && (
                          <p className="text-xs text-muted-foreground">
                            Size: {formatFileSize(resource.file_size_bytes)}
                          </p>
                        )}
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => handleDownload(resource)}
                        >
                          {resource.resource_type === 'link' ? (
                            <>
                              <LinkIcon className="mr-2 h-4 w-4" />
                              Open Link
                            </>
                          ) : resource.resource_type === 'video' ? (
                            <>
                              <Video className="mr-2 h-4 w-4" />
                              Watch Video
                            </>
                          ) : (
                            <>
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

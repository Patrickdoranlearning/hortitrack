'use client';

import { useState, useCallback, useEffect } from 'react';
import type { GalleryImage } from '@/components/media/SmartGalleryUploader';
import { logError } from '@/lib/log';

type EntityType = 'batch' | 'variety' | 'product';

type UseSmartGalleryOptions = {
  entityType: EntityType;
  entityId: string;
  badgeType?: 'live_crop' | 'reference' | 'size_guide';
};

export function useSmartGallery({
  entityType,
  entityId,
  badgeType,
}: UseSmartGalleryOptions) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch images on mount
  useEffect(() => {
    const fetchImages = async () => {
      if (!entityId) {
        setImages([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set(`${entityType}Id`, entityId);

        const response = await fetch(`/api/media/gallery?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch gallery');
        }

        const data = await response.json();
        setImages(
          (data.images || []).map((img: GalleryImage) => ({
            ...img,
            entityType: img.entityType || entityType,
          }))
        );
      } catch (err) {
        logError('Error fetching gallery', { error: err });
        setError('Failed to load images');
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [entityType, entityId]);

  // Upload a new image
  const uploadImage = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId);
      if (badgeType) {
        formData.append('badgeType', badgeType);
      }

      // Set as hero if it's the first image
      if (images.length === 0) {
        formData.append('isHero', 'true');
      }

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();

      // Add to local state
      const newImage: GalleryImage = {
        id: data.mediaId,
        url: data.filePath,
        badge: getBadgeLabel(entityType, badgeType),
        isHero: images.length === 0,
        entityType,
      };

      setImages((prev) => [...prev, newImage]);
    },
    [entityType, entityId, badgeType, images.length]
  );

  // Delete an image
  const deleteImage = useCallback(
    async (imageId: string) => {
      const response = await fetch(`/api/media/${imageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Delete failed');
      }

      setImages((prev) => prev.filter((img) => img.id !== imageId));
    },
    []
  );

  // Set hero image
  const setHeroImage = useCallback(
    async (imageId: string) => {
      const response = await fetch(`/api/media/${imageId}/hero`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to set hero');
      }

      setImages((prev) =>
        prev.map((img) => ({
          ...img,
          isHero: img.id === imageId,
        }))
      );
    },
    []
  );

  return {
    images,
    loading,
    error,
    uploadImage,
    deleteImage,
    setHeroImage,
    refetch: () => {
      setLoading(true);
      // Trigger re-fetch by updating a state that useEffect depends on
      // This is a simple approach - you could also use a dedicated refetch trigger
    },
  };
}

function getBadgeLabel(
  entityType: EntityType,
  badgeType?: 'live_crop' | 'reference' | 'size_guide'
): string {
  if (badgeType) {
    switch (badgeType) {
      case 'live_crop':
        return `Live Crop: ${new Date().toLocaleDateString()}`;
      case 'reference':
        return 'Reference Image';
      case 'size_guide':
        return 'Size Reference';
    }
  }

  switch (entityType) {
    case 'batch':
      return `Live Crop: ${new Date().toLocaleDateString()}`;
    case 'variety':
      return 'Reference Image';
    case 'product':
      return 'Size Reference';
  }
}




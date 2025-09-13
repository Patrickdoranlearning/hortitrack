'use client';

import React, { useContext, useEffect, useState, FormEvent } from 'react';
import { ReferenceDataContext } from '@/contexts/ReferenceDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { addVarietyAction, addSizeAction, addLocationAction, addSupplierAction } from '@/app/actions';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

export default function ReferenceDataPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { data, reload, loading } = useContext(ReferenceDataContext);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  const [varietyName, setVarietyName] = useState('');
  const [varietyFamily, setVarietyFamily] = useState('');
  const [sizeName, setSizeName] = useState('');
  const [sizeType, setSizeType] = useState('');
  const [sizeMultiple, setSizeMultiple] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationSite, setLocationSite] = useState('');
  const [supplierName, setSupplierName] = useState('');

  if (!user) return null;
  if (loading || !data) return <p className="p-4">Loading…</p>;

  async function onAddVariety(e: FormEvent) {
    e.preventDefault();
    await addVarietyAction({ name: varietyName, family: varietyFamily, category: '' });
    setVarietyName('');
    setVarietyFamily('');
    reload();
  }

  async function onAddSize(e: FormEvent) {
    e.preventDefault();
    await addSizeAction({ name: sizeName, type: sizeType || 'Pot', containerType: sizeType || 'Pot', multiple: sizeMultiple ? Number(sizeMultiple) : undefined });
    setSizeName('');
    setSizeType('');
    setSizeMultiple('');
    reload();
  }

  async function onAddLocation(e: FormEvent) {
    e.preventDefault();
    await addLocationAction({ name: locationName, nursery: locationSite });
    setLocationName('');
    setLocationSite('');
    reload();
  }

  async function onAddSupplier(e: FormEvent) {
    e.preventDefault();
    await addSupplierAction({ name: supplierName });
    setSupplierName('');
    reload();
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-8 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-4xl">Reference Data</h1>
        <Button asChild variant="outline">
          <Link href="/settings">
            <ArrowLeft />
            Back to Data Management
          </Link>
        </Button>
      </div>

      {/* Varieties */}
      <Card>
        <CardHeader>
          <CardTitle>Varieties</CardTitle>
          <CardDescription>Master list of plant varieties.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="mb-4">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Family</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.varieties.map(v => (
                <TableRow key={v.id || v.name}>
                  <TableCell>{v.name}</TableCell>
                  <TableCell>{v.family}</TableCell>
                </TableRow>
              ))}
              {data.varieties.length === 0 && (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No varieties</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <form onSubmit={onAddVariety} className="flex flex-wrap gap-2">
            <Input placeholder="Name" value={varietyName} onChange={e => setVarietyName(e.target.value)} />
            <Input placeholder="Family" value={varietyFamily} onChange={e => setVarietyFamily(e.target.value)} />
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>

      {/* Sizes */}
      <Card>
        <CardHeader>
          <CardTitle>Sizes</CardTitle>
          <CardDescription>Container and plug sizes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="mb-4">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Multiple</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.sizes.map(s => (
                <TableRow key={s.id || s.name}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.container_type}</TableCell>
                  <TableCell>{s.cell_multiple}</TableCell>
                </TableRow>
              ))}
              {data.sizes.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No sizes</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <form onSubmit={onAddSize} className="flex flex-wrap gap-2">
            <Input placeholder="Name" value={sizeName} onChange={e => setSizeName(e.target.value)} />
            <Input placeholder="Type" value={sizeType} onChange={e => setSizeType(e.target.value)} />
            <Input placeholder="Multiple" value={sizeMultiple} onChange={e => setSizeMultiple(e.target.value)} className="w-24" />
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>

      {/* Locations */}
      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <CardDescription>Nursery locations.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="mb-4">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Site</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.locations.map(l => (
                <TableRow key={l.id || l.name}>
                  <TableCell>{l.name}</TableCell>
                  <TableCell>{l.nursery_site}</TableCell>
                </TableRow>
              ))}
              {data.locations.length === 0 && (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No locations</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <form onSubmit={onAddLocation} className="flex flex-wrap gap-2">
            <Input placeholder="Name" value={locationName} onChange={e => setLocationName(e.target.value)} />
            <Input placeholder="Site" value={locationSite} onChange={e => setLocationSite(e.target.value)} />
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>

      {/* Suppliers */}
      <Card>
        <CardHeader>
          <CardTitle>Suppliers</CardTitle>
          <CardDescription>Approved suppliers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="mb-4">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.suppliers.map(s => (
                <TableRow key={s.id || s.name}>
                  <TableCell>{s.name}</TableCell>
                </TableRow>
              ))}
              {data.suppliers.length === 0 && (
                <TableRow><TableCell colSpan={1} className="text-center text-muted-foreground">No suppliers</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <form onSubmit={onAddSupplier} className="flex flex-wrap gap-2">
            <Input placeholder="Name" value={supplierName} onChange={e => setSupplierName(e.target.value)} />
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

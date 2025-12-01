import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function B2BPortalLanding() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-24">
            <h1 className="text-4xl font-bold mb-4">B2B Customer Portal</h1>
            <p className="text-xl mb-8">Coming Soon</p>
            <Button asChild>
                <Link href="/">Return to Main Site</Link>
            </Button>
        </div>
    );
}

import HomePageContainer from '@/app/HomePageContainer';
import SafeLanding from './safe-landing';

export default function Page() {
  const safe = process.env.NEXT_PUBLIC_SAFE_BUILD === '1';
  if (safe) {
    return <SafeLanding />;
  }
  // Full app (may import shadcn components, AI flows, etc.)
  return <HomePageContainer />;
}

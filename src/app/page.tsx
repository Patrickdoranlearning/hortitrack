import HomePageContainer from '@/app/HomePageContainer';
import SafeLanding from './safe-landing';
import { getBatchesAction, getVarietiesAction, getLocationsAction, getSizesAction, getSuppliersAction } from "./actions";


export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Temporarily bypass safe mode to get the app running.
  // const safe = process.env.NEXT_PUBLIC_SAFE_BUILD === '1';
  // if (safe) {
  //   return <SafeLanding />;
  // }
  // Full app (may import shadcn components, AI flows, etc.)
  return <HomePageContainer />;
}

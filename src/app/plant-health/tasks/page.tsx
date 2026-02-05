import { PageFrame } from '@/ui/templates';
import { IpmTasksClient } from './components';

export const metadata = {
  title: 'IPM Applications | HortiTrack',
  description: 'Manage spray jobs and IPM applications',
};

export default function IpmTasksPage() {
  return (
    <PageFrame moduleKey="plantHealth">
      <IpmTasksClient />
    </PageFrame>
  );
}

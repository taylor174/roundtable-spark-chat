import { useSearchParams } from 'react-router-dom';
import { FeatureTester } from '@/components/FeatureTester';
import { BackButton } from '@/components/BackButton';

export function FeatureTest() {
  const [searchParams] = useSearchParams();
  const tableCode = searchParams.get('table');

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Feature Testing Dashboard</h1>
          <BackButton showConfirmation={false} redirectToSummary={false} />
        </div>
        
        <FeatureTester tableCode={tableCode || undefined} />
      </div>
    </div>
  );
}
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const NavigationTest = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const testNavigation = () => {
    console.log('🔍 NAV TEST: Current location:', location.pathname);
    console.log('🔍 NAV TEST: Testing navigation to /t/XXOZQI/join');
    
    try {
      navigate('/t/XXOZQI/join');
      console.log('🔍 NAV TEST: Navigation attempt completed');
    } catch (error) {
      console.error('🔍 NAV TEST: Navigation failed:', error);
    }
  };

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>Navigation Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>Current route: {location.pathname}</p>
        <Button onClick={testNavigation} variant="outline" className="w-full">
          Test Navigation to Join Page
        </Button>
        <Button 
          onClick={() => window.location.href = '/t/XXOZQI/join'} 
          variant="secondary" 
          className="w-full"
        >
          Force Navigation (window.location)
        </Button>
      </CardContent>
    </Card>
  );
};
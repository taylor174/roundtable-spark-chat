import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface BackButtonProps {
  variant?: 'default' | 'ghost' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
  className?: string;
  children?: React.ReactNode;
}

export function BackButton({
  variant = 'ghost',
  size = 'default',
  showConfirmation = false,
  confirmationTitle = 'Leave Session?',
  confirmationDescription = 'Are you sure you want to leave this session? You may lose your progress.',
  className = '',
  children
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate('/');
  };

  const ButtonContent = children || (
    <>
      <ArrowLeft className="h-4 w-4" />
      Back to Home
    </>
  );

  if (showConfirmation) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={variant} size={size} className={className}>
            {ButtonContent}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={handleGoBack}>
              Leave Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Button 
      variant={variant} 
      size={size} 
      className={className}
      onClick={handleGoBack}
    >
      {ButtonContent}
    </Button>
  );
}
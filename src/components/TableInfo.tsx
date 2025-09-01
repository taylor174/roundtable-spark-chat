import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import QRCode from 'qrcode';
import { QrCode, Copy, Check } from 'lucide-react';

interface TableInfoProps {
  tableCode: string;
  participantCount: number;
  isHost: boolean;
}

export function TableInfo({ tableCode, participantCount, isHost }: TableInfoProps) {
  // Only show for hosts
  if (!isHost) {
    return null;
  }
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  
  const joinUrl = `${window.location.origin}/t/${tableCode}/join`;

  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then(setQrCodeUrl)
      .catch(console.error);
  }, [joinUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Silent fail - copy functionality not critical
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="h-4 w-4 mr-2" />
          Share Table
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Table {tableCode}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          
          {/* QR Code */}
          <div className="flex justify-center">
            {qrCodeUrl ? (
              <img 
                src={qrCodeUrl} 
                alt={`QR Code for Table ${tableCode}`}
                className="border rounded-lg"
              />
            ) : (
              <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
                <QrCode className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Join Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Share this link:</label>
            <div className="flex items-center space-x-2">
              <Input
                readOnly
                value={joinUrl}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Table Stats */}
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Participants:</span>
              <Badge variant="outline">{participantCount}</Badge>
            </div>
            {isHost && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-muted-foreground">Your role:</span>
                <Badge>Host</Badge>
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Participants can scan the QR code or visit the link to join.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
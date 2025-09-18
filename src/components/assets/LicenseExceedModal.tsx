import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LifeBuoy } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LicenseExceedInfo {
  reason: 'GLOBAL_LIMIT' | 'PROPERTY_LIMIT';
  message: string;
  propertyLimit?: number;
  propertyUsage?: number;
  globalLimit?: number;
  globalUsage?: number;
  propertyId?: string;
}

interface Props {
  open: boolean;
  info: LicenseExceedInfo | null;
  onClose: () => void;
  onCreateTicket: (info: LicenseExceedInfo) => void;
}

export function LicenseExceedModal({ open, info, onClose, onCreateTicket }: Props) {
  const remainingProperty = info?.propertyLimit != null && info.propertyLimit > 0 && info.propertyUsage != null
    ? Math.max(0, info.propertyLimit - info.propertyUsage)
    : null;
  const remainingGlobal = info?.globalLimit != null && info.globalLimit > 0 && info.globalUsage != null
    ? Math.max(0, info.globalLimit - info.globalUsage)
    : null;
  return (
    <Dialog open={open} onOpenChange={(v)=> { if(!v) onClose(); }}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-destructive'>
            <AlertTriangle className='h-5 w-5' /> License Exceeded
          </DialogTitle>
          <DialogDescription>
            {info?.message || 'Your current license limits have been exceeded.'}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 text-sm'>
          {info?.reason === 'PROPERTY_LIMIT' && (
            <div className='rounded-md border border-destructive/30 bg-destructive/5 p-3'>
              <div className='flex justify-between text-xs'>
                <span className='font-medium'>Property Limit</span>
                <span>{info.propertyUsage} / {info.propertyLimit}</span>
              </div>
              {remainingProperty === 0 && <div className='mt-1 text-[11px] text-muted-foreground'>No remaining capacity for this property.</div>}
            </div>
          )}
          {info?.reason === 'GLOBAL_LIMIT' && (
            <div className='rounded-md border border-destructive/30 bg-destructive/5 p-3'>
              <div className='flex justify-between text-xs'>
                <span className='font-medium'>Global Allowance</span>
                <span>{info.globalUsage} / {info.globalLimit}</span>
              </div>
              {remainingGlobal === 0 && <div className='mt-1 text-[11px] text-muted-foreground'>No remaining global capacity.</div>}
            </div>
          )}
          <div className='text-xs text-muted-foreground'>To continue adding assets, please request an upgrade. Creating a support ticket lets admins/managers review and adjust allocation.</div>
        </div>
        <DialogFooter className='flex gap-2 sm:gap-4'>
          <Button variant='outline' onClick={onClose}>Close</Button>
          {info && (
            <Button onClick={()=> onCreateTicket(info)} className='gap-2'>
              <LifeBuoy className='h-4 w-4'/> Raise Upgrade Ticket
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

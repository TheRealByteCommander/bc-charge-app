import { BottomSheet } from '../BottomSheet';
import { CommunityReportForm } from '../CommunityReportForm';

export function StationReportSheet({
  open,
  onClose,
  stationId,
}: {
  open: boolean;
  onClose: () => void;
  stationId: string;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Meldung senden">
      <CommunityReportForm stationId={stationId} embedded />
    </BottomSheet>
  );
}

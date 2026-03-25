// src/components/Booking/TapeChartDragOverlay.tsx
import { LABEL_W, CELL_W, CELL_H } from './TapeChartConstants';

type TapeChartDragOverlayProps = {
  drag: { rid: string; startCol: number; endCol: number; rowTop: number } | null;
};

export default function TapeChartDragOverlay({ drag }: TapeChartDragOverlayProps) {
  if (!drag) return null;
  const from = Math.min(drag.startCol, drag.endCol);
  const to = Math.max(drag.startCol, drag.endCol);
  const left = LABEL_W + from * CELL_W;
  const width = (to - from + 1) * CELL_W;
  return (
    <div
      className="pointer-events-none absolute z-[15] rounded border-2 border-blue-400 bg-blue-100/40"
      style={{ left, top: drag.rowTop, width, height: CELL_H }}
    />
  );
}

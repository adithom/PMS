// src/utils/roomHelpers.ts
import type { Room } from '../types';

export const getRoomId = (room: Room): string => (room as any).roomId ?? (room as any).id ?? '';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Lap = {
  part: string;
  timeSpentMs: number; // Time spent on this part in ms
};

export type TaskStatus = 'todo' | 'ongoing' | 'completed';

export type DayRecord = {
  day: number; // 1-20
  type: 'L' | 'R'; // Listening or Reading
  status: TaskStatus;
  totalTimeMs?: number;
  laps: Lap[];
  mistakes: Record<string, number>; // Part (e.g., '1', '5') -> Number of mistakes
  reasons: string[]; // Debug tags
};

interface AppState {
  records: DayRecord[];
  updateRecord: (day: number, type: 'L' | 'R', data: Partial<DayRecord>) => void;
  initRecords: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      records: [],
      updateRecord: (day, type, data) =>
        set((state) => {
          const newRecords = [...state.records];
          const index = newRecords.findIndex((r) => r.day === day && r.type === type);
          if (index !== -1) {
            newRecords[index] = { ...newRecords[index], ...data };
          } else {
            // Should not happen if initialized, but safe fallback
            newRecords.push({ day, type, status: 'ongoing', laps: [], mistakes: {}, reasons: [], ...data });
          }
          return { records: newRecords };
        }),
      initRecords: () =>
        set(() => {
          const records: DayRecord[] = [];
          for (let i = 1; i <= 10; i++) {
            records.push({ day: i, type: 'L', status: 'todo', laps: [], mistakes: {}, reasons: [] });
            records.push({ day: i, type: 'R', status: 'todo', laps: [], mistakes: {}, reasons: [] });
          }
          return { records };
        }),
    }),
    {
      name: 'cheese-toeic-storage',
    }
  )
);

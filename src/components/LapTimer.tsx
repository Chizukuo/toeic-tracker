'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Play, Square, Flag, AlertTriangle } from 'lucide-react';
import { useStore } from '@/store/useStore';

type LapData = {
  partName: string;
  expectedTimeMs: number;
};

const READING_LAPS: LapData[] = [
  { partName: 'Part 5 (10m)', expectedTimeMs: 10 * 60 * 1000 },
  { partName: 'Part 6 (8m)', expectedTimeMs: 8 * 60 * 1000 },
  { partName: 'Part 7 Single (25m)', expectedTimeMs: 25 * 60 * 1000 },
  { partName: 'Part 7 Multiple (32m)', expectedTimeMs: 32 * 60 * 1000 },
];

export function LapTimer({ day, type }: { day: number, type: 'L' | 'R' }) {
  const isListening = type === 'L';
  const totalTimeMs = isListening ? 45 * 60 * 1000 : 75 * 60 * 1000;
  
  const [timeLeft, setTimeLeft] = useState(totalTimeMs);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  const [currentLapIndex, setCurrentLapIndex] = useState(0);
  const [lapStartTime, setLapStartTime] = useState<number | null>(null);
  
  const startTimeRef = useRef<number | null>(null);
  const requestRef = useRef<number | null>(null);

  const updateRecord = useStore(state => state.updateRecord);

  const startTimer = () => {
    setIsRunning(true);
    startTimeRef.current = Date.now() - (totalTimeMs - timeLeft);
    if (!isListening && lapStartTime === null) {
      setLapStartTime(Date.now());
    }
  };

  const stopTimer = () => {
    setIsRunning(false);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  };

  const finishExam = () => {
    stopTimer();
    setIsFinished(true);
    // Auto record last lap if reading
    if (!isListening && lapStartTime !== null && currentLapIndex < READING_LAPS.length) {
      recordLapTime();
    }
    updateRecord(day, type, { status: 'completed' });
  };

  const recordLapTime = () => {
    if (!isRunning || lapStartTime === null) return;
    
    const now = Date.now();
    const timeSpentMs = now - lapStartTime;
    const partName = READING_LAPS[currentLapIndex].partName;

    useStore.getState().updateRecord(day, type, {
       laps: [...(useStore.getState().records.find(r => r.day === day && r.type === type)?.laps || []), { part: partName, timeSpentMs }]
    });

    setLapStartTime(now);
    setCurrentLapIndex(prev => prev + 1);

    if (currentLapIndex >= READING_LAPS.length - 1) {
      finishExam(); // Auto finish if all laps done
    }
  };

  useEffect(() => {
    const loop = () => {
      if (isRunning && startTimeRef.current !== null) {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(totalTimeMs - elapsed, 0);
        setTimeLeft(remaining);

        if (remaining <= 0) {
          finishExam();
        } else {
          requestRef.current = requestAnimationFrame(loop);
        }
      }
    };
    if (isRunning) {
      requestRef.current = requestAnimationFrame(loop);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isRunning]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isWarning = timeLeft < 5 * 60 * 1000; // < 5 mins
  const progressPercent = ((totalTimeMs - timeLeft) / totalTimeMs) * 100;

  return (
    <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl mb-6">
      <CardHeader className="pb-4 border-b border-zinc-800">
        <CardTitle className="text-xl flex items-center justify-between font-mono">
          <span className="text-zinc-400 font-sans text-sm tracking-wider uppercase">
            {isListening ? 'Strict Listening Mode' : 'Paced Reading Mode'}
          </span>
          <span className={`${isWarning ? 'text-red-500 animate-pulse' : 'text-amber-400'} text-3xl font-bold tracking-tighter`}>
            {formatTime(timeLeft)}
          </span>
        </CardTitle>
        <Progress value={progressPercent} className={`h-1 mt-2 ${isWarning ? '[&>div]:bg-red-500' : '[&>div]:bg-amber-400'}`} />
      </CardHeader>

      <CardContent className="pt-6">
        <div className="flex gap-4 mb-6">
          {!isRunning && !isFinished && (
            <Button onClick={startTimer} className="flex-1 bg-amber-400 hover:bg-amber-500 text-zinc-950 font-bold">
              <Play className="mr-2 h-4 w-4" fill="currentColor" /> 开始冲刺
            </Button>
          )}
          
          {!isListening && isRunning && currentLapIndex < READING_LAPS.length && (
            <Button onClick={recordLapTime} variant="outline" className="flex-1 border-amber-400/50 text-amber-400 hover:bg-amber-400/10">
              <Flag className="mr-2 h-4 w-4" /> 打点 ({READING_LAPS[currentLapIndex].partName.split(' ')[0]} 完成)
            </Button>
          )}

          {isRunning && (
            <Button onClick={finishExam} variant="destructive" className="flex-1 bg-red-900/40 text-red-400 hover:bg-red-900/60 border border-red-900/50">
              <Square className="mr-2 h-4 w-4" fill="currentColor" /> 强制交卷
            </Button>
          )}
        </div>

        {!isListening && (
          <div className="space-y-3">
            <h4 className="text-sm text-zinc-500 font-mono uppercase tracking-wider mb-2">Pacing Tracker</h4>
            <div className="grid grid-cols-4 gap-2">
              {READING_LAPS.map((lap, i) => {
                const isPassed = i < currentLapIndex;
                const isCurrent = i === currentLapIndex && isRunning;
                return (
                  <div key={i} className={`p-2 rounded border text-xs text-center flex flex-col justify-center
                    ${isPassed ? 'border-zinc-800 bg-zinc-800/50 text-zinc-400' : 
                      isCurrent ? 'border-amber-400/50 bg-amber-400/10 text-amber-400' : 
                      'border-zinc-800/50 text-zinc-600'}`}>
                    <span className="font-bold truncate" title={lap.partName}>{lap.partName.split(' ')[0] + ' ' + (lap.partName.split(' ')[1] || '')}</span>
                    <span className="text-[10px] opacity-70 mt-1">{lap.expectedTimeMs / 60000}m</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
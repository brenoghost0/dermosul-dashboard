import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: string;
  showLabel?: boolean; // Mostra o texto "A OFERTA TERMINA EM:"
  compact?: boolean;   // Versão compacta para overlays/CTAs
  className?: string;  // Classes adicionais para o wrapper
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate, showLabel = true, compact = false, className = '' }) => {
  const calculateTimeLeft = () => {
    const difference = +new Date(targetDate) - +new Date();
    let timeLeft = {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearTimeout(timer);
  });

  const timerComponents = (
    <div className={`flex items-center justify-center gap-1.5 text-center ${compact ? '' : ''}`}>
      {Object.entries(timeLeft).map(([interval, value]) => (
        <div key={interval} className="flex flex-col items-center">
          <span className={compact ? "text-sm font-bold text-amber-300 bg-black/50 px-1.5 py-0.5 rounded-md" : "text-xl font-bold text-yellow-400 bg-black bg-opacity-25 px-2 py-1 rounded-md"}>
            {String(value).padStart(2, '0')}
          </span>
          <span className={compact ? "text-[9px] uppercase text-gray-200 mt-0.5" : "text-[10px] uppercase text-gray-300 mt-1"}>
            {interval === 'days' ? 'Dias' : interval === 'hours' ? 'Horas' : interval === 'minutes' ? 'Min' : 'Seg'}
          </span>
        </div>
      ))}
    </div>
  );

  if (compact) {
    return (
      <div className={`bg-black/50 backdrop-blur text-white px-2 py-1 rounded-md shadow ${className}`}>
        {timerComponents}
      </div>
    );
  }

  return (
    <div className={`w-full max-w-md mx-auto bg-gray-900 bg-opacity-75 text-white p-2 rounded-lg my-4 text-center ${className}`}>
      {showLabel && <h3 className="text-xs font-semibold uppercase mb-2 text-gray-200">A OFERTA TERMINA EM:</h3>}
      {timerComponents}
    </div>
  );
};

export default CountdownTimer;

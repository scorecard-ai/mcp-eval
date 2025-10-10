"use client";

interface DonutChartProps {
  score: number; // 0-100
  size?: number; // diameter in pixels
  strokeWidth?: number;
  label?: string;
  showLabel?: boolean;
}

export default function DonutChart({
  score,
  size = 120,
  strokeWidth = 8,
  label,
  showLabel = true,
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const center = size / 2;

  // Lighthouse-style color coding
  const getColor = (score: number) => {
    if (score >= 90) return "#0cce6b"; // Green
    if (score >= 50) return "#ffa400"; // Orange
    return "#ff4e42"; // Red
  };

  const color = getColor(score);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#e0e0e0"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* Score text in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-bold"
            style={{
              fontSize: size * 0.28,
              color: color,
            }}
          >
            {Math.round(score)}
          </span>
        </div>
      </div>
      {showLabel && label && (
        <p className="mt-2 text-xs font-medium text-gray-700 text-center uppercase tracking-wide">
          {label}
        </p>
      )}
    </div>
  );
}

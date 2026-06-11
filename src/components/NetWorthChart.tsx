import React from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { HistoricalPoint, Currency, TimeRange } from '../types';

interface NetWorthChartProps {
  data: HistoricalPoint[];
  mode: 'FIAT' | 'BTC' | 'COMPARISON' | 'EXCHANGE'; // Comparison shows BTC vs USD Erosion
  displayCurrency: string;
  timeRange: TimeRange;
}

export const NetWorthChart: React.FC<NetWorthChartProps> = ({ data, mode, displayCurrency, timeRange }) => {
  const isComparison = mode === 'COMPARISON';
  const isExchange = mode === 'EXCHANGE';
  
  // Standard Chart Data Key
  // Note: For EXCHANGE mode, we are temporarily reusing 'totalValueUSD' to store the rate
  const dataKey = mode === 'BTC' ? 'totalValueBTC' : (displayCurrency === Currency.PHP && !isExchange ? 'totalValuePHP' : 'totalValueUSD');
  const color = mode === 'BTC' ? '#F7931A' : (isExchange ? '#e4e4e7' : '#10b981'); // Bitcoin Orange, Neutral, or Emerald Green

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        let dateLabel = label;
        // Re-format label for tooltip
        if (timeRange !== '1D' && !isExchange) {
             const d = new Date(label);
             if (!isNaN(d.getTime())) {
                 // Format: Nov 4
                 dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
             }
        }

      if (isComparison) {
        // Dual Tooltip
        const btcVal = payload[0].value;
        const inflationVal = payload[1]?.value;
        return (
           <div className="bg-zinc-900/95 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-2xl min-w-[120px]">
            <p className="text-zinc-400 text-xs font-medium mb-2">{dateLabel}</p>
            <div className="flex flex-col gap-2">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">BTC Price</span>
                <p className="text-[#F7931A] font-bold text-sm">${Math.round(btcVal).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Purchasing Power</span>
                <p className="text-rose-400 font-bold text-sm">{inflationVal.toFixed(1)}</p>
              </div>
            </div>
          </div>
        )
      }

      if (isExchange) {
           const val = payload[0].value;
           return (
            <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl">
              <p className="text-white font-bold text-sm">{val.toFixed(4)}</p>
            </div>
          );
      }

      // Standard Tooltip
      const val = payload[0].value;
      const formatted = mode === 'BTC' 
        ? `₿${val.toFixed(4)}` 
        : new Intl.NumberFormat('en-PH', { style: 'currency', currency: displayCurrency }).format(val);

      return (
        <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl min-w-[100px]">
          <p className="text-zinc-400 text-xs font-medium mb-1">{dateLabel}</p>
          <p className="text-white font-bold text-lg tracking-tight leading-none">{formatted}</p>
        </div>
      );
    }
    return null;
  };

  if (isComparison) {
    return (
      <div className="w-full h-full transition-all duration-500 ease-in-out">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
             <XAxis 
              dataKey="date" 
              hide={true}
            />
            {/* Left Axis: BTC Price */}
            <YAxis yAxisId="left" hide domain={['auto', 'auto']} />
            {/* Right Axis: Inflation Index */}
            <YAxis yAxisId="right" hide domain={[0, 110]} />
            
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#52525b', strokeWidth: 1 }} />
            
            {/* BTC Price Line */}
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="btcPrice" 
              stroke="#F7931A" 
              strokeWidth={3} 
              dot={false}
              animationDuration={1500}
            />
            {/* USD Inflation Line */}
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="inflationIndex" 
              stroke="#f43f5e" 
              strokeWidth={2} 
              strokeDasharray="4 4"
              dot={false}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="w-full h-full transition-all duration-500 ease-in-out">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`color${mode}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="date" 
            hide={true}
          />
          <YAxis 
            hide={true} // Clean look, value in tooltip
             domain={['auto', 'auto']} // Allow graph to stretch
          />
          <Tooltip content={<CustomTooltip />} cursor={!isExchange ? { stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4' } : false} />
          <Area 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={3}
            fillOpacity={1} 
            fill={`url(#color${mode})`} 
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
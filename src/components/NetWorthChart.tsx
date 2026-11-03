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
  
  // Chart renders the value already in the chosen display currency.
  const dataKey = mode === 'BTC' ? 'totalValueBTC' : (isExchange ? 'totalValueUSD' : 'totalValueDisplay');
  const color = mode === 'BTC' ? '#F7931A' : (isExchange ? '#e4e4e7' : '#399d74'); // Bitcoin orange, neutral, or Kaya secondary green

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        let dateLabel = label;
        if (!isExchange) {
             const d = new Date(label);
             if (!isNaN(d.getTime())) {
                 dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
             }
        }

      if (isComparison) {
        // Dual Tooltip
        const btcVal = payload[0].value;
        const inflationVal = payload[1]?.value;
        return (
           <div className="kaya-pop p-3 rounded-xl min-w-[120px]">
            <p className="text-textMuted text-xs font-medium mb-2">{dateLabel}</p>
            <div className="flex flex-col gap-2">
              <div>
                <span className="text-[10px] text-textFaint uppercase tracking-wider block">BTC Price</span>
                <p className="text-[#F7931A] font-bold text-sm">${Math.round(btcVal).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-[10px] text-textFaint uppercase tracking-wider block">Purchasing Power</span>
                <p className="text-rose-400 font-bold text-sm">{inflationVal.toFixed(1)}</p>
              </div>
            </div>
          </div>
        )
      }

      if (isExchange) {
           const val = payload[0].value;
           return (
            <div className="bg-textMuted text-paper px-3 py-2 rounded-xl shadow-lg shadow-black/30">
              <p className="text-sm font-semibold leading-none tabular-nums">{val.toFixed(4)}</p>
            </div>
          );
      }

      // Standard Tooltip
      const val = payload[0].value;
      const formatted = mode === 'BTC' 
        ? `₿${val.toFixed(4)}` 
        : new Intl.NumberFormat('en-PH', { style: 'currency', currency: displayCurrency }).format(val);

      return (
        // Same as the Income tooltip: muted fill, black text (matches the active toggles)
        <div className="bg-textMuted text-paper px-3 py-2 rounded-xl shadow-lg shadow-black/30">
          <p className="text-[11px] font-medium text-paper/60 leading-none mb-1">{dateLabel}</p>
          <p className="text-sm font-semibold leading-none tabular-nums">{formatted}</p>
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
          <Tooltip content={<CustomTooltip />} cursor={!isExchange ? { stroke: 'rgba(220,245,223,0.35)', strokeWidth: 1, strokeDasharray: '4 4' } : false} />
          <Area 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={2.5}
            fillOpacity={1} 
            fill={`url(#color${mode})`} 
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
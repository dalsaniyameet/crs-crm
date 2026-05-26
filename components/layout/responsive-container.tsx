/**
 * Responsive Container — handles mobile-friendly spacing and layouts
 */
export function ResponsiveContainer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-3 md:px-5 lg:px-6 py-3 md:py-4 lg:py-6 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Responsive Grid — auto-adjusts columns based on screen size
 */
export function ResponsiveGrid({ children, columns = 3, className = "" }: { children: React.ReactNode; columns?: number; className?: string }) {
  const gridClass = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  }[columns] || `grid-cols-1 md:grid-cols-${columns}`;

  return (
    <div className={`grid gap-3 md:gap-4 lg:gap-5 ${gridClass} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Responsive Section — header with mobile-friendly layout
 */
export function ResponsiveSection({ 
  title, 
  subtitle, 
  children, 
  action,
  className = "" 
}: { 
  title: string; 
  subtitle?: string; 
  children: React.ReactNode; 
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 mb-3 md:mb-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h2 className="text-base md:text-lg font-bold text-white truncate">{title}</h2>
          {subtitle && <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

/**
 * Responsive Table Wrapper — horizontal scroll on mobile
 */
export function ResponsiveTableWrapper({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-white/10 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Responsive Flex — stack on mobile, row on desktop
 */
export function ResponsiveFlex({ 
  children, 
  gap = 3, 
  className = "" 
}: { 
  children: React.ReactNode; 
  gap?: number;
  className?: string;
}) {
  const gapClass = {
    1: "gap-1 md:gap-2",
    2: "gap-2 md:gap-3",
    3: "gap-3 md:gap-4",
    4: "gap-4 md:gap-6",
  }[gap] || `gap-${gap}`;

  return (
    <div className={`flex flex-col md:flex-row items-start md:items-center ${gapClass} ${className}`}>
      {children}
    </div>
  );
}

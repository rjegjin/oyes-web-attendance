type DashboardCardProps = {
  label: string;
  value: number | string;
  tone?: "default" | "accent" | "warn";
};

export function DashboardCard({ label, value, tone = "default" }: DashboardCardProps) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

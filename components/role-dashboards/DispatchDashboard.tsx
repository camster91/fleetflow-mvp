import { CommandShell, Exceptions, FleetTotals, DecisionActions, type CommandCentreProps } from './CommandCentre'
export default function DispatchDashboard(props: CommandCentreProps) {
  const unassigned = props.availability.deliveries
    ? props.deliveries.filter((d) => !d.driver && d.status !== 'delivered')
    : []
  return (
    <CommandShell
      title="Dispatch command centre"
      partial={props.partial}
      retry={props.retry}
      availability={props.availability}
      restricted={props.restricted}
    >
      <Exceptions {...props} />
      <section>
        <h2 className="text-lg font-semibold">Assignments</h2>
        {!props.availability.deliveries ? (
          <p className="mt-3 text-sm text-slate-600">Delivery assignments unavailable.</p>
        ) : unassigned.length ? (
          <ul className="mt-3 space-y-2">
            {unassigned.slice(0, 5).map((d) => (
              <li className="rounded-lg border bg-white p-3" key={String(d.id)}>
                {d.customer}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No unassigned deliveries.</p>
        )}
      </section>
      <DecisionActions {...props} />
      <FleetTotals {...props} />
    </CommandShell>
  )
}

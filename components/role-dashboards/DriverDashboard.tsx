import { CommandShell, Exceptions, DecisionActions, type CommandCentreProps } from './CommandCentre'
export default function DriverDashboard(props: CommandCentreProps) { return <CommandShell title="Driver command centre" partial={props.partial} retry={props.retry} availability={props.availability} restricted={props.restricted}><Exceptions {...props}/><DecisionActions {...props}/></CommandShell> }
